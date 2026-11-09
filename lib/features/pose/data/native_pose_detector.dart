import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/services.dart';

import '../domain/body_pose.dart';

/// Pose detection through each platform's first-party engine:
/// Apple Vision on iOS (built into the OS, adds nothing to app size) and
/// Google ML Kit on Android (official Maven artifact).
///
/// Native code returns joints normalised to the upright image, so this class
/// has no platform-specific geometry. See ios/Runner/PosePlugin.swift and
/// android/app/src/main/kotlin/dev/matthew/fotoin/PosePlugin.kt.
class NativePoseDetector {
  static const _channel = MethodChannel('fotoin/pose');
  static const _minConfidence = 0.4;

  /// Detects the most prominent person in a still image file.
  Future<BodyPose?> detectFile(String path) async {
    final result = await _channel.invokeMapMethod<String, Object?>(
      'detectFile',
      {'path': path},
    );
    return _parse(result, mirror: false);
  }

  /// Detects a pose in a live camera frame. Throws nothing on bad frames;
  /// returns null when nobody is visible.
  Future<BodyPose?> detectFrame(
    CameraImage image,
    CameraDescription camera,
  ) async {
    final result = await _channel.invokeMapMethod<String, Object?>(
      'detectFrame',
      {
        'bytes': _bytes(image),
        'width': image.width,
        'height': image.height,
        'bytesPerRow': image.planes.first.bytesPerRow,
        'sensorOrientation': camera.sensorOrientation,
        'front': camera.lensDirection == CameraLensDirection.front,
      },
    );
    return _parse(
      result,
      mirror: camera.lensDirection == CameraLensDirection.front,
    );
  }

  static Uint8List _bytes(CameraImage image) {
    // Android: NV21 (one plane). iOS: BGRA (one plane).
    if (image.planes.length == 1) return image.planes.first.bytes;
    final buffer = WriteBuffer();
    for (final plane in image.planes) {
      buffer.putUint8List(plane.bytes);
    }
    return buffer.done().buffer.asUint8List();
  }

  static BodyPose? _parse(
    Map<String, Object?>? result, {
    required bool mirror,
  }) {
    if (result == null) return null;
    final raw = result['joints'] as Map<Object?, Object?>? ?? const {};
    final joints = <Joint, Offset>{};
    for (final entry in raw.entries) {
      final joint = Joint.values.asNameMap()[entry.key];
      final v = (entry.value as List<Object?>).cast<num>();
      if (joint == null || v[2] < _minConfidence) continue;
      final x = v[0].toDouble().clamp(0.0, 1.0);
      joints[joint] = Offset(
        mirror ? 1 - x : x,
        v[1].toDouble().clamp(0.0, 1.0),
      );
    }
    final pose = BodyPose(
      joints,
      aspect: (result['aspect'] as num? ?? 0.75).toDouble(),
    );
    return pose.isEmpty ? null : pose;
  }

  static bool get isSupported => Platform.isIOS || Platform.isAndroid;
}
