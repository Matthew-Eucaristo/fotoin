import 'package:flutter/material.dart';

/// Dark camera-app tokens: one amber
/// call-to-action colour, teal accent, near-black surfaces. System fonts keep
/// the app light and native on both platforms.
abstract final class AppColors {
  static const bg = Color(0xFF1F1F1F);
  static const surface = Color(0xFF262626);
  static const surfaceHigh = Color(0xFF303030);
  static const ink = Color(0xFFF7F7F7);
  static const inkMuted = Color(0xFFB4B4B4);
  static const amber = Color(0xFFFFC045);
  static const teal = Color(0xFF2FA7A1);
  static const danger = Color(0xFFFF6B5E);
}

abstract final class AppRadii {
  static const panel = 24.0;
  static const control = 16.0;
}

abstract final class AppMotion {
  static const fast = Duration(milliseconds: 140);
  static const normal = Duration(milliseconds: 260);
  static const slow = Duration(milliseconds: 380);
}

ThemeData buildAppTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: AppColors.amber,
        brightness: Brightness.dark,
      ).copyWith(
        primary: AppColors.amber,
        onPrimary: const Color(0xFF1F1F1F),
        secondary: AppColors.teal,
        surface: AppColors.bg,
        onSurface: AppColors.ink,
        surfaceContainer: AppColors.surface,
        surfaceContainerHigh: AppColors.surfaceHigh,
        error: AppColors.danger,
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.ink,
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadii.panel),
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.surfaceHigh,
      contentTextStyle: const TextStyle(color: AppColors.ink, fontSize: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
    ),
    sliderTheme: const SliderThemeData(
      activeTrackColor: AppColors.amber,
      thumbColor: AppColors.amber,
      inactiveTrackColor: Color(0x55F7F7F7),
    ),
  );
}
