/**
 * ModelService.ts
 * Copies bundled TFLite models from app assets to document directory on first run.
 * Models bundled sizes:
 *   mobilefacenet_int8.tflite        → 4.8 MB
 *   face_detector_ultra_light.tflite → 1.1 MB
 *   liveness_minivgg_int8.tflite     → 2.1 MB
 *   Total AI model footprint         → ~8 MB
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MODEL_VERSION_KEY = 'model_version';
const CURRENT_MODEL_VERSION = '1.0.0';

const MODELS = [
  'mobilefacenet_int8.tflite',
  'face_detector_ultra_light.tflite',
  'liveness_minivgg_int8.tflite',
];

export const ModelService = {
  async loadModel(): Promise<void> {
    console.log('[ModelService] Mock model loading (bypassed file copy)');
  },

  async copyModelsFromAssets(): Promise<void> {
    for (const model of MODELS) {
      const destPath = `${RNFS.DocumentDirectoryPath}/${model}`;
      try {
        const exists = await RNFS.exists(destPath);
        if (!exists) {
          if (Platform.OS === 'android') {
            await RNFS.copyFileAssets(`models/${model}`, destPath);
          } else {
            const srcPath = `${RNFS.MainBundlePath}/models/${model}`;
            await RNFS.copyFile(srcPath, destPath);
          }
        }
      } catch (err) {
        console.warn(`[ModelService] Failed to copy ${model} from assets:`, err);
        // We continue anyway so the app can boot
      }
    }
    console.log('[ModelService] Model check complete');
  },

  async getModelSizes(): Promise<Record<string, number>> {
    const sizes: Record<string, number> = {};
    for (const model of MODELS) {
      const path = `${RNFS.DocumentDirectoryPath}/${model}`;
      try {
        const stat = await RNFS.stat(path);
        sizes[model] = stat.size;
      } catch {
        sizes[model] = 0;
      }
    }
    return sizes;
  },
};
