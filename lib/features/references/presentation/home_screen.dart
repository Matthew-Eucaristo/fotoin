import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/copy/id_copy.dart';
import '../../../core/theme/app_theme.dart';
import '../data/reference_store.dart';
import '../providers/references_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _adding = false;

  Future<void> _add() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null || !mounted) return;
    setState(() => _adding = true);
    try {
      final added = await ref
          .read(referencesProvider.notifier)
          .add(picked.path);
      if (!mounted) return;
      if (added.pose == null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text(Copy.noPersonFound)));
      }
      context.push('/shoot/${added.id}');
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _confirmDelete(ReferencePhoto photo) async {
    HapticFeedback.mediumImpact();
    final delete = await showModalBottomSheet<bool>(
      context: context,
      builder: (context) => SafeArea(
        child: ListTile(
          leading: const Icon(Icons.delete_outline, color: AppColors.danger),
          title: const Text(Copy.deleteReference),
          onTap: () => Navigator.pop(context, true),
        ),
      ),
    );
    if (delete == true) {
      await ref.read(referencesProvider.notifier).remove(photo);
    }
  }

  @override
  Widget build(BuildContext context) {
    final refs = ref.watch(referencesProvider);
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Copy.homeTitle,
                      style: text.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      Copy.homeSubtitle,
                      style: text.bodyMedium?.copyWith(
                        color: AppColors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            switch (refs) {
              AsyncData(:final value) when value.isEmpty =>
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyState(),
                ),
              AsyncData(:final value) => SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 140),
                sliver: SliverGrid.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 3 / 4,
                  ),
                  itemCount: value.length,
                  itemBuilder: (context, i) => _ReferenceTile(
                    photo: value[i],
                    onTap: () => context.push('/shoot/${value[i].id}'),
                    onLongPress: () => _confirmDelete(value[i]),
                  ),
                ),
              ),
              AsyncError(:final error) => SliverFillRemaining(
                child: Center(child: Text('$error')),
              ),
              _ => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
            },
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: FilledButton.icon(
          onPressed: _adding ? null : _add,
          icon: _adding
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : const Icon(Icons.add_photo_alternate_outlined),
          label: Text(_adding ? Copy.readingPose : Copy.addReference),
        ),
      ),
    );
  }
}

class _ReferenceTile extends StatelessWidget {
  const _ReferenceTile({
    required this.photo,
    required this.onTap,
    required this.onLongPress,
  });

  final ReferencePhoto photo;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    return Hero(
      tag: 'ref-${photo.id}',
      child: Material(
        color: AppColors.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.control),
        ),
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: Ink.image(
            image: ResizeImage(
              FileImage(File(photo.imagePath)),
              width: 480, // decode small: keeps the grid light
            ),
            fit: BoxFit.cover,
            child: photo.pose == null
                ? null
                : const Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: EdgeInsets.all(8),
                      child: CircleAvatar(
                        radius: 12,
                        backgroundColor: Color(0xCC1F1F1F),
                        child: Icon(
                          Icons.accessibility_new,
                          size: 15,
                          color: AppColors.amber,
                        ),
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.photo_camera_back_outlined,
            size: 56,
            color: AppColors.amber,
          ),
          const SizedBox(height: 16),
          Text(
            Copy.emptyTitle,
            style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            Copy.emptyBody,
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: AppColors.inkMuted),
          ),
        ],
      ),
    );
  }
}
