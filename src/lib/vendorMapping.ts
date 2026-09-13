// ============================================================================
// DAFTAR SINGKATAN RESMI NAMA VENDOR MITRA OPERASIONAL LOGIFLOW
// Sesuai standarisasi operasional lapangan pergudangan:
// PT Maximus Integrasi Indonesia : MAXIMUS
// PT Sahabat Dua Muda : SDM
// PT BAL Logistik Internasional : BAL
// PT Esa Gemilang Sakti : ESA
// PT Dollar Information : DOLLAR
// PT Majapahit Solusi Bersama : MYROBIN
// PT Karya Megah Intemusa : INTERNUSA
// PT Solusi Mitra Pertama : SMP
// PT Dwi Rajendra Samudra : RAJENDRA
// PT Dewi Buana Mulia : BUANNA
// ============================================================================

export const VENDOR_SHORT_NAMES: Record<string, string> = {
  'PT Maximus Integrasi Indonesia': 'MAXIMUS',
  'PT Sahabat Dua Muda': 'SDM',
  'PT BAL Logistik Internasional': 'BAL',
  'PT Esa Gemilang Sakti': 'ESA',
  'PT Dollar Information': 'DOLLAR',
  'PT Majapahit Solusi Bersama': 'MYROBIN',
  'PT Karya Megah Intemusa': 'INTERNUSA',
  'PT Solusi Mitra Pertama': 'SMP',
  'PT Dwi Rajendra Samudra': 'RAJENDRA',
  'PT Dewi Buana Mulia': 'BUANNA',
};

/**
 * Mengonversi nama vendor panjang menjadi singkatan resmi lapangan.
 * Jika nama sudah singkat atau tidak ada di kamus mapping, mengembalikan nama aslinya.
 */
export function getShortVendorName(name?: string | null): string {
  if (!name) return '-';
  const trimmed = name.trim();
  return VENDOR_SHORT_NAMES[trimmed] || trimmed;
}
