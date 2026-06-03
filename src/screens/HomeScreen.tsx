/**
 * Screens index: HomeScreen, ResultScreen, SyncScreen, SplashScreen, AdminScreen
 */

// ─── HomeScreen ───────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFaceGuard } from '../context/FaceGuardContext';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state, refreshSyncStatus } = useFaceGuard();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    refreshSyncStatus();
  }, []);

  return (
    <Animated.View style={[styles.home, { opacity: fadeAnim }]}>
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.homeAppName}>FaceGuard</Text>
          <Text style={styles.homeTagline}>Offline · Secure · Accurate</Text>
        </View>
        <View style={[styles.netBadge, { backgroundColor: state.networkOnline ? '#00FF8820' : '#FF444420' }]}>
          <View style={[styles.netDot, { backgroundColor: state.networkOnline ? '#00FF88' : '#FF4444' }]} />
          <Text style={[styles.netText, { color: state.networkOnline ? '#00FF88' : '#FF4444' }]}>
            {state.networkOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{state.users.length}</Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: state.pendingCount > 0 ? '#FFB800' : '#00FF88' }]}>
            {state.pendingCount}
          </Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>~8MB</Text>
          <Text style={styles.statLabel}>Model Size</Text>
        </View>
      </View>

      <ScrollView style={styles.actions} contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.primaryAction]}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.actionIcon}>🔍</Text>
          <View>
            <Text style={styles.actionTitle}>Authenticate</Text>
            <Text style={styles.actionSub}>Verify identity with face recognition</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Enroll')}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <View>
            <Text style={styles.actionTitle}>Enroll Personnel</Text>
            <Text style={styles.actionSub}>Register a new face template</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !state.networkOnline && styles.disabledBtn]}
          onPress={() => navigation.navigate('Sync')}
          disabled={!state.networkOnline && state.pendingCount === 0}
        >
          <Text style={styles.actionIcon}>☁️</Text>
          <View>
            <Text style={styles.actionTitle}>Sync to AWS</Text>
            <Text style={styles.actionSub}>
              {state.pendingCount > 0
                ? `${state.pendingCount} records pending upload`
                : 'All records synced'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Admin')}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <View>
            <Text style={styles.actionTitle}>Admin Panel</Text>
            <Text style={styles.actionSub}>Manage users and view logs</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

// ─── ResultScreen ─────────────────────────────────────────────────────────────
export const ResultScreen: React.FC = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { success, userName, confidence, inferenceTimeMs, livenessScore, reason, spoofType } = route.params ?? {};
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100 }).start();
  }, []);

  const getReasonText = () => {
    switch (reason) {
      case 'LIVENESS_FAILED': return `Anti-spoofing check failed${spoofType ? ` (${spoofType} attack detected)` : ''}`;
      case 'NO_MATCH': return 'Face not recognized. Not in enrolled database.';
      case 'NO_USERS_ENROLLED': return 'No users enrolled yet.';
      case 'ERROR': return 'Processing error. Please try again.';
      default: return '';
    }
  };

  return (
    <View style={styles.resultContainer}>
      <Animated.View style={[styles.resultCard, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.resultIcon}>{success ? '✅' : '❌'}</Text>
        <Text style={[styles.resultTitle, { color: success ? '#00FF88' : '#FF4444' }]}>
          {success ? 'Access Granted' : 'Access Denied'}
        </Text>

        {success ? (
          <>
            <Text style={styles.resultName}>{userName}</Text>
            <View style={styles.resultMetrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{(confidence * 100).toFixed(1)}%</Text>
                <Text style={styles.metricLabel}>Match Score</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{inferenceTimeMs}ms</Text>
                <Text style={styles.metricLabel}>Inference</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{(livenessScore * 100).toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>Liveness</Text>
              </View>
            </View>
            <View style={styles.savedBadge}>
              <Text style={styles.savedText}>📝 Attendance logged · Pending sync</Text>
            </View>
          </>
        ) : (
          <Text style={styles.reasonText}>{getReasonText()}</Text>
        )}
      </Animated.View>

      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.replace('Auth')}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.homeText}>Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── SyncScreen ───────────────────────────────────────────────────────────────
export const SyncScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state, refreshSyncStatus } = useFaceGuard();
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<any>(null);
  const [progress, setProgress] = React.useState(0);
  const { SyncService } = require('../services/SyncService');

  const handleSync = async () => {
    setSyncing(true);
    setProgress(0);
    try {
      const result = await SyncService.syncPendingRecords(
        'AUTH_TOKEN_FROM_SECURE_STORAGE',
        (synced: number, total: number) => setProgress(synced / total),
      );
      setSyncResult(result);
      await refreshSyncStatus();
    } catch (err) {
      setSyncResult({ success: false, error: String(err) });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.syncContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.syncTitle}>Sync to AWS</Text>
      <Text style={styles.syncSub}>Upload pending attendance records to Datalake 3.0</Text>

      <View style={styles.syncStatusCard}>
        <Text style={styles.syncStatusLabel}>Pending Records</Text>
        <Text style={styles.syncStatusValue}>{state.pendingCount}</Text>
        <Text style={styles.syncStatusLabel}>Network</Text>
        <Text style={[styles.syncStatusValue, { color: state.networkOnline ? '#00FF88' : '#FF4444' }]}>
          {state.networkOnline ? '● Connected' : '● No Connection'}
        </Text>
      </View>

      {syncing && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {syncResult && (
        <View style={[styles.syncResultBox, { borderColor: syncResult.success ? '#00FF8840' : '#FF444440' }]}>
          <Text style={{ color: syncResult.success ? '#00FF88' : '#FF4444', fontWeight: '700', fontSize: 15 }}>
            {syncResult.success ? '✅ Sync Complete' : '❌ Sync Failed'}
          </Text>
          {syncResult.success && (
            <Text style={styles.syncResultDetail}>
              {syncResult.recordsSynced} uploaded · {syncResult.purgedCount} purged locally
            </Text>
          )}
          {!syncResult.success && <Text style={styles.syncResultDetail}>{syncResult.error}</Text>}
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, (!state.networkOnline || syncing) && styles.disabledBtn]}
        onPress={handleSync}
        disabled={!state.networkOnline || syncing}
      >
        <Text style={styles.primaryBtnText}>{syncing ? 'Syncing…' : 'Start Sync'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── SplashScreen ─────────────────────────────────────────────────────────────
export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => navigation.replace('Home'), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.splashContainer}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={styles.splashIcon}>🛡️</Text>
        <Text style={styles.splashTitle}>FaceGuard</Text>
        <Text style={styles.splashSub}>Offline · Secure · Instant</Text>
        <Text style={styles.splashPowered}>Powered by MobileFaceNet · TFLite</Text>
      </Animated.View>
    </View>
  );
};

// ─── AdminScreen ──────────────────────────────────────────────────────────────
export const AdminScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state, refreshUsers } = useFaceGuard();

  const handleDelete = async (userId: string) => {
    const { DatabaseService } = require('../services/DatabaseService');
    await DatabaseService.deleteUser(userId);
    await refreshUsers();
  };

  return (
    <View style={styles.adminContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.syncTitle}>Enrolled Users</Text>
      <ScrollView style={{ flex: 1 }}>
        {state.users.length === 0 && (
          <Text style={styles.emptyText}>No users enrolled yet.</Text>
        )}
        {state.users.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{user.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userMeta}>{user.employeeId} · {user.department}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(user.id)}>
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const C = { bg: '#0A0F1E', card: '#131929', accent: '#00D4FF', text: '#FFFFFF', muted: '#FFFFFF60' };

const styles = StyleSheet.create({
  // Home
  home: { flex: 1, backgroundColor: C.bg, paddingTop: 56 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  homeAppName: { color: C.text, fontSize: 26, fontWeight: '900' },
  homeTagline: { color: C.muted, fontSize: 12, marginTop: 2 },
  netBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  netDot: { width: 8, height: 8, borderRadius: 4 },
  netText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { color: C.accent, fontSize: 22, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  actions: { flex: 1, paddingHorizontal: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.card, borderRadius: 16, padding: 18 },
  primaryAction: { borderWidth: 1, borderColor: `${C.accent}40` },
  actionIcon: { fontSize: 28 },
  actionTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  actionSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  disabledBtn: { opacity: 0.4 },
  // Result
  resultContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: { backgroundColor: C.card, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' },
  resultIcon: { fontSize: 64, marginBottom: 16 },
  resultTitle: { fontSize: 26, fontWeight: '900', marginBottom: 8 },
  resultName: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 24 },
  resultMetrics: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  metric: { alignItems: 'center' },
  metricValue: { color: C.accent, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  savedBadge: { backgroundColor: '#00FF8820', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  savedText: { color: '#00FF88', fontSize: 12, fontWeight: '600' },
  reasonText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  resultActions: { flexDirection: 'row', gap: 16, marginTop: 24, width: '100%' },
  retryBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  retryText: { color: C.bg, fontWeight: '800', fontSize: 16 },
  homeBtn: { flex: 1, backgroundColor: C.card, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  homeText: { color: C.text, fontWeight: '700', fontSize: 16 },
  // Sync
  syncContainer: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 56 },
  syncTitle: { color: C.text, fontSize: 26, fontWeight: '800', marginBottom: 4, marginTop: 16 },
  syncSub: { color: C.muted, fontSize: 14, marginBottom: 24 },
  syncStatusCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 24, gap: 4 },
  syncStatusLabel: { color: C.muted, fontSize: 12 },
  syncStatusValue: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF20', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 2 },
  syncResultBox: { backgroundColor: '#FFFFFF08', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24, gap: 6 },
  syncResultDetail: { color: C.muted, fontSize: 13 },
  // Splash
  splashContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  splashIcon: { fontSize: 72, textAlign: 'center', marginBottom: 20 },
  splashTitle: { color: C.text, fontSize: 40, fontWeight: '900', textAlign: 'center' },
  splashSub: { color: C.accent, fontSize: 16, textAlign: 'center', marginTop: 8 },
  splashPowered: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
  // Admin
  adminContainer: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 56 },
  emptyText: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, gap: 14 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${C.accent}30`, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: C.accent, fontSize: 18, fontWeight: '800' },
  userName: { color: C.text, fontWeight: '700', fontSize: 15 },
  userMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  deleteBtn: { fontSize: 20, padding: 4 },
  // Shared
  backBtn: { marginBottom: 4 },
  backText: { color: C.accent, fontSize: 16 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: C.bg, fontWeight: '800', fontSize: 16 },
});

export default HomeScreen;
