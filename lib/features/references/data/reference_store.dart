import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import '../../pose/data/native_pose_detector.dart';
import '../../pose/domain/body_pose.dart';

/// A reference photo the partner wants recreated. Stored only on this device:
/// Pinterest images are someone else's work, used privately as a guide.
class ReferencePhoto {
  const ReferencePhoto({
    required this.id,
    required this.imagePath,
    required this.aspect,
    required this.createdAt,
    this.pose,
  });

  final String id;
  final String imagePath;

  /// Image width / height.
  final double aspect;
  final DateTime createdAt;

  /// Null when no person was found; the ghost overlay still works.
  final BodyPose? pose;

  Map<String, Object?> toJson(String dir) => {
    'id': id,
    'file': imagePath.substring(dir.length + 1),
    'aspect': aspect,
    'createdAt': createdAt.toIso8601String(),
    'pose': pose?.toJson(),
  };

  static ReferencePhoto fromJson(Map<String, dynamic> json, String dir) =>
      ReferencePhoto(
        id: json['id'] as String,
        imagePath: '$dir/${json['file']}',
        aspect: (json['aspect'] as num).toDouble(),
        createdAt: DateTime.parse(json['createdAt'] as String),
        pose: json['pose'] == null
            ? null
            : BodyPose.fromJson(json['pose'] as Map<String, dynamic>),
      );
}

class ReferenceStore {
  Future<Directory> _dir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/references');
    if (!dir.existsSync()) await dir.create(recursive: true);
    return dir;
  }

  Future<File> _index() async => File('${(await _dir()).path}/index.json');

  Future<List<ReferencePhoto>> load() async {
    final dir = await _dir();
    final index = await _index();
    if (!index.existsSync()) return [];
    final list = jsonDecode(await index.readAsString()) as List<dynamic>;
    return [
      for (final item in list)
        ReferencePhoto.fromJson(item as Map<String, dynamic>, dir.path),
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  Future<void> _save(List<ReferencePhoto> items) async {
    final dir = await _dir();
    await (await _index()).writeAsString(
      jsonEncode([for (final r in items) r.toJson(dir.path)]),
    );
  }

  /// Copies the picked image into app storage and reads its pose once.
  Future<ReferencePhoto> add(String sourcePath) async {
    final dir = await _dir();
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    final ext = sourcePath.contains('.') ? sourcePath.split('.').last : 'jpg';
    final copy = await File(sourcePath).copy('${dir.path}/$id.$ext');

    final bytes = await copy.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final aspect = frame.image.width / frame.image.height;
    frame.image.dispose();

    BodyPose? pose;
    try {
      pose = await NativePoseDetector().detectFile(copy.path);
    } on PlatformException {
      pose = null; // the ghost overlay still works without a pose
    }

    final ref = ReferencePhoto(
      id: id,
      imagePath: copy.path,
      aspect: aspect,
      createdAt: DateTime.now(),
      pose: pose,
    );
    await _save([ref, ...await load()]);
    return ref;
  }

  Future<void> remove(ReferencePhoto ref) async {
    final items = (await load()).where((r) => r.id != ref.id).toList();
    await _save(items);
    final file = File(ref.imagePath);
    if (file.existsSync()) await file.delete();
  }
}
