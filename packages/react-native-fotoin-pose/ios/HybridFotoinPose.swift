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
  private let liveFaceRequest = VNDetectFaceLandmarksRequest()

  func detect(frame: any HybridFrameSpec) throws -> [Double] {
    guard let source = Self.handler(for: frame) else { return [] }
    try source.handler.perform([liveRequest])
    return Self.pack(liveRequest.results, aspect: source.aspect)
  }

  func detectInImage(path: String) throws -> Promise<[Double]> {
    return Promise.async {
      let (handler, aspect) = try Self.handler(forPath: path)
      let request = VNDetectHumanBodyPoseRequest()
      try handler.perform([request])
      return Self.pack(request.results, aspect: aspect)
    }
  }

  func detectFace(frame: any HybridFrameSpec) throws -> [Double] {
    guard let source = Self.handler(for: frame) else { return [] }
    try source.handler.perform([liveFaceRequest])
    return Self.packFace(liveFaceRequest.results, aspect: source.aspect)
  }

  func detectFaceInImage(path: String) throws -> Promise<[Double]> {
    return Promise.async {
      let (handler, aspect) = try Self.handler(forPath: path)
      let request = VNDetectFaceLandmarksRequest()
      try handler.perform([request])
      return Self.packFace(request.results, aspect: aspect)
    }
  }

  /// Vision handler for a live frame. The frame output rotates buffers
  /// physically, so pixels are already upright.
  private static func handler(for frame: any HybridFrameSpec) -> (handler: VNImageRequestHandler, aspect: Double)? {
    guard let native = frame as? any NativeFrame,
      let sample = native.sampleBuffer,
      let pixels = CMSampleBufferGetImageBuffer(sample)
    else { return nil }
    let width = Double(CVPixelBufferGetWidth(pixels))
    let height = Double(CVPixelBufferGetHeight(pixels))
    guard width > 0, height > 0 else { return nil }
    let orientation: CGImagePropertyOrientation = frame.isMirrored ? .upMirrored : .up
    return (VNImageRequestHandler(cvPixelBuffer: pixels, orientation: orientation, options: [:]), width / height)
  }

  /// Vision handler for a still image, honouring EXIF orientation.
  private static func handler(forPath path: String) throws -> (VNImageRequestHandler, Double) {
    let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
    guard let image = UIImage(contentsOfFile: url.path), let cg = image.cgImage else {
      throw RuntimeError.error(withMessage: "Cannot read image at \(path)")
    }
    let handler = VNImageRequestHandler(
      cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation), options: [:])
    // UIImage.size already accounts for EXIF orientation.
    return (handler, Double(image.size.width / image.size.height))
  }

  private static let maxPeople = 4

  /// Faces, largest first → [aspect, count, (box(4), eyeA, eyeB, nose, mouthA, mouthB)…].
  private static func packFace(_ observations: [VNFaceObservation]?, aspect: Double) -> [Double] {
    let faces = (observations ?? [])
      .sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
      .compactMap(faceBlock)
      .prefix(maxPeople)
    return [aspect, Double(faces.count)] + faces.flatMap { $0 }
  }

  private static func faceBlock(_ face: VNFaceObservation) -> [Double]? {
    guard let landmarks = face.landmarks,
      let leftEye = landmarks.leftEye, let rightEye = landmarks.rightEye,
      let nose = landmarks.nose, let lips = landmarks.outerLips
    else { return nil }
    // Normalised image points; Vision's origin is bottom-left, ours top-left.
    let unit = CGSize(width: 1, height: 1)
    func flip(_ p: CGPoint) -> [Double] { [Double(p.x), 1 - Double(p.y)] }
    func centroid(_ region: VNFaceLandmarkRegion2D) -> [Double] {
      let pts = region.pointsInImage(imageSize: unit)
      guard !pts.isEmpty else { return [0, 0] }
      let sum = pts.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
      return flip(CGPoint(x: sum.x / CGFloat(pts.count), y: sum.y / CGFloat(pts.count)))
    }
    let lipPoints = lips.pointsInImage(imageSize: unit)
    // Nose tip: the lowest point of the nose region (smallest Vision y).
    guard let mouthA = lipPoints.min(by: { $0.x < $1.x }),
      let mouthB = lipPoints.max(by: { $0.x < $1.x }),
      let noseTip = nose.pointsInImage(imageSize: unit).min(by: { $0.y < $1.y })
    else { return nil }
    let box = face.boundingBox
    return [Double(box.minX), 1 - Double(box.maxY), Double(box.width), Double(box.height)]
      + centroid(leftEye) + centroid(rightEye) + flip(noseTip) + flip(mouthA) + flip(mouthB)
  }

  /// Bodies, largest first (area of confident joints) → [aspect, count, (x, y, conf)×13…].
  private static func pack(_ observations: [VNHumanBodyPoseObservation]?, aspect: Double) -> [Double] {
    var people: [(area: Double, values: [Double])] = []
    for observation in observations ?? [] {
      var values: [Double] = []
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
      if found >= 4 { people.append(((maxX - minX) * (maxY - minY), values)) }
    }
    let top = people.sorted { $0.area > $1.area }.prefix(maxPeople)
    return [aspect, Double(top.count)] + top.flatMap { $0.values }
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
