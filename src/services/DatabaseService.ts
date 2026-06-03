/**
 * DatabaseService.ts
 *
 * Offline-first SQLite storage for face templates and attendance records.
 * Uses react-native-sqlite-storage (open-source, no license required).
 *
 * Tables:
 *   - users         : enrolled personnel
 *   - face_templates: encrypted face embeddings (AES-256)
 *   - attendance    : local attendance records (pending sync)
 *   - sync_log      : sync history
 */

import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { AESEncryption } from '../utils/AESEncryption';

SQLite.enablePromise(true);

export interface User {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  enrolledAt: number;
  isActive: boolean;
  thumbnailBase64?: string;
}

export interface FaceTemplate {
  userId: string;
  embeddingIndex: number;       // Up to 5 templates per user
  encryptedEmbedding: string;   // AES-256 encrypted base64
  capturedAt: number;
  lightingCondition: 'INDOOR' | 'OUTDOOR' | 'LOW_LIGHT' | 'HARSH_SUN';
  quality: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  timestamp: number;
  locationType: string;          // GPS location name
  latitude?: number;
  longitude?: number;
  livenessScore: number;
  recognitionScore: number;
  status: 'PUNCH_IN' | 'PUNCH_OUT';
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  deviceId: string;
  imageSnapshot?: string;        // Optional base64 thumbnail for audit
}

// ─── DB Singleton ─────────────────────────────────────────────────────────────
let db: SQLiteDatabase | null = null;

export const DatabaseService = {

  async initialize(): Promise<void> {
    db = await SQLite.openDatabase({
      name: 'faceguard.db',
      location: 'default',
    });
    await this.runMigrations();
    console.log('[DB] Initialized');
  },

  async runMigrations(): Promise<void> {
    if (!db) throw new Error('DB not initialized');

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        employee_id TEXT UNIQUE NOT NULL,
        department TEXT,
        enrolled_at INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        thumbnail TEXT
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS face_templates (
        user_id TEXT NOT NULL,
        embedding_index INTEGER NOT NULL,
        encrypted_embedding TEXT NOT NULL,
        captured_at INTEGER NOT NULL,
        lighting_condition TEXT DEFAULT 'INDOOR',
        quality REAL DEFAULT 0.8,
        PRIMARY KEY (user_id, embedding_index),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        location_type TEXT,
        latitude REAL,
        longitude REAL,
        liveness_score REAL NOT NULL,
        recognition_score REAL NOT NULL,
        status TEXT NOT NULL,
        sync_status TEXT DEFAULT 'PENDING',
        device_id TEXT NOT NULL,
        image_snapshot TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        synced_at INTEGER,
        records_synced INTEGER,
        status TEXT,
        error_message TEXT
      );
    `);

    // Indexes for performance
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_attendance_sync ON attendance(sync_status);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id, timestamp);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_templates_user ON face_templates(user_id);
    `);
  },

  // ─── User Operations ────────────────────────────────────────────────────────

  async insertUser(user: User): Promise<void> {
    if (!db) throw new Error('DB not initialized');
    await db.executeSql(
      `INSERT INTO users (id, name, employee_id, department, enrolled_at, is_active, thumbnail)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [user.id, user.name, user.employeeId, user.department, user.enrolledAt, user.isActive ? 1 : 0, user.thumbnailBase64 ?? null],
    );
  },

  async getAllUsers(): Promise<User[]> {
    if (!db) throw new Error('DB not initialized');
    const [result] = await db.executeSql(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY name;',
    );
    return Array.from({ length: result.rows.length }, (_, i) => {
      const row = result.rows.item(i);
      return {
        id: row.id,
        name: row.name,
        employeeId: row.employee_id,
        department: row.department,
        enrolledAt: row.enrolled_at,
        isActive: row.is_active === 1,
        thumbnailBase64: row.thumbnail,
      };
    });
  },

  async deleteUser(userId: string): Promise<void> {
    if (!db) throw new Error('DB not initialized');
    await db.transaction(async tx => {
      await tx.executeSql('DELETE FROM face_templates WHERE user_id = ?;', [userId]);
      await tx.executeSql('DELETE FROM users WHERE id = ?;', [userId]);
    });
  },

  // ─── Face Template Operations ───────────────────────────────────────────────

  async saveTemplate(template: FaceTemplate): Promise<void> {
    if (!db) throw new Error('DB not initialized');
    await db.executeSql(
      `INSERT OR REPLACE INTO face_templates
       (user_id, embedding_index, encrypted_embedding, captured_at, lighting_condition, quality)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        template.userId,
        template.embeddingIndex,
        template.encryptedEmbedding,
        template.capturedAt,
        template.lightingCondition,
        template.quality,
      ],
    );
  },

  async getTemplatesForUser(userId: string): Promise<number[][]> {
    if (!db) throw new Error('DB not initialized');
    const [result] = await db.executeSql(
      'SELECT encrypted_embedding FROM face_templates WHERE user_id = ? ORDER BY quality DESC;',
      [userId],
    );

    const embeddings: number[][] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      // Decrypt embedding
      const decrypted = await AESEncryption.decrypt(row.encrypted_embedding);
      embeddings.push(JSON.parse(decrypted));
    }
    return embeddings;
  },

  async getAllTemplates(): Promise<Array<{ userId: string; userName: string; embeddings: number[][] }>> {
    if (!db) throw new Error('DB not initialized');

    const users = await this.getAllUsers();
    const result = [];

    for (const user of users) {
      const embeddings = await this.getTemplatesForUser(user.id);
      if (embeddings.length > 0) {
        result.push({ userId: user.id, userName: user.name, embeddings });
      }
    }

    return result;
  },

  // ─── Attendance Operations ──────────────────────────────────────────────────

  async insertAttendance(record: AttendanceRecord): Promise<void> {
    if (!db) throw new Error('DB not initialized');
    await db.executeSql(
      `INSERT INTO attendance
       (id, user_id, timestamp, location_type, latitude, longitude,
        liveness_score, recognition_score, status, sync_status, device_id, image_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.userId,
        record.timestamp,
        record.locationType,
        record.latitude ?? null,
        record.longitude ?? null,
        record.livenessScore,
        record.recognitionScore,
        record.status,
        record.syncStatus,
        record.deviceId,
        record.imageSnapshot ?? null,
      ],
    );
  },

  async getPendingSyncRecords(): Promise<AttendanceRecord[]> {
    if (!db) throw new Error('DB not initialized');
    const [result] = await db.executeSql(
      "SELECT * FROM attendance WHERE sync_status = 'PENDING' ORDER BY timestamp ASC LIMIT 100;",
    );
    return Array.from({ length: result.rows.length }, (_, i) => {
      const r = result.rows.item(i);
      return {
        id: r.id, userId: r.user_id, timestamp: r.timestamp,
        locationType: r.location_type, latitude: r.latitude, longitude: r.longitude,
        livenessScore: r.liveness_score, recognitionScore: r.recognition_score,
        status: r.status, syncStatus: r.sync_status, deviceId: r.device_id,
        imageSnapshot: r.image_snapshot,
      } as AttendanceRecord;
    });
  },

  async markRecordsSynced(ids: string[]): Promise<void> {
    if (!db) throw new Error('DB not initialized');
    const placeholders = ids.map(() => '?').join(', ');
    await db.executeSql(
      `UPDATE attendance SET sync_status = 'SYNCED' WHERE id IN (${placeholders});`,
      ids,
    );
  },

  async purgeSync(): Promise<number> {
    if (!db) throw new Error('DB not initialized');
    const [result] = await db.executeSql(
      "DELETE FROM attendance WHERE sync_status = 'SYNCED';",
    );
    return result.rowsAffected;
  },

  async getPendingCount(): Promise<number> {
    if (!db) throw new Error('DB not initialized');
    const [result] = await db.executeSql(
      "SELECT COUNT(*) as cnt FROM attendance WHERE sync_status = 'PENDING';",
    );
    return result.rows.item(0).cnt;
  },

  async getTodayAttendance(userId: string): Promise<AttendanceRecord[]> {
    if (!db) throw new Error('DB not initialized');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [result] = await db.executeSql(
      'SELECT * FROM attendance WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC;',
      [userId, startOfDay.getTime()],
    );
    return Array.from({ length: result.rows.length }, (_, i) => result.rows.item(i));
  },
};
