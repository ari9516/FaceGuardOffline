/**
 * AuthScreen.tsx
 * Main face authentication screen with liveness detection.
 * Full flow: Detect → Liveness Challenges → Extract Embedding → Match → Log
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Vibration, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FaceCameraView from '../components/FaceCameraView';
import FaceRecognitionEngine, { FaceDetection, FaceEmbedding } from '../services/FaceRecognitionEngine';
import LivenessDetectionService, { LivenessChallenge, Challenge } from '../services/LivenessDetectionService';
import { DatabaseService } from '../services/DatabaseService';
import { useFaceGuard } from '../context/FaceGuardContext';
import { generateUUID } from '../utils/uuid';
import DeviceInfo from 'react-native-device-info';

type AuthPhase = 'IDLE' | 'LIVENESS' | 'PROCESSING' | 'DONE';

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { refreshSyncStatus } = useFaceGuard();

  const [phase, setPhase] = useState<AuthPhase>('IDLE');
  const [challenges, setChallenges] = useState<LivenessChallenge[]>([]);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [challengeTimer, setChallengeTimer] = useState(0);
  const [instruction, setInstruction] = useState('Look straight at the camera');
  const [passiveScore, setPassiveScore] = useState(0);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [lastDetection, setLastDetection] = useState<FaceDetection | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<Challenge[]>([]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout>();
  const challengeTimerRef = useRef<NodeJS.Timeout>();
  const capturedFrames = useRef<string[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    // Start liveness flow after 1s
    const t = setTimeout(startLiveness, 1000);
    return () => { clearTimeout(t); clearTimers(); };
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (challengeTimerRef.current) clearInterval(challengeTimerRef.current);
  };

  const startLiveness = () => {
    const seq = LivenessDetectionService.generateChallengeSequence(2);
    setChallenges(seq);
    setCurrentChallengeIdx(0);
    setInstruction(seq[0].instruction);
    setPhase('LIVENESS');
    startChallengeTimer(seq[0].timeoutMs);
  };

  const startChallengeTimer = (timeoutMs: number) => {
    let elapsed = 0;
    const tick = 100;
    challengeTimerRef.current = setInterval(() => {
      elapsed += tick;
      setChallengeTimer(elapsed / timeoutMs);
      Animated.timing(progressAnim, {
        toValue: elapsed / timeoutMs,
        duration: tick,
        useNativeDriver: false,
      }).start();
      if (elapsed >= timeoutMs) {
        clearInterval(challengeTimerRef.current);
        advanceChallenge(false);
      }
    }, tick);
  };

  const advanceChallenge = useCallback((passed: boolean) => {
    clearInterval(challengeTimerRef.current);
    progressAnim.setValue(0);

    if (passed) {
      Vibration.vibrate(80);
      setCompletedChallenges(prev => [...prev, challenges[currentChallengeIdx].type]);
    }

    const nextIdx = currentChallengeIdx + 1;
    if (nextIdx < challenges.length) {
      setCurrentChallengeIdx(nextIdx);
      setInstruction(challenges[nextIdx].instruction);
      startChallengeTimer(challenges[nextIdx].timeoutMs);
    } else {
      finalizeLiveness(passed ? [...completedChallenges, challenges[currentChallengeIdx].type] : completedChallenges);
    }
  }, [challenges, currentChallengeIdx, completedChallenges]);

  const finalizeLiveness = async (passedChallenges: Challenge[]) => {
    setPhase('PROCESSING');
    setInstruction('Verifying identity…');

    try {
      // Passive PAD on most recent frame
      const lastFrame = capturedFrames.current[capturedFrames.current.length - 1];
      const pScore = lastFrame ? await LivenessDetectionService.runPassivePAD(lastFrame) : 0.5;
      const textureScore = lastFrame ? await LivenessDetectionService.textureBasedLiveness(lastFrame) : 0.5;

      const livenessResult = LivenessDetectionService.assessLiveness(
        pScore, passedChallenges, blinkDetected, textureScore,
      );

      if (!livenessResult.isLive) {
        navigation.replace('Result', {
          success: false,
          reason: 'LIVENESS_FAILED',
          spoofType: livenessResult.spoofType,
        });
        return;
      }

      // Load all templates
      const templates = await DatabaseService.getAllTemplates();

      if (templates.length === 0) {
        navigation.replace('Result', { success: false, reason: 'NO_USERS_ENROLLED' });
        return;
      }

      // Extract embedding from best quality frame
      const embedding = await FaceRecognitionEngine.extractEmbedding(lastFrame);

      // Match
      const matchResult = await FaceRecognitionEngine.matchEmbedding(embedding, templates);

      if (matchResult.matched) {
        // Log attendance
        const deviceId = await DeviceInfo.getUniqueId();
        await DatabaseService.insertAttendance({
          id: generateUUID(),
          userId: matchResult.userId!,
          timestamp: Date.now(),
          locationType: 'FIELD',
          livenessScore: livenessResult.passiveScore,
          recognitionScore: matchResult.confidence,
          status: 'PUNCH_IN',
          syncStatus: 'PENDING',
          deviceId,
        });
        await refreshSyncStatus();
      }

      navigation.replace('Result', {
        success: matchResult.matched,
        userId: matchResult.userId,
        userName: matchResult.userName,
        confidence: matchResult.confidence,
        inferenceTimeMs: matchResult.inferenceTimeMs,
        livenessScore: livenessResult.passiveScore,
        reason: matchResult.matched ? 'SUCCESS' : 'NO_MATCH',
      });
    } catch (err) {
      navigation.replace('Result', { success: false, reason: 'ERROR', error: String(err) });
    }
  };

  const handleFrame = useCallback(({ base64, detections }: { base64: string; detections: FaceDetection[] }) => {
    if (processingRef.current || phase !== 'LIVENESS') return;

    if (detections.length === 0) return;
    const det = detections[0];
    setLastDetection(det);

    // Keep rolling buffer of 10 frames for passive PAD & optical flow
    capturedFrames.current.push(base64);
    if (capturedFrames.current.length > 10) capturedFrames.current.shift();

    // Check blink via EAR
    const earResult = LivenessDetectionService.computeEAR(det.landmarks);
    if (earResult.isBlinking) setBlinkDetected(true);

    // Check current challenge
    if (challenges.length === 0 || currentChallengeIdx >= challenges.length) return;
    const current = challenges[currentChallengeIdx];

    let challengeMet = false;
    switch (current.type) {
      case 'BLINK': challengeMet = earResult.isBlinking; break;
      case 'SMILE': challengeMet = LivenessDetectionService.detectSmile(det.landmarks); break;
      case 'TURN_LEFT': challengeMet = LivenessDetectionService.detectHeadTurn(det, 'LEFT'); break;
      case 'TURN_RIGHT': challengeMet = LivenessDetectionService.detectHeadTurn(det, 'RIGHT'); break;
      case 'NOD': challengeMet = LivenessDetectionService.detectNod(det, lastDetection ?? undefined); break;
    }

    if (challengeMet) advanceChallenge(true);
  }, [phase, challenges, currentChallengeIdx, lastDetection, advanceChallenge]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <FaceCameraView
        onFrameProcessed={handleFrame}
        mode="auth"
        livenessInstruction={phase === 'LIVENESS' ? instruction : undefined}
        overlayColor={phase === 'PROCESSING' ? '#FFB800' : '#00D4FF'}
      />

      {/* Challenge progress bar */}
      {phase === 'LIVENESS' && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressLabel}>
            Challenge {currentChallengeIdx + 1} / {challenges.length}
          </Text>
        </View>
      )}

      {/* Processing overlay */}
      {phase === 'PROCESSING' && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Verifying…</Text>
        </View>
      )}

      {/* Cancel button */}
      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>✕ Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressContainer: {
    position: 'absolute',
    bottom: 140,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#FFFFFF30',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00D4FF',
    borderRadius: 2,
  },
  progressLabel: { color: '#FFFFFF80', fontSize: 12 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: { color: '#FFB800', fontSize: 18, fontWeight: '700' },
  cancelBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    backgroundColor: '#FFFFFF15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelText: { color: '#FFFFFFCC', fontSize: 14, fontWeight: '600' },
});

export default AuthScreen;
