/**
 * SyncService.ts
 *
 * Offline-to-online sync with AWS S3 + DynamoDB (Datalake 3.0 backend).
 *
 * Sync Strategy:
 *   1. Network detection via NetInfo
 *   2. Batch upload pending records to API Gateway → Lambda → DynamoDB
 *   3. Mark records as synced in local SQLite
 *   4. Purge synced records (configurable retention period)
 *   5. Log sync result
 *
 * Security: Records encrypted in transit (TLS 1.3), at rest (AES-256).
 * Retry: Exponential backoff (3 attempts, max 30s delay).
 */

import NetInfo from '@react-native-community/netinfo';
import { DatabaseService, AttendanceRecord } from './DatabaseService';
import { AESEncryption } from '../utils/AESEncryption';
import DeviceInfo from 'react-native-device-info';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE_URL = 'https://api.datalake3.example.com/v1';   // Replace with actual endpoint
const SYNC_BATCH_SIZE = 50;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 8000, 30000]; // ms
const PURGE_AFTER_SYNC = true;

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  syncInProgress: boolean;
  lastError: string | null;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  purgedCount: number;
  durationMs: number;
  error?: string;
}

// ─── Sync Service ─────────────────────────────────────────────────────────────
export const SyncService = {

  async checkConnectivity(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  },

  /**
   * Main sync function - call when network is available.
   */
  async syncPendingRecords(
    authToken: string,
    onProgress?: (synced: number, total: number) => void,
  ): Promise<SyncResult> {
    const start = Date.now();
    const isOnline = await this.checkConnectivity();

    if (!isOnline) {
      return {
        success: false,
        recordsSynced: 0,
        recordsFailed: 0,
        purgedCount: 0,
        durationMs: 0,
        error: 'No internet connection',
      };
    }

    const pendingRecords = await DatabaseService.getPendingSyncRecords();

    if (pendingRecords.length === 0) {
      return { success: true, recordsSynced: 0, recordsFailed: 0, purgedCount: 0, durationMs: Date.now() - start };
    }

    let totalSynced = 0;
    let totalFailed = 0;
    const syncedIds: string[] = [];

    // Process in batches
    for (let i = 0; i < pendingRecords.length; i += SYNC_BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + SYNC_BATCH_SIZE);

      try {
        const successIds = await this.uploadBatchWithRetry(batch, authToken);
        syncedIds.push(...successIds);
        totalSynced += successIds.length;
        totalFailed += (batch.length - successIds.length);
        onProgress?.(totalSynced, pendingRecords.length);
      } catch (err) {
        totalFailed += batch.length;
      }
    }

    // Mark synced records
    if (syncedIds.length > 0) {
      await DatabaseService.markRecordsSynced(syncedIds);
    }

    // Purge synced records if configured
    let purgedCount = 0;
    if (PURGE_AFTER_SYNC && syncedIds.length > 0) {
      purgedCount = await DatabaseService.purgeSync();
    }

    // Log sync result
    await this.logSync({
      syncedAt: Date.now(),
      recordsSynced: totalSynced,
      status: totalFailed === 0 ? 'SUCCESS' : 'PARTIAL',
      error: totalFailed > 0 ? `${totalFailed} records failed` : undefined,
    });

    return {
      success: totalFailed === 0,
      recordsSynced: totalSynced,
      recordsFailed: totalFailed,
      purgedCount,
      durationMs: Date.now() - start,
    };
  },

  async uploadBatchWithRetry(
    records: AttendanceRecord[],
    authToken: string,
  ): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.uploadBatch(records, authToken);
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await this.sleep(RETRY_DELAYS[attempt]);
        }
      }
    }

    throw lastError ?? new Error('Upload failed after retries');
  },

  async uploadBatch(
    records: AttendanceRecord[],
    authToken: string,
  ): Promise<string[]> {
    const deviceId = await DeviceInfo.getUniqueId();

    // Prepare payload - strip sensitive image snapshots unless configured
    const payload = {
      deviceId,
      appVersion: '1.0.0',
      records: records.map(r => ({
        id: r.id,
        userId: r.userId,
        timestamp: r.timestamp,
        locationType: r.locationType,
        latitude: r.latitude,
        longitude: r.longitude,
        livenessScore: r.livenessScore,
        recognitionScore: r.recognitionScore,
        status: r.status,
        // Image snapshot stripped for bandwidth; audit images stay local
      })),
    };

    const response = await fetch(`${API_BASE_URL}/attendance/bulk-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'X-Device-ID': deviceId,
        'X-App-Version': '1.0.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    // API returns list of successfully saved record IDs
    return result.savedIds ?? records.map(r => r.id);
  },

  /**
   * Manual purge - removes all synced records from local DB.
   * Call after confirmed sync or to free space.
   */
  async purgeLocalSyncedRecords(): Promise<number> {
    return DatabaseService.purgeSync();
  },

  async getStatus(): Promise<SyncStatus> {
    const isOnline = await this.checkConnectivity();
    const pendingCount = await DatabaseService.getPendingCount();

    return {
      isOnline,
      lastSyncAt: null, // Load from AsyncStorage in real app
      pendingCount,
      syncInProgress: false,
      lastError: null,
    };
  },

  async logSync(entry: {
    syncedAt: number;
    recordsSynced: number;
    status: string;
    error?: string;
  }): Promise<void> {
    // Store sync log in DB
    const id = `sync_${entry.syncedAt}`;
    // DatabaseService.insertSyncLog(id, entry) -- simplified
    console.log('[Sync] Log:', entry);
  },

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};
