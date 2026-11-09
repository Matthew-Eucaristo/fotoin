import type { ShotHint } from './features/pose/matcher';

/** Indonesian UI copy, in one place so a language switch is a file swap. */
export const copy = {
  appName: 'Fotoin',
  homeTitle: 'Referensi dia',
  homeSubtitle: 'Simpan foto yang dia mau (dari Pinterest, IG, atau contoh), lalu foto dia persis seperti itu.',
  addReference: 'Tambah referensi',
  readingPose: 'Membaca pose…',
  emptyTitle: 'Belum ada referensi',
  emptyBody: 'Minta dia kirim foto contoh yang dia suka. Simpan di galeri, lalu tambahkan di sini.',
  noPersonFound: 'Orangnya nggak kebaca. Overlay foto tetap bisa dipakai.',
  deleteReference: 'Hapus referensi',
  cancel: 'Batal',

  ghost: 'Foto',
  skeleton: 'Pose',
  autoShoot: 'Auto',
  holdToPeek: 'Tahan untuk lihat referensi',
  noCamera: 'Kamera tidak tersedia di perangkat ini (misalnya simulator). Coba di HP.',
  cameraDenied: 'Fotoin butuh izin kamera.',
  openSettings: 'Buka Pengaturan',
  allowCamera: 'Izinkan kamera',
  shutter: 'Ambil foto',
  close: 'Tutup',

  save: 'Simpan ke Galeri',
  saved: 'Tersimpan',
  retake: 'Ulangi',
  reference: 'Referensi',
  saveDenied: 'Izinkan Fotoin menyimpan ke galeri di Pengaturan.',

  hint: {
    findPerson: 'Arahkan kamera ke dia',
    stepBack: 'Mundur sedikit',
    stepCloser: 'Maju sedikit',
    panLeft: 'Geser HP ke kiri',
    panRight: 'Geser HP ke kanan',
    tiltUp: 'Arahkan HP sedikit ke atas',
    tiltDown: 'Arahkan HP sedikit ke bawah',
    holdLevel: 'Luruskan HP',
    fixLeftArm: 'Tangan kiri dia belum pas',
    fixRightArm: 'Tangan kanan dia belum pas',
    fixLeftLeg: 'Kaki kiri dia belum pas',
    fixRightLeg: 'Kaki kanan dia belum pas',
    fixTorso: 'Badan dia sedikit beda arah',
    hold: 'Pas! Tahan…',
  } satisfies Record<ShotHint, string>,
} as const;
