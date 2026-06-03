<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1a0d,50:1a3a1a,100:c8f135&height=160&section=header&text=FaceGuardOffline&fontSize=42&fontColor=c8f135&fontAlignY=38&desc=On-Device%20Face%20Recognition%20%E2%80%A2%20No%20Cloud.%20No%20Compromise.&descColor=e8e8e0&descAlignY=58&animation=fadeIn" width="100%"/>

<br/>

![React Native](https://img.shields.io/badge/React%20Native-0.73-20232A?style=for-the-badge&logo=react&logoColor=c8f135)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-0d1a0d?style=for-the-badge&logo=typescript&logoColor=c8f135)
![TensorFlow Lite](https://img.shields.io/badge/TFLite-On--Device%20ML-c8f135?style=for-the-badge&logo=tensorflow&logoColor=0d1a0d)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-e8e8e0?style=for-the-badge&logo=android&logoColor=0d1a0d)
![Model Size](https://img.shields.io/badge/Model%20Size-%3C20MB-c8f135?style=for-the-badge)
![Accuracy](https://img.shields.io/badge/Accuracy-%3E95%25-0d1a0d?style=for-the-badge)
![Hackathon](https://img.shields.io/badge/NHAI%20Hackathon-2025-c8f135?style=for-the-badge)

</div>

---

## ✦ Overview

**FaceGuardOffline** is our submission for the **NHAI Hackathon 2025** — built to solve the problem of authenticating field personnel in zero-network zones.

The challenge: accurately verify identity using facial recognition + liveness detection on standard mid-range Android/iOS devices, with **no active internet connection**, a model footprint under **20 MB**, and recognition speed under **1 second**.

> *"How can we accurately and securely authenticate field personnel using facial recognition and liveness detection on standard mid-range mobile devices without any active internet connection, while ensuring the AI model remains lightweight and seamlessly integrates with a React Native application on both Android and iOS devices?"*
>
> — NHAI Hackathon 2025 Problem Statement

---

## ✦ Core Features

| Feature | Details |
|---|---|
| **On-Device Inference** | TensorFlow Lite model — entire recognition pipeline runs locally, zero network required |
| **Liveness Detection** | Anti-spoofing via blink / smile / head-turn challenges — defeats photo and screen attacks |
| **AES-Encrypted Storage** | All face embeddings stored in SQLite with AES encryption at rest |
| **Offline-First Architecture** | `NetInfo` enforces offline operation; blocks recognition if network is unexpectedly active |
| **Sync & Purge Mechanism** | Scoped for AWS server sync once connectivity is restored; local data purged post-sync |
| **Cross-Platform** | Single TypeScript codebase targeting Android 8.0+ and iOS 12+ |
| **Diverse Demographics** | Model trained to handle varied Indian demographics and outdoor lighting (harsh sun, low light, shadows) |

---

## ✦ Technical Specifications

| Constraint | Target | Status |
|---|---|---|
| Model Size | < 20 MB | ✅ |
| Recognition Speed | < 1 sec on mid-range devices | ✅ |
| Facial Recognition Accuracy | > 95% | ✅ |
| Minimum Android | 8.0+ (3 GB RAM) | ✅ |
| Minimum iOS | 12+ (3 GB RAM) | ✅ |
| Third-party libraries | Open-source only, no paid licenses | ✅ |

---

## ✦ Tech Stack

```
React Native 0.73           →  Cross-platform mobile runtime
TypeScript 5.0              →  Static typing throughout
react-native-tflite         →  On-device TensorFlow Lite inference
react-native-vision-camera  →  High-performance live camera feed
react-native-sqlite-storage →  Embedded local face database
react-native-aes-crypto     →  AES encryption for stored embeddings
@rn-community/netinfo       →  Network detection & offline enforcement
React Navigation 6          →  Native stack navigation
react-native-fs             →  Local file system access
```

All dependencies are **open-source** with no additional license requirements.

---

## ✦ Architecture

```
FaceGuardOffline/
├── src/
│   ├── screens/          # Navigation-routed views
│   ├── components/       # Reusable UI elements
│   ├── ml/               # TFLite model integration & inference pipeline
│   ├── db/               # SQLite schema, CRUD, AES encryption layer
│   └── utils/            # NetInfo guard, sync/purge helpers
├── android/              # Android-specific native config
├── ios/                  # iOS-specific native config
├── App.tsx               # Root component + navigation setup
└── package.json
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
Liveness Check (blink / smile / head-turn challenge)
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
Match Result ──► Authentication Feedback
    │
    ▼ (when network restores)
AWS Sync → Local Purge
```

On **registration**, a face embedding is extracted from a liveness-verified frame and stored encrypted. On **recognition**, the live embedding is compared against stored entries — fully on-device. When connectivity is later restored, local records sync to the AWS server and are purged from the device.

---

## ✦ Liveness Detection

To prevent fraud via printed photos or screen replay, the app requires the user to complete one or more passive challenges before a recognition attempt is accepted:

- **Blink detection** — eye aspect ratio threshold via facial landmarks
- **Smile detection** — mouth curve analysis
- **Head turn** — yaw angle delta check

All challenge logic runs on-device via the TFLite model pipeline — no server call required.

---

## ✦ Privacy & Security Model

- **No cloud, no API** — zero external endpoints during operation
- **NetInfo enforcement** — recognition blocked while any network is active
- **AES encryption at rest** — SQLite face data is encrypted; plaintext embeddings never persist to disk
- **Sync & purge** — data leaves the device only on explicit sync, then is deleted locally
- **No telemetry, no analytics**

---

## ✦ Getting Started

### Prerequisites

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

## ✦ Evaluation Criteria

| Criteria | Weight | Our Approach |
|---|---|---|
| **Innovation** | 30 marks | Edge AI with TFLite compression, passive liveness anti-spoofing |
| **Feasibility** | 30 marks | Drop-in React Native integration, <1s on mid-range hardware |
| **Scalability & Sustainability** | 20 marks | Offline-to-online sync/purge, diverse demographic training |
| **Presentation & Documentation** | 20 marks | Full source code, integration guide, architecture docs |

---

## ✦ Team

<div align="center">

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/RishiRaj1495">
        <img src="https://avatars.githubusercontent.com/RishiRaj1495" width="80px" style="border-radius:50%; border: 2px solid #c8f135;" alt="Rishi Raj"/><br/>
        <sub><b>Rishi Raj</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/swastiksinha1">
        <img src="https://avatars.githubusercontent.com/swastiksinha1" width="80px" style="border-radius:50%; border: 2px solid #c8f135;" alt="Swastik Sinha"/><br/>
        <sub><b>Swastik Sinha</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/ari9516">
        <img src="https://avatars.githubusercontent.com/u/191688404?v=4" width="80px" style="border-radius:50%; border: 2px solid #c8f135;" alt="Arnav Kumar"/><br/>
        <sub><b>Arnav Kumar</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/AbhilashSingh">
        <img src="https://avatars.githubusercontent.com/u/224326754?v=4" width="80px" style="border-radius:50%; border: 2px solid #c8f135;" alt="Abhilash Singh"/><br/>
        <sub><b>Abhilash Singh</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Brotodeep">
        <img src="https://avatars.githubusercontent.com/Brotodeep" width="80px" style="border-radius:50%; border: 2px solid #c8f135;" alt="Brotodeep Pal"/><br/>
        <sub><b>Brotodeep Pal</b></sub>
      </a>
    </td>
  </tr>
</table>

*Submitted for **NHAI Hackathon 2025** · VIT Bhopal*

*Submission window: 22 May 2026 – 05 June 2026*

</div>

---

## ✦ License

This project is open source. All third-party libraries used are open-source with no additional license requirements, per the hackathon constraints.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:c8f135,50:1a3a1a,100:0d1a0d&height=100&section=footer" width="100%"/>

*No face left the device during the making of this app.*

</div>


</div>
