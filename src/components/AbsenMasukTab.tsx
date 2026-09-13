'use client';

// ============================================================================
// KOMPONEN TAB 2: ABSEN MASUK & SERAH TERIMA PASUKAN (APEL SHIFT)
// Fitur Baru:
// 1. 1 Kartu Terpadu per Vendor per Shift (mencakup Regular & Additional).
// 2. Input Hadir Fisik Terpisah: Hadir Regular & Hadir Additional.
// 3. Dua Slot Upload Foto Apel Terpisah:
//    - 📸 Slot Foto Barisan Apel REGULAR
//    - 📸 Slot Foto Barisan Apel ADDITIONAL (hanya muncul jika ada target additional)
// 4. Kalkulasi Realtime % Fulfillment Awal Gabungan.
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
  Moon,
  Layers
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
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State hadir fisik terpisah
  const [actualRegular, setActualRegular] = useState<number>(0);
  const [actualAdditional, setActualAdditional] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // State Foto Barisan Regular
  const [photoRegPreview, setPhotoRegPreview] = useState<string | null>(null);
  const [photoRegFile, setPhotoRegFile] = useState<File | null>(null);

  // State Foto Barisan Additional
  const [photoAddPreview, setPhotoAddPreview] = useState<string | null>(null);
  const [photoAddFile, setPhotoAddFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Membuka modal absen masuk
  const handleOpenModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existing = plot.attendanceIn;

    const targetReg = plot.targetRegular ?? (plot.status === 'REGULAR' ? plot.targetHeadcount : 0);
    const targetAdd = plot.targetAdditional ?? (plot.status === 'ADDITIONAL' ? plot.targetHeadcount : 0);

    // Muat data jika sudah pernah diinput, atau default ke target kuota
    setActualRegular(existing ? (existing.actualRegular ?? existing.actualHeadcount) : targetReg);
    setActualAdditional(existing ? (existing.actualAdditional ?? 0) : targetAdd);
    setNotes(existing ? existing.notes || '' : '');

    // Set foto preview jika ada
    setPhotoRegPreview(existing?.photoInRegularUrl || existing?.photoInUrl || null);
    setPhotoAddPreview(existing?.photoInAdditionalUrl || null);

    setPhotoRegFile(null);
    setPhotoAddFile(null);
    setIsModalOpen(true);
  };

  // Upload Foto Apel Regular
  const handlePhotoRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoRegFile(file);
      setPhotoRegPreview(URL.createObjectURL(file));
    }
  };

  // Upload Foto Apel Additional
  const handlePhotoAddChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoAddFile(file);
      setPhotoAddPreview(URL.createObjectURL(file));
    }
  };

  // Submit data absensi masuk terpadu ke server
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('plotinganId', selectedPlotingan.id);
      formData.append('actualRegular', actualRegular.toString());
      formData.append('actualAdditional', actualAdditional.toString());
      formData.append('notes', notes);

      if (photoRegFile) {
        formData.append('photoInRegular', photoRegFile);
      }
      if (photoAddFile) {
        formData.append('photoInAdditional', photoAddFile);
      }

      await submitAbsenMasuk(formData);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan absensi masuk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Kalkulasi target & total di modal
  const targetRegModal = selectedPlotingan ? (selectedPlotingan.targetRegular ?? (selectedPlotingan.status === 'REGULAR' ? selectedPlotingan.targetHeadcount : 0)) : 0;
  const targetAddModal = selectedPlotingan ? (selectedPlotingan.targetAdditional ?? (selectedPlotingan.status === 'ADDITIONAL' ? selectedPlotingan.targetHeadcount : 0)) : 0;
  const totalTargetModal = targetRegModal + targetAddModal;
  const totalActualModal = actualRegular + actualAdditional;
  const fulfillmentModal = totalTargetModal > 0 ? Math.round((totalActualModal / totalTargetModal) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN MASUK */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 2: Absen Masuk & Serah Terima Pasukan</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Diisi saat apel/briefing awal shift. Catat kehadiran fisik orang dan unggah foto barisan terpisah untuk pasukan 
          <span className="font-bold text-blue-700"> Regular</span> dan <span className="font-bold text-amber-700">Additional</span>.
        </p>
      </div>

      {/* 2. DAFTAR KARTU PLOTINGAN (1 KARTU PER VENDOR PER SHIFT) */}
      {plotingans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Belum Ada Plotingan untuk Absen Masuk</p>
          <p className="text-xs text-slate-400 mt-1">
            Silakan buat data Plotingan terlebih dahulu di Tab 1.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plotingans.map((p) => {
            const hasCheckedIn = !!p.attendanceIn;
            const actualTotal = p.attendanceIn?.actualHeadcount || 0;
            const actualReg = p.attendanceIn?.actualRegular ?? 0;
            const actualAdd = p.attendanceIn?.actualAdditional ?? 0;
            
            const targetReg = p.targetRegular ?? (p.status === 'REGULAR' ? p.targetHeadcount : 0);
            const targetAdd = p.targetAdditional ?? (p.status === 'ADDITIONAL' ? p.targetHeadcount : 0);
            const rate = Math.round((actualTotal / p.targetHeadcount) * 100);

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
                  
                  {/* Badge Shift Pagi / Malam */}
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded shadow-xs">
                    {p.shift.name.toLowerCase().includes('pagi') ? (
                      <Sun className="w-3 h-3 text-amber-500" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-500" />
                    )}
                    {p.shift.name}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Info Vendor & Jam Kerja */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {p.vendor.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.workingHours ? `Jam Kerja: ${p.workingHours}` : 'Jam Kerja Fleksibel'}
                    </p>
                  </div>

                  {/* Komparasi Target vs Realisasi Masuk (Regular & Additional) */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                    {/* Baris Regular */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Pasukan Regular:
                      </span>
                      <span className="font-bold text-slate-800">
                        {hasCheckedIn ? (
                          <strong className="text-emerald-600 font-extrabold">{actualReg}</strong>
                        ) : '-'}{' '}
                        / {targetReg} Org
                      </span>
                    </div>

                    {/* Baris Additional (jika ada) */}
                    {targetAdd > 0 && (
                      <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-1.5">
                        <span className="font-bold text-amber-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Pasukan Additional:
                        </span>
                        <span className="font-bold text-slate-800">
                          {hasCheckedIn ? (
                            <strong className="text-amber-600 font-extrabold">{actualAdd}</strong>
                          ) : '-'}{' '}
                          / {targetAdd} Org
                        </span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-1.5 font-extrabold">
                      <span className="text-slate-600 uppercase">Total Headcount:</span>
                      <span className={hasCheckedIn ? 'text-emerald-700' : 'text-slate-500'}>
                        {hasCheckedIn ? `${actualTotal} Org` : '-'} (Target: {p.targetHeadcount} Org)
                      </span>
                    </div>
                  </div>

                  {/* Indikator Fulfillment & Preview Foto Terpisah */}
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
                          {rate}% {rate >= 100 ? '⭐ Lengkap' : '⚠️ Kurang'}
                        </span>
                      </div>

                      {/* Thumbnails Foto Apel Reguler & Additional */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Foto Regular */}
                        {p.attendanceIn?.photoInRegularUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 h-20 bg-slate-100">
                            <img
                              src={p.attendanceIn.photoInRegularUrl}
                              alt="Foto Apel Regular"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-blue-900/80 text-white text-[9px] font-bold text-center py-0.5">
                              Foto Regular
                            </span>
                          </div>
                        )}

                        {/* Foto Additional */}
                        {p.attendanceIn?.photoInAdditionalUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 h-20 bg-slate-100">
                            <img
                              src={p.attendanceIn.photoInAdditionalUrl}
                              alt="Foto Apel Additional"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-amber-900/80 text-white text-[9px] font-bold text-center py-0.5">
                              Foto Additional
                            </span>
                          </div>
                        )}
                      </div>
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

      {/* 3. MODAL FORM INPUT ABSEN MASUK TERPADU */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Form Absen Masuk</h3>
                <p className="text-xs text-slate-500">{selectedPlotingan.vendor.name} &bull; {selectedPlotingan.shift.name}</p>
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
              
              {/* Input Hadir Fisik Regular vs Additional */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Realisasi Orang Hadir (Fisik Apel)
                  </span>
                  <span className="text-xs font-black text-slate-800">
                    Target: {totalTargetModal} Org
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Hadir Regular */}
                  <div>
                    <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">
                      Hadir Regular (Target: {targetRegModal})
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={actualRegular}
                      onChange={(e) => setActualRegular(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-blue-400 bg-white rounded-xl px-3 py-2 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Hadir Additional */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 uppercase mb-1">
                      Hadir Additional (Target: {targetAddModal})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={actualAdditional}
                      onChange={(e) => setActualAdditional(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-amber-400 bg-white rounded-xl px-3 py-2 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Indikator Realtime Live Fulfillment */}
                <div className="mt-2 flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Total Masuk & Fulfillment:
                  </span>
                  <span
                    className={`font-black px-2 py-0.5 rounded ${
                      fulfillmentModal >= 95
                        ? 'bg-emerald-100 text-emerald-800'
                        : fulfillmentModal >= 80
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {totalActualModal} Org ({fulfillmentModal}%)
                  </span>
                </div>
              </div>

              {/* DUA SLOT FOTO TERPISAH: REGULAR & ADDITIONAL */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase">Dokumentasi Foto Barisan Apel</p>

                {/* 1. Slot Foto Apel REGULAR */}
                <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200/80 space-y-2">
                  <label className="block text-xs font-bold text-blue-900">
                    1. Foto Barisan Pasukan REGULAR
                  </label>
                  <label className="flex items-center gap-2 border border-dashed border-blue-300 rounded-lg p-2.5 bg-white hover:bg-blue-50/50 transition-colors cursor-pointer text-xs font-semibold text-blue-700">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Ambil Foto Barisan Regular</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoRegChange}
                      className="hidden"
                    />
                  </label>

                  {photoRegPreview && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                      <img src={photoRegPreview} alt="Preview Regular" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoRegPreview(null); setPhotoRegFile(null); }}
                        className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer"
                        title="Hapus Foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Slot Foto Apel ADDITIONAL (Hanya jika kuota target additional > 0) */}
                {targetAddModal > 0 && (
                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-2">
                    <label className="block text-xs font-bold text-amber-900">
                      2. Foto Barisan Pasukan ADDITIONAL (Lembur / Peak)
                    </label>
                    <label className="flex items-center gap-2 border border-dashed border-amber-300 rounded-lg p-2.5 bg-white hover:bg-amber-50/50 transition-colors cursor-pointer text-xs font-semibold text-amber-700">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <span>Ambil Foto Barisan Additional</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoAddChange}
                        className="hidden"
                      />
                    </label>

                    {photoAddPreview && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                        <img src={photoAddPreview} alt="Preview Additional" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setPhotoAddPreview(null); setPhotoAddFile(null); }}
                          className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer"
                          title="Hapus Foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Catatan Apel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Catatan Apel (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: 1 orang regular terlambat 15 menit..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-3 pt-2">
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