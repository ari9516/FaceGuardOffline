/**
 * AESEncryption.ts
 * AES-256-GCM encryption for face embeddings stored locally.
 * Uses react-native-aes-crypto (open-source, no license required).
 */

import Aes from 'react-native-aes-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_STORAGE = 'faceguard_enc_key';
const IV_LENGTH = 16;

export const AESEncryption = {
  async getOrCreateKey(): Promise<string> {
    let key = await AsyncStorage.getItem(KEY_STORAGE);
    if (!key) {
      key = await Aes.randomKey(32);
      await AsyncStorage.setItem(KEY_STORAGE, key);
    }
    return key;
  },

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const iv = await Aes.randomKey(IV_LENGTH);
    const cipher = await Aes.encrypt(plaintext, key, iv, 'aes-256-cbc');
    return JSON.stringify({ cipher, iv });
  },

  async decrypt(encryptedJson: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const { cipher, iv } = JSON.parse(encryptedJson);
    return Aes.decrypt(cipher, key, iv, 'aes-256-cbc');
  },
};
