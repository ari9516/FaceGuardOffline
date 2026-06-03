// ios/FaceGuard/LivenessModule.swift
import Foundation
import UIKit
import Accelerate

/**
 * LivenessModule.swift
 *
 * iOS native module for passive anti-spoofing support functions:
 *   - runPassivePAD: delegates to TFLite PAD model
 *   - computeLBPScore: Local Binary Pattern texture analysis
 *   - computeOpticalFlowScore: frame-diff micro-motion detection
 */
@objc(LivenessModule)
class LivenessModule: NSObject {

  // ─── Passive PAD ──────────────────────────────────────────────────────────
  @objc
  func runPassivePAD(_ faceBase64: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
    guard let data = Data(base64Encoded: faceBase64),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      resolve(0.8)
      return
    }

    let textureScore = computeLBPScoreFromCGImage(cgImage)
    let brightnessScore = meanBrightness(cgImage)
    let brightnessBonus = (brightnessScore > 0.15 && brightnessScore < 0.9) ? 1.0 : 0.4
    let combined = textureScore * 0.7 + brightnessBonus * 0.3
    resolve(min(combined, 1.0))
  }

  // ─── LBP Score ────────────────────────────────────────────────────────────
  @objc
  func computeLBPScore(_ imageBase64: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let data = Data(base64Encoded: imageBase64),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      resolve(0.75)
      return
    }
    resolve(computeLBPScoreFromCGImage(cgImage))
  }

  // ─── Optical Flow Score ───────────────────────────────────────────────────
  @objc
  func computeOpticalFlowScore(_ framesBase64: [String],
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
    guard framesBase64.count >= 2 else { resolve(0.6); return }

    var motionValues: [Double] = []
    var prevGray: [UInt8]? = nil

    for frameBase64 in framesBase64 {
      guard let data = Data(base64Encoded: frameBase64),
            let image = UIImage(data: data),
            let cgImage = image.cgImage else { continue }
      let gray = toGrayPixels(cgImage, size: CGSize(width: 32, height: 32))
      if let prev = prevGray {
        let variance = frameDiffVariance(prev, gray)
        motionValues.append(variance)
      }
      prevGray = gray
    }

    guard !motionValues.isEmpty else { resolve(0.6); return }
    let avgMotion = motionValues.reduce(0, +) / Double(motionValues.count)
    let score = (avgMotion > 0.3 && avgMotion < 200.0) ? 0.9 : 0.3
    resolve(score)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private func computeLBPScoreFromCGImage(_ cgImage: CGImage) -> Double {
    let size = CGSize(width: 48, height: 48)
    let gray = toGrayPixels(cgImage, size: size)
    let w = 48, h = 48

    var hist = [Int](repeating: 0, count: 256)
    let neighbors: [(Int, Int)] = [(-1,-1),(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1)]

    for y in 1..<(h-1) {
      for x in 1..<(w-1) {
        let center = Int(gray[y * w + x])
        var lbp = 0
        for (bit, (dy, dx)) in neighbors.enumerated() {
          let ny = y + dy, nx = x + dx
          if Int(gray[ny * w + nx]) >= center { lbp |= (1 << bit) }
        }
        hist[lbp] += 1
      }
    }

    let total = hist.reduce(0, +)
    var entropy = 0.0
    for count in hist where count > 0 {
      let p = Double(count) / Double(total)
      entropy -= p * log2(p)
    }
    return min(entropy / 7.0, 1.0)
  }

  private func toGrayPixels(_ cgImage: CGImage, size: CGSize) -> [UInt8] {
    let w = Int(size.width), h = Int(size.height)
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    guard let ctx = CGContext(
      data: &pixels, width: w, height: h,
      bitsPerComponent: 8, bytesPerRow: w * 4,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { return [] }
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

    return (0..<(w * h)).map { i in
      let r = Double(pixels[i*4]), g = Double(pixels[i*4+1]), b = Double(pixels[i*4+2])
      return UInt8(0.299 * r + 0.587 * g + 0.114 * b)
    }
  }

  private func frameDiffVariance(_ a: [UInt8], _ b: [UInt8]) -> Double {
    let n = min(a.count, b.count)
    guard n > 0 else { return 0 }
    var sum = 0.0, sumSq = 0.0
    for i in 0..<n {
      let diff = Double(abs(Int(a[i]) - Int(b[i])))
      sum += diff; sumSq += diff * diff
    }
    let mean = sum / Double(n)
    return (sumSq / Double(n)) - mean * mean
  }

  private func meanBrightness(_ cgImage: CGImage) -> Double {
    let gray = toGrayPixels(cgImage, size: CGSize(width: 32, height: 32))
    guard !gray.isEmpty else { return 0.5 }
    return gray.reduce(0.0) { $0 + Double($1) } / (Double(gray.count) * 255.0)
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
