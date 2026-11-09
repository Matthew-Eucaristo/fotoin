import Flutter
import UIKit
import Vision

/// Body pose detection with Apple Vision (built into iOS, no bundled model).
/// Channel contract (shared with Android's PosePlugin.kt):
///   detectFile {path}
///   detectFrame {bytes (BGRA), width, height, bytesPerRow, sensorOrientation, front}
/// Both return {aspect, joints: {name: [x, y, confidence]}} with x/y normalised
/// to the upright image (origin top-left), or nil when nobody is found.
final class PosePlugin: NSObject, FlutterPlugin {
  private let queue = DispatchQueue(label: "fotoin.pose", qos: .userInitiated)

  private static let joints: [(String, VNHumanBodyPoseObservation.JointName)] = [
    ("nose", .nose),
    ("leftShoulder", .leftShoulder), ("rightShoulder", .rightShoulder),
    ("leftElbow", .leftElbow), ("rightElbow", .rightElbow),
    ("leftWrist", .leftWrist), ("rightWrist", .rightWrist),
    ("leftHip", .leftHip), ("rightHip", .rightHip),
    ("leftKnee", .leftKnee), ("rightKnee", .rightKnee),
    ("leftAnkle", .leftAnkle), ("rightAnkle", .rightAnkle),
  ]

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(name: "fotoin/pose", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(PosePlugin(), channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any] else {
      result(FlutterError(code: "bad_args", message: "Missing arguments", details: nil))
      return
    }
    let work: () throws -> [String: Any]?
    switch call.method {
    case "detectFile":
      guard let path = args["path"] as? String else {
        result(FlutterError(code: "bad_args", message: "Missing path", details: nil))
        return
      }
      work = { try Self.detectFile(path: path) }
    case "detectFrame":
      guard let data = args["bytes"] as? FlutterStandardTypedData,
        let width = args["width"] as? Int,
        let height = args["height"] as? Int,
        let bytesPerRow = args["bytesPerRow"] as? Int,
        let sensor = args["sensorOrientation"] as? Int
      else {
        result(FlutterError(code: "bad_args", message: "Missing frame fields", details: nil))
        return
      }
      work = {
        try Self.detectFrame(
          data: data.data, width: width, height: height,
          bytesPerRow: bytesPerRow, sensorOrientation: sensor)
      }
    default:
      result(FlutterMethodNotImplemented)
      return
    }
    queue.async {
      do {
        let value = try work()
        DispatchQueue.main.async { result(value) }
      } catch {
        DispatchQueue.main.async {
          result(FlutterError(code: "vision_failed", message: error.localizedDescription, details: nil))
        }
      }
    }
  }

  private static func detectFile(path: String) throws -> [String: Any]? {
    guard let image = UIImage(contentsOfFile: path), let cg = image.cgImage else {
      throw NSError(domain: "fotoin.pose", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read image"])
    }
    let handler = VNImageRequestHandler(
      cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation), options: [:])
    // UIImage.size already accounts for EXIF orientation.
    return try detect(handler: handler, aspect: image.size.width / image.size.height)
  }

  private static func detectFrame(
    data: Data, width: Int, height: Int, bytesPerRow: Int, sensorOrientation: Int
  ) throws -> [String: Any]? {
    var buffer: CVPixelBuffer?
    CVPixelBufferCreate(
      kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
      [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary, &buffer)
    guard let pixels = buffer else { return nil }
    CVPixelBufferLockBaseAddress(pixels, [])
    if let base = CVPixelBufferGetBaseAddress(pixels) {
      let dstStride = CVPixelBufferGetBytesPerRow(pixels)
      data.withUnsafeBytes { src in
        guard let srcBase = src.baseAddress else { return }
        for row in 0..<height {
          memcpy(base + row * dstStride, srcBase + row * bytesPerRow, min(dstStride, bytesPerRow))
        }
      }
    }
    CVPixelBufferUnlockBaseAddress(pixels, [])

    // camera_avfoundation may already deliver portrait frames; only rotate
    // frames that still arrive in the sensor's landscape layout.
    let landscape = width > height
    let orientation: CGImagePropertyOrientation
    switch landscape ? sensorOrientation % 360 : 0 {
    case 90: orientation = .right
    case 180: orientation = .down
    case 270: orientation = .left
    default: orientation = .up
    }
    let quarterTurn = orientation == .right || orientation == .left
    let aspect = quarterTurn ? Double(height) / Double(width) : Double(width) / Double(height)
    let handler = VNImageRequestHandler(cvPixelBuffer: pixels, orientation: orientation, options: [:])
    return try detect(handler: handler, aspect: aspect)
  }

  private static func detect(handler: VNImageRequestHandler, aspect: Double) throws -> [String: Any]? {
    let request = VNDetectHumanBodyPoseRequest()
    try handler.perform([request])
    guard let observations = request.results, !observations.isEmpty else { return nil }

    // Most prominent person: largest area covered by confident joints.
    var best: [String: [Double]] = [:]
    var bestArea = -1.0
    for observation in observations {
      var found: [String: [Double]] = [:]
      for (name, joint) in joints {
        guard let point = try? observation.recognizedPoint(joint), point.confidence > 0.1 else { continue }
        // Vision's origin is bottom-left; Flutter's is top-left.
        found[name] = [Double(point.location.x), 1 - Double(point.location.y), Double(point.confidence)]
      }
      let xs = found.values.map { $0[0] }, ys = found.values.map { $0[1] }
      guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else { continue }
      let area = (maxX - minX) * (maxY - minY)
      if area > bestArea {
        bestArea = area
        best = found
      }
    }
    return best.isEmpty ? nil : ["aspect": aspect, "joints": best]
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
