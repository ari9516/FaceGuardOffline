// ios/FaceGuard/TFLiteModule.swift
import Foundation
import TensorFlowLite
import UIKit

/**
 * TFLiteModule.swift
 *
 * React Native native module for TFLite inference on iOS.
 * Uses TensorFlowLiteSwift pod (Apache-2.0, open-source).
 * Supports Metal delegate for GPU acceleration on A-series chips (optional).
 */
@objc(TFLiteModule)
class TFLiteModule: NSObject {

  private var interpreters: [String: Interpreter] = [:]

  // ─── Load Model ─────────────────────────────────────────────────────────────
  @objc
  func loadModel(_ modelPath: String, modelKey: String,
                 resolve: @escaping RCTPromiseResolveBlock,
                 reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        var options = Interpreter.Options()
        options.threadCount = 2

        // Try Metal delegate first (GPU), fall back to CPU
        var delegates: [Delegate] = []
        if let metalDelegate = MetalDelegate() {
          delegates.append(metalDelegate)
        }

        let interpreter = try Interpreter(modelPath: modelPath, options: options, delegates: delegates)
        try interpreter.allocateTensors()
        self.interpreters[modelKey] = interpreter
        resolve(true)
      } catch {
        // Retry without GPU delegate
        do {
          var options = Interpreter.Options()
          options.threadCount = 2
          let interpreter = try Interpreter(modelPath: modelPath, options: options)
          try interpreter.allocateTensors()
          self.interpreters[modelKey] = interpreter
          resolve(true)
        } catch {
          reject("LOAD_ERROR", error.localizedDescription, error)
        }
      }
    }
  }

  // ─── Run Inference ──────────────────────────────────────────────────────────
  @objc
  func runInference(_ imageBase64: String, modelKey: String,
                    width: Int, height: Int,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
    guard let interpreter = interpreters[modelKey] else {
      reject("NOT_LOADED", "Model '\(modelKey)' not loaded", nil)
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        guard let imageData = Data(base64Encoded: imageBase64),
              let uiImage = UIImage(data: imageData),
              let cgImage = uiImage.cgImage else {
          reject("IMAGE_ERROR", "Invalid image data", nil)
          return
        }

        // Resize and normalize image to Float32 buffer
        guard let inputData = self.imageToFloat32Buffer(cgImage, width: width, height: height) else {
          reject("PREPROCESS_ERROR", "Image preprocessing failed", nil)
          return
        }

        let inputTensor = try interpreter.input(at: 0)
        try interpreter.copy(inputData, toInputAt: 0)

        let t0 = Date()
        try interpreter.invoke()
        let elapsed = Date().timeIntervalSince(t0) * 1000
        NSLog("[TFLite] \(modelKey) inference: \(String(format: "%.1f", elapsed))ms")

        let outputTensor = try interpreter.output(at: 0)
        let outputData = outputTensor.data
        let outputCount = outputData.count / MemoryLayout<Float>.size
        var outputArray = [Float](repeating: 0, count: outputCount)
        outputData.withUnsafeBytes { rawBuffer in
          let floatBuffer = rawBuffer.bindMemory(to: Float.self)
          for i in 0..<outputCount { outputArray[i] = floatBuffer[i] }
        }

        resolve(outputArray.map { Double($0) })
      } catch {
        reject("INFERENCE_ERROR", error.localizedDescription, error)
      }
    }
  }

  // ─── Sharpness ─────────────────────────────────────────────────────────────
  @objc
  func computeSharpness(_ imageBase64: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let data = Data(base64Encoded: imageBase64),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      resolve(300.0)
      return
    }
    let variance = laplacianVariance(cgImage)
    resolve(variance)
  }

  // ─── Brightness ────────────────────────────────────────────────────────────
  @objc
  func computeBrightness(_ imageBase64: String,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    guard let data = Data(base64Encoded: imageBase64),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      resolve(0.5)
      return
    }
    resolve(meanBrightness(cgImage))
  }

  @objc
  func preprocessImage(_ imageBase64: String, width: Int, height: Int,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let data = Data(base64Encoded: imageBase64),
          let image = UIImage(data: data) else {
      resolve(imageBase64)
      return
    }
    let resized = resizeImage(image, to: CGSize(width: width, height: height))
    if let jpegData = resized.jpegData(compressionQuality: 0.95) {
      resolve(jpegData.base64EncodedString())
    } else {
      resolve(imageBase64)
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private func imageToFloat32Buffer(_ cgImage: CGImage, width: Int, height: Int) -> Data? {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var pixelData = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(
      data: &pixelData,
      width: width, height: height,
      bitsPerComponent: 8, bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { return nil }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

    var floatBuffer = [Float](repeating: 0, count: width * height * 3)
    for i in 0..<(width * height) {
      floatBuffer[i * 3 + 0] = Float(pixelData[i * 4 + 0]) / 128.0 - 1.0  // R
      floatBuffer[i * 3 + 1] = Float(pixelData[i * 4 + 1]) / 128.0 - 1.0  // G
      floatBuffer[i * 3 + 2] = Float(pixelData[i * 4 + 2]) / 128.0 - 1.0  // B
    }

    return Data(bytes: floatBuffer, count: floatBuffer.count * MemoryLayout<Float>.size)
  }

  private func laplacianVariance(_ cgImage: CGImage) -> Double {
    let w = cgImage.width, h = cgImage.height
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &pixels, width: w, height: h,
                        bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    ctx?.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

    var sum: Double = 0, sumSq: Double = 0, n: Double = 0
    for y in 1..<(h - 1) {
      for x in 1..<(w - 1) {
        let c = Double((pixels[(y * w + x) * 4] + pixels[(y * w + x) * 4 + 1] + pixels[(y * w + x) * 4 + 2]) / 3)
        let t = Double((pixels[((y-1) * w + x) * 4] + pixels[((y-1) * w + x) * 4 + 1] + pixels[((y-1) * w + x) * 4 + 2]) / 3)
        let b = Double((pixels[((y+1) * w + x) * 4] + pixels[((y+1) * w + x) * 4 + 1] + pixels[((y+1) * w + x) * 4 + 2]) / 3)
        let l = Double((pixels[(y * w + (x-1)) * 4] + pixels[(y * w + (x-1)) * 4 + 1] + pixels[(y * w + (x-1)) * 4 + 2]) / 3)
        let r = Double((pixels[(y * w + (x+1)) * 4] + pixels[(y * w + (x+1)) * 4 + 1] + pixels[(y * w + (x+1)) * 4 + 2]) / 3)
        let lap = 4 * c - t - b - l - r
        sum += lap; sumSq += lap * lap; n += 1
      }
    }
    let mean = sum / n
    return (sumSq / n) - mean * mean
  }

  private func meanBrightness(_ cgImage: CGImage) -> Double {
    let w = cgImage.width, h = cgImage.height
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &pixels, width: w, height: h,
                        bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    ctx?.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))
    var total: Double = 0
    let step = 4
    var count: Double = 0
    for i in stride(from: 0, to: pixels.count, by: step * 4) {
      let r = Double(pixels[i]), g = Double(pixels[i+1]), b = Double(pixels[i+2])
      total += 0.299 * r + 0.587 * g + 0.114 * b
      count += 1
    }
    return (total / count) / 255.0
  }

  private func resizeImage(_ image: UIImage, to size: CGSize) -> UIImage {
    UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
    image.draw(in: CGRect(origin: .zero, size: size))
    let resized = UIGraphicsGetImageFromCurrentImageContext() ?? image
    UIGraphicsEndImageContext()
    return resized
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
