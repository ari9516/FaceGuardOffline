package com.faceguardoffline;

import com.facebook.react.bridge.*;

public class LivenessModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "LivenessModule";

    public LivenessModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() { return MODULE_NAME; }

    @ReactMethod
    public void analyzeLiveness(String imageBase64, Promise promise) {
        // MOCK: Always return high liveness score to allow presentation to work
        promise.resolve(0.98);
    }

    @ReactMethod
    public void runPassivePAD(String imageBase64, Promise promise) {
        // MOCK: Always return high liveness score
        promise.resolve(0.95);
    }

    @ReactMethod
    public void computeLBPScore(String imageBase64, Promise promise) {
        // MOCK: Always return high liveness score
        promise.resolve(0.92);
    }

    @ReactMethod
    public void computeOpticalFlowScore(ReadableArray frames, Promise promise) {
        // MOCK: Always return high liveness score
        promise.resolve(0.90);
    }
}
