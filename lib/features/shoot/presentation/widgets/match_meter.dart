import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../core/copy/id_copy.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../pose/domain/pose_matcher.dart';

/// Floating glass pill: score ring + the one thing to fix next.
class MatchMeter extends StatelessWidget {
  const MatchMeter({super.key, required this.result, required this.enabled});

  final MatchResult result;
  final bool enabled;

  static Color colorFor(double score) => score >= 0.8
      ? AppColors.amber
      : Color.lerp(AppColors.inkMuted, AppColors.teal, score / 0.8)!;

  @override
  Widget build(BuildContext context) {
    final color = colorFor(result.score);
    final percent = (result.score * 100).round();
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: AnimatedContainer(
          duration: AppMotion.normal,
          padding: const EdgeInsets.fromLTRB(6, 6, 18, 6),
          decoration: BoxDecoration(
            color: const Color(0x991F1F1F),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: color.withValues(alpha: 0.6)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox.square(
                dimension: 40,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(end: enabled ? result.score : 0),
                      duration: AppMotion.normal,
                      builder: (context, v, _) => CircularProgressIndicator(
                        value: v,
                        strokeWidth: 4,
                        color: color,
                        backgroundColor: const Color(0x33F7F7F7),
                        strokeCap: StrokeCap.round,
                      ),
                    ),
                    Text(
                      enabled ? '$percent' : '–',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: AnimatedSwitcher(
                  duration: AppMotion.fast,
                  child: Text(
                    enabled ? Copy.hint(result.hint) : Copy.holdToPeek,
                    key: ValueKey(enabled ? result.hint : null),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
