import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gal/gal.dart';
import 'package:go_router/go_router.dart';

import '../../../core/copy/id_copy.dart';
import '../../../core/theme/app_theme.dart';
import '../../references/providers/references_provider.dart';

typedef ReviewArgs = ({String shotPath, String referenceId});

/// Shows the shot next to the reference; save or retake.
class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key, required this.args});

  final ReviewArgs args;

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  bool _saving = false;
  bool _saved = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await Gal.putImage(widget.args.shotPath, album: Copy.appName);
      HapticFeedback.mediumImpact();
      setState(() => _saved = true);
    } on GalException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.type.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reference = ref
        .watch(referencesProvider)
        .value
        ?.where((r) => r.id == widget.args.referenceId)
        .firstOrNull;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadii.panel),
                        child: Image.file(
                          File(widget.args.shotPath),
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ),
                  if (reference != null)
                    Positioned(
                      right: 24,
                      bottom: 24,
                      width: 96,
                      child: _Labeled(
                        label: Copy.reference,
                        child: AspectRatio(
                          aspectRatio: reference.aspect,
                          child: Image.file(
                            File(reference.imagePath),
                            fit: BoxFit.cover,
                            cacheWidth: 300,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Row(
                spacing: 12,
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.pop(),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        foregroundColor: AppColors.ink,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.control),
                        ),
                      ),
                      child: const Text(Copy.retake),
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _saving || _saved ? null : _save,
                      icon: Icon(
                        _saved ? Icons.check_rounded : Icons.download_rounded,
                      ),
                      label: Text(_saved ? Copy.saved : Copy.save),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Labeled extends StatelessWidget {
  const _Labeled({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.ink, width: 2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: child,
          ),
        ),
      ],
    );
  }
}
