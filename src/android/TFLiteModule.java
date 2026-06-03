// android/app/src/main/java/com/faceguard/TFLiteModule.java
package com.faceguard;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.facebook.react.bridge.*;

import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.support.image.TensorImage;
import org.tensorflow.lite.support.tensorbuffer.TensorBuffer;

import java.io.FileInputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;

/**
 * TFLiteModule.java
 *
 * React Native native module bridging TFLite inference to JS.
 * Manages two model instances: 'recognizer' (MobileFaceNet) and 'detector' (Ultra-Light-Fast).
 *
 * Thread: All inference runs on a dedicated background thread to avoid blocking the UI.
 */
public class TFLiteModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "TFLiteModule";
    private static final int NUM_THREADS = 2;  // Optimal for mid-range CPUs

    // Model interpreters
    private Interpreter recognizerInterpreter;
    private Interpreter detectorInterpreter;
    private Interpreter padInterpreter;  // Passive Anti-Spoofing

    private final Map<String, Interpreter> interpreters = new HashMap<>();

    public TFLiteModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() { return MODULE_NAME; }

    /**
     * Load a TFLite model from file path.
     * @param modelPath  Absolute path to .tflite file
     * @param modelKey   Identifier: 'recognizer', 'detector', or 'pad'
     */
    @ReactMethod
    public void loadModel(String modelPath, String modelKey, Promise promise) {
        try {
            Interpreter.Options options = new Interpreter.Options();
            options.setNumThreads(NUM_THREADS);
            options.setUseXNNPACK(true);  // Enable XNNPACK delegate for 2x speedup

            MappedByteBuffer modelBuffer = loadModelFile(modelPath);
            Interpreter interpreter = new Interpreter(modelBuffer, options);
            interpreters.put(modelKey, interpreter);

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LOAD_ERROR", e.getMessage());
        }
    }

    /**
     * Run inference on a base64-encoded image.
     * Returns float array (embedding or detection output).
     */
    @ReactMethod
    public void runInference(String imageBase64, String modelKey, int width, int height, Promise promise) {
        Interpreter interpreter = interpreters.get(modelKey);
        if (interpreter == null) {
            promise.reject("NOT_LOADED", "Model '" + modelKey + "' not loaded");
            return;
        }

        try {
            // Decode base64 → Bitmap
            byte[] imageBytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            Bitmap resized = Bitmap.createScaledBitmap(bitmap, width, height, true);

            // Prepare input buffer (normalized float32)
            ByteBuffer inputBuffer = ByteBuffer.allocateDirect(4 * width * height * 3);
            inputBuffer.order(ByteOrder.nativeOrder());

            int[] pixels = new int[width * height];
            resized.getPixels(pixels, 0, width, 0, 0, width, height);

            for (int pixel : pixels) {
                // Normalize to [-1, 1]
                float r = ((pixel >> 16) & 0xFF) / 128.0f - 1.0f;
                float g = ((pixel >> 8) & 0xFF) / 128.0f - 1.0f;
                float b = (pixel & 0xFF) / 128.0f - 1.0f;
                inputBuffer.putFloat(r);
                inputBuffer.putFloat(g);
                inputBuffer.putFloat(b);
            }

            // Get output size from model
            int outputSize = interpreter.getOutputTensor(0).shape()[1];
            float[][] output = new float[1][outputSize];

            // Run inference
            long t0 = System.currentTimeMillis();
            interpreter.run(inputBuffer, output);
            long elapsed = System.currentTimeMillis() - t0;

            // Convert to JS array
            WritableArray result = Arguments.createArray();
            for (float v : output[0]) result.pushDouble(v);

            // Log inference time for benchmarking
            android.util.Log.d("TFLite", modelKey + " inference: " + elapsed + "ms");

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("INFERENCE_ERROR", e.getMessage());
        }
    }

    /**
     * Compute Laplacian variance (sharpness score) of an image.
     */
    @ReactMethod
    public void computeSharpness(String imageBase64, Promise promise) {
        try {
            byte[] bytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            Bitmap gray = toGrayscale(bmp);

            double variance = laplacianVariance(gray);
            promise.resolve(variance);
        } catch (Exception e) {
            promise.resolve(300.0); // default: assume ok
        }
    }

    /**
     * Compute mean brightness of image (0-1).
     */
    @ReactMethod
    public void computeBrightness(String imageBase64, Promise promise) {
        try {
            byte[] bytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            double brightness = meanBrightness(bmp);
            promise.resolve(brightness);
        } catch (Exception e) {
            promise.resolve(0.5);
        }
    }

    @ReactMethod
    public void preprocessImage(String imageBase64, int width, int height, Promise promise) {
        // Resize + normalize image, return as base64
        try {
            byte[] bytes = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            Bitmap resized = Bitmap.createScaledBitmap(bmp, width, height, true);
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            resized.compress(Bitmap.CompressFormat.JPEG, 95, baos);
            String result = Base64.encodeToString(baos.toByteArray(), Base64.DEFAULT);
            promise.resolve(result);
        } catch (Exception e) {
            promise.resolve(imageBase64);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private MappedByteBuffer loadModelFile(String path) throws Exception {
        FileInputStream fis = new FileInputStream(path);
        FileChannel channel = fis.getChannel();
        return channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size());
    }

    private Bitmap toGrayscale(Bitmap src) {
        Bitmap gray = Bitmap.createBitmap(src.getWidth(), src.getHeight(), Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(gray);
        android.graphics.ColorMatrix cm = new android.graphics.ColorMatrix();
        cm.setSaturation(0);
        android.graphics.Paint paint = new android.graphics.Paint();
        paint.setColorFilter(new android.graphics.ColorMatrixColorFilter(cm));
        canvas.drawBitmap(src, 0, 0, paint);
        return gray;
    }

    private double laplacianVariance(Bitmap bmp) {
        int w = bmp.getWidth(), h = bmp.getHeight();
        double sum = 0, sumSq = 0;
        int n = 0;
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int c = (bmp.getPixel(x, y) & 0xFF);
                int lap = 4 * c
                    - (bmp.getPixel(x - 1, y) & 0xFF)
                    - (bmp.getPixel(x + 1, y) & 0xFF)
                    - (bmp.getPixel(x, y - 1) & 0xFF)
                    - (bmp.getPixel(x, y + 1) & 0xFF);
                sum += lap;
                sumSq += (double) lap * lap;
                n++;
            }
        }
        double mean = sum / n;
        return (sumSq / n) - mean * mean;
    }

    private double meanBrightness(Bitmap bmp) {
        long sum = 0;
        int w = bmp.getWidth(), h = bmp.getHeight();
        for (int y = 0; y < h; y += 2) {
            for (int x = 0; x < w; x += 2) {
                int p = bmp.getPixel(x, y);
                int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, b = p & 0xFF;
                sum += (int)(0.299 * r + 0.587 * g + 0.114 * b);
            }
        }
        return (sum / ((w / 2.0) * (h / 2.0))) / 255.0;
    }
}
