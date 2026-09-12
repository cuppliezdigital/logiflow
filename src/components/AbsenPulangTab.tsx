'use client';

// ============================================================================
// KOMPONEN TAB 3: ABSEN PULANG, TUMBANG & AUDIT INTEGRITAS PASUKAN
// Fitur:
// 1. Audit Integritas Otomatis: Rumus Masuk = Pulang Utuh + Tumbang
// 2. Deteksi Selisih Pekerja Kabur / Hilang Tanpa Izin
// 3. Pencatatan Khusus Tenaga Kerja Sakit/Cedera (Tumbang) + Bukti Foto P3K
// 4. Unggah Foto Apel Checkout / Barisan Pulang
// 5. Integrasi Server Action submitAbsenPulang
// ============================================================================

import React, { useState } from 'react';
import { 
  LogOut, 
  Camera, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  X,
  ShieldCheck,
  HeartPulse,
  UserX,
  Sun,
  Moon
} from 'lucide-react';
import { submitAbsenPulang } from '@/app/actions';

// Definisi props untuk komponen AbsenPulangTab
interface AbsenPulangTabProps {
  plotingans: any[];      // Data seluruh plotingan pada tanggal terpilih
  selectedDate: string;   // Tanggal operasional (YYYY-MM-DD)
  onRefresh: () => void;  // Callback untuk me-refresh data setelah submit
}

export default function AbsenPulangTab({
  plotingans,
  selectedDate,
  onRefresh,
}: AbsenPulangTabProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Objek plotingan yang sedang dipilih untuk diisi / diedit data pulangnya
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  // Visibilitas modal formulir absen pulang
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State angka headcount pulang & tumbang
  const [pulangHeadcount, setPulangHeadcount] = useState<number>(0);
  const [tumbangHeadcount, setTumbangHeadcount] = useState<number>(0);
  const [tumbangNotes, setTumbangNotes] = useState('');

  // State upload foto barisan checkout / apel pulang
  const [photoPulangPreview, setPhotoPulangPreview] = useState<string | null>(null);
  const [photoPulangFile, setPhotoPulangFile] = useState<File | null>(null);

  // State upload foto bukti klinik / surat sakit untuk orang tumbang
  const [photoTumbangPreview, setPhotoTumbangPreview] = useState<string | null>(null);
  const [photoTumbangFile, setPhotoTumbangFile] = useState<File | null>(null);

  // Indikator loading saat submit form
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Buka modal untuk plotingan tertentu
  const handleOpenModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existingIn = plot.attendanceIn;
    const existingOut = existingIn?.attendanceOut;

    if (existingOut) {
      // Jika sudah pernah checkout, muat data existing
      setPulangHeadcount(existingOut.pulangHeadcount);
      setTumbangHeadcount(existingOut.tumbangHeadcount || 0);
      setTumbangNotes(existingOut.tumbangNotes || '');
      setPhotoPulangPreview(existingOut.photoPulangUrl || null);
      setPhotoTumbangPreview(existingOut.photoTumbangUrl || null);
    } else {
      // Default: diasumsikan semua orang yang masuk pulang utuh
      setPulangHeadcount(existingIn ? existingIn.actualHeadcount : 0);
      setTumbangHeadcount(0);
      setTumbangNotes('');
      setPhotoPulangPreview(null);
      setPhotoTumbangPreview(null);
    }

    setPhotoPulangFile(null);
    setPhotoTumbangFile(null);
    setIsModalOpen(true);
  };

  // Handler upload foto apel pulang
  const handlePhotoPulangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPulangFile(file);
      setPhotoPulangPreview(URL.createObjectURL(file));
    }
  };

  // Handler upload foto bukti tumbang (P3K / Klinik)
  const handlePhotoTumbangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoTumbangFile(file);
      setPhotoTumbangPreview(URL.createObjectURL(file));
    }
  };

  // Submit data absen pulang & audit ke server
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan?.attendanceIn?.id) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('attendanceInId', selectedPlotingan.attendanceIn.id);
      formData.append('pulangHeadcount', pulangHeadcount.toString());
      formData.append('tumbangHeadcount', tumbangHeadcount.toString());
      formData.append('tumbangNotes', tumbangNotes);

      if (photoPulangFile) {
        formData.append('photoPulang', photoPulangFile);
      }
      if (photoTumbangFile) {
        formData.append('photoTumbang', photoTumbangFile);
      }

      await submitAbsenPulang(formData);
      setIsModalOpen(false); // Tutup modal
      onRefresh();           // Refresh data tabel
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan absensi pulang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // LOGIKA AUDIT REALTIME DI DALAM MODAL
  // --------------------------------------------------------------------------
  // Jumlah orang riil yang hadir saat apel masuk
  const actualIn = selectedPlotingan?.attendanceIn?.actualHeadcount || 0;
  // Total orang yang terdata saat pulang (Pulang Utuh + Tumbang Sakit)
  const totalAccounted = pulangHeadcount + tumbangHeadcount;
  // Selisih: Jika > 0, artinya ada orang yang kabur/hilang di tengah shift
  const selisih = actualIn - totalAccounted;
  // Status integritas seimbang (klop)
  const isBalanced = selisih === 0;

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN PULANG */}
      <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-l-4 border-rose-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 3: Absen Pulang, Tumbang & Audit Integritas</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Diisi di akhir shift saat apel checkout. Sistem akan mengaudit otomatis: 
          <span className="font-bold text-slate-900"> Masuk = Pulang Utuh + Tumbang</span>. Selisih yang tidak tercatat akan terhitung sebagai pekerja kabur.
        </p>
      </div>

      {/* 2. DAFTAR KARTU MONITORING ABSEN PULANG */}
      {plotingans.length === 0 ? (
        // State kosong jika belum ada plotingan
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Belum Ada Plotingan pada Tanggal Ini</p>
          <p className="text-xs text-slate-400 mt-1">Silakan atur data plotingan di Tab 1 terlebih dahulu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plotingans.map((p) => {
            const hasCheckedIn = !!p.attendanceIn;
            const hasCheckedOut = !!p.attendanceIn?.attendanceOut;
            const inCount = p.attendanceIn?.actualHeadcount || 0;
            const outRecord = p.attendanceIn?.attendanceOut;
            const pulang = outRecord?.pulangHeadcount || 0;
            const tumbang = outRecord?.tumbangHeadcount || 0;
            const selisihCard = outRecord?.selisihCount || 0;
            const isMatch = outRecord?.isBalanced ?? false;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md ${
                  !hasCheckedIn
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : hasCheckedOut
                    ? isMatch
                      ? 'border-emerald-300'
                      : 'border-rose-400 ring-1 ring-rose-300'
                    : 'border-amber-300'
                }`}
              >
                {/* Strip Status di Atas Kartu */}
                <div
                  className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
                    !hasCheckedIn
                      ? 'bg-slate-100 text-slate-500'
                      : hasCheckedOut
                      ? isMatch
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {!hasCheckedIn ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Belum Absen Masuk
                      </>
                    ) : hasCheckedOut ? (
                      isMatch ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Closed &bull; Klop (Integritas OK)
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                          Closed &bull; Ada Selisih {selisihCard} Orang!
                        </>
                      )
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        Sedang Bekerja (Belum Checkout)
                      </>
                    )}
                  </span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-white/80">
                    {p.shift.name.split(' ')[0]}
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

                  {/* Grid Rincian Headcount (Masuk vs Pulang vs Tumbang vs Selisih) */}
                  {hasCheckedIn ? (
                    <div className="grid grid-cols-4 gap-1.5 bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                      {/* Masuk */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Masuk</span>
                        <p className="text-base font-black text-slate-800 mt-0.5">{inCount}</p>
                      </div>
                      {/* Pulang Utuh */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Pulang</span>
                        <p className={`text-base font-black mt-0.5 ${hasCheckedOut ? 'text-blue-600' : 'text-slate-300'}`}>
                          {hasCheckedOut ? pulang : '-'}
                        </p>
                      </div>
                      {/* Tumbang Sakit */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Tumbang</span>
                        <p className={`text-base font-black mt-0.5 ${hasCheckedOut ? (tumbang > 0 ? 'text-amber-600' : 'text-slate-400') : 'text-slate-300'}`}>
                          {hasCheckedOut ? tumbang : '-'}
                        </p>
                      </div>
                      {/* Selisih Kabur */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Selisih</span>
                        <p className={`text-base font-black mt-0.5 ${hasCheckedOut ? (selisihCard > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600') : 'text-slate-300'}`}>
                          {hasCheckedOut ? selisihCard : '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-400">
                      Plotingan ini belum melakukan Absen Masuk di Tab 2.
                    </div>
                  )}

                  {/* Catatan Orang Tumbang & Foto Bukti jika ada */}
                  {hasCheckedOut && tumbang > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1 font-bold text-amber-800">
                        <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                        <span>Keterangan Sakit ({tumbang} Orang):</span>
                      </div>
                      <p className="text-[11px] text-amber-700 italic">
                        "{outRecord?.tumbangNotes || 'Tidak ada rincian catatan sakit'}"
                      </p>
                    </div>
                  )}

                  {/* Tombol Aksi Buka Form Modal Absen Pulang */}
                  {hasCheckedIn && (
                    <button
                      onClick={() => handleOpenModal(p)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        hasCheckedOut
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {hasCheckedOut ? 'Edit Absen Pulang' : 'Input Absen Pulang'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. MODAL FORM INPUT ABSEN PULANG & AUDIT INTEGRITAS */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Form Absen Pulang & Integritas</h3>
                <p className="text-xs text-slate-500">
                  {selectedPlotingan.vendor.name} &bull; {selectedPlotingan.shift.name}
                </p>
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
              
              {/* Ringkasan Jumlah Orang Hadir di Awal (Masuk) */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">Tercatat Hadir Masuk (Apel):</span>
                <span className="text-base font-black text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
                  {actualIn} Orang
                </span>
              </div>

              {/* Input Orang Pulang Utuh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  1. Orang Pulang Utuh (Selesai Shift)
                </label>
                <input
                  type="number"
                  min="0"
                  max={actualIn}
                  required
                  value={pulangHeadcount}
                  onChange={(e) => setPulangHeadcount(parseInt(e.target.value) || 0)}
                  className="w-full border-2 border-blue-400 bg-white rounded-xl px-4 py-2 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Jumlah pekerja yang mengikuti apel kepulangan setelah shift selesai.
                </span>
              </div>

              {/* Input Orang Tumbang (Sakit / Cedera / P3K) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5 text-amber-700">
                  <HeartPulse className="w-3.5 h-3.5" />
                  2. Orang Tumbang di Jam Kerja (Sakit / P3K)
                </label>
                <input
                  type="number"
                  min="0"
                  max={actualIn}
                  value={tumbangHeadcount}
                  onChange={(e) => setTumbangHeadcount(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 bg-white rounded-xl px-4 py-2 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Pekerja yang dipulangkan awal karena sakit / kecelakaan kerja dengan rekomendasi klinik.
                </span>
              </div>

              {/* KOTAK AUDIT INTEGRITAS OTOMATIS (LIVE FORMULA) */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isBalanced
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : selisih > 0
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    {isBalanced ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    Hasil Audit Integritas:
                  </span>
                  <span className="font-extrabold px-2 py-0.5 rounded bg-white/80 shadow-xs">
                    {isBalanced ? 'SEIMBANG / MATCH' : selisih > 0 ? `SELISIH ${selisih} KABUR` : `LEBIH ${Math.abs(selisih)}`}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-mono bg-white/70 px-2 py-1 rounded">
                    Masuk ({actualIn}) = Pulang ({pulangHeadcount}) + Tumbang ({tumbangHeadcount}) + Selisih ({selisih})
                  </p>
                  {isBalanced && (
                    <p className="text-emerald-700 text-[11px]">
                      ✔ Data headcount lengkap dan akurat 100%. Tagihan vendor dapat diproses utuh.
                    </p>
                  )}
                  {selisih > 0 && (
                    <p className="text-rose-700 text-[11px] font-semibold flex items-center gap-1">
                      <UserX className="w-3.5 h-3.5" />
                      Perhatian: Terdapat {selisih} pekerja hilang/kabur di tengah shift tanpa keterangan!
                    </p>
                  )}
                  {selisih < 0 && (
                    <p className="text-amber-700 text-[11px]">
                      Jumlah kepulangan melebihi catatan masuk awal saat apel pagi.
                    </p>
                  )}
                </div>
              </div>

              {/* Form Tambahan Khusus Jika Ada yang Tumbang */}
              {tumbangHeadcount > 0 && (
                <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Catatan Medis / Keterangan Tumbang (Wajib)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={tumbangNotes}
                      onChange={(e) => setTumbangNotes(e.target.value)}
                      placeholder="Contoh: 1 orang pusing dock 2, 1 orang kram otot kaki saat unloading..."
                      className="w-full border border-amber-300 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Foto Bukti Surat Sakit / Penanganan P3K */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Foto Bukti Penanganan Klinik / Form P3K
                    </label>
                    <label className="flex items-center gap-2 border border-dashed border-amber-300 rounded-xl p-2.5 bg-white hover:bg-amber-50 transition-colors cursor-pointer text-xs">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-slate-700">Unggah Foto Surat Klinik</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoTumbangChange}
                        className="hidden"
                      />
                    </label>
                    {photoTumbangPreview && (
                      <div className="relative mt-2 rounded-lg overflow-hidden border border-slate-200 h-24 bg-slate-100">
                        <img src={photoTumbangPreview} alt="Bukti Sakit" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setPhotoTumbangPreview(null); setPhotoTumbangFile(null); }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Foto Apel Pulang / Checkout */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Foto Apel Checkout / Barisan Pulang
                </label>
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-3.5 hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer">
                    <Camera className="w-6 h-6 text-blue-500 mb-1" />
                    <span className="text-xs font-bold text-slate-700">Ambil Foto Barisan Pulang</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoPulangChange}
                      className="hidden"
                    />
                  </label>

                  {photoPulangPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-40 bg-slate-100">
                      <img src={photoPulangPreview} alt="Preview Foto Pulang" className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoPulangPreview(null); setPhotoPulangFile(null); }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-xs shadow-md cursor-pointer"
                        title="Hapus foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Aksi Form */}
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
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data Pulang'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

