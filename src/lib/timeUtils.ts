// ============================================================================
// UTILITY: MANAJEMEN FORMAT WAKTU OPERASIONAL GUDANG 24 JAM
// Mengonversi waktu ke format standar 24 jam ketat (00:00 s.d. 23:59)
// Menghilangkan format 12 jam (AM/PM) agar data laporan rapi & konsisten
// ============================================================================

/**
 * Mendapatkan waktu lokal saat ini dalam format 24 jam HH:mm (misal: "14:30")
 */
export const getCurrent24HourTime = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Mengonversi atau menormalisasi string waktu ke format 24 jam ketat (HH:mm).
 * Menangani string input seperti "02:30 PM" -> "14:30", "08:15 AM" -> "08:15", atau "1700" -> "17:00".
 */
export const convertTo24Hour = (timeStr?: string | null): string => {
  if (!timeStr || typeof timeStr !== 'string') return getCurrent24HourTime();
  const trimmed = timeStr.trim();
  if (!trimmed) return getCurrent24HourTime();

  const isPM = /pm/i.test(trimmed);
  const isAM = /am/i.test(trimmed);

  // Bersihkan semua karakter selain angka dan titik dua
  const cleaned = trimmed.replace(/[^0-9:]/g, '');
  if (!cleaned) return getCurrent24HourTime();

  let hours = 0;
  let minutes = 0;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    hours = parseInt(parts[0] || '0', 10);
    minutes = parseInt(parts[1] || '0', 10);
  } else if (cleaned.length <= 2) {
    hours = parseInt(cleaned, 10);
    minutes = 0;
  } else {
    hours = parseInt(cleaned.slice(0, 2), 10);
    minutes = parseInt(cleaned.slice(2, 4), 10);
  }

  if (isNaN(hours)) hours = 0;
  if (isNaN(minutes)) minutes = 0;

  // Logika konversi 12 jam (AM/PM) ke format 24 jam
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  // Batasi jam (0-23) dan menit (0-59)
  hours = Math.min(Math.max(0, hours), 23);
  minutes = Math.min(Math.max(0, minutes), 59);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

