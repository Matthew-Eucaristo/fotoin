import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../../../core/copy/id_copy.dart';
import '../../../core/theme/app_theme.dart';
import '../../pose/data/native_pose_detector.dart';
import '../../pose/domain/body_pose.dart';
import '../../pose/domain/pose_matcher.dart';
import '../../references/data/reference_store.dart';
import '../../references/providers/references_provider.dart';
import 'widgets/match_meter.dart';
import 'widgets/pose_painter.dart';

/// One lens choice: a physical camera plus a zoom level on it.
typedef _Lens = ({String label, CameraDescription camera, double zoom});

class ShootScreen extends ConsumerStatefulWidget {
  const ShootScreen({super.key, required this.referenceId});

  final String referenceId;

  @override
  ConsumerState<ShootScreen> createState() => _ShootScreenState();
}

class _ShootScreenState extends ConsumerState<ShootScreen>
    with WidgetsBindingObserver {
  static const _autoThreshold = 0.8;
  static const _autoHold = Duration(milliseconds: 700);
  static const _frameInterval = Duration(milliseconds: 80); // ~12 fps analysis

  CameraController? _controller;
  List<_Lens> _lenses = const [];
  int _lensIndex = 0;
  bool _noCamera = false;
  bool _opening = false;
  bool _denied = false;

  final _detector = NativePoseDetector();
  bool _busy = false;
  DateTime _lastFrame = DateTime(0);

  BodyPose? _live; // normalised to the upright camera frame
  MatchResult _match = MatchResult.none;
  double _roll = 0;
  StreamSubscription<AccelerometerEvent>? _tilt;

  bool _showGhost = true;
  bool _showPose = true;
  bool _auto = true;
  double _opacity = 0.35;
  bool _peek = false;
  bool _capturing = false;
  DateTime? _matchedSince;

  ReferencePhoto? get _ref =>
      ref.read(referencesProvider.notifier).byId(widget.referenceId);

  /// Viewport aspect follows the reference, clamped to sensible portrait
  /// shapes so the shot is framed like the reference.
  double get _viewAspect => (_ref?.aspect ?? 3 / 4).clamp(9 / 16, 1.0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tilt = accelerometerEventStream(samplingPeriod: SensorInterval.uiInterval)
        .listen((e) {
          final roll = math.atan2(e.x, e.y) * 180 / math.pi;
          _roll = _roll * 0.8 + roll * 0.2;
        });
    _setupCameras();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tilt?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Permission dialogs also make the app inactive; only release a camera
    // that is actually open, and only reopen once lenses are known.
    final c = _controller;
    if (state == AppLifecycleState.inactive && c != null) {
      _controller = null;
      c.dispose();
      if (mounted) setState(() {});
    } else if (state == AppLifecycleState.resumed &&
        c == null &&
        !_opening &&
        _lenses.isNotEmpty) {
      _openLens(_lensIndex);
    }
  }

  Future<void> _setupCameras() async {
    final cameras = await availableCameras();
    final back = cameras
        .where((c) => c.lensDirection == CameraLensDirection.back)
        .toList();
    if (back.isEmpty) {
      setState(() => _noCamera = true);
      return;
    }
    final main = back.firstWhere(
      (c) => c.lensType == CameraLensType.wide,
      orElse: () => back.first,
    );
    final ultraWide = back
        .where((c) => c.lensType == CameraLensType.ultraWide)
        .firstOrNull;

    // Probe zoom range of the main camera once to decide 0.5x / 2x options.
    final probe = CameraController(
      main,
      ResolutionPreset.low,
      enableAudio: false,
    );
    var minZoom = 1.0, maxZoom = 1.0;
    try {
      await probe.initialize();
      minZoom = await probe.getMinZoomLevel();
      maxZoom = await probe.getMaxZoomLevel();
    } on CameraException catch (e) {
      if (e.code.contains('Denied')) {
        setState(() => _denied = true);
        return;
      }
    } finally {
      await probe.dispose();
    }

    _lenses = [
      if (ultraWide != null)
        (label: '0.5', camera: ultraWide, zoom: 1.0)
      else if (minZoom < 0.99)
        (label: '0.5', camera: main, zoom: math.max(minZoom, 0.5)),
      (label: '1', camera: main, zoom: 1.0),
      if (maxZoom >= 2) (label: '2', camera: main, zoom: 2.0),
    ];
    _lensIndex = _lenses.indexWhere((l) => l.label == '1');
    await _openLens(_lensIndex);
  }

  Future<void> _openLens(int index) async {
    if (_opening || index < 0 || index >= _lenses.length) return;
    _opening = true;
    try {
      await _openLensUnguarded(index);
    } finally {
      _opening = false;
    }
  }

  Future<void> _openLensUnguarded(int index) async {
    final lens = _lenses[index];
    final old = _controller;
    final reuse = old != null && old.description == lens.camera;
    if (reuse) {
      await old.setZoomLevel(lens.zoom);
      setState(() => _lensIndex = index);
      return;
    }
    _controller = null;
    if (mounted) setState(() {});
    await old?.dispose();

    final c = CameraController(
      lens.camera,
      ResolutionPreset.veryHigh,
      enableAudio: false,
      imageFormatGroup: Platform.isAndroid
          ? ImageFormatGroup.nv21
          : ImageFormatGroup.bgra8888,
    );
    try {
      await c.initialize();
      await c.lockCaptureOrientation(DeviceOrientation.portraitUp);
      if (lens.zoom != 1) await c.setZoomLevel(lens.zoom);
      await c.startImageStream(_onFrame);
    } on CameraException catch (e) {
      await c.dispose();
      if (mounted) setState(() => _denied = e.code.contains('Denied'));
      return;
    }
    if (!mounted) {
      await c.dispose();
      return;
    }
    setState(() {
      _controller = c;
      _lensIndex = index;
    });
  }

  Future<void> _onFrame(CameraImage image) async {
    final now = DateTime.now();
    if (_busy || now.difference(_lastFrame) < _frameInterval) return;
    final c = _controller;
    final reference = _ref;
    if (c == null || reference == null) return;
    _busy = true;
    _lastFrame = now;
    try {
      final live = await _detector.detectFrame(image, c.description);
      if (!mounted) return;
      final target = reference.pose?.coverInto(_viewAspect);
      final liveInView = live?.coverInto(_viewAspect);
      final match = target == null
          ? MatchResult.none
          : PoseMatcher(rollDegrees: _roll).match(liveInView, target);
      setState(() {
        _live = live;
        _match = match;
      });
      _checkAuto(match);
    } catch (_) {
      // A dropped frame is fine; the next one will be analysed.
    } finally {
      _busy = false;
    }
  }

  void _checkAuto(MatchResult match) {
    if (!_auto || _capturing || _ref?.pose == null) return;
    if (match.score < _autoThreshold) {
      _matchedSince = null;
      return;
    }
    _matchedSince ??= DateTime.now();
    if (DateTime.now().difference(_matchedSince!) >= _autoHold) {
      _matchedSince = null;
      _capture();
    } else {
      HapticFeedback.selectionClick();
    }
  }

  Future<void> _capture() async {
    final c = _controller;
    if (c == null || _capturing) return;
    setState(() => _capturing = true);
    HapticFeedback.heavyImpact();
    try {
      if (c.value.isStreamingImages) await c.stopImageStream();
      final file = await c.takePicture();
      if (!mounted) return;
      await context.push(
        '/review',
        extra: (shotPath: file.path, referenceId: widget.referenceId),
      );
    } on CameraException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.description ?? e.code)));
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
      if (_controller == c && !c.value.isStreamingImages) {
        await c.startImageStream(_onFrame);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final reference = ref
        .watch(referencesProvider)
        .value
        ?.where((r) => r.id == widget.referenceId)
        .firstOrNull;
    if (reference == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final target = reference.pose?.coverInto(_viewAspect);
    final live = _live?.coverInto(_viewAspect);
    final c = _controller;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _TopBar(
              onClose: () => context.pop(),
              meter: MatchMeter(
                result: _match,
                enabled: reference.pose != null && !_peek,
              ),
            ),
            Expanded(
              child: Center(
                child: AspectRatio(
                  aspectRatio: _viewAspect,
                  child: GestureDetector(
                    onLongPressStart: (_) => setState(() => _peek = true),
                    onLongPressEnd: (_) => setState(() => _peek = false),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadii.panel),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (c != null && c.value.isInitialized)
                            _CoverPreview(controller: c)
                          else
                            _CameraPlaceholder(
                              message: _denied
                                  ? Copy.cameraDenied
                                  : _noCamera
                                  ? Copy.noCamera
                                  : null,
                            ),
                          if (_showGhost || _peek)
                            AnimatedOpacity(
                              duration: AppMotion.fast,
                              opacity: _peek ? 1 : _opacity,
                              child: Hero(
                                tag: 'ref-${reference.id}',
                                child: Image.file(
                                  File(reference.imagePath),
                                  fit: BoxFit.cover,
                                  gaplessPlayback: true,
                                ),
                              ),
                            ),
                          if (_showPose && !_peek)
                            CustomPaint(
                              painter: PosePainter(
                                target: target,
                                live: live,
                                targetColor: AppColors.ink.withValues(
                                  alpha: 0.55,
                                ),
                                liveColor: MatchMeter.colorFor(_match.score),
                              ),
                            ),
                          if (_capturing)
                            const ColoredBox(color: Color(0x66000000)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            _Controls(
              showGhost: _showGhost,
              showPose: _showPose,
              auto: _auto,
              hasPose: reference.pose != null,
              opacity: _opacity,
              lenses: _lenses.map((l) => l.label).toList(),
              lensIndex: _lensIndex,
              onGhost: () => setState(() => _showGhost = !_showGhost),
              onPose: () => setState(() => _showPose = !_showPose),
              onAuto: () => setState(() => _auto = !_auto),
              onOpacity: (v) => setState(() => _opacity = v),
              onLens: (i) {
                HapticFeedback.selectionClick();
                _openLens(i);
              },
              onShutter: c == null ? null : _capture,
            ),
          ],
        ),
      ),
    );
  }
}

/// Camera preview cropped (BoxFit.cover) into the viewport, matching how the
/// reference and pose overlays are mapped.
class _CoverPreview extends StatelessWidget {
  const _CoverPreview({required this.controller});

  final CameraController controller;

  @override
  Widget build(BuildContext context) {
    final size = controller.value.previewSize!;
    // previewSize is reported in landscape; the app is portrait.
    final w = math.min(size.width, size.height);
    final h = math.max(size.width, size.height);
    return FittedBox(
      fit: BoxFit.cover,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(width: w, height: h, child: CameraPreview(controller)),
    );
  }
}

class _CameraPlaceholder extends StatelessWidget {
  const _CameraPlaceholder({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.surface,
      child: Center(
        child: message == null
            ? const CircularProgressIndicator()
            : Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.inkMuted),
                ),
              ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onClose, required this.meter});

  final VoidCallback onClose;
  final Widget meter;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 12),
      child: Row(
        children: [
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded),
            color: AppColors.ink,
            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Align(alignment: Alignment.centerLeft, child: meter),
          ),
        ],
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({
    required this.showGhost,
    required this.showPose,
    required this.auto,
    required this.hasPose,
    required this.opacity,
    required this.lenses,
    required this.lensIndex,
    required this.onGhost,
    required this.onPose,
    required this.onAuto,
    required this.onOpacity,
    required this.onLens,
    required this.onShutter,
  });

  final bool showGhost, showPose, auto, hasPose;
  final double opacity;
  final List<String> lenses;
  final int lensIndex;
  final VoidCallback onGhost, onPose, onAuto;
  final ValueChanged<double> onOpacity;
  final ValueChanged<int> onLens;
  final VoidCallback? onShutter;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedSize(
            duration: AppMotion.normal,
            child: showGhost
                ? Row(
                    children: [
                      const Icon(
                        Icons.opacity_rounded,
                        size: 18,
                        color: AppColors.inkMuted,
                      ),
                      Expanded(
                        child: Slider(
                          value: opacity,
                          min: 0.1,
                          max: 0.8,
                          onChanged: onOpacity,
                        ),
                      ),
                    ],
                  )
                : const SizedBox(width: double.infinity),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 8,
            children: [
              _Toggle(label: Copy.ghost, on: showGhost, onTap: onGhost),
              if (hasPose) ...[
                _Toggle(label: Copy.skeleton, on: showPose, onTap: onPose),
                _Toggle(label: Copy.autoShoot, on: auto, onTap: onAuto),
              ],
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 84,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _Shutter(onTap: onShutter),
                if (lenses.length > 1)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: _LensPicker(
                      labels: lenses,
                      selected: lensIndex,
                      onSelect: onLens,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({required this.label, required this.on, required this.onTap});

  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: on,
      onSelected: (_) {
        HapticFeedback.selectionClick();
        onTap();
      },
      showCheckmark: false,
      selectedColor: AppColors.amber,
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        color: on ? AppColors.bg : AppColors.ink,
      ),
      backgroundColor: AppColors.surfaceHigh,
      side: BorderSide.none,
      shape: const StadiumBorder(),
    );
  }
}

class _LensPicker extends StatelessWidget {
  const _LensPicker({
    required this.labels,
    required this.selected,
    required this.onSelect,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < labels.length; i++)
              GestureDetector(
                onTap: () => onSelect(i),
                child: AnimatedContainer(
                  duration: AppMotion.fast,
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i == selected
                        ? AppColors.surfaceHigh
                        : Colors.transparent,
                  ),
                  child: Text(
                    i == selected ? '${labels[i]}×' : labels[i],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: i == selected ? AppColors.amber : AppColors.ink,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Shutter extends StatelessWidget {
  const _Shutter({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Ambil foto',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 76,
          height: 76,
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.ink, width: 4),
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: onTap == null ? AppColors.inkMuted : AppColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}
