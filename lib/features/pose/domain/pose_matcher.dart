import 'dart:math' as math;
import 'dart:ui';

import 'body_pose.dart';

/// What the photographer should do next, most important first.
enum ShotHint {
  findPerson,
  stepBack,
  stepCloser,
  panLeft,
  panRight,
  tiltUp,
  tiltDown,
  holdLevel,
  fixLeftArm,
  fixRightArm,
  fixLeftLeg,
  fixRightLeg,
  fixTorso,
  hold,
}

class MatchResult {
  const MatchResult({
    required this.score,
    required this.poseScore,
    required this.placementScore,
    required this.hint,
  });

  static const none = MatchResult(
    score: 0,
    poseScore: 0,
    placementScore: 0,
    hint: ShotHint.findPerson,
  );

  /// 0..1 overall similarity.
  final double score;
  final double poseScore;
  final double placementScore;
  final ShotHint hint;
}

/// Compares a live pose against a reference pose.
///
/// Pose similarity compares limb directions (scale and position invariant).
/// Placement compares where the body sits in the frame and how big it is, which
/// tells the photographer to move, rather than the subject.
class PoseMatcher {
  const PoseMatcher({this.rollDegrees = 0});

  /// Phone roll from the accelerometer; non-zero means the frame is tilted.
  final double rollDegrees;

  static const _placementTolerance = 0.07;
  static const _sizeTolerance = 0.12;
  static const _limbToleranceRad = math.pi / 3; // 60° → score 0

  MatchResult match(BodyPose? live, BodyPose reference) {
    if (live == null || live.isEmpty || reference.isEmpty) {
      return MatchResult.none;
    }
    // Pinterest images are often flipped; accept whichever side fits better.
    final a = _matchOriented(live, reference);
    final b = _matchOriented(live, reference.mirrored());
    return a.score >= b.score ? a : b;
  }

  MatchResult _matchOriented(BodyPose live, BodyPose ref) {
    // Limb directions.
    final limbScores = <(Joint, Joint), double>{};
    for (final limb in kLimbs) {
      final la = _vector(live, limb);
      final ra = _vector(ref, limb);
      if (la == null || ra == null) continue;
      final diff = _angleBetween(la, ra);
      limbScores[limb] = math.max(0, 1 - diff / _limbToleranceRad);
    }
    final poseScore = limbScores.isEmpty
        ? 0.0
        : limbScores.values.reduce((x, y) => x + y) / limbScores.length;

    // Placement in frame, anchored on the torso so moving arms do not count.
    final la = _anchor(live), ra = _anchor(ref);
    final dx = la.center.dx - ra.center.dx;
    final dy = la.center.dy - ra.center.dy;
    final sizeRatio = ra.size <= 0 ? 1.0 : la.size / ra.size;
    final placementError =
        dx.abs() + dy.abs() + (math.log(sizeRatio).abs() * 0.8);
    final placementScore = math.max(0.0, 1 - placementError / 0.6);

    final levelPenalty = rollDegrees.abs() > 4 ? 0.1 : 0.0;
    final score = (0.6 * poseScore + 0.4 * placementScore - levelPenalty).clamp(
      0.0,
      1.0,
    );

    return MatchResult(
      score: score,
      poseScore: poseScore,
      placementScore: placementScore,
      hint: _hint(dx, dy, sizeRatio, limbScores),
    );
  }

  ShotHint _hint(
    double dx,
    double dy,
    double sizeRatio,
    Map<(Joint, Joint), double> limbScores,
  ) {
    if (sizeRatio > 1 + _sizeTolerance) return ShotHint.stepBack;
    if (sizeRatio < 1 - _sizeTolerance) return ShotHint.stepCloser;
    // Subject sits right of the target → turn the phone right.
    if (dx > _placementTolerance) return ShotHint.panRight;
    if (dx < -_placementTolerance) return ShotHint.panLeft;
    // Subject sits lower than the target → aim lower.
    if (dy > _placementTolerance) return ShotHint.tiltDown;
    if (dy < -_placementTolerance) return ShotHint.tiltUp;
    if (rollDegrees.abs() > 4) return ShotHint.holdLevel;

    if (limbScores.isEmpty) return ShotHint.findPerson;
    final worst = limbScores.entries.reduce(
      (a, b) => a.value <= b.value ? a : b,
    );
    if (worst.value > 0.8) return ShotHint.hold;
    return _limbHint(worst.key);
  }

  static ShotHint _limbHint((Joint, Joint) limb) {
    final names = '${limb.$1.name} ${limb.$2.name}';
    final isLeft =
        limb.$1.name.startsWith('left') && limb.$2.name.startsWith('left');
    final isRight =
        limb.$1.name.startsWith('right') && limb.$2.name.startsWith('right');
    final isArm = names.contains('Elbow') || names.contains('Wrist');
    final isLeg = names.contains('Knee') || names.contains('Ankle');
    if (isArm && isLeft) return ShotHint.fixLeftArm;
    if (isArm && isRight) return ShotHint.fixRightArm;
    if (isLeg && isLeft) return ShotHint.fixLeftLeg;
    if (isLeg && isRight) return ShotHint.fixRightLeg;
    return ShotHint.fixTorso;
  }

  /// Torso centre and length (shoulder midpoint → hip midpoint); falls back to
  /// the joint bounds when the torso is not visible.
  static ({Offset center, double size}) _anchor(BodyPose pose) {
    final j = pose.joints;
    final ls = j[Joint.leftShoulder], rs = j[Joint.rightShoulder];
    final lh = j[Joint.leftHip], rh = j[Joint.rightHip];
    if (ls != null && rs != null && lh != null && rh != null) {
      final shoulders = (ls + rs) / 2, hips = (lh + rh) / 2;
      return (
        center: (shoulders + hips) / 2,
        size: (hips - shoulders).distance,
      );
    }
    final b = pose.bounds;
    return (center: b.center, size: b.height);
  }

  static (double, double)? _vector(BodyPose pose, (Joint, Joint) limb) {
    final a = pose.joints[limb.$1];
    final b = pose.joints[limb.$2];
    if (a == null || b == null) return null;
    // Scale x by aspect so angles are measured in real proportions.
    return ((b.dx - a.dx) * pose.aspect, b.dy - a.dy);
  }

  static double _angleBetween((double, double) a, (double, double) b) {
    final dot = a.$1 * b.$1 + a.$2 * b.$2;
    final mag =
        math.sqrt(a.$1 * a.$1 + a.$2 * a.$2) *
        math.sqrt(b.$1 * b.$1 + b.$2 * b.$2);
    if (mag == 0) return math.pi;
    return math.acos((dot / mag).clamp(-1.0, 1.0));
  }
}
