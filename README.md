<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1a0d,50:1a3a1a,100:c8f135&height=160&section=header&text=FaceGuardOffline&fontSize=42&fontColor=c8f135&fontAlignY=38&desc=On-Device%20Face%20Recognition%20%E2%80%A2%20No%20Cloud.%20No%20Compromise.&descColor=e8e8e0&descAlignY=58&animation=fadeIn" width="100%"/>

<br/>

![React Native](https://img.shields.io/badge/React%20Native-0.73-20232A?style=for-the-badge&logo=react&logoColor=c8f135)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-0d1a0d?style=for-the-badge&logo=typescript&logoColor=c8f135)
![TensorFlow Lite](https://img.shields.io/badge/TFLite-On--Device%20ML-c8f135?style=for-the-badge&logo=tensorflow&logoColor=0d1a0d)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-e8e8e0?style=for-the-badge&logo=android&logoColor=0d1a0d)
![Hackathon](https://img.shields.io/badge/Built%20At-Hackathon%207.0-c8f135?style=for-the-badge)

</div>

---

## ✦ What is FaceGuardOffline?

**FaceGuardOffline** is a privacy-first face recognition app built entirely for the edge. Face data never leaves the device — no API calls, no cloud uploads, no internet dependency. Recognition runs locally via a TensorFlow Lite model, face embeddings are stored in an encrypted SQLite database, and the app actively blocks itself when a network connection is detected.

Built under 24 hours at **Hackathon 7.0**.

---

## ✦ Core Features

| Feature | Details |
|---|---|
| **On-Device Inference** | TensorFlow Lite model runs entirely on the device's neural processing pipeline |
| **Zero Network Dependency** | App enforces offline-only operation via `NetInfo` — no data is ever transmitted |
| **AES-Encrypted Storage** | All face embeddings stored in SQLite with AES encryption at rest |
| **Live Camera Feed** | Real-time face detection using `react-native-vision-camera` |
| **Cross-Platform** | Runs on both Android and iOS from a single TypeScript codebase |
| **Persistent Identity DB** | Register, recognize, and manage identities locally across sessions |

---

## ✦ Architecture

```
FaceGuardOffline/
├── src/
│   ├── screens/          # Navigation-routed views
│   ├── components/       # Reusable UI elements
│   ├── ml/               # TFLite model integration & inference
│   ├── db/               # SQLite schema, queries, AES layer
│   └── utils/            # NetInfo guard, helpers
├── android/              # Android-specific native config
├── ios/                  # iOS-specific native config
├── App.tsx               # Root component + navigation setup
└── package.json
```

---

## ✦ Tech Stack

```
React Native 0.73        →  Cross-platform mobile runtime
TypeScript 5.0           →  Static typing throughout
react-native-tflite      →  On-device TensorFlow Lite inference
react-native-vision-camera  →  High-performance camera access
react-native-sqlite-storage →  Embedded local database
react-native-aes-crypto  →  AES encryption for face embeddings
@react-native-community/netinfo  →  Network detection & offline guard
React Navigation 6       →  Native stack navigation
```

---

## ✦ Getting Started

### Prerequisites

Make sure your React Native environment is set up:
→ [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)

You'll need: Node ≥ 18, JDK 17+, Android Studio or Xcode.

### Install

```bash
git clone https://github.com/RishiRaj1495/FaceGuardOffline.git
cd FaceGuardOffline
npm install
```

**iOS only — install pods:**
```bash
cd ios && bundle exec pod install && cd ..
```

### Run

```bash
# Start Metro bundler
npm start

# Android
npm run android

# iOS
npm run ios
```

---

## ✦ How It Works

```
Camera Frame
    │
    ▼
Vision Camera (live preview)
    │
    ▼
TFLite Model (face detection + embedding extraction)
    │
    ▼
AES Encryption
    │
    ▼
SQLite Database (local, encrypted, persistent)
    │
    ▼
Match / Register Result ──► UI Feedback
```

On registration, a face embedding is extracted and stored encrypted. On recognition, the live embedding is compared against stored entries — entirely on-device, no round trips.

---

## ✦ Privacy Model

- **No cloud, no API** — the app calls zero external endpoints
- **NetInfo enforcement** — recognition is blocked while a network connection is active
- **Encrypted at rest** — SQLite face data is AES-encrypted; plaintext embeddings are never persisted
- **No telemetry, no analytics**

---

## ✦ Built At

<div align="center">

> **Hackathon 7.0** — Built under 24 hours
>
> A project exploring what privacy-preserving biometrics looks like when the cloud is removed entirely from the equation.

</div>

---

## ✦ Team

Built by students from **VIT Bhopal** — contributions welcome via pull request.

---

## ✦ License

This project is open source. See [LICENSE](LICENSE) for details.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:c8f135,50:1a3a1a,100:0d1a0d&height=100&section=footer" width="100%"/>

*No face left the device during the making of this app.*

</div>
