import 'dart:math' as math;
import 'dart:ui';

/// Body joints used for matching. Kept independent of any detector SDK so the
/// detector (ML Kit today, Apple Vision later) can be swapped.
enum Joint {
  nose,
  leftShoulder,
  rightShoulder,
  leftElbow,
  rightElbow,
  leftWrist,
  rightWrist,
  leftHip,
  rightHip,
  leftKnee,
  rightKnee,
  leftAnkle,
  rightAnkle,
}

/// Limbs drawn as the skeleton and compared by direction.
const List<(Joint, Joint)> kLimbs = [
  (Joint.leftShoulder, Joint.rightShoulder),
  (Joint.leftHip, Joint.rightHip),
  (Joint.leftShoulder, Joint.leftHip),
  (Joint.rightShoulder, Joint.rightHip),
  (Joint.leftShoulder, Joint.leftElbow),
  (Joint.leftElbow, Joint.leftWrist),
  (Joint.rightShoulder, Joint.rightElbow),
  (Joint.rightElbow, Joint.rightWrist),
  (Joint.leftHip, Joint.leftKnee),
  (Joint.leftKnee, Joint.leftAnkle),
  (Joint.rightHip, Joint.rightKnee),
  (Joint.rightKnee, Joint.rightAnkle),
];

/// A detected pose with joint positions normalised to the image (0..1 on both
/// axes, origin top-left, already in the upright display orientation).
class BodyPose {
  const BodyPose(this.joints, {this.aspect = 3 / 4});

  final Map<Joint, Offset> joints;

  /// Image width / height, used to compare angles without distortion.
  final double aspect;

  bool get isEmpty => joints.length < 4;

  /// Bounding box of the visible joints, normalised.
  Rect get bounds {
    var minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
    for (final p in joints.values) {
      minX = math.min(minX, p.dx);
      minY = math.min(minY, p.dy);
      maxX = math.max(maxX, p.dx);
      maxY = math.max(maxY, p.dy);
    }
    return Rect.fromLTRB(minX, minY, maxX, maxY);
  }

  /// Re-expresses the pose in a viewport of [targetAspect] that shows this
  /// image with BoxFit.cover (centre crop). Joints outside the crop are dropped.
  BodyPose coverInto(double targetAspect) {
    double fx = 1, fy = 1;
    if (aspect > targetAspect) {
      fx = targetAspect / aspect; // image wider: sides cropped
    } else {
      fy = aspect / targetAspect; // image taller: top/bottom cropped
    }
    final ox = (1 - fx) / 2, oy = (1 - fy) / 2;
    final mapped = <Joint, Offset>{};
    for (final e in joints.entries) {
      final x = (e.value.dx - ox) / fx, y = (e.value.dy - oy) / fy;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      mapped[e.key] = Offset(x, y);
    }
    return BodyPose(mapped, aspect: targetAspect);
  }

  /// Horizontal flip; left and right joints swap so limbs still compare.
  BodyPose mirrored() => BodyPose({
    for (final e in joints.entries)
      _mirrorJoint(e.key): Offset(1 - e.value.dx, e.value.dy),
  }, aspect: aspect);

  Map<String, Object> toJson() => {
    'aspect': aspect,
    'joints': {
      for (final e in joints.entries) e.key.name: [e.value.dx, e.value.dy],
    },
  };

  static BodyPose fromJson(Map<String, dynamic> json) {
    final joints = json['joints'] as Map<String, dynamic>;
    return BodyPose({
      for (final e in joints.entries)
        Joint.values.byName(e.key): Offset(
          ((e.value as List)[0] as num).toDouble(),
          ((e.value as List)[1] as num).toDouble(),
        ),
    }, aspect: (json['aspect'] as num).toDouble());
  }

  static Joint _mirrorJoint(Joint j) {
    final name = j.name;
    if (name.startsWith('left')) {
      return Joint.values.byName('right${name.substring(4)}');
    }
    if (name.startsWith('right')) {
      return Joint.values.byName('left${name.substring(5)}');
    }
    return j;
  }
}
