/**
 * EnrollScreen.tsx
 * Multi-sample face enrollment: captures 5 embeddings across lighting conditions.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FaceCameraView from '../components/FaceCameraView';
import FaceRecognitionEngine, { FaceDetection } from '../services/FaceRecognitionEngine';
import { DatabaseService } from '../services/DatabaseService';
import { AESEncryption } from '../utils/AESEncryption';
import { useFaceGuard } from '../context/FaceGuardContext';
import { generateUUID } from '../utils/uuid';

const REQUIRED_SAMPLES = 5;
const SAMPLE_INSTRUCTIONS = [
  'Look straight at the camera',
  'Slightly tilt left — natural light',
  'Slightly tilt right',
  'Look up slightly',
  'Natural expression, outdoor lighting',
];

type EnrollPhase = 'FORM' | 'CAPTURE' | 'DONE';

const EnrollScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { dispatch, refreshUsers } = useFaceGuard();

  const [phase, setPhase] = useState<EnrollPhase>('FORM');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [sampleCount, setSampleCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [qualityScores, setQualityScores] = useState<number[]>([]);
  const captureReady = useRef(true);

  const LIGHTING_CONDITIONS: Array<'INDOOR' | 'OUTDOOR' | 'LOW_LIGHT' | 'HARSH_SUN'> = [
    'INDOOR', 'OUTDOOR', 'INDOOR', 'LOW_LIGHT', 'OUTDOOR',
  ];

  const handleStartEnroll = () => {
    if (!name.trim() || !employeeId.trim()) {
      Alert.alert('Required', 'Please enter name and employee ID');
      return;
    }
    setPhase('CAPTURE');
  };

  const handleFrame = useCallback(async ({ base64, detections }: { base64: string; detections: FaceDetection[] }) => {
    if (!captureReady.current || isProcessing) return;
    if (detections.length === 0) return;
    if (detections[0].confidence < 0.85) return;
    if (Math.abs(detections[0].yaw) > 25 || Math.abs(detections[0].pitch) > 20) return;

    captureReady.current = false;
    setIsProcessing(true);

    try {
      const embedding = await FaceRecognitionEngine.extractEmbedding(base64);

      if (embedding.quality < 0.5) {
        captureReady.current = true;
        setIsProcessing(false);
        return;
      }

      setCapturedEmbeddings(prev => [...prev, embedding.vector]);
      setQualityScores(prev => [...prev, embedding.quality]);
      const newCount = sampleCount + 1;
      setSampleCount(newCount);

      if (newCount >= REQUIRED_SAMPLES) {
        await saveEnrollment([...capturedEmbeddings, embedding.vector], [...qualityScores, embedding.quality]);
      } else {
        setTimeout(() => { captureReady.current = true; }, 1500);
      }
    } catch (err) {
      console.error('Enroll frame error:', err);
      captureReady.current = true;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, sampleCount, capturedEmbeddings, qualityScores]);

  const saveEnrollment = async (embeddings: number[][], qualities: number[]) => {
    setIsProcessing(true);
    try {
      const userId = generateUUID();
      await DatabaseService.insertUser({
        id: userId,
        name: name.trim(),
        employeeId: employeeId.trim(),
        department: department.trim(),
        enrolledAt: Date.now(),
        isActive: true,
      });

      for (let i = 0; i < embeddings.length; i++) {
        const encrypted = await AESEncryption.encrypt(JSON.stringify(embeddings[i]));
        await DatabaseService.saveTemplate({
          userId,
          embeddingIndex: i,
          encryptedEmbedding: encrypted,
          capturedAt: Date.now(),
          lightingCondition: LIGHTING_CONDITIONS[i],
          quality: qualities[i],
        });
      }

      await refreshUsers();
      setPhase('DONE');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Enrollment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (phase === 'FORM') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.form}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enroll Personnel</Text>
        <Text style={styles.subtitle}>Register a new field operative</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rajesh Kumar"
            placeholderTextColor="#FFFFFF40"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Employee ID *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. EMP-2024-001"
            placeholderTextColor="#FFFFFF40"
            value={employeeId}
            onChangeText={setEmployeeId}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Department</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Field Operations"
            placeholderTextColor="#FFFFFF40"
            value={department}
            onChangeText={setDepartment}
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📸  We'll capture {REQUIRED_SAMPLES} face samples in different poses to improve accuracy in outdoor lighting conditions.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleStartEnroll}>
          <Text style={styles.primaryBtnText}>Start Capture →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'DONE') {
    return (
      <View style={styles.container}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>Enrollment Complete</Text>
          <Text style={styles.doneSub}>{name} has been enrolled with {REQUIRED_SAMPLES} face samples.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.primaryBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FaceCameraView
        onFrameProcessed={handleFrame}
        mode="enroll"
        overlayColor="#00FF88"
        livenessInstruction={SAMPLE_INSTRUCTIONS[sampleCount] ?? 'Hold still…'}
      />

      {/* Progress dots */}
      <View style={styles.dots}>
        {Array.from({ length: REQUIRED_SAMPLES }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < sampleCount ? styles.dotFilled : styles.dotEmpty]}
          />
        ))}
      </View>

      <View style={styles.captureInfo}>
        <Text style={styles.captureCountText}>{sampleCount} / {REQUIRED_SAMPLES} captured</Text>
        {isProcessing && <ActivityIndicator color="#00FF88" size="small" />}
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => setPhase('FORM')}>
        <Text style={styles.cancelText}>✕ Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1E' },
  form: { padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 20 },
  backText: { color: '#00D4FF', fontSize: 16 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#FFFFFF60', fontSize: 15, marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#FFFFFF90', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF10',
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#00D4FF15',
    borderWidth: 1,
    borderColor: '#00D4FF30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: { color: '#00D4FF', fontSize: 13, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0A0F1E', fontSize: 16, fontWeight: '800' },
  dots: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotFilled: { backgroundColor: '#00FF88' },
  dotEmpty: { backgroundColor: '#FFFFFF30' },
  captureInfo: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  captureCountText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
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
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  doneIcon: { fontSize: 64, marginBottom: 24 },
  doneTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  doneSub: { color: '#FFFFFF70', fontSize: 16, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
});

export default EnrollScreen;
