import 'package:flutter_test/flutter_test.dart';
import 'package:fotoin/features/pose/domain/body_pose.dart';
import 'package:fotoin/features/pose/domain/pose_matcher.dart';

BodyPose standing({double dx = 0, double dy = 0, double scale = 1}) {
  Offset p(double x, double y) =>
      Offset(0.5 + (x - 0.5) * scale + dx, 0.5 + (y - 0.5) * scale + dy);
  return BodyPose({
    Joint.nose: p(0.5, 0.2),
    Joint.leftShoulder: p(0.58, 0.3),
    Joint.rightShoulder: p(0.42, 0.3),
    Joint.leftElbow: p(0.62, 0.42),
    Joint.rightElbow: p(0.38, 0.42),
    Joint.leftWrist: p(0.63, 0.52),
    Joint.rightWrist: p(0.37, 0.52),
    Joint.leftHip: p(0.55, 0.55),
    Joint.rightHip: p(0.45, 0.55),
    Joint.leftKnee: p(0.56, 0.7),
    Joint.rightKnee: p(0.44, 0.7),
    Joint.leftAnkle: p(0.56, 0.85),
    Joint.rightAnkle: p(0.44, 0.85),
  });
}

void main() {
  const matcher = PoseMatcher();

  test('identical pose scores ~1 and says hold', () {
    final r = matcher.match(standing(), standing());
    expect(r.score, greaterThan(0.95));
    expect(r.hint, ShotHint.hold);
  });

  test('subject too big asks to step back', () {
    final r = matcher.match(standing(scale: 1.4), standing());
    expect(r.hint, ShotHint.stepBack);
  });

  test('subject right of target asks to pan right', () {
    final r = matcher.match(standing(dx: 0.15), standing());
    expect(r.hint, ShotHint.panRight);
  });

  test('raised arm is flagged', () {
    final ref = standing();
    final live = BodyPose({
      ...standing().joints,
      Joint.rightElbow: const Offset(0.36, 0.22),
      Joint.rightWrist: const Offset(0.34, 0.12),
    });
    final r = matcher.match(live, ref);
    expect(r.hint, ShotHint.fixRightArm);
    expect(r.poseScore, lessThan(0.9));
  });

  test('mirrored reference still matches', () {
    final r = matcher.match(standing().mirrored(), standing());
    expect(r.score, greaterThan(0.95));
  });

  test('no person gives findPerson', () {
    expect(matcher.match(null, standing()).hint, ShotHint.findPerson);
  });
}
