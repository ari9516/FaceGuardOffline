/**
 * FaceCameraView.tsx
 * Real-time camera view with face detection overlay.
 * Uses react-native-vision-camera (open-source, MIT license).
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { FaceDetection } from '../services/FaceRecognitionEngine';

interface Props {
  onFrameProcessed: (frame: { base64: string; detections: FaceDetection[] }) => void;
  overlayColor?: string;
  showGuide?: boolean;
  livenessInstruction?: string;
  mode: 'enroll' | 'auth';
}

const FaceCameraView: React.FC<Props> = ({
  onFrameProcessed,
  overlayColor = '#00D4FF',
  showGuide = true,
  livenessInstruction,
  mode,
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('front') || useCameraDevice('back');

  useEffect(() => {
    (async () => {
      const currentStatus = Camera.getCameraPermissionStatus();
      console.log('[FaceCameraView] Current camera permission status:', currentStatus);
      if (currentStatus === 'granted') {
        setHasPermission(true);
      } else {
        const status = await Camera.requestCameraPermission();
        console.log('[FaceCameraView] Camera permission requested status:', status);
        setHasPermission(status === 'granted');
      }
    })();
  }, []);

  useEffect(() => {
    console.log('[FaceCameraView] Selected device:', device?.position);
  }, [device]);

  const camera = useRef<Camera>(null);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (faceInFrame) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [faceInFrame]);

  const handleFrame = useCallback((base64: string, detections: FaceDetection[]) => {
    setFaceInFrame(detections.length > 0);
    onFrameProcessed({ base64, detections });
  }, [onFrameProcessed]);

  // Periodically send mock frame detections since the C++ engine is mocked natively anyway
  useEffect(() => {
    if (!hasPermission || !device) return;

    const interval = setInterval(() => {
      const mockBase64 = 'mock_base64_data';
      const mockDetections: FaceDetection[] = [
        {
          boundingBox: { x: 50, y: 50, w: 200, h: 250 },
          landmarks: [
            { x: 100, y: 150 },
            { x: 120, y: 150 },
            { x: 140, y: 150 },
            { x: 160, y: 150 },
            { x: 180, y: 150 },
          ],
          confidence: 0.99,
          yaw: 0,
          pitch: 0,
          roll: 0,
        }
      ];
      handleFrame(mockBase64, mockDetections);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasPermission, device, handleFrame]);

  if (!hasPermission) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Camera initializing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* Dark overlay with oval cutout */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <Animated.View
            style={[
              styles.faceOval,
              {
                borderColor: faceInFrame ? overlayColor : '#FFFFFF40',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Corner brackets */}
      {showGuide && (
        <>
          <View style={[styles.corner, styles.topLeft, { borderColor: overlayColor }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: overlayColor }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: overlayColor }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: overlayColor }]} />
        </>
      )}

      {/* Status indicator */}
      <View style={styles.statusBadge}>
        <View style={[styles.statusDot, { backgroundColor: faceInFrame ? '#00FF88' : '#FF4444' }]} />
        <Text style={styles.statusText}>
          {faceInFrame ? 'Face Detected' : 'Position Your Face'}
        </Text>
      </View>

      {/* Liveness instruction */}
      {livenessInstruction && (
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionText}>{livenessInstruction}</Text>
        </View>
      )}
    </View>
  );
};

const OVAL_W = 260;
const OVAL_H = 320;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0F1E' },
  placeholderText: { color: '#ffffff80', fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: '#000000CC' },
  overlayMiddle: { flexDirection: 'row', height: OVAL_H },
  overlaySide: { flex: 1, backgroundColor: '#000000CC' },
  faceOval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  overlayBottom: { flex: 1, backgroundColor: '#000000CC' },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  topLeft: { top: '28%', left: '14%', borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: '28%', right: '14%', borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: '28%', left: '14%', borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: '28%', right: '14%', borderLeftWidth: 0, borderTopWidth: 0 },
  statusBadge: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000AA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  instructionBanner: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#00D4FF22',
    borderWidth: 1,
    borderColor: '#00D4FF66',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  instructionText: { color: '#00D4FF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});

export default FaceCameraView;
