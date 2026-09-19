'use client';

// ============================================================================
// KOMPONEN FASE 4: ABSEN PULANG & REKONSILIASI KEPULANGAN TERPADU (2 SUB-TAB)
// Alur Kerja Lapangan:
// 1. Sub-Tab 1: Serah Terima Kepulangan Vendor
//    - Vendor mengantar anak-anak pulang, menghitung realisasi pulang Reg & Add.
//    - Terhubung otomatis dengan data Live Tumbang (Fase 3): pekerja sakit/izin
//      langsung terdata tanpa perlu input ulang atau dicurangi vendor.
//    - Wajib melampirkan foto apel kepulangan kontingen vendor.
// 2. Sub-Tab 2: Kepulangan Regu Under Lapangan (Checkout Regu Pos Divisi)
//    - Under di Bongkar, Muat, Sortir (A/B/C), FIFO, Repack mengonfirmasi
//      pelepasan anak-anak yang dipegangnya saat shift berakhir.
//    - Wajib melampirkan foto apel kepulangan regu bersama Under.
// 3. Live Audit Rekonsiliasi Kepulangan:
//    - Membandingkan Total Pulang Vendor vs Total Pulang Under Lapangan.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
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
  Layers, 
  Plus, 
  Trash2, 
  Lock, 
  ZoomIn, 
  Image as ImageIcon,
  MapPin,
  Truck,
  Box,
  Package,
  Edit2,
  Check
} from 'lucide-react';
import { 
  submitAbsenPulang, 
  getUnderAssignments, 
  submitUnderCheckout 
} from '@/app/actions';
import { compressImage } from '@/lib/compressImage';
import { getShortVendorName } from '@/lib/vendorMapping';
import { DIVISION_DEFINITIONS } from '@/components/AbsenMasukTab';
import { getCurrent24HourTime, convertTo24Hour } from '@/lib/timeUtils';

// Struktur slot foto checkout vendor
interface SectionPhotoSlot {
  id: string;
  section: string;
  file: File | null;
  preview: string | null;
  existingUrl?: string | null;
}

// Struktur data kejadian tumbang
interface TumbangIncidentSlot {
  id: string;
  category: 'REGULAR' | 'ADDITIONAL';
  time: string;
  type: string;
  notes: string;
  file: File | null;
  preview: string | null;
  existingUrl?: string | null;
}

interface AbsenPulangTabProps {
  plotingans: any[];
  shifts?: any[];
  tumbangIncidents?: any[];
  selectedDate: string;
  onRefresh: () => void;
}

export default function AbsenPulangTab({
  plotingans,
  shifts = [],
  tumbangIncidents = [],
  selectedDate,
  onRefresh,
}: AbsenPulangTabProps) {
  // --------------------------------------------------------------------------
  // 1. STATE NAVIGASI SUB-TAB
  // --------------------------------------------------------------------------
  const [activeSubTab, setActiveSubTab] = useState<'VENDOR' | 'UNDER'>('VENDOR');

  // Filter shift Under
  const [underShiftFilter, setUnderShiftFilter] = useState<string>('ALL');
  const [underAssignments, setUnderAssignments] = useState<any[]>([]);
  const [loadingUnder, setLoadingUnder] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. STATE MODAL CHECKOUT VENDOR (SUB-TAB 1)
  // --------------------------------------------------------------------------
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [pulangRegular, setPulangRegular] = useState<number>(0);
  const [pulangAdditional, setPulangAdditional] = useState<number>(0);
  const [tumbangRegular, setTumbangRegular] = useState<number>(0);
  const [tumbangAdditional, setTumbangAdditional] = useState<number>(0);
  const [tumbangNotes, setTumbangNotes] = useState('');
  const [vendorTumbangList, setVendorTumbangList] = useState<TumbangIncidentSlot[]>([]);
  const [pulangRegPhotoSlots, setPulangRegPhotoSlots] = useState<SectionPhotoSlot[]>([]);
  const [pulangAddPhotoSlots, setPulangAddPhotoSlots] = useState<SectionPhotoSlot[]>([]);
  const [isSubmittingVendor, setIsSubmittingVendor] = useState(false);

  // --------------------------------------------------------------------------
  // 3. STATE MODAL CHECKOUT UNDER LAPANGAN (SUB-TAB 2)
  // --------------------------------------------------------------------------
  const [selectedUnder, setSelectedUnder] = useState<any | null>(null);
  const [isUnderModalOpen, setIsUnderModalOpen] = useState(false);
  const [underCheckoutReg, setUnderCheckoutReg] = useState<number>(0);
  const [underCheckoutAdd, setUnderCheckoutAdd] = useState<number>(0);
  const [underCheckoutNotes, setUnderCheckoutNotes] = useState<string>('');
  const [underCheckoutPhotoFile, setUnderCheckoutPhotoFile] = useState<File | null>(null);
  const [underCheckoutPhotoPreview, setUnderCheckoutPhotoPreview] = useState<string | null>(null);
  const [isSubmittingUnder, setIsSubmittingUnder] = useState(false);

  // --------------------------------------------------------------------------
  // 4. LIGHTBOX ZOOM MODAL
  // --------------------------------------------------------------------------
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // --------------------------------------------------------------------------
  // 5. FETCH DATA UNDER ASSIGNMENTS
  // --------------------------------------------------------------------------
  const loadUnderAssignmentsData = useCallback(async () => {
    try {
      setLoadingUnder(true);
      const data = await getUnderAssignments(selectedDate);
      setUnderAssignments(data);
    } catch (err) {
      console.error('Gagal mengambil penugasan under:', err);
    } finally {
      setLoadingUnder(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadUnderAssignmentsData();
  }, [loadUnderAssignmentsData]);

  // Master shifts deduplikasi
  const rawShifts = shifts && shifts.length > 0 ? shifts : [
    { id: 'pagi', name: 'Shift Pagi' },
    { id: 'malam', name: 'Shift Malam' },
  ];
  const availableShifts = rawShifts.filter((s, idx, arr) =>
    idx === arr.findIndex((t) => t.name.toLowerCase().trim() === s.name.toLowerCase().trim())
  );

  // --------------------------------------------------------------------------
  // 6. EVENT HANDLER CHECKOUT VENDOR (SUB-TAB 1)
  // --------------------------------------------------------------------------
  const handleOpenVendorModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existingOut = plot.attendanceIn?.attendanceOut;
    const inReg = plot.attendanceIn ? (plot.attendanceIn.actualRegular ?? plot.attendanceIn.actualHeadcount) : 0;
    const inAdd = plot.attendanceIn?.actualAdditional ?? 0;

    // Ambil insiden tumbang hari ini untuk vendor ini dari Tab 3 Live Tumbang
    const relatedIncidents = tumbangIncidents.filter((inc) => 
      inc.shiftId === plot.shiftId && (inc.vendorId === plot.vendorId || inc.vendorName?.toLowerCase() === plot.vendor.name.toLowerCase())
    );

    const relatedRegTumbang = relatedIncidents.filter(i => i.category === 'REGULAR').length;
    const relatedAddTumbang = relatedIncidents.filter(i => i.category === 'ADDITIONAL').length;

    const currentTumbangReg = existingOut ? existingOut.tumbangRegular : relatedRegTumbang;
    const currentTumbangAdd = existingOut ? existingOut.tumbangAdditional : relatedAddTumbang;

    setTumbangRegular(currentTumbangReg);
    setTumbangAdditional(currentTumbangAdd);
    setTumbangNotes(existingOut?.tumbangNotes || (relatedIncidents.length > 0 ? `Otomatis sinkron ${relatedIncidents.length} insiden dari Tab Live Tumbang` : ''));

    if (existingOut) {
      setPulangRegular(existingOut.pulangRegular ?? existingOut.pulangHeadcount ?? Math.max(0, inReg - currentTumbangReg));
      setPulangAdditional(existingOut.pulangAdditional ?? Math.max(0, inAdd - currentTumbangAdd));
    } else {
      setPulangRegular(Math.max(0, inReg - currentTumbangReg));
      setPulangAdditional(Math.max(0, inAdd - currentTumbangAdd));
    }

    // Inisialisasi slot foto checkout REGULAR
    let parsedRegSlots: SectionPhotoSlot[] = [];
    if (existingOut?.photosPulangRegularJson) {
      try {
        const arr = JSON.parse(existingOut.photosPulangRegularJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedRegSlots = arr.map((item: any, idx: number) => ({
            id: `init-out-reg-${idx}-${Date.now()}`,
            section: 'Foto Full Vendor',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {}
    }
    if (parsedRegSlots.length === 0 && (existingOut?.photoPulangRegularUrl || existingOut?.photoPulangUrl)) {
      parsedRegSlots = [{
        id: `init-out-reg-0-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: existingOut.photoPulangRegularUrl || existingOut.photoPulangUrl,
        existingUrl: existingOut.photoPulangRegularUrl || existingOut.photoPulangUrl,
      }];
    }
    if (parsedRegSlots.length === 0 && inReg > 0) {
      parsedRegSlots = [{
        id: `init-out-reg-empty-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: null,
      }];
    }
    setPulangRegPhotoSlots(parsedRegSlots);

    // Inisialisasi slot foto checkout ADDITIONAL
    let parsedAddSlots: SectionPhotoSlot[] = [];
    if (existingOut?.photosPulangAdditionalJson) {
      try {
        const arr = JSON.parse(existingOut.photosPulangAdditionalJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedAddSlots = arr.map((item: any, idx: number) => ({
            id: `init-out-add-${idx}-${Date.now()}`,
            section: 'Foto Full Vendor',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {}
    }
    if (parsedAddSlots.length === 0 && existingOut?.photoPulangAdditionalUrl) {
      parsedAddSlots = [{
        id: `init-out-add-0-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: existingOut.photoPulangAdditionalUrl,
        existingUrl: existingOut.photoPulangAdditionalUrl,
      }];
    }
    if (parsedAddSlots.length === 0 && inAdd > 0) {
      parsedAddSlots = [{
        id: `init-out-add-empty-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: null,
      }];
    }
    setPulangAddPhotoSlots(parsedAddSlots);

    setIsVendorModalOpen(true);
  };

  const handleAddPulangRegSlot = () => {
    setPulangRegPhotoSlots((prev) => [
      ...prev,
      { id: `out-reg-${Date.now()}`, section: 'Foto Full Vendor', file: null, preview: null }
    ]);
  };

  const handleRemovePulangRegSlot = (id: string) => {
    setPulangRegPhotoSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePulangRegFileChange = async (id: string, file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setPulangRegPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file: compressed, preview: previewUrl } : slot))
    );
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan?.attendanceIn?.id) return;

    const inReg = selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount;
    const inAdd = selectedPlotingan.attendanceIn.actualAdditional ?? 0;

    const selisihReg = inReg - (pulangRegular + tumbangRegular);
    const selisihAdd = inAdd - (pulangAdditional + tumbangAdditional);
    const selisihTotal = selisihReg + selisihAdd;

    if (selisihTotal !== 0) {
      alert(`Jumlah kepulangan tidak klop! Masuk (${inReg + inAdd}) ≠ Pulang (${pulangRegular + pulangAdditional}) + Tumbang (${tumbangRegular + tumbangAdditional}). Selisih: ${selisihTotal} orang.`);
      return;
    }

    const validRegPhotos = pulangRegPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);
    const validAddPhotos = pulangAddPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);

    if (pulangRegular > 0 && validRegPhotos.length === 0) {
      alert('Wajib melampirkan minimal 1 foto apel kepulangan kontingen Regular!');
      return;
    }

    setIsSubmittingVendor(true);
    try {
      const formData = new FormData();
      formData.append('attendanceInId', selectedPlotingan.attendanceIn.id);
      formData.append('pulangRegular', pulangRegular.toString());
      formData.append('pulangAdditional', pulangAdditional.toString());
      formData.append('tumbangRegular', tumbangRegular.toString());
      formData.append('tumbangAdditional', tumbangAdditional.toString());
      formData.append('tumbangNotes', tumbangNotes);

      formData.append('photoPulangRegular_count', validRegPhotos.length.toString());
      validRegPhotos.forEach((slot, index) => {
        formData.append(`photoPulangRegular_section_${index}`, slot.section);
        if (slot.file) formData.append(`photoPulangRegular_file_${index}`, slot.file);
        if (slot.existingUrl) formData.append(`photoPulangRegular_existing_${index}`, slot.existingUrl);
      });

      formData.append('photoPulangAdditional_count', validAddPhotos.length.toString());
      validAddPhotos.forEach((slot, index) => {
        formData.append(`photoPulangAdditional_section_${index}`, slot.section);
        if (slot.file) formData.append(`photoPulangAdditional_file_${index}`, slot.file);
        if (slot.existingUrl) formData.append(`photoPulangAdditional_existing_${index}`, slot.existingUrl);
      });

      const res = await submitAbsenPulang(formData);
      if (res.success) {
        setIsVendorModalOpen(false);
        onRefresh();
      } else {
        alert(res.error || 'Gagal menyimpan absensi pulang vendor.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSubmittingVendor(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. EVENT HANDLER CHECKOUT UNDER LAPANGAN (SUB-TAB 2)
  // --------------------------------------------------------------------------
  const handleOpenUnderModal = (under: any) => {
    setSelectedUnder(under);
    setUnderCheckoutReg(under.checkoutRegular ?? under.regularCount);
    setUnderCheckoutAdd(under.checkoutAdditional ?? under.additionalCount);
    setUnderCheckoutNotes(under.checkoutNotes || '');
    setUnderCheckoutPhotoFile(null);
    setUnderCheckoutPhotoPreview(under.checkoutPhotoUrl || null);
    setIsUnderModalOpen(true);
  };

  const handleUnderPhotoChange = async (file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    setUnderCheckoutPhotoFile(compressed);
    setUnderCheckoutPhotoPreview(URL.createObjectURL(compressed));
  };

  const handleUnderCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnder?.id) return;

    if (!underCheckoutPhotoFile && !selectedUnder.checkoutPhotoUrl) {
      alert('Foto bukti apel kepulangan regu bersama Under WAJIB dilampirkan!');
      return;
    }

    setIsSubmittingUnder(true);
    try {
      const fd = new FormData();
      fd.append('id', selectedUnder.id);
      fd.append('checkoutRegular', underCheckoutReg.toString());
      fd.append('checkoutAdditional', underCheckoutAdd.toString());
      if (underCheckoutNotes.trim()) fd.append('notes', underCheckoutNotes.trim());
      if (underCheckoutPhotoFile) fd.append('photo', underCheckoutPhotoFile);
      else if (selectedUnder.checkoutPhotoUrl) fd.append('existingPhotoUrl', selectedUnder.checkoutPhotoUrl);

      const res = await submitUnderCheckout(fd);
      if (res.success) {
        await loadUnderAssignmentsData();
        setIsUnderModalOpen(false);
        onRefresh();
      } else {
        alert('Gagal checkout under: ' + (res.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal simpan checkout under: ' + err.message);
    } finally {
      setIsSubmittingUnder(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. AUDIT REKONSILIASI KEPULANGAN (TOTAL PULANG VENDOR VS UNDER)
  // --------------------------------------------------------------------------
  const filteredPlotingans = underShiftFilter === 'ALL'
    ? plotingans
    : plotingans.filter((p) => p.shiftId === underShiftFilter);

  const totalVendorPulangReg = filteredPlotingans.reduce((sum, p) => sum + (p.attendanceIn?.attendanceOut?.pulangRegular ?? p.attendanceIn?.attendanceOut?.pulangHeadcount ?? 0), 0);
  const totalVendorPulangAdd = filteredPlotingans.reduce((sum, p) => sum + (p.attendanceIn?.attendanceOut?.pulangAdditional ?? 0), 0);
  const totalVendorPulangTotal = totalVendorPulangReg + totalVendorPulangAdd;

  const filteredUnder = underShiftFilter === 'ALL'
    ? underAssignments
    : underAssignments.filter((u) => u.shiftId === underShiftFilter);

  const totalUnderPulangReg = filteredUnder.reduce((sum, u) => sum + (u.checkoutRegular ?? 0), 0);
  const totalUnderPulangAdd = filteredUnder.reduce((sum, u) => sum + (u.checkoutAdditional ?? 0), 0);
  const totalUnderPulangTotal = totalUnderPulangReg + totalUnderPulangAdd;

  const selisihPulang = totalVendorPulangTotal - totalUnderPulangTotal;
  const isPulangBalanced = totalVendorPulangTotal > 0 && selisihPulang === 0;

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER FASE 4 OPERASIONAL */}
      <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-950 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-white/20 text-white border border-white/30">
                FASE 4 OPERASIONAL
              </span>
              <span className="text-xs text-indigo-200 font-medium">Tanggal: {selectedDate}</span>
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight mt-1 flex items-center gap-2">
              <LogOut className="w-5 h-5 text-indigo-400" />
              Absen Pulang & Rekonsiliasi Kepulangan Shift
            </h1>
            <p className="text-xs text-indigo-200/90 mt-0.5 max-w-2xl leading-relaxed">
              Merekam pelepasan pulang pasukan dari dua sisi: Serah terima kepulangan Vendor & konfirmasi checkout 
              oleh Under Lapangan di tiap divisi, tersinkronisasi otomatis dengan data pekerja tumbang.
            </p>
          </div>

          {/* Sub-Tab Pill Switcher */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/20 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('VENDOR')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'VENDOR'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Serah Terima Out Vendor</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                {totalVendorPulangTotal} MP
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('UNDER')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'UNDER'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Distribusi Out PIC Lapangan</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                {totalUnderPulangTotal} MP
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BANNER REKONSILIASI KEPULANGAN (AUDIT VENDOR VS UNDER) */}
      <div className={`rounded-2xl border p-4 shadow-xs transition-all ${
        isPulangBalanced
          ? 'bg-emerald-50/70 border-emerald-300'
          : selisihPulang > 0
          ? 'bg-amber-50/80 border-amber-300'
          : totalVendorPulangTotal === 0 && totalUnderPulangTotal === 0
          ? 'bg-slate-50 border-slate-200'
          : 'bg-rose-50/80 border-rose-300'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isPulangBalanced
                ? 'bg-emerald-600 text-white'
                : selisihPulang > 0
                ? 'bg-amber-600 text-white'
                : totalVendorPulangTotal === 0 && totalUnderPulangTotal === 0
                ? 'bg-slate-300 text-slate-700'
                : 'bg-rose-600 text-white'
            }`}>
              {isPulangBalanced ? (
                <ShieldCheck className="w-5 h-5" />
              ) : selisihPulang > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Audit Rekonsiliasi Kepulangan Shift
                </span>
                {underShiftFilter !== 'ALL' && (
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border text-slate-600">
                    Filter: {availableShifts.find(s => s.id === underShiftFilter)?.name || underShiftFilter}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1 text-slate-700">
                <span>
                  🏢 Pulang Diserahkan Vendor: <strong className="font-extrabold text-blue-700">{totalVendorPulangTotal} MP</strong> 
                  {' '}({totalVendorPulangReg} Reg + {totalVendorPulangAdd} Add)
                </span>
                <span className="text-slate-300 hidden sm:inline">&bull;</span>
                <span>
                  📍 Pulang Dikonfirmasi Under: <strong className="font-extrabold text-indigo-700">{totalUnderPulangTotal} MP</strong> 
                  {' '}({totalUnderPulangReg} Reg + {totalUnderPulangAdd} Add)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {totalVendorPulangTotal === 0 && totalUnderPulangTotal === 0 ? (
              <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                Shift Berjalan (Belum Ada Checkout Pulang)
              </span>
            ) : isPulangBalanced ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                KLOP 100% (Vendor & Under Sesuai)
              </span>
            ) : selisihPulang > 0 ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-100" />
                Selisih: {selisihPulang} MP Belum Dikonfirmasi Checkout Under
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-100" />
                Selisih: Checkout Under Melebihi Vendor (+{Math.abs(selisihPulang)} MP)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SUB-TAB 1: SERAH TERIMA KEPULANGAN VENDOR                            */}
      {/* ==================================================================== */}
      {activeSubTab === 'VENDOR' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plotingans.map((p) => {
              const hasCheckedIn = !!p.attendanceIn;
              const hasCheckedOut = !!p.attendanceIn?.attendanceOut;
              const inReg = p.attendanceIn ? (p.attendanceIn.actualRegular ?? p.attendanceIn.actualHeadcount) : 0;
              const inAdd = p.attendanceIn?.actualAdditional ?? 0;
              const inTotal = inReg + inAdd;

              const out = p.attendanceIn?.attendanceOut;
              const outReg = out ? (out.pulangRegular ?? out.pulangHeadcount ?? 0) : 0;
              const outAdd = out ? (out.pulangAdditional ?? 0) : 0;
              const outTotal = outReg + outAdd;

              const tumbangReg = out ? (out.tumbangRegular ?? 0) : 0;
              const tumbangAdd = out ? (out.tumbangAdditional ?? 0) : 0;
              const tumbangTotal = tumbangReg + tumbangAdd;

              // Cek insiden tumbang hari ini untuk vendor ini dari Tab 3 Live Tumbang
              const relatedTumbang = tumbangIncidents.filter((inc) => 
                inc.shiftId === p.shiftId && (inc.vendorId === p.vendorId || inc.vendorName?.toLowerCase() === p.vendor.name.toLowerCase())
              );

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                    !hasCheckedIn
                      ? 'border-slate-200 opacity-60'
                      : hasCheckedOut
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                >
                  <div>
                    {/* Status Header */}
                    <div className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
                      !hasCheckedIn
                        ? 'bg-slate-100 text-slate-500'
                        : hasCheckedOut
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {!hasCheckedIn ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Belum Absen Masuk
                          </>
                        ) : hasCheckedOut ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Sudah Checkout ({outTotal} MP)
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            Sedang Kerja (Belum Checkout)
                          </>
                        )}
                      </span>

                      <span className="text-[11px] font-bold text-slate-700 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                        Shift {p.shift.name}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          {getShortVendorName(p.vendor.name)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Masuk: <strong className="text-slate-800">{inTotal} MP</strong> ({inReg} Reg + {inAdd} Add)
                        </p>
                      </div>

                      {/* Notifikasi Tumbang Terhubung dari Tab 3 */}
                      {relatedTumbang.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              Data Tumbang Shift Ini:
                            </span>
                            <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded text-[10px] font-black">
                              {relatedTumbang.length} Orang
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-700">
                            {relatedTumbang.map((t, idx) => (
                              <span key={idx} className="block">
                                &bull; Jam {t.time} ({t.category}): {t.type} di {t.division}
                              </span>
                            ))}
                          </p>
                        </div>
                      )}

                      {/* Rincian Pulang */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Pulang Regular:</span>
                          <span className="font-extrabold text-blue-700">{hasCheckedOut ? `${outReg} MP` : '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Pulang Additional:</span>
                          <span className="font-extrabold text-amber-700">{hasCheckedOut ? `${outAdd} MP` : '-'}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-bold">
                          <span className="text-slate-700">Total Pulang / Masuk:</span>
                          <span className={hasCheckedOut ? 'text-emerald-700 font-black' : 'text-slate-500'}>
                            {hasCheckedOut ? `${outTotal} / ${inTotal} MP` : `Masuk: ${inTotal} MP`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Action */}
                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      disabled={!hasCheckedIn}
                      onClick={() => handleOpenVendorModal(p)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        !hasCheckedIn
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : hasCheckedOut
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {hasCheckedOut ? 'Edit Checkout Vendor' : 'Input Checkout Vendor (Wajib Foto)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: KEPULANGAN REGU UNDER LAPANGAN                            */}
      {/* ==================================================================== */}
      {activeSubTab === 'UNDER' && (
        <div className="space-y-4">
          
          {/* Shift Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Filter Shift:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setUnderShiftFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    underShiftFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Shift
                </button>
                {availableShifts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setUnderShiftFilter(s.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      underShiftFilter === s.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Shift {s.name}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-bold text-slate-500">
              Total {filteredUnder.length} Regu Terdaftar
            </span>
          </div>

          {/* Grid Under Cards */}
          {filteredUnder.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Penugasan Under</p>
              <p className="text-xs text-slate-400 mt-0.5">Under didistribusikan pada Fase 2 (Absen Masuk).</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredUnder.map((u) => {
                const isUnderCheckedOut = !!u.checkoutPhotoUrl || u.checkoutTotal !== null;
                const def = DIVISION_DEFINITIONS.find((d) => d.key === u.division);

                return (
                  <div
                    key={u.id}
                    className={`bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-xs hover:shadow-md ${
                      isUnderCheckedOut ? 'border-emerald-300' : 'border-amber-300'
                    }`}
                  >
                    <div>
                      {/* Header Divisi & Nama Under */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${def?.badgeStyle || 'bg-slate-100 text-slate-700'}`}>
                            {def?.name || u.division}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 mt-1.5">{u.underName}</h4>
                          <span className="text-[10px] text-slate-500">Shift {u.shift?.name || 'Pagi'}</span>
                        </div>

                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                          isUnderCheckedOut ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isUnderCheckedOut ? `${u.checkoutTotal} MP Pulang` : `${u.totalHeadcount} MP Masuk`}
                        </span>
                      </div>

                      {/* Headcount Breakdown */}
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 my-3 text-xs space-y-1">
                        <div className="flex justify-between text-slate-600">
                          <span>Masuk Awal:</span>
                          <span className="font-bold text-slate-800">{u.regularCount} Reg + {u.additionalCount} Add</span>
                        </div>
                        {isUnderCheckedOut && (
                          <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                            <span>Checkout Pulang:</span>
                            <span>{u.checkoutRegular} Reg + {u.checkoutAdditional} Add</span>
                          </div>
                        )}
                      </div>

                      {/* Foto Apel Checkout Kepulangan */}
                      {u.checkoutPhotoUrl ? (
                        <div
                          onClick={() => setLightboxPhoto({ url: u.checkoutPhotoUrl, title: `Checkout Pulang: ${u.underName} (${u.division})` })}
                          className="relative h-24 rounded-xl overflow-hidden border border-emerald-300 bg-slate-100 cursor-pointer group mb-2"
                        >
                          <img src={u.checkoutPhotoUrl} alt="Foto Checkout Pulang" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </div>
                          <span className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.2 rounded">
                            Foto Checkout
                          </span>
                        </div>
                      ) : (
                        <div className="h-16 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 flex items-center justify-center text-[10px] text-amber-700 gap-1 mb-2">
                          <Camera className="w-3.5 h-3.5 text-amber-500" /> Belum ada foto apel pulang
                        </div>
                      )}

                      {u.checkoutNotes && (
                        <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-2">
                          "{u.checkoutNotes}"
                        </p>
                      )}
                    </div>

                    {/* Tombol Checkout Under */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenUnderModal(u)}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isUnderCheckedOut
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        {isUnderCheckedOut ? 'Edit Checkout Regu' : 'Input Checkout Regu (Wajib Foto)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MODAL CHECKOUT VENDOR (SUB-TAB 1)                                  */}
      {/* ==================================================================== */}
      {isVendorModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  Checkout Serah Terima Vendor
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {getShortVendorName(selectedPlotingan.vendor.name)} &bull; Shift {selectedPlotingan.shift.name} ({selectedDate})
                </p>
              </div>
              <button
                onClick={() => setIsVendorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVendorSubmit} className="space-y-4 mt-4">
              
              {/* Ringkasan Masuk */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 uppercase block mb-1">Status Kehadiran Masuk:</span>
                <div className="flex justify-between text-slate-800">
                  <span>Masuk Regular: <strong>{selectedPlotingan.attendanceIn?.actualRegular || 0} MP</strong></span>
                  <span>Masuk Additional: <strong>{selectedPlotingan.attendanceIn?.actualAdditional || 0} MP</strong></span>
                  <span>Total: <strong>{(selectedPlotingan.attendanceIn?.actualRegular || 0) + (selectedPlotingan.attendanceIn?.actualAdditional || 0)} MP</strong></span>
                </div>
              </div>

              {/* Rincian Pulang Utuh */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    Pulang Regular (MP):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pulangRegular === 0 ? '' : pulangRegular}
                    onChange={(e) => setPulangRegular(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Pulang Additional (MP):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pulangAdditional === 0 ? '' : pulangAdditional}
                    onChange={(e) => setPulangAdditional(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Rincian Tumbang Terhubung (Terkunci / Read-Only Display Resmi PIC) */}
              <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    Pekerja Tumbang / Izin (Rekaman Resmi PIC Lapangan):
                  </span>
                  <span className="bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded text-[11px] font-black">
                    Total: {tumbangRegular + tumbangAdditional} Orang
                  </span>
                </div>

                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Data tumbang terkunci otomatis sesuai rekap PIC di Fase 3 Live Tumbang demi integritas absensi. Vendor tidak dapat mengubah angka ini.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white/80 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Tumbang Reguler:</span>
                    <span className="text-sm font-black text-amber-900">{tumbangRegular} Orang</span>
                  </div>
                  <div className="bg-white/80 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Tumbang Additional:</span>
                    <span className="text-sm font-black text-amber-900">{tumbangAdditional} Orang</span>
                  </div>
                </div>
              </div>

              {/* Upload Foto Kontingen Pulang Vendor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Bukti Apel Kontingen Pulang Vendor (Wajib Foto):
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPulangRegSlot}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> + Foto
                  </button>
                </div>

                <div className="space-y-2">
                  {pulangRegPhotoSlots.map((slot, index) => (
                    <div key={slot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                      {slot.preview ? (
                        <div
                          onClick={() => setLightboxPhoto({ url: slot.preview!, title: `Foto Pulang #${index + 1}` })}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-indigo-300 shrink-0 cursor-pointer"
                        >
                          <img src={slot.preview} alt="Preview Pulang" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0 bg-white">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          {slot.preview ? 'Ganti Foto' : 'Ambil Foto Pulang Vendor'}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handlePulangRegFileChange(slot.id, e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {pulangRegPhotoSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePulangRegSlot(slot.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVendor}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingVendor ? 'Menyimpan...' : 'Simpan Checkout Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODAL CHECKOUT REGU UNDER LAPANGAN (SUB-TAB 2)                     */}
      {/* ==================================================================== */}
      {isUnderModalOpen && selectedUnder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  Checkout Regu Under Lapangan
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedUnder.underName} &bull; {selectedUnder.division} (Shift {selectedUnder.shift?.name || 'Pagi'})
                </p>
              </div>
              <button
                onClick={() => setIsUnderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUnderCheckoutSubmit} className="space-y-4 mt-4">
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Pasukan Awal yang Dipegang:</span>
                <p className="text-slate-800 font-black text-sm mt-0.5">
                  {selectedUnder.regularCount} Regular + {selectedUnder.additionalCount} Additional = {selectedUnder.totalHeadcount} MP
                </p>
              </div>

              {/* Rincian Pulang Under */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    Pulang Regular (MP):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={underCheckoutReg === 0 ? '' : underCheckoutReg}
                    onChange={(e) => setUnderCheckoutReg(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Pulang Additional (MP):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={underCheckoutAdd === 0 ? '' : underCheckoutAdd}
                    onChange={(e) => setUnderCheckoutAdd(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Foto Bukti Apel Kepulangan Regu Bersama Under (WAJIB) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Bukti Apel Kepulangan Bersama Under (Wajib Ber-Timestamp):
                  </label>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                    * WAJIB
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {underCheckoutPhotoPreview ? (
                    <div
                      onClick={() => setLightboxPhoto({ url: underCheckoutPhotoPreview!, title: `Regu Pulang: ${selectedUnder.underName}` })}
                      className="w-16 h-16 rounded-xl overflow-hidden border border-indigo-300 shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400 relative group"
                    >
                      <img src={underCheckoutPhotoPreview} alt="Preview Regu Pulang" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-rose-300 flex items-center justify-center text-rose-400 shrink-0 bg-rose-50/40">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      {underCheckoutPhotoPreview ? 'Ganti Foto Apel Pulang' : 'Ambil Foto Apel Pulang Regu'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleUnderPhotoChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {underCheckoutPhotoPreview ? (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>TIMESTAMP PULANG TERVERIFIKASI &bull; {selectedDate} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                      </div>
                    ) : (
                      <span className="block text-[10px] text-rose-500 font-medium mt-1">
                        * Under wajib melampirkan foto apel kepulangan regu sebelum menyimpan.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Catatan Selesai Shift */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Selesai Shift (Opsional):
                </label>
                <input
                  type="text"
                  value={underCheckoutNotes}
                  onChange={(e) => setUnderCheckoutNotes(e.target.value)}
                  placeholder="Misal: Operasional beres, target tercapai aman..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              {(() => {
                const hasPhoto = !!underCheckoutPhotoFile || !!selectedUnder.checkoutPhotoUrl;
                return (
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsUnderModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!hasPhoto || isSubmittingUnder}
                      className={`flex-1 py-2.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                        hasPhoto && !isSubmittingUnder
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      }`}
                    >
                      {!hasPhoto ? (
                        <>
                          <Lock className="w-4 h-4 text-slate-400" />
                          Wajib Foto Apel Pulang
                        </>
                      ) : isSubmittingUnder ? (
                        'Menyimpan...'
                      ) : (
                        'Simpan Checkout Under'
                      )}
                    </button>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. LIGHTBOX FULLSCREEN ZOOM PREVIEW                                  */}
      {/* ==================================================================== */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/90">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                {lightboxPhoto.title}
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black max-h-[80vh] overflow-hidden">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
