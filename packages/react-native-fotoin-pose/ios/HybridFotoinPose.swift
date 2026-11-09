import Foundation
import ImageIO
import NitroModules
import UIKit
import Vision
import VisionCamera

/// Body pose with Apple Vision (built into iOS, no bundled model).
/// Output layout is documented in src/specs/FotoinPose.nitro.ts.
class HybridFotoinPose: HybridFotoinPoseSpec {
  private static let joints: [VNHumanBodyPoseObservation.JointName] = [
    .nose,
    .leftShoulder, .rightShoulder,
    .leftElbow, .rightElbow,
    .leftWrist, .rightWrist,
    .leftHip, .rightHip,
    .leftKnee, .rightKnee,
    .leftAnkle, .rightAnkle,
  ]

  // Reused across frames; frames arrive serially on the frame thread.
  private let liveRequest = VNDetectHumanBodyPoseRequest()

  func detect(frame: any HybridFrameSpec) throws -> [Double] {
    guard let native = frame as? any NativeFrame,
      let sample = native.sampleBuffer,
      let pixels = CMSampleBufferGetImageBuffer(sample)
    else { return [] }
    let width = Double(CVPixelBufferGetWidth(pixels))
    let height = Double(CVPixelBufferGetHeight(pixels))
    guard width > 0, height > 0 else { return [] }

    // The frame output rotates buffers physically, so pixels are upright.
    let orientation: CGImagePropertyOrientation = frame.isMirrored ? .upMirrored : .up
    let handler = VNImageRequestHandler(cvPixelBuffer: pixels, orientation: orientation, options: [:])
    try handler.perform([liveRequest])
    return Self.pack(liveRequest.results, aspect: width / height)
  }

  func detectInImage(path: String) throws -> Promise<[Double]> {
    return Promise.async {
      let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
      guard let image = UIImage(contentsOfFile: url.path), let cg = image.cgImage else {
        throw RuntimeError.error(withMessage: "Cannot read image at \(path)")
      }
      let request = VNDetectHumanBodyPoseRequest()
      let handler = VNImageRequestHandler(
        cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation), options: [:])
      try handler.perform([request])
      // UIImage.size already accounts for EXIF orientation.
      return Self.pack(request.results, aspect: Double(image.size.width / image.size.height))
    }
  }

  /// Picks the most prominent person (largest area of confident joints).
  private static func pack(_ observations: [VNHumanBodyPoseObservation]?, aspect: Double) -> [Double] {
    guard let observations, !observations.isEmpty else { return [] }
    var best: [Double] = []
    var bestArea = -1.0
    for observation in observations {
      var values: [Double] = [aspect]
      var minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0, found = 0
      for joint in joints {
        if let p = try? observation.recognizedPoint(joint), p.confidence > 0.1 {
          // Vision's origin is bottom-left; ours is top-left.
          let x = Double(p.location.x), y = 1 - Double(p.location.y)
          values += [x, y, Double(p.confidence)]
          minX = min(minX, x); maxX = max(maxX, x)
          minY = min(minY, y); maxY = max(maxY, y)
          found += 1
        } else {
          values += [0, 0, 0]
        }
      }
      guard found > 0 else { continue }
      let area = (maxX - minX) * (maxY - minY)
      if area > bestArea {
        bestArea = area
        best = values
      }
    }
    return best
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
