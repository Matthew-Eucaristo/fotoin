import 'package:flutter/material.dart';

import '../../../pose/domain/body_pose.dart';

/// Draws the reference pose (target) and the live pose on top of the viewport.
/// Both poses are already normalised to the viewport.
class PosePainter extends CustomPainter {
  PosePainter({
    required this.target,
    required this.live,
    required this.targetColor,
    required this.liveColor,
  });

  final BodyPose? target;
  final BodyPose? live;
  final Color targetColor;
  final Color liveColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (target != null) _draw(canvas, size, target!, targetColor, 7);
    if (live != null) _draw(canvas, size, live!, liveColor, 4);
  }

  void _draw(Canvas canvas, Size size, BodyPose pose, Color color, double w) {
    final line = Paint()
      ..color = color
      ..strokeWidth = w
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final dot = Paint()..color = color;
    Offset at(Offset p) => Offset(p.dx * size.width, p.dy * size.height);

    for (final (a, b) in kLimbs) {
      final pa = pose.joints[a], pb = pose.joints[b];
      if (pa == null || pb == null) continue;
      canvas.drawLine(at(pa), at(pb), line);
    }
    final nose = pose.joints[Joint.nose];
    if (nose != null) canvas.drawCircle(at(nose), w * 2.2, dot);
    for (final p in pose.joints.values) {
      canvas.drawCircle(at(p), w * 0.8, dot);
    }
  }

  @override
  bool shouldRepaint(PosePainter old) =>
      old.live != live || old.target != target || old.liveColor != liveColor;
}
