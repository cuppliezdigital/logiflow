'use client';

// ============================================================================
// KOMPONEN TAB 3: ABSEN PULANG, TUMBANG & AUDIT INTEGRITAS (REG & ADD)
// Fitur Baru:
// 1. 1 Kartu Terpadu per Vendor per Shift dengan indikator Regular & Additional.
// 2. Input Kepulangan & Tumbang dipisah untuk Regular dan Additional.
// 3. Slot Upload Foto Checkout Terpisah:
//    - 📸 Slot Foto Barisan Pulang REGULAR
//    - 📸 Slot Foto Barisan Pulang ADDITIONAL (jika ada)
//    - 📸 Slot Foto Bukti Surat Klinik / P3K (jika ada yang tumbang)
// 4. Audit Integritas Otomatis untuk Regular & Additional secara transparan.
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
  Moon,
  Layers
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
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State orang pulang utuh (terpisah Reg & Add)
  const [pulangRegular, setPulangRegular] = useState<number>(0);
  const [pulangAdditional, setPulangAdditional] = useState<number>(0);

  // State orang tumbang sakit (terpisah Reg & Add)
  const [tumbangRegular, setTumbangRegular] = useState<number>(0);
  const [tumbangAdditional, setTumbangAdditional] = useState<number>(0);
  const [tumbangNotes, setTumbangNotes] = useState('');

  // State upload foto barisan pulang regular
  const [photoPulangRegPreview, setPhotoPulangRegPreview] = useState<string | null>(null);
  const [photoPulangRegFile, setPhotoPulangRegFile] = useState<File | null>(null);

  // State upload foto barisan pulang additional
  const [photoPulangAddPreview, setPhotoPulangAddPreview] = useState<string | null>(null);
  const [photoPulangAddFile, setPhotoPulangAddFile] = useState<File | null>(null);

  // State upload foto bukti klinik P3K
  const [photoTumbangPreview, setPhotoTumbangPreview] = useState<string | null>(null);
  const [photoTumbangFile, setPhotoTumbangFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Buka modal absen pulang
  const handleOpenModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existingIn = plot.attendanceIn;
    const existingOut = existingIn?.attendanceOut;

    const inReg = existingIn ? (existingIn.actualRegular ?? existingIn.actualHeadcount) : 0;
    const inAdd = existingIn ? (existingIn.actualAdditional ?? 0) : 0;

    if (existingOut) {
      setPulangRegular(existingOut.pulangRegular ?? existingOut.pulangHeadcount);
      setPulangAdditional(existingOut.pulangAdditional ?? 0);
      setTumbangRegular(existingOut.tumbangRegular ?? existingOut.tumbangHeadcount);
      setTumbangAdditional(existingOut.tumbangAdditional ?? 0);
      setTumbangNotes(existingOut.tumbangNotes || '');

      setPhotoPulangRegPreview(existingOut.photoPulangRegularUrl || existingOut.photoPulangUrl || null);
      setPhotoPulangAddPreview(existingOut.photoPulangAdditionalUrl || null);
      setPhotoTumbangPreview(existingOut.photoTumbangUrl || null);
    } else {
      // Default diasumsikan semua orang yang masuk pulang utuh
      setPulangRegular(inReg);
      setPulangAdditional(inAdd);
      setTumbangRegular(0);
      setTumbangAdditional(0);
      setTumbangNotes('');
      setPhotoPulangRegPreview(null);
      setPhotoPulangAddPreview(null);
      setPhotoTumbangPreview(null);
    }

    setPhotoPulangRegFile(null);
    setPhotoPulangAddFile(null);
    setPhotoTumbangFile(null);
    setIsModalOpen(true);
  };

  // Upload Foto Pulang Regular
  const handlePhotoPulangRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPulangRegFile(file);
      setPhotoPulangRegPreview(URL.createObjectURL(file));
    }
  };

  // Upload Foto Pulang Additional
  const handlePhotoPulangAddChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPulangAddFile(file);
      setPhotoPulangAddPreview(URL.createObjectURL(file));
    }
  };

  // Upload Foto Bukti Tumbang / Klinik
  const handlePhotoTumbangChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoTumbangFile(file);
      setPhotoTumbangPreview(URL.createObjectURL(file));
    }
  };

  // Submit form absen pulang ke server
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan?.attendanceIn?.id) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('attendanceInId', selectedPlotingan.attendanceIn.id);
      formData.append('pulangRegular', pulangRegular.toString());
      formData.append('pulangAdditional', pulangAdditional.toString());
      formData.append('tumbangRegular', tumbangRegular.toString());
      formData.append('tumbangAdditional', tumbangAdditional.toString());
      formData.append('tumbangNotes', tumbangNotes);

      if (photoPulangRegFile) {
        formData.append('photoPulangRegular', photoPulangRegFile);
      }
      if (photoPulangAddFile) {
        formData.append('photoPulangAdditional', photoPulangAddFile);
      }
      if (photoTumbangFile) {
        formData.append('photoTumbang', photoTumbangFile);
      }

      await submitAbsenPulang(formData);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan absensi pulang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // LOGIKA AUDIT INTEGRITAS REALTIME DI MODAL
  // --------------------------------------------------------------------------
  const inRegModal = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount) : 0;
  const inAddModal = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualAdditional ?? 0) : 0;
  const inTotalModal = inRegModal + inAddModal;

  const selisihRegModal = inRegModal - (pulangRegular + tumbangRegular);
  const selisihAddModal = inAddModal - (pulangAdditional + tumbangAdditional);
  const selisihTotalModal = selisihRegModal + selisihAddModal;
  const isBalancedModal = selisihTotalModal === 0;

  const totalTumbangModal = tumbangRegular + tumbangAdditional;

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN PULANG */}
      <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-l-4 border-rose-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 3: Absen Pulang, Tumbang & Audit Integritas</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Diisi di akhir shift. Sistem mengaudit otomatis integritas kuota: 
          <span className="font-bold text-slate-900"> Masuk = Pulang Utuh + Tumbang</span> (terpisah untuk Regular dan Additional).
        </p>
      </div>

      {/* 2. DAFTAR KARTU (1 KARTU PER VENDOR PER SHIFT) */}
      {plotingans.length === 0 ? (
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
            
            const inReg = p.attendanceIn?.actualRegular ?? p.attendanceIn?.actualHeadcount ?? 0;
            const inAdd = p.attendanceIn?.actualAdditional ?? 0;
            const inTotal = p.attendanceIn?.actualHeadcount ?? 0;

            const outRecord = p.attendanceIn?.attendanceOut;
            const pulangTotal = outRecord?.pulangHeadcount ?? 0;
            const pulangReg = outRecord?.pulangRegular ?? outRecord?.pulangHeadcount ?? 0;
            const pulangAdd = outRecord?.pulangAdditional ?? 0;

            const tumbangTotal = outRecord?.tumbangHeadcount ?? 0;
            const selisihCard = outRecord?.selisihCount ?? 0;
            const isMatch = outRecord?.isBalanced ?? false;

            const targetReg = p.targetRegular ?? (p.status === 'REGULAR' ? p.targetHeadcount : 0);
            const targetAdd = p.targetAdditional ?? (p.status === 'ADDITIONAL' ? p.targetHeadcount : 0);

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
                          Closed &bull; Selisih {selisihCard} Orang!
                        </>
                      )
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        Sedang Bekerja (Belum Checkout)
                      </>
                    )}
                  </span>
                  
                  {/* Badge Shift */}
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
                  {/* Info Vendor & Rincian Target */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {p.vendor.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Target Reg: {targetReg}
                      </span>
                      {targetAdd > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Target Add: {targetAdd}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grid Rincian Headcount Terpadu */}
                  {hasCheckedIn ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                      <div className="grid grid-cols-4 gap-1 text-center border-b border-slate-200 pb-1 text-[10px] uppercase font-bold text-slate-400">
                        <span>Status</span>
                        <span>Masuk</span>
                        <span>Pulang</span>
                        <span>Selisih</span>
                      </div>
                      
                      {/* Baris Regular */}
                      <div className="grid grid-cols-4 gap-1 text-center text-xs font-semibold">
                        <span className="text-blue-700 font-bold text-left pl-1">Regular</span>
                        <span className="text-slate-900 font-extrabold">{inReg}</span>
                        <span className={hasCheckedOut ? 'text-blue-600 font-extrabold' : 'text-slate-400'}>
                          {hasCheckedOut ? pulangReg : '-'}
                        </span>
                        <span className={hasCheckedOut ? (outRecord?.selisihRegular ? 'text-rose-600 font-black' : 'text-emerald-600') : 'text-slate-400'}>
                          {hasCheckedOut ? outRecord?.selisihRegular ?? 0 : '-'}
                        </span>
                      </div>

                      {/* Baris Additional (jika ada) */}
                      {targetAdd > 0 && (
                        <div className="grid grid-cols-4 gap-1 text-center text-xs font-semibold">
                          <span className="text-amber-700 font-bold text-left pl-1">Additional</span>
                          <span className="text-slate-900 font-extrabold">{inAdd}</span>
                          <span className={hasCheckedOut ? 'text-amber-600 font-extrabold' : 'text-slate-400'}>
                            {hasCheckedOut ? pulangAdd : '-'}
                          </span>
                          <span className={hasCheckedOut ? (outRecord?.selisihAdditional ? 'text-rose-600 font-black' : 'text-emerald-600') : 'text-slate-400'}>
                            {hasCheckedOut ? outRecord?.selisihAdditional ?? 0 : '-'}
                          </span>
                        </div>
                      )}

                      {/* Baris Total & Tumbang */}
                      <div className="border-t border-slate-200 pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-semibold">
                          Total Tumbang (Sakit): <strong className="text-amber-600">{hasCheckedOut ? tumbangTotal : 0} Org</strong>
                        </span>
                        <span className="text-slate-500 font-semibold">
                          Total Selisih: <strong className={selisihCard > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>{hasCheckedOut ? selisihCard : 0} Org</strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-400">
                      Plotingan ini belum melakukan Absen Masuk di Tab 2.
                    </div>
                  )}

                  {/* Keterangan Tumbang jika ada */}
                  {hasCheckedOut && tumbangTotal > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1 font-bold text-amber-800">
                        <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                        <span>Keterangan Sakit ({tumbangTotal} Orang):</span>
                      </div>
                      <p className="text-[11px] text-amber-700 italic">
                        "{outRecord?.tumbangNotes || 'Tidak ada rincian catatan sakit'}"
                      </p>
                    </div>
                  )}

                  {/* Tombol Input / Edit Absen Pulang */}
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
              
              {/* Ringkasan Hadir Masuk di Awal */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 uppercase">Tercatat Hadir Masuk:</span>
                <span className="font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  Reg: {inRegModal} &bull; Add: {inAddModal} (Total: {inTotalModal} Org)
                </span>
              </div>

              {/* 1. INPUT KEPULANGAN UTUH (REGULAR & ADDITIONAL) */}
              <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200 space-y-2">
                <label className="block text-xs font-bold text-blue-900 uppercase">
                  1. Orang Pulang Utuh (Selesai Shift)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-blue-700 block mb-1">Pulang Regular:</span>
                    <input
                      type="number"
                      min="0"
                      max={inRegModal}
                      required
                      value={pulangRegular}
                      onChange={(e) => setPulangRegular(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-blue-300 bg-white rounded-xl px-3 py-1.5 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 block mb-1">Pulang Additional:</span>
                    <input
                      type="number"
                      min="0"
                      max={inAddModal}
                      value={pulangAdditional}
                      onChange={(e) => setPulangAdditional(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-amber-300 bg-white rounded-xl px-3 py-1.5 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. INPUT ORANG TUMBANG (REGULAR & ADDITIONAL) */}
              <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2">
                <label className="block text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                  2. Orang Tumbang di Jam Kerja (Sakit / Cedera / P3K)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-blue-700 block mb-1">Tumbang Regular:</span>
                    <input
                      type="number"
                      min="0"
                      value={tumbangRegular}
                      onChange={(e) => setTumbangRegular(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-300 bg-white rounded-xl px-3 py-1.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 block mb-1">Tumbang Additional:</span>
                    <input
                      type="number"
                      min="0"
                      value={tumbangAdditional}
                      onChange={(e) => setTumbangAdditional(parseInt(e.target.value) || 0)}
                      className="w-full border border-slate-300 bg-white rounded-xl px-3 py-1.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* KOTAK AUDIT INTEGRITAS REALTIME */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isBalancedModal
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    {isBalancedModal ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    Hasil Audit Integritas:
                  </span>
                  <span className="font-extrabold px-2 py-0.5 rounded bg-white/80 shadow-xs">
                    {isBalancedModal ? 'SEIMBANG / MATCH' : `SELISIH ${selisihTotalModal} KABUR`}
                  </span>
                </div>

                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between bg-white/70 px-2 py-1 rounded">
                    <span>Audit Regular: Masuk {inRegModal} = Pulang {pulangRegular} + Tumbang {tumbangRegular}</span>
                    <strong className={selisihRegModal > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {selisihRegModal > 0 ? `Selisih ${selisihRegModal}` : '✔ Klop'}
                    </strong>
                  </div>
                  {inAddModal > 0 && (
                    <div className="flex justify-between bg-white/70 px-2 py-1 rounded">
                      <span>Audit Additional: Masuk {inAddModal} = Pulang {pulangAdditional} + Tumbang {tumbangAdditional}</span>
                      <strong className={selisihAddModal > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {selisihAddModal > 0 ? `Selisih ${selisihAddModal}` : '✔ Klop'}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Khusus Jika Ada yang Tumbang */}
              {totalTumbangModal > 0 && (
                <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Catatan Medis / Keterangan Tumbang (Wajib)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={tumbangNotes}
                      onChange={(e) => setTumbangNotes(e.target.value)}
                      placeholder="Contoh: 1 orang pusing dock 2, 1 orang kram otot kaki..."
                      className="w-full border border-amber-300 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Foto Bukti Surat Sakit / Klinik P3K
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

              {/* DUA SLOT FOTO PULANG TERPISAH: REGULAR & ADDITIONAL */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase">Dokumentasi Foto Checkout Kepulangan</p>

                {/* 1. Foto Pulang Regular */}
                <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200 space-y-2">
                  <label className="block text-xs font-bold text-blue-900">
                    Foto Barisan Pulang REGULAR
                  </label>
                  <label className="flex items-center gap-2 border border-dashed border-blue-300 rounded-lg p-2.5 bg-white hover:bg-blue-50/50 transition-colors cursor-pointer text-xs font-semibold text-blue-700">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Ambil Foto Barisan Pulang Regular</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoPulangRegChange}
                      className="hidden"
                    />
                  </label>
                  {photoPulangRegPreview && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                      <img src={photoPulangRegPreview} alt="Foto Pulang Regular" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoPulangRegPreview(null); setPhotoPulangRegFile(null); }}
                        className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Foto Pulang Additional (jika ada) */}
                {inAddModal > 0 && (
                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2">
                    <label className="block text-xs font-bold text-amber-900">
                      Foto Barisan Pulang ADDITIONAL
                    </label>
                    <label className="flex items-center gap-2 border border-dashed border-amber-300 rounded-lg p-2.5 bg-white hover:bg-amber-50/50 transition-colors cursor-pointer text-xs font-semibold text-amber-700">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <span>Ambil Foto Barisan Pulang Additional</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoPulangAddChange}
                        className="hidden"
                      />
                    </label>
                    {photoPulangAddPreview && (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100">
                        <img src={photoPulangAddPreview} alt="Foto Pulang Additional" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setPhotoPulangAddPreview(null); setPhotoPulangAddFile(null); }}
                          className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tombol Aksi Form */}
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
