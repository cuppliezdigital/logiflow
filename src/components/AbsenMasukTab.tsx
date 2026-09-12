'use client';

// ============================================================================
// KOMPONEN TAB 2: ABSEN MASUK & SERAH TERIMA PASUKAN (APEL SHIFT)
// Fitur:
// 1. Kartu Status Kehadiran per Plotingan Vendor
// 2. Kalkulasi Realtime % Fulfillment Awal (Hadir Fisik vs Target)
// 3. Upload / Jepret Foto Barisan Apel lewat Kamera HP atau File Gambar
// 4. Modal Form Absen Masuk & Integrasi Server Action submitAbsenMasuk
// ============================================================================

import React, { useState } from 'react';
import { 
  LogIn, 
  Camera, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { submitAbsenMasuk } from '@/app/actions';

// Definisi props untuk komponen AbsenMasukTab
interface AbsenMasukTabProps {
  plotingans: any[];      // Data plotingan lengkap dengan attendanceIn & vendor/shift
  selectedDate: string;   // Tanggal operasional kerja (YYYY-MM-DD)
  onRefresh: () => void;  // Callback refresh data setelah form disimpan
}

export default function AbsenMasukTab({
  plotingans,
  selectedDate,
  onRefresh,
}: AbsenMasukTabProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Menyimpan objek plotingan yang sedang dipilih untuk diisi absensi masuknya
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  // Visibilitas modal dialog absen masuk
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Jumlah fisik orang yang hadir di apel
  const [actualHeadcount, setActualHeadcount] = useState<number>(0);
  // Catatan serah terima / kondisi apel
  const [notes, setNotes] = useState('');
  // URL untuk menampilkan preview foto yang dipilih sebelum diunggah
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // File binary gambar yang dipilih dari input kamera / file
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Indikator status loading saat tombol simpan ditekan
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Membuka modal absen masuk untuk plotingan tertentu
  const handleOpenModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existing = plot.attendanceIn;
    // Jika sudah pernah diisi, muat data sebelumnya. Jika belum, default ke targetHeadcount
    setActualHeadcount(existing ? existing.actualHeadcount : plot.targetHeadcount);
    setNotes(existing ? existing.notes || '' : '');
    setPhotoPreview(existing ? existing.photoInUrl || null : null);
    setPhotoFile(null);
    setIsModalOpen(true);
  };

  // Menangani pemilihan foto dari kamera atau galeri file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  // Mengirim data absensi masuk ke server
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('plotinganId', selectedPlotingan.id);
      formData.append('actualHeadcount', actualHeadcount.toString());
      formData.append('notes', notes);
      if (photoFile) {
        formData.append('photoIn', photoFile);
      }

      await submitAbsenMasuk(formData);
      setIsModalOpen(false); // Tutup modal
      onRefresh();           // Refresh data tampilan
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan absensi masuk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Target orang dari plotingan yang sedang aktif di modal
  const target = selectedPlotingan ? selectedPlotingan.targetHeadcount : 0;
  // Hitung persentase pemenuhan kuota awal di modal
  const fulfillment = target > 0 ? Math.round((actualHeadcount / target) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN MASUK */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 2: Absen Masuk & Serah Terima Pasukan</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Diisi saat apel/briefing awal shift. Catat jumlah orang fisik yang hadir dan unggah bukti foto barisan.
        </p>
      </div>

      {/* 2. DAFTAR KARTU PLOTINGAN UNTUK ABSEN MASUK */}
      {plotingans.length === 0 ? (
        // State kosong jika belum ada plotingan di Tab 1
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Belum Ada Plotingan untuk Absen Masuk</p>
          <p className="text-xs text-slate-400 mt-1">
            Silakan buat data Plotingan terlebih dahulu di Tab 1.
          </p>
        </div>
      ) : (
        // Grid kartu untuk setiap vendor dan shift kerja
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plotingans.map((p) => {
            const hasCheckedIn = !!p.attendanceIn;
            const actual = p.attendanceIn?.actualHeadcount || 0;
            const rate = Math.round((actual / p.targetHeadcount) * 100);

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md ${
                  hasCheckedIn
                    ? 'border-emerald-200'
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                {/* Strip Status di Bagian Atas Kartu */}
                <div
                  className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
                    hasCheckedIn
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {hasCheckedIn ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Sudah Absen Masuk
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Menunggu Apel Masuk
                      </>
                    )}
                  </span>
                  {/* Badge Regular vs Additional */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      p.status === 'REGULAR'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Info Vendor & Shift */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {p.vendor.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      {p.shift.name.toLowerCase().includes('pagi') ? (
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      )}
                      <span className="font-bold text-slate-700">{p.shift.name}</span>
                      {p.workingHours && <span className="text-slate-400">&bull; {p.workingHours}</span>}
                    </p>
                  </div>

                  {/* Komparasi Target vs Realisasi Masuk */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Target Ploting</span>
                      <p className="text-lg font-black text-slate-700">{p.targetHeadcount} <span className="text-xs font-normal">Org</span></p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Realisasi Masuk</span>
                      <p className={`text-lg font-black ${hasCheckedIn ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {hasCheckedIn ? `${actual} Org` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Indikator % Fulfillment Awal & Foto Barisan Apel */}
                  {hasCheckedIn && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">Fulfillment Awal:</span>
                        <span
                          className={`font-extrabold px-2 py-0.5 rounded-full text-xs ${
                            rate >= 95
                              ? 'bg-emerald-100 text-emerald-800'
                              : rate >= 80
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rate}% {rate >= 100 ? '⭐ Target Tercapai' : rate < 80 ? '⚠️ Kurang Orang' : ''}
                        </span>
                      </div>

                      {/* Tampilan Foto Bukti Apel */}
                      {p.attendanceIn?.photoInUrl && (
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                          <img
                            src={p.attendanceIn.photoInUrl}
                            alt="Foto Briefing Masuk"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                            Foto Apel Terlampir
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tombol Input / Edit Absen Masuk */}
                  <button
                    onClick={() => handleOpenModal(p)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      hasCheckedIn
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {hasCheckedIn ? 'Edit Absen Masuk' : 'Input Absen Masuk'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. MODAL FORM INPUT ABSEN MASUK */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Form Absen Masuk</h3>
                <p className="text-xs text-slate-500">{selectedPlotingan.vendor.name} &middot; {selectedPlotingan.shift.name}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Input */}
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              
              {/* Target Plotingan & Input Jumlah Kehadiran Fisik */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Target Plotingan:</span>
                  <span className="text-sm font-black text-slate-900">{target} Orang</span>
                </div>

                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Total Orang Masuk Hadir (Fisik Apel)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={actualHeadcount}
                  onChange={(e) => setActualHeadcount(parseInt(e.target.value) || 0)}
                  className="w-full border-2 border-amber-400 bg-white rounded-xl px-4 py-2.5 text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                {/* Indikator Realtime Live Fulfillment */}
                <div className="mt-3 flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Kalkulasi Fulfillment:
                  </span>
                  <span
                    className={`font-black px-2 py-0.5 rounded ${
                      fulfillment >= 95
                        ? 'bg-emerald-100 text-emerald-800'
                        : fulfillment >= 80
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {fulfillment}% ({actualHeadcount} / {target})
                  </span>
                </div>
              </div>

              {/* Upload Foto Barisan Apel (Kamera / File Picker) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Foto Barisan / Briefing Apel
                </label>
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 hover:border-amber-500 hover:bg-amber-50/20 transition-all cursor-pointer">
                    <Camera className="w-8 h-8 text-amber-500 mb-1" />
                    <span className="text-xs font-bold text-slate-700">Ambil Foto Lewat Kamera / Galeri</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Wajib foto barisan orang yang hadir</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {/* Preview Foto Jika Sudah Dipilih */}
                  {photoPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100">
                      <img src={photoPreview} alt="Preview Foto Apel" className="w-full h-48 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-xs shadow-md cursor-pointer"
                        title="Hapus foto ini"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Catatan Apel / Masuk */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Catatan Apel (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: 2 orang terlambat 10 menit, seragam lengkap..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Absen Masuk'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}