import type { MatchResult, ShotHint } from './features/pose/matcher';

/** Indonesian UI copy, in one place so a language switch is a file swap. */
export const copy = {
  appName: 'Fotoin',
  about: 'Tentang Fotoin',
  version: (v: string) => `Versi ${v}`,
  privacyPolicy: 'Kebijakan privasi',
  sourceCode: 'Kode sumber (open source)',
  promises: [
    {
      icon: { ios: 'gift', android: 'redeem' },
      title: 'Gratis, tanpa iklan',
      body: 'Tidak ada iklan, langganan, atau akun. Selamanya.',
    },
    {
      icon: { ios: 'lock.iphone', android: 'phonelink_lock' },
      title: 'Semua di HP-mu',
      body: 'Pose dibaca langsung di perangkat. Foto dan referensi tidak pernah dikirim ke mana pun.',
    },
    {
      icon: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code' },
      title: 'Open source',
      body: 'Kodenya terbuka untuk dipelajari dan dikembangkan bersama.',
    },
  ] as const,
  steps: [
    { title: 'Pilih pose', body: 'Dari galeri (simpanan Pinterest, IG) atau ambil foto contoh.' },
    { title: 'Ikuti panduan', body: 'Kerangka pose dan petunjuk memberi tahu cara memotret.' },
    { title: 'Jepret otomatis', body: 'Kamera memotret sendiri saat posenya sudah pas.' },
  ] as const,
  homeTitle: 'Referensi pose',
  homeSubtitle: 'Simpan pose yang kamu suka (Pinterest, IG, atau foto contoh), lalu potret subjekmu persis seperti itu.',
  addReference: 'Tambah referensi',
  fromGallery: 'Dari galeri',
  takeExample: 'Foto contoh',
  exampleHint: 'Foto contoh pose yang diinginkan',
  readingPose: 'Membaca pose…',
  emptyTitle: 'Cara pakai',
  noPersonFound: 'Orangnya nggak kebaca. Overlay foto tetap bisa dipakai.',
  deleteReference: 'Hapus referensi',
  cancel: 'Batal',

  ghost: 'Foto',
  skeleton: 'Pose',
  faceGuide: 'Wajah',
  autoShoot: 'Auto',
  holdToPeek: 'Tahan untuk lihat referensi',
  grid: 'Grid',
  noCamera: 'Kamera tidak tersedia di perangkat ini (misalnya simulator). Coba di HP.',
  cameraDenied: 'Fotoin butuh izin kamera.',
  openSettings: 'Buka Pengaturan',
  allowCamera: 'Izinkan kamera',
  shutter: 'Ambil foto',
  close: 'Tutup',

  save: 'Simpan ke Galeri',
  savePose: 'Simpan pose',
  poseSaved: 'Pose tersimpan',
  saved: 'Tersimpan',
  retake: 'Ulangi',
  reference: 'Referensi',
  saveDenied: 'Izinkan Fotoin menyimpan ke galeri di Pengaturan.',

  hint: {
    findPerson: 'Arahkan kamera ke subjek',
    stepBack: 'Mundur sedikit',
    stepCloser: 'Maju sedikit',
    panLeft: 'Geser HP ke kiri',
    panRight: 'Geser HP ke kanan',
    tiltUp: 'Arahkan HP sedikit ke atas',
    tiltDown: 'Arahkan HP sedikit ke bawah',
    holdLevel: 'Luruskan HP',
    fixLeftArm: 'Tangan kiri belum pas',
    fixRightArm: 'Tangan kanan belum pas',
    fixLeftLeg: 'Kaki kiri belum pas',
    fixRightLeg: 'Kaki kanan belum pas',
    fixTorso: 'Arah badan belum pas',
    turnLeft: 'Menoleh ke kiri layar',
    turnRight: 'Menoleh ke kanan layar',
    tiltHeadLeft: 'Miringkan kepala ke kiri layar',
    tiltHeadRight: 'Miringkan kepala ke kanan layar',
    chinUp: 'Angkat dagu sedikit',
    chinDown: 'Turunkan dagu sedikit',
    needMorePeople: 'Perlu lebih banyak orang di frame',
    spreadApart: 'Minta mereka berdiri lebih berjauhan',
    closeTogether: 'Minta mereka lebih berdekatan',
    hold: 'Pas! Tahan…',
  } satisfies Record<ShotHint, string>,
} as const;

/** Position labels for people in a group, left → right on screen. */
function personLabel(index: number, people: number): string {
  if (people === 2) return index === 0 ? 'Orang kiri' : 'Orang kanan';
  if (people === 3) return ['Orang kiri', 'Orang tengah', 'Orang kanan'][index];
  return `Orang ke-${index + 1}`;
}

/** The hint line shown on the meter, naming the person in group shots. */
export function hintText(result: MatchResult): string {
  if (result.hint === 'needMorePeople' && result.people) return `Perlu ${result.people} orang di frame`;
  const text = copy.hint[result.hint];
  if (result.person === undefined || !result.people) return text;
  return `${personLabel(result.person, result.people)}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
