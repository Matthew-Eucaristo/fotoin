import '../../features/pose/domain/pose_matcher.dart';

/// Indonesian UI copy. Kept in one place so a language switch is a file swap.
abstract final class Copy {
  static const appName = 'Fotoin';
  static const homeTitle = 'Referensi dia';
  static const homeSubtitle =
      'Simpan foto yang dia mau (dari Pinterest, IG, atau contoh), lalu foto dia persis seperti itu.';
  static const addReference = 'Tambah referensi';
  static const emptyTitle = 'Belum ada referensi';
  static const emptyBody =
      'Minta dia kirim foto contoh yang dia suka. Simpan di galeri, lalu tambahkan di sini.';
  static const readingPose = 'Membaca pose…';
  static const noPersonFound =
      'Orangnya nggak kebaca. Overlay foto tetap bisa dipakai.';
  static const deleteReference = 'Hapus referensi';

  static const ghost = 'Foto';
  static const skeleton = 'Pose';
  static const autoShoot = 'Auto';
  static const holdToPeek = 'Tahan untuk lihat referensi';
  static const noCamera =
      'Kamera tidak tersedia di perangkat ini (misalnya simulator). Coba di HP.';
  static const cameraDenied = 'Izinkan akses kamera di Pengaturan.';

  static const save = 'Simpan ke Galeri';
  static const saved = 'Tersimpan di Galeri';
  static const retake = 'Ulangi';
  static const yourShot = 'Hasilmu';
  static const reference = 'Referensi';

  static String hint(ShotHint hint) => switch (hint) {
    ShotHint.findPerson => 'Arahkan kamera ke dia',
    ShotHint.stepBack => 'Mundur sedikit',
    ShotHint.stepCloser => 'Maju sedikit',
    ShotHint.panLeft => 'Geser HP ke kiri',
    ShotHint.panRight => 'Geser HP ke kanan',
    ShotHint.tiltUp => 'Arahkan HP sedikit ke atas',
    ShotHint.tiltDown => 'Arahkan HP sedikit ke bawah',
    ShotHint.holdLevel => 'Luruskan HP',
    ShotHint.fixLeftArm => 'Tangan kiri dia belum pas',
    ShotHint.fixRightArm => 'Tangan kanan dia belum pas',
    ShotHint.fixLeftLeg => 'Kaki kiri dia belum pas',
    ShotHint.fixRightLeg => 'Kaki kanan dia belum pas',
    ShotHint.fixTorso => 'Badan dia sedikit beda arah',
    ShotHint.hold => 'Pas! Tahan…',
  };
}
