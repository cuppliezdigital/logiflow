'use client';

// ============================================================================
// KOMPONEN TAB 2: ABSEN MASUK & DISTRIBUSI POS UNDER LAPANGAN (3 AKTOR OPERASIONAL)
// Arsitektur Alur Lapangan Terpadu:
// 1. Aktor 1 (Manager J&T): Plotingan kuota H-1 (diatur di Tab 1).
// 2. Aktor 2 (Pihak Vendor): Serah terima pasukan di awal shift.
//    Vendor membawa anak-anak naik ke lapangan, mengambil foto full kontingen,
//    dan mencatat nama/jumlah Reg & Add tanpa wajib repot memisah foto per bagian.
// 3. Aktor 3 (Karyawan / Under Lapangan J&T): Pembagian operasional riil per divisi:
//    - Bongkaran
//    - Muatan (1 Under memegang 3-4 anak Reg/Add)
//    - Sortir (3 Jalur: Bodebek, Sumatraan, Jakarta)
//    - FIFO
//    - Repack
//    Under mengambil foto regu yang dipegangnya & input jumlah Reg/Add.
// 4. Live Audit Reconciliation Banner:
//    Membandingkan Total Pasukan Diserahkan Vendor vs Total Diterima Under Lapangan.
// 5. Lightbox Modal Preview untuk foto kontingen vendor & foto regu Under.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LogIn, 
  Camera, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X,
  Sparkles,
  Sun,
  Moon,
  Layers,
  Plus,
  Trash2,
  Lock,
  ZoomIn,
  Image as ImageIcon,
  Users,
  Box,
  Truck,
  Package,
  Edit2,
  RefreshCw,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronRight
} from 'lucide-react';
import { 
  submitAbsenMasuk, 
  saveUnderAssignment, 
  deleteUnderAssignment, 
  getUnderAssignments,
  submitLateArrival
} from '@/app/actions';
import { compressImage } from '@/lib/compressImage';
import { getShortVendorName } from '@/lib/vendorMapping';

// Daftar opsi preset foto kontingen vendor (cukup foto utuh kontingen vendor tanpa wajib memecah per divisi)
const SECTION_PRESETS = ['Foto Full Vendor', 'Foto Kontingen Tambahan'];

// Definisi 5 Divisi Utama Operasional Pergudangan J&T & Sub-Jalur Sortir
export const DIVISION_DEFINITIONS = [
  { 
    key: 'BONGKARAN', 
    name: 'Bongkaran', 
    shortName: 'Bongkar',
    group: 'BONGKARAN', 
    icon: Box, 
    borderAccent: 'border-blue-200 hover:border-blue-400',
    bgHeader: 'bg-blue-50/80 text-blue-900',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'Bongkar kontainer / armada masuk' 
  },
  { 
    key: 'MUATAN', 
    name: 'Muatan', 
    shortName: 'Muat',
    group: 'MUATAN', 
    icon: Truck, 
    borderAccent: 'border-amber-200 hover:border-amber-400',
    bgHeader: 'bg-amber-50/80 text-amber-900',
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: 'Muat paket armada keluar (1 Under megang 3-4 anak)' 
  },
  { 
    key: 'SORTIR_BODEBEK', 
    name: 'Sortir Bodebek (A)', 
    shortName: 'Bodebek (A)', 
    group: 'SORTIR', 
    lane: 'BODEBEK',
    icon: Layers, 
    borderAccent: 'border-indigo-200 hover:border-indigo-400',
    bgHeader: 'bg-indigo-50/80 text-indigo-900',
    badgeStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'Jalur 1: Sortir Bodebek (A)' 
  },
  { 
    key: 'SORTIR_SUMATRAAN', 
    name: 'Sortir Sumatraan (B)', 
    shortName: 'Sumatraan (B)', 
    group: 'SORTIR', 
    lane: 'SUMATRAAN',
    icon: Layers, 
    borderAccent: 'border-purple-200 hover:border-purple-400',
    bgHeader: 'bg-purple-50/80 text-purple-900',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'Jalur 2: Sortir Sumatraan (B)' 
  },
  { 
    key: 'SORTIR_JAKARTA', 
    name: 'Sortir Jakarta (C)', 
    shortName: 'Jakarta (C)', 
    group: 'SORTIR', 
    lane: 'JAKARTA',
    icon: Layers, 
    borderAccent: 'border-teal-200 hover:border-teal-400',
    bgHeader: 'bg-teal-50/80 text-teal-900',
    badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200',
    desc: 'Jalur 3: Sortir Jakarta (C)' 
  },
  { 
    key: 'FIFO', 
    name: 'FIFO', 
    shortName: 'FIFO',
    group: 'FIFO', 
    icon: Clock, 
    borderAccent: 'border-emerald-200 hover:border-emerald-400',
    bgHeader: 'bg-emerald-50/80 text-emerald-900',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'First In First Out staging & perputaran muatan' 
  },
  { 
    key: 'REPACK', 
    name: 'Repack', 
    shortName: 'Repack',
    group: 'REPACK', 
    icon: Package, 
    borderAccent: 'border-rose-200 hover:border-rose-400',
    bgHeader: 'bg-rose-50/80 text-rose-900',
    badgeStyle: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Pengemasan ulang paket rusak & sortir rapel' 
  },
];

// Struktur data slot foto upload presensi vendor
interface SectionPhotoSlot {
  id: string;                 // Identifier unik slot
  section: string;            // Kategori bagian (misal: 'Foto Full Vendor', 'Bongkar')
  file: File | null;          // File gambar terkompresi
  preview: string | null;     // URL preview gambar
  existingUrl?: string | null;// URL lama dari database jika ada
}

// Props komponen AbsenMasukTab
interface AbsenMasukTabProps {
  plotingans: any[];          // Seluruh data plotingan vendor tanggal terpilih
  shifts?: any[];             // Master data shift (Pagi, Malam)
  selectedDate: string;       // Tanggal aktif format YYYY-MM-DD
  onRefresh: () => void;      // Callback refresh data parent
}

export default function AbsenMasukTab({
  plotingans,
  shifts = [],
  selectedDate,
  onRefresh,
}: AbsenMasukTabProps) {
  // --------------------------------------------------------------------------
  // 1. STATE NAVIGASI SUB-TAB & UNDER LAPANGAN
  // --------------------------------------------------------------------------
  // Mode Sub-Tab: 'VENDOR' (Serah Terima Pasukan Vendor) vs 'UNDER' (Distribusi Pos & Under Lapangan)
  const [activeSubTab, setActiveSubTab] = useState<'VENDOR' | 'UNDER'>('VENDOR');

  // Filter shift pada Sub-Tab Under ('ALL' atau ID shift spesifik)
  const [underShiftFilter, setUnderShiftFilter] = useState<string>('ALL');

  // Filter divisi khusus tampilan mobile ('ALL' atau key divisi spesifik)
  const [mobileUnderDivFilter, setMobileUnderDivFilter] = useState<string>('ALL');

  // Daftar penugasan regu Under dari database
  const [underAssignments, setUnderAssignments] = useState<any[]>([]);
  const [loadingUnder, setLoadingUnder] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. STATE MODAL ABSEN MASUK VENDOR (SUB-TAB 1)
  // --------------------------------------------------------------------------
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actualRegular, setActualRegular] = useState<number>(0);
  const [actualAdditional, setActualAdditional] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [regularPhotoSlots, setRegularPhotoSlots] = useState<SectionPhotoSlot[]>([]);
  const [additionalPhotoSlots, setAdditionalPhotoSlots] = useState<SectionPhotoSlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // 3. STATE MODAL UNDER LAPANGAN (SUB-TAB 2)
  // --------------------------------------------------------------------------
  const [isUnderModalOpen, setIsUnderModalOpen] = useState<boolean>(false);
  const [editingUnder, setEditingUnder] = useState<any | null>(null);
  const [modalShiftId, setModalShiftId] = useState<string>('');
  const [modalDivision, setModalDivision] = useState<string>('BONGKARAN');
  const [modalUnderName, setModalUnderName] = useState<string>('');
  const [modalRegularCount, setModalRegularCount] = useState<number>(0);
  const [modalAdditionalCount, setModalAdditionalCount] = useState<number>(0);
  const [modalPhotoFile, setModalPhotoFile] = useState<File | null>(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalVendorBreakdown, setModalVendorBreakdown] = useState<Array<{ vendorId: string; vendorName: string; regular: number; additional: number }>>([]);
  const [isSubmittingUnder, setIsSubmittingUnder] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 3.B STATE MODAL INPUT SUSULAN / TELAT VENDOR
  // --------------------------------------------------------------------------
  const [isLateModalOpen, setIsLateModalOpen] = useState<boolean>(false);
  const [selectedLatePlotingan, setSelectedLatePlotingan] = useState<any | null>(null);
  const [lateRegular, setLateRegular] = useState<number>(0);
  const [lateAdditional, setLateAdditional] = useState<number>(0);
  const [lateTime, setLateTime] = useState<string>('');
  const [lateNotes, setLateNotes] = useState<string>('');
  const [latePhotoFile, setLatePhotoFile] = useState<File | null>(null);
  const [latePhotoPreview, setLatePhotoPreview] = useState<string | null>(null);
  const [isSubmittingLate, setIsSubmittingLate] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 4. STATE LIGHTBOX ZOOM PREVIEW FOTO
  // --------------------------------------------------------------------------
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // --------------------------------------------------------------------------
  // 5. FETCH DATA PENUGASAN UNDER LAPANGAN
  // --------------------------------------------------------------------------
  const loadUnderAssignments = useCallback(async () => {
    try {
      setLoadingUnder(true);
      const data = await getUnderAssignments(selectedDate);
      setUnderAssignments(data);
    } catch (err) {
      console.error('Gagal mengambil data penugasan Under:', err);
    } finally {
      setLoadingUnder(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadUnderAssignments();
  }, [loadUnderAssignments]);

  // Master shifts fallback jika kosong, sekaligus deduplikasi agar tidak pernah ada shift ganda
  const rawShifts = shifts && shifts.length > 0 ? shifts : [
    { id: 'pagi', name: 'Shift Pagi' },
    { id: 'malam', name: 'Shift Malam' },
  ];
  const availableShifts = rawShifts.filter((s, idx, arr) =>
    idx === arr.findIndex((t) => t.name.toLowerCase().trim() === s.name.toLowerCase().trim())
  );

  // --------------------------------------------------------------------------
  // 6. HELPER SLOT FOTO DINAMIS VENDOR (SUB-TAB 1)
  // --------------------------------------------------------------------------
  const handleAddRegularSlot = () => {
    const nextSection = SECTION_PRESETS[regularPhotoSlots.length % SECTION_PRESETS.length] || 'Foto Full Vendor';
    const newSlot: SectionPhotoSlot = {
      id: `reg-slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setRegularPhotoSlots((prev) => [...prev, newSlot]);
  };

  const handleRemoveRegularSlot = (id: string) => {
    setRegularPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  const handleUpdateRegularSection = (id: string, sectionName: string) => {
    setRegularPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  const handleRegularFileChange = async (id: string, file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setRegularPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file: compressed, preview: previewUrl } : slot))
    );
  };

  const handleAddAdditionalSlot = () => {
    const nextSection = SECTION_PRESETS[additionalPhotoSlots.length % SECTION_PRESETS.length] || 'Foto Full Vendor';
    const newSlot: SectionPhotoSlot = {
      id: `add-slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setAdditionalPhotoSlots((prev) => [...prev, newSlot]);
  };

  const handleRemoveAdditionalSlot = (id: string) => {
    setAdditionalPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  const handleUpdateAdditionalSection = (id: string, sectionName: string) => {
    setAdditionalPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  const handleAdditionalFileChange = async (id: string, file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setAdditionalPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file: compressed, preview: previewUrl } : slot))
    );
  };

  // --------------------------------------------------------------------------
  // 7. EVENT HANDLER MODAL ABSEN MASUK VENDOR
  // --------------------------------------------------------------------------
  const handleOpenVendorModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existing = plot.attendanceIn;

    const targetReg = plot.targetRegular ?? (plot.status === 'REGULAR' ? plot.targetHeadcount : 0);
    const targetAdd = plot.targetAdditional ?? (plot.status === 'ADDITIONAL' ? plot.targetHeadcount : 0);

    const initReg = existing ? (existing.actualRegular ?? existing.actualHeadcount) : targetReg;
    const initAdd = existing ? (existing.actualAdditional ?? 0) : targetAdd;
    setActualRegular(initReg);
    setActualAdditional(initAdd);
    setNotes(existing ? existing.notes || '' : '');

    // Inisialisasi slot foto REGULAR dari database JSON
    let parsedRegSlots: SectionPhotoSlot[] = [];
    if (existing?.photosRegularJson) {
      try {
        const arr = JSON.parse(existing.photosRegularJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedRegSlots = arr.map((item: any, idx: number) => ({
            id: `init-reg-${idx}-${Date.now()}`,
            section: item.section || 'Foto Full Vendor',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {}
    }
    if (parsedRegSlots.length === 0 && (existing?.photoInRegularUrl || existing?.photoInUrl)) {
      parsedRegSlots = [{
        id: `init-reg-0-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: existing.photoInRegularUrl || existing.photoInUrl,
        existingUrl: existing.photoInRegularUrl || existing.photoInUrl,
      }];
    }
    if (parsedRegSlots.length === 0 && initReg > 0) {
      parsedRegSlots = [{
        id: `init-reg-empty-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: null,
      }];
    }
    setRegularPhotoSlots(parsedRegSlots);

    // Inisialisasi slot foto ADDITIONAL dari database JSON
    let parsedAddSlots: SectionPhotoSlot[] = [];
    if (existing?.photosAdditionalJson) {
      try {
        const arr = JSON.parse(existing.photosAdditionalJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedAddSlots = arr.map((item: any, idx: number) => ({
            id: `init-add-${idx}-${Date.now()}`,
            section: item.section || 'Foto Full Vendor',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {}
    }
    if (parsedAddSlots.length === 0 && existing?.photoInAdditionalUrl) {
      parsedAddSlots = [{
        id: `init-add-0-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: existing.photoInAdditionalUrl,
        existingUrl: existing.photoInAdditionalUrl,
      }];
    }
    if (parsedAddSlots.length === 0 && initAdd > 0) {
      parsedAddSlots = [{
        id: `init-add-empty-${Date.now()}`,
        section: 'Foto Full Vendor',
        file: null,
        preview: null,
      }];
    }
    setAdditionalPhotoSlots(parsedAddSlots);

    setIsModalOpen(true);
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan) return;

    const totalHeadcount = actualRegular + actualAdditional;
    if (totalHeadcount <= 0) {
      alert('Total orang masuk harus minimal 1 orang.');
      return;
    }

    const hasRegularPhoto = regularPhotoSlots.some((slot) => !!slot.file || !!slot.existingUrl);
    const hasAdditionalPhoto = additionalPhotoSlots.some((slot) => !!slot.file || !!slot.existingUrl);

    if (!hasRegularPhoto && !hasAdditionalPhoto) {
      alert('Wajib melampirkan minimal 1 foto bukti fisik kehadiran kontingen vendor!');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('plotinganId', selectedPlotingan.id);
      formData.append('actualRegular', actualRegular.toString());
      formData.append('actualAdditional', actualAdditional.toString());
      if (notes.trim()) formData.append('notes', notes.trim());

      const validRegSlots = regularPhotoSlots.filter((slot) => !!slot.file || !!slot.existingUrl);
      formData.append('photoInRegular_count', validRegSlots.length.toString());
      validRegSlots.forEach((slot, index) => {
        formData.append(`photoInRegular_section_${index}`, slot.section);
        if (slot.file) {
          formData.append(`photoInRegular_file_${index}`, slot.file);
        } else if (slot.existingUrl) {
          formData.append(`photoInRegular_existing_${index}`, slot.existingUrl);
        }
      });

      const validAddSlots = additionalPhotoSlots.filter((slot) => !!slot.file || !!slot.existingUrl);
      formData.append('photoInAdditional_count', validAddSlots.length.toString());
      validAddSlots.forEach((slot, index) => {
        formData.append(`photoInAdditional_section_${index}`, slot.section);
        if (slot.file) {
          formData.append(`photoInAdditional_file_${index}`, slot.file);
        } else if (slot.existingUrl) {
          formData.append(`photoInAdditional_existing_${index}`, slot.existingUrl);
        }
      });

      const res = await submitAbsenMasuk(formData);
      if (res.success) {
        setIsModalOpen(false);
        onRefresh();
      } else {
        alert(res.error || 'Gagal menyimpan absensi serah terima vendor.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan saat simpan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. EVENT HANDLER MODAL UNDER LAPANGAN (SUB-TAB 2)
  // --------------------------------------------------------------------------
  const activeVendors = Array.from(
    new Map(plotingans.map((p) => [p.vendor.id, { id: p.vendor.id, name: p.vendor.name }])).values()
  );

  const handleOpenAddUnder = (defaultDiv?: string) => {
    setEditingUnder(null);
    const initialShiftId = (underShiftFilter !== 'ALL' ? underShiftFilter : availableShifts[0]?.id) || '';
    setModalShiftId(initialShiftId);
    setModalDivision(defaultDiv || 'BONGKARAN');
    setModalUnderName('');
    setModalRegularCount(0);
    setModalAdditionalCount(0);
    setModalPhotoFile(null);
    setModalPhotoPreview(null);
    setModalNotes('');
    setModalVendorBreakdown([]);
    setIsUnderModalOpen(true);
  };

  const handleOpenEditUnder = (u: any) => {
    setEditingUnder(u);
    setModalShiftId(u.shiftId);
    setModalDivision(u.division);
    setModalUnderName(u.underName);
    setModalRegularCount(u.regularCount || 0);
    setModalAdditionalCount(u.additionalCount || 0);
    setModalPhotoFile(null);
    setModalPhotoPreview(u.photoUrl || null);
    setModalNotes(u.notes || '');

    let breakdown: any[] = [];
    if (u.vendorBreakdownJson) {
      try {
        breakdown = JSON.parse(u.vendorBreakdownJson);
      } catch (e) {}
    }
    setModalVendorBreakdown(Array.isArray(breakdown) ? breakdown : []);
    setIsUnderModalOpen(true);
  };

  const handleAddVendorBreakdown = () => {
    const defaultVendor = activeVendors[0] || { id: 'generic', name: 'Vendor Lapangan' };
    setModalVendorBreakdown((prev) => [
      ...prev,
      { vendorId: defaultVendor.id, vendorName: defaultVendor.name, regular: 0, additional: 0 }
    ]);
  };

  const handleRemoveVendorBreakdown = (index: number) => {
    setModalVendorBreakdown((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateVendorBreakdown = (index: number, field: string, value: any) => {
    setModalVendorBreakdown((prev) => {
      const updated = [...prev];
      if (field === 'vendorId') {
        const found = activeVendors.find((v) => v.id === value);
        updated[index] = { ...updated[index], vendorId: value, vendorName: found ? found.name : value };
      } else {
        updated[index] = { ...updated[index], [field]: parseInt(value, 10) || 0 };
      }
      return updated;
    });
  };

  const handleApplyBreakdownTotals = () => {
    const totalReg = modalVendorBreakdown.reduce((sum, item) => sum + (item.regular || 0), 0);
    const totalAdd = modalVendorBreakdown.reduce((sum, item) => sum + (item.additional || 0), 0);
    setModalRegularCount(totalReg);
    setModalAdditionalCount(totalAdd);
  };

  const handleModalPhotoChange = async (file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    setModalPhotoFile(compressed);
    setModalPhotoPreview(URL.createObjectURL(compressed));
  };

  const handleSaveUnder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalShiftId || !modalDivision || !modalUnderName.trim()) {
      alert('Harap lengkapi Shift, Divisi, dan Nama Under.');
      return;
    }
    const total = modalRegularCount + modalAdditionalCount;
    if (total <= 0) {
      alert('Jumlah anak yang dipegang Under minimal 1 orang (Regular atau Additional).');
      return;
    }

    if (!modalPhotoFile && !editingUnder?.photoUrl) {
      alert('Foto bukti apel regu bersama Under WAJIB dilampirkan!');
      return;
    }

    try {
      setIsSubmittingUnder(true);
      const fd = new FormData();
      if (editingUnder?.id) {
        fd.append('id', editingUnder.id);
      }
      fd.append('date', selectedDate);
      fd.append('shiftId', modalShiftId);
      fd.append('division', modalDivision);
      fd.append('underName', modalUnderName.trim());
      fd.append('regularCount', modalRegularCount.toString());
      fd.append('additionalCount', modalAdditionalCount.toString());
      if (modalNotes.trim()) fd.append('notes', modalNotes.trim());

      if (modalVendorBreakdown.length > 0) {
        fd.append('vendorBreakdownJson', JSON.stringify(modalVendorBreakdown));
      }

      if (modalPhotoFile) {
        fd.append('photo', modalPhotoFile);
      } else if (editingUnder?.photoUrl) {
        fd.append('existingPhotoUrl', editingUnder.photoUrl);
      }

      const res = await saveUnderAssignment(fd);
      if (res.success) {
        await loadUnderAssignments();
        setIsUnderModalOpen(false);
        onRefresh();
      } else {
        alert('Gagal: ' + (res.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menyimpan under: ' + err.message);
    } finally {
      setIsSubmittingUnder(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8.B EVENT HANDLER MODAL SUSULAN / TELAT VENDOR
  // --------------------------------------------------------------------------
  const handleOpenLateModal = (plot: any) => {
    setSelectedLatePlotingan(plot);
    setLateRegular(0);
    setLateAdditional(0);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setLateTime(`${hh}:${mm}`);
    setLateNotes('');
    setLatePhotoFile(null);
    setLatePhotoPreview(null);
    setIsLateModalOpen(true);
  };

  const handleLatePhotoChange = async (file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    setLatePhotoFile(compressed);
    setLatePhotoPreview(URL.createObjectURL(compressed));
  };

  const handleSaveLate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLatePlotingan) return;
    const totalLate = lateRegular + lateAdditional;
    if (totalLate <= 0) {
      alert('Jumlah pekerja susulan minimal 1 orang (Regular atau Additional).');
      return;
    }
    try {
      setIsSubmittingLate(true);
      const fd = new FormData();
      fd.append('plotinganId', selectedLatePlotingan.id);
      fd.append('regular', lateRegular.toString());
      fd.append('additional', lateAdditional.toString());
      fd.append('time', lateTime);
      if (lateNotes.trim()) fd.append('notes', lateNotes.trim());
      if (latePhotoFile) fd.append('photo', latePhotoFile);

      const res = await submitLateArrival(fd);
      if (res.success) {
        setIsLateModalOpen(false);
        onRefresh();
      } else {
        alert('Gagal: ' + (res.error || 'Terjadi kesalahan saat simpan susulan.'));
      }
    } catch (err: any) {
      alert('Gagal menyimpan susulan: ' + err.message);
    } finally {
      setIsSubmittingLate(false);
    }
  };

  const handleDeleteUnder = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data regu ${name}?`)) return;
    try {
      const res = await deleteUnderAssignment(id);
      if (res.success) {
        await loadUnderAssignments();
        onRefresh();
      } else {
        alert('Gagal menghapus: ' + (res.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // --------------------------------------------------------------------------
  // 9. KALKULASI REKONSILIASI (VENDOR IN VS UNDER IN)
  // --------------------------------------------------------------------------
  const filteredPlotingans = underShiftFilter === 'ALL'
    ? plotingans
    : plotingans.filter((p) => p.shiftId === underShiftFilter);

  const totalVendorReg = filteredPlotingans.reduce((sum, p) => sum + (p.attendanceIn?.actualRegular ?? 0), 0);
  const totalVendorAdd = filteredPlotingans.reduce((sum, p) => sum + (p.attendanceIn?.actualAdditional ?? 0), 0);
  const totalVendorTotal = totalVendorReg + totalVendorAdd;

  const filteredUnder = underShiftFilter === 'ALL'
    ? underAssignments
    : underAssignments.filter((u) => u.shiftId === underShiftFilter);

  const totalUnderReg = filteredUnder.reduce((sum, u) => sum + (u.regularCount || 0), 0);
  const totalUnderAdd = filteredUnder.reduce((sum, u) => sum + (u.additionalCount || 0), 0);
  const totalUnderTotal = totalUnderReg + totalUnderAdd;

  const selisihTotal = totalVendorTotal - totalUnderTotal;
  const selisihReg = totalVendorReg - totalUnderReg;
  const selisihAdd = totalVendorAdd - totalUnderAdd;
  const isBalanced = totalVendorTotal > 0 && selisihTotal === 0;

  // Validasi modal vendor
  const totalHeadcountInput = actualRegular + actualAdditional;
  const hasRegPhoto = regularPhotoSlots.some((s) => !!s.file || !!s.existingUrl);
  const hasAddPhoto = additionalPhotoSlots.some((s) => !!s.file || !!s.existingUrl);
  const canSubmitVendor = totalHeadcountInput > 0 && (hasRegPhoto || hasAddPhoto);

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER ALUR KERJA (DESKTOP) */}
      <div className="hidden md:block bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-800 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-100 font-medium">Tanggal: {selectedDate}</span>
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight mt-1">
              Absen Masuk & Distribusi Pos PIC Lapangan
            </h1>
            <p className="hidden md:block text-xs text-blue-100/90 mt-0.5 max-w-2xl leading-relaxed">
              Merekam kehadiran fisik serah terima pasukan dari vendor, kemudian mendistribusikannya ke 5 divisi kerja 
              (Bongkar, Muat, Sortir 3 Jalur, FIFO, Repack) yang dipegang langsung oleh Under Lapangan.
            </p>
          </div>

          {/* Sub-Tab Pill Switcher Desktop */}
          <div className="flex items-center bg-black/25 p-1 rounded-xl border border-white/20 self-start md:self-auto shrink-0">
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
              <span>1. Serah Terima In Vendor</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                {totalVendorTotal} MP
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
              <span>2. Distribusi In PIC Lapangan</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                {totalUnderTotal} MP
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. HEADER ALUR KERJA (MOBILE: ROUNDED-3XL + PILL SWITCHER) */}
      <div className="md:hidden bg-white rounded-3xl p-3 border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Gateway Kehadiran</span>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Absen Masuk Shift</h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            {availableShifts.find(s => s.id === underShiftFilter)?.name || 'Shift Aktif'}
          </span>
        </div>

        {/* Switcher Pill Bulat Penuh */}
        <div className="bg-slate-100 p-1 rounded-full flex items-center text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setActiveSubTab('VENDOR')}
            className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'VENDOR'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>1. Vendor</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeSubTab === 'VENDOR' ? 'bg-blue-100 text-blue-800' : 'text-slate-400'
            }`}>
              {totalVendorTotal} MP
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('UNDER')}
            className={`flex-1 py-1.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'UNDER'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Under Pos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeSubTab === 'UNDER' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'
            }`}>
              {totalUnderTotal} MP
            </span>
          </button>
        </div>
      </div>

      {/* 2. BANNER REKONSILIASI (DESKTOP) */}
      <div className={`hidden md:block rounded-2xl border p-4 shadow-xs transition-all ${
        isBalanced
          ? 'bg-emerald-50/70 border-emerald-300'
          : selisihTotal > 0
          ? 'bg-amber-50/80 border-amber-300'
          : totalVendorTotal === 0 && totalUnderTotal === 0
          ? 'bg-slate-50 border-slate-200'
          : 'bg-rose-50/80 border-rose-300'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Sisi Kiri: Rincian Angka Serah Terima vs Under */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isBalanced
                ? 'bg-emerald-600 text-white'
                : selisihTotal > 0
                ? 'bg-amber-600 text-white'
                : totalVendorTotal === 0 && totalUnderTotal === 0
                ? 'bg-slate-300 text-slate-700'
                : 'bg-rose-600 text-white'
            }`}>
              {isBalanced ? (
                <ShieldCheck className="w-5 h-5" />
              ) : selisihTotal > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : totalVendorTotal === 0 && totalUnderTotal === 0 ? (
                <Clock className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Audit Rekonsiliasi Distribusi Pasukan
                </span>
                {underShiftFilter !== 'ALL' && (
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border text-slate-600">
                    Filter: {availableShifts.find(s => s.id === underShiftFilter)?.name || underShiftFilter}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1 text-slate-700">
                <span>
                  🏢 Diserahkan Vendor: <strong className="font-extrabold text-blue-700">{totalVendorTotal} MP</strong> 
                  {' '}({totalVendorReg} Reg + {totalVendorAdd} Add)
                </span>
                <span className="text-slate-300 hidden sm:inline">&bull;</span>
                <span>
                  📍 Diterima Under: <strong className="font-extrabold text-indigo-700">{totalUnderTotal} MP</strong> 
                  {' '}({totalUnderReg} Reg + {totalUnderAdd} Add)
                </span>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Status Keseimbangan (Klop / Selisih) */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {totalVendorTotal === 0 && totalUnderTotal === 0 ? (
              <span className="px-3 py-1.5 rounded-xl bg-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                Menunggu Serah Terima Masuk
              </span>
            ) : isBalanced ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                KLOP & TUNTAS (100% Pasukan Terdistribusi)
              </span>
            ) : selisihTotal > 0 ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-100" />
                Belum Lengkap: Sisa {selisihTotal} Anak ({selisihReg} Reg, {selisihAdd} Add) Belum Ada Under!
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-100" />
                Kelebihan Input: +{Math.abs(selisihTotal)} Anak di Data Under dibanding Vendor!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. BANNER REKONSILIASI (MOBILE: SLIM CHIP) */}
      <div className={`md:hidden rounded-2xl border p-2.5 flex items-center justify-between text-xs transition-all ${
        isBalanced
          ? 'bg-emerald-50/70 border-emerald-200'
          : selisihTotal > 0
          ? 'bg-amber-50/80 border-amber-200'
          : totalVendorTotal === 0 && totalUnderTotal === 0
          ? 'bg-slate-50 border-slate-200'
          : 'bg-rose-50/80 border-rose-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            isBalanced ? 'bg-emerald-100 text-emerald-600' :
            selisihTotal > 0 ? 'bg-amber-100 text-amber-600' :
            totalVendorTotal === 0 && totalUnderTotal === 0 ? 'bg-slate-200 text-slate-600' :
            'bg-rose-100 text-rose-600'
          }`}>
            {isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold text-slate-900 block leading-none truncate">Audit Serah Terima</span>
            <span className="text-[9px] text-slate-500 truncate block mt-0.5">Vendor: {totalVendorTotal} MP &bull; Under: {totalUnderTotal} MP</span>
          </div>
        </div>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border shadow-2xs shrink-0 ${
          isBalanced ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
          selisihTotal > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' :
          totalVendorTotal === 0 && totalUnderTotal === 0 ? 'bg-white text-slate-600 border-slate-200' :
          'bg-rose-100 text-rose-800 border-rose-200'
        }`}>
          {totalVendorTotal === 0 && totalUnderTotal === 0 ? 'Menunggu' : isBalanced ? '✓ KLOP' : `${selisihTotal} Selisih`}
        </span>
      </div>

      {/* ==================================================================== */}
      {/* KONTEN SUB-TAB 1: SERAH TERIMA PASUKAN VENDOR                        */}
      {/* ==================================================================== */}
      {activeSubTab === 'VENDOR' && (
        <div className="space-y-4">
          {/* Petunjuk Operasional Vendor (Disembunyikan di HP agar tidak sesak) */}
          <div className="hidden md:flex bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Camera className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Ketentuan Serah Terima Vendor:</strong> Vendor membawa anak-anak naik ke lapangan, mengambil foto full bawaan masing-masing, 
                dan mencatat kuota hadir Regular & Additional. Foto dapat diunggah full kontingen tanpa wajib memecah per bagian.
              </span>
            </div>
            <button
              onClick={() => setActiveSubTab('UNDER')}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              Lanjut ke Distribusi Under <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Daftar Kartu Plotingan Vendor */}
          {plotingans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-700">Belum Ada Plotingan untuk Absen Masuk</p>
              <p className="text-xs text-slate-400 mt-1">
                Silakan atur kuota target plotingan terlebih dahulu pada Tab 1 (Plotingan H-1).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plotingans.map((p) => {
                const hasCheckedIn = !!p.attendanceIn;
                const actualTotal = p.attendanceIn?.actualHeadcount || 0;
                const actualReg = p.attendanceIn?.actualRegular ?? 0;
                const actualAdd = p.attendanceIn?.actualAdditional ?? 0;
                const rate = p.targetHeadcount > 0 ? Math.round((actualTotal / p.targetHeadcount) * 100) : 0;

                // Ekstrak foto dari JSON
                let cardRegPhotos: Array<{ section: string; url: string }> = [];
                if (p.attendanceIn?.photosRegularJson) {
                  try {
                    const parsed = JSON.parse(p.attendanceIn.photosRegularJson);
                    if (Array.isArray(parsed)) cardRegPhotos = parsed;
                  } catch (e) {}
                }
                if (cardRegPhotos.length === 0 && p.attendanceIn?.photoInRegularUrl) {
                  cardRegPhotos = [{ section: 'Regular', url: p.attendanceIn.photoInRegularUrl }];
                }

                let cardAddPhotos: Array<{ section: string; url: string }> = [];
                if (p.attendanceIn?.photosAdditionalJson) {
                  try {
                    const parsed = JSON.parse(p.attendanceIn.photosAdditionalJson);
                    if (Array.isArray(parsed)) cardAddPhotos = parsed;
                  } catch (e) {}
                }
                if (cardAddPhotos.length === 0 && p.attendanceIn?.photoInAdditionalUrl) {
                  cardAddPhotos = [{ section: 'Additional', url: p.attendanceIn.photoInAdditionalUrl }];
                }

                const totalPhotosOnCard = cardRegPhotos.length + cardAddPhotos.length;
                const statusBorderClass = hasCheckedIn
                  ? 'border-l-4 border-l-emerald-500'
                  : 'border-l-4 border-l-blue-600';

                return (
                  <React.Fragment key={p.id}>
                    {/* TAMPILAN MOBILE (MD:HIDDEN) - ERGONOMIC THUMB ACTION + LEFT BAR */}
                    <div className={`md:hidden bg-white rounded-3xl p-3 border border-slate-200/90 ${statusBorderClass} shadow-xs flex items-center justify-between gap-2.5 pl-3.5`}>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 leading-tight">
                            {getShortVendorName(p.vendor.name)}
                          </h4>
                          {hasCheckedIn ? (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              ✓ Masuk {actualTotal} MP
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                              Menunggu
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                          <span>{hasCheckedIn ? `Realisasi: ${actualTotal}/${p.targetHeadcount} MP` : `Target: ${p.targetHeadcount} MP`}</span>
                          <span>&bull;</span>
                          <span className={hasCheckedIn ? 'text-slate-400' : 'text-blue-600 font-semibold'}>
                            {hasCheckedIn ? `${actualReg} Reg + ${actualAdd} Add` : `${p.targetRegular || 0} Reg + ${p.targetAdditional || 0} Add`}
                          </span>
                        </div>
                        {totalPhotosOnCard > 0 && (
                          <div className="pt-0.5">
                            <span 
                              onClick={() => {
                                if (cardRegPhotos[0]) setLightboxPhoto({ url: cardRegPhotos[0].url, title: `${getShortVendorName(p.vendor.name)}: ${cardRegPhotos[0].section}` });
                                else if (cardAddPhotos[0]) setLightboxPhoto({ url: cardAddPhotos[0].url, title: `${getShortVendorName(p.vendor.name)}: ${cardAddPhotos[0].section}` });
                              }}
                              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold text-[9px] cursor-pointer"
                            >
                              <Camera className="w-2.5 h-2.5" /> {totalPhotosOnCard} foto
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tombol Aksi Jempol Kanan */}
                      <div className="shrink-0 flex items-center gap-1">
                        {hasCheckedIn ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenVendorModal(p)}
                              className="px-2.5 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenLateModal(p)}
                              className="px-2 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 flex items-center gap-0.5 cursor-pointer transition-all active:scale-95"
                              title="Input Susulan / Telat"
                            >
                              <Plus className="w-3 h-3 text-amber-600" />
                              <span className="text-[10px]">Susulan</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenVendorModal(p)}
                            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 transition-all"
                          >
                            <LogIn className="w-3.5 h-3.5 text-blue-200" />
                            <span>Input</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* TAMPILAN DESKTOP (HIDDEN MD:FLEX) - TETAP UTUH SEPERTI ASLI */}
                    <div
                      className={`hidden md:flex bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md flex-col justify-between ${
                        hasCheckedIn ? 'border-emerald-200' : 'border-slate-200 hover:border-amber-300'
                      }`}
                    >
                    <div>
                      {/* Status Strip Bar */}
                      <div
                        className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
                          hasCheckedIn ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {hasCheckedIn ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Sudah Masuk ({actualTotal} Org)
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Menunggu Masuk
                            </>
                          )}
                        </span>

                        {/* Shift Badge */}
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
                        {/* Info Vendor Singkat & Panjang */}
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              {getShortVendorName(p.vendor.name)}
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {p.vendor.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {p.workingHours ? `Jam Kerja: ${p.workingHours}` : 'Jam Kerja Normal'}
                          </p>
                        </div>

                        {/* Realisasi Kehadiran Reg & Add */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-blue-700 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Pasukan Regular:
                            </span>
                            <span className="font-bold text-slate-800">
                              {hasCheckedIn ? (
                                <strong className="text-blue-700 font-extrabold">{actualReg} Org</strong>
                              ) : (
                                <span className="text-slate-400 italic">Target: {p.targetRegular || 0}</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs border-t border-slate-200/60 pt-1.5">
                            <span className="font-bold text-amber-700 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              Pasukan Additional:
                            </span>
                            <span className="font-bold text-slate-800">
                              {hasCheckedIn ? (
                                <strong className="text-amber-700 font-extrabold">{actualAdd} Org</strong>
                              ) : (
                                <span className="text-slate-400 italic">Target: {p.targetAdditional || 0}</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-1.5 font-extrabold">
                            <span className="text-slate-600 uppercase">Total Hadir / Target:</span>
                            <span className={hasCheckedIn ? 'text-emerald-700 font-black' : 'text-slate-600 font-bold'}>
                              {hasCheckedIn ? `${actualTotal} / ${p.targetHeadcount} MP` : `Target: ${p.targetHeadcount} MP`}
                            </span>
                          </div>
                        </div>

                        {/* Galeri Foto Kontingen Vendor */}
                        {hasCheckedIn && totalPhotosOnCard > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                              Foto Kontingen Vendor ({totalPhotosOnCard}):
                            </span>

                            <div className="grid grid-cols-3 gap-1.5">
                              {cardRegPhotos.map((photo, pIdx) => (
                                <div
                                  key={`card-reg-${pIdx}`}
                                  onClick={() => setLightboxPhoto({ url: photo.url, title: `${getShortVendorName(p.vendor.name)}: ${photo.section}` })}
                                  className="group relative rounded-lg overflow-hidden border border-blue-200 h-16 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                  title="Klik untuk perbesar"
                                >
                                  <img
                                    src={photo.url}
                                    alt="Foto Reg"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <span className="absolute bottom-0 inset-x-0 bg-blue-900/80 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                                    {photo.section}
                                  </span>
                                </div>
                              ))}

                              {cardAddPhotos.map((photo, pIdx) => (
                                <div
                                  key={`card-add-${pIdx}`}
                                  onClick={() => setLightboxPhoto({ url: photo.url, title: `${getShortVendorName(p.vendor.name)} (Add): ${photo.section}` })}
                                  className="group relative rounded-lg overflow-hidden border border-amber-200 h-16 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all"
                                  title="Klik untuk perbesar"
                                >
                                  <img
                                    src={photo.url}
                                    alt="Foto Add"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <span className="absolute bottom-0 inset-x-0 bg-amber-900/80 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                                    {photo.section}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Riwayat Susulan / Telat Vendor Jika Ada */}
                        {hasCheckedIn && p.attendanceIn?.lateArrivalsJson && (() => {
                          let lateList: any[] = [];
                          try {
                            lateList = JSON.parse(p.attendanceIn.lateArrivalsJson);
                          } catch (e) {}
                          if (Array.isArray(lateList) && lateList.length > 0) {
                            const totalLate = lateList.reduce((s: number, l: any) => s + (l.total || (l.regular || 0) + (l.additional || 0)), 0);
                            return (
                              <div className="bg-amber-50/90 rounded-xl p-2.5 border border-amber-200 text-xs">
                                <div className="flex items-center justify-between text-amber-900 font-bold">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    Pekerja Susulan / Telat:
                                  </span>
                                  <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-black text-[10px]">
                                    +{totalLate} MP
                                  </span>
                                </div>
                                <div className="mt-1 space-y-0.5 text-[11px] text-amber-800 divide-y divide-amber-100">
                                  {lateList.map((l: any, lIdx: number) => (
                                    <div key={lIdx} className="flex items-center justify-between pt-1">
                                      <span>Jam {l.time} &bull; +{l.regular || 0} Reg, +{l.additional || 0} Add</span>
                                      {l.notes && <span className="italic text-[10px] text-amber-700">"{l.notes}"</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      </div>
                    </div>

                    {/* Tombol Input/Edit Absen Masuk & Input Susulan */}
                    <div className="p-4 pt-0 space-y-2">
                      {hasCheckedIn ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenVendorModal(p)}
                            className="flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit Absen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenLateModal(p)}
                            className="flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-600" />
                            + Susulan / Telat
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenVendorModal(p)}
                          className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Input Absen Masuk (Wajib Foto)
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* KONTEN SUB-TAB 2: DISTRIBUSI POS & UNDER LAPANGAN J&T (5 DIVISI)    */}
      {/* ==================================================================== */}
      {activeSubTab === 'UNDER' && (
        <div className="space-y-6">
          
          {/* Toolbar Kontrol Desktop */}
          <div className="hidden md:flex bg-white rounded-2xl border border-slate-200 p-4 items-center justify-between gap-4 shadow-xs">
            
            {/* Filter Shift Kerja */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-600 shrink-0">Pilih Shift:</span>
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
                    {s.name.toLowerCase().includes('pagi') ? (
                      <Sun className="w-3 h-3 text-amber-500" />
                    ) : (
                      <Moon className="w-3 h-3 text-indigo-500" />
                    )}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tombol Tambah Regu / Under Baru */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => loadUnderAssignments()}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                title="Refresh data Under"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUnder ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddUnder('BONGKARAN')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                + Tambah Regu Under Lapangan
              </button>
            </div>
          </div>

          {/* Toolbar Khusus Mobile: Filter Shift & Tombol Tambah Under Cepat */}
          <div className="md:hidden bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2">
            <div className="flex-1 bg-slate-100 p-1 rounded-full flex text-[10px] font-extrabold text-center">
              <button
                type="button"
                onClick={() => setUnderShiftFilter('ALL')}
                className={`flex-1 py-1 rounded-full transition-all cursor-pointer ${
                  underShiftFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              {availableShifts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setUnderShiftFilter(s.id)}
                  className={`flex-1 py-1 rounded-full transition-all cursor-pointer ${
                    underShiftFilter === s.id
                      ? 'bg-white text-slate-900 shadow-xs font-black'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {s.name.toLowerCase().includes('pagi') ? 'Pagi' : 'Malam'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleOpenAddUnder(mobileUnderDivFilter === 'ALL' || mobileUnderDivFilter === 'SORTIR' ? 'BONGKARAN' : mobileUnderDivFilter)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Under</span>
            </button>
          </div>

          {/* BAR PILIHAN DIVISI RAMPING KHUSUS HP (MENGGANTIKAN 5 KOTAK RAKSASA!) */}
          <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setMobileUnderDivFilter('ALL')}
              className={`px-3 py-1.5 rounded-full font-bold text-[10px] shrink-0 transition-all cursor-pointer ${
                mobileUnderDivFilter === 'ALL'
                  ? 'bg-slate-900 text-white font-black shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Semua Pos ({filteredUnder.length})
            </button>
            {[
              { key: 'BONGKARAN', label: 'Bongkaran' },
              { key: 'MUATAN', label: 'Muatan' },
              { key: 'SORTIR', label: 'Sortir' },
              { key: 'FIFO', label: 'FIFO' },
              { key: 'REPACK', label: 'Repack' },
            ].map((div) => {
              const count = div.key === 'SORTIR'
                ? filteredUnder.filter((u) => u.division.startsWith('SORTIR')).length
                : filteredUnder.filter((u) => u.division === div.key).length;
              const isSelected = mobileUnderDivFilter === div.key;
              return (
                <button
                  key={div.key}
                  type="button"
                  onClick={() => setMobileUnderDivFilter(div.key)}
                  className={`px-2.5 py-1.5 rounded-full font-bold text-[10px] shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white font-black shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {div.label} ({count})
                </button>
              );
            })}
          </div>

          {/* DAFTAR KARTU UNDER ERGONOMIS KHUSUS HP (BORDER-L-4 + THUMB ACTION) */}
          <div className="md:hidden space-y-2">
            {(() => {
              const displayUnder = mobileUnderDivFilter === 'ALL'
                ? filteredUnder
                : mobileUnderDivFilter === 'SORTIR'
                ? filteredUnder.filter((u) => u.division.startsWith('SORTIR'))
                : filteredUnder.filter((u) => u.division === mobileUnderDivFilter);

              if (displayUnder.length === 0) {
                return (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center">
                    <p className="text-xs text-slate-400 font-semibold">
                      Belum ada regu Under {mobileUnderDivFilter !== 'ALL' ? `di Pos ${mobileUnderDivFilter}` : 'pada shift ini'}.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenAddUnder(mobileUnderDivFilter === 'ALL' || mobileUnderDivFilter === 'SORTIR' ? 'BONGKARAN' : mobileUnderDivFilter)}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Tambah Under Sekarang
                    </button>
                  </div>
                );
              }

              return displayUnder.map((u) => {
                let col = {
                  border: 'border-l-blue-600',
                  badgeBg: 'bg-blue-50',
                  badgeText: 'text-blue-700',
                  label: 'Bongkaran',
                };

                if (u.division.startsWith('SORTIR')) {
                  let sub = 'Sortir';
                  if (u.division === 'SORTIR_BODEBEK') sub = 'Sortir Bodebek';
                  else if (u.division === 'SORTIR_SUMATRAAN') sub = 'Sortir Sumatraan';
                  else if (u.division === 'SORTIR_JAKARTA') sub = 'Sortir Jakarta';
                  col = {
                    border: 'border-l-indigo-600',
                    badgeBg: 'bg-indigo-50',
                    badgeText: 'text-indigo-700',
                    label: sub,
                  };
                } else if (u.division === 'MUATAN') {
                  col = {
                    border: 'border-l-amber-500',
                    badgeBg: 'bg-amber-50',
                    badgeText: 'text-amber-700',
                    label: 'Muatan',
                  };
                } else if (u.division === 'FIFO') {
                  col = {
                    border: 'border-l-emerald-500',
                    badgeBg: 'bg-emerald-50',
                    badgeText: 'text-emerald-700',
                    label: 'FIFO',
                  };
                } else if (u.division === 'REPACK') {
                  col = {
                    border: 'border-l-rose-500',
                    badgeBg: 'bg-rose-50',
                    badgeText: 'text-rose-700',
                    label: 'Repack',
                  };
                }

                return (
                  <div
                    key={`mobile-under-${u.id}`}
                    className={`bg-white rounded-3xl p-3 border border-slate-200/90 shadow-xs flex items-center justify-between gap-2.5 pl-3.5 border-l-4 ${col.border}`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${col.badgeBg} ${col.badgeText} border-slate-200/60`}>
                          {col.label}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 leading-tight truncate">
                          {u.underName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="font-extrabold text-slate-800">{u.totalHeadcount} MP</span>
                        <span>&bull;</span>
                        <span>{u.regularCount} Reg + {u.additionalCount} Add</span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded">
                          Shift {u.shift?.name || 'Pagi'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        {u.photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto({ url: u.photoUrl, title: `Regu: ${u.underName} (${u.division})` })}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            <Camera className="w-3 h-3 text-slate-500" />
                            <span>Foto Apel</span>
                          </button>
                        ) : null}
                        {u.notes && (
                          <span className="text-[9px] text-slate-400 italic truncate max-w-[130px]">
                            "{u.notes}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tombol Aksi Jempol Kanan */}
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditUnder(u)}
                        className="px-2.5 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="Edit Under"
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnder(u.id, u.underName)}
                        className="p-2 rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 active:scale-95 transition-all cursor-pointer"
                        title="Hapus Under"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* RENDERING 5 DIVISI OPERASIONAL GUDANG (KHUSUS LAPTOP / DESKTOP: TETAP UTUH SEPERTI ASLI) */}
          <div className="hidden md:block space-y-6">

            {/* DIVISI 1: BONGKARAN */}
            {(() => {
              const divKey = 'BONGKARAN';
              const def = DIVISION_DEFINITIONS.find(d => d.key === divKey)!;
              const items = filteredUnder.filter(u => u.division === divKey);
              const totalOrg = items.reduce((s, u) => s + u.totalHeadcount, 0);
              const totalReg = items.reduce((s, u) => s + u.regularCount, 0);
              const totalAdd = items.reduce((s, u) => s + u.additionalCount, 0);

              return (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Header Divisi */}
                  <div className="px-5 py-3.5 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-600 text-white">
                        <Box className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900">1. Divisi Bongkaran</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {totalOrg} Orang ({items.length} Under)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Bongkar kontainer / armada masuk ({totalReg} Reg + {totalAdd} Add)</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddUnder('BONGKARAN')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Under Bongkar
                    </button>
                  </div>

                  {/* Isi Regu Under di Bongkaran */}
                  <div className="p-5">
                    {items.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-semibold">Belum ada regu Under di Divisi Bongkaran.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('BONGKARAN')}
                          className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Under Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map((u) => renderUnderCard(u))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* DIVISI 2: MUATAN (1 UNDER MEGANG 3-4 ANAK) */}
            {(() => {
              const divKey = 'MUATAN';
              const def = DIVISION_DEFINITIONS.find(d => d.key === divKey)!;
              const items = filteredUnder.filter(u => u.division === divKey);
              const totalOrg = items.reduce((s, u) => s + u.totalHeadcount, 0);
              const totalReg = items.reduce((s, u) => s + u.regularCount, 0);
              const totalAdd = items.reduce((s, u) => s + u.additionalCount, 0);

              return (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-600 text-white">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900">2. Divisi Muatan</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {totalOrg} Orang ({items.length} Under)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pemuatan ke armada keluar (1 Under megang 3-4 anak: {totalReg} Reg + {totalAdd} Add)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddUnder('MUATAN')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Under Muatan
                    </button>
                  </div>

                  <div className="p-5">
                    {items.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-semibold">Belum ada regu Under di Divisi Muatan.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('MUATAN')}
                          className="mt-2 text-xs font-bold text-amber-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Under Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map((u) => renderUnderCard(u))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* DIVISI 3: SORTIR (TERBAGI DALAM 3 JALUR: BODEBEK, SUMATRAAN, JAKARTA) */}
            {(() => {
              const sortirKeys = ['SORTIR_BODEBEK', 'SORTIR_SUMATRAAN', 'SORTIR_JAKARTA'];
              const allSortirItems = filteredUnder.filter(u => sortirKeys.includes(u.division));
              const totalOrgSortir = allSortirItems.reduce((s, u) => s + u.totalHeadcount, 0);

              const bodebekItems = filteredUnder.filter(u => u.division === 'SORTIR_BODEBEK');
              const sumatraanItems = filteredUnder.filter(u => u.division === 'SORTIR_SUMATRAAN');
              const jakartaItems = filteredUnder.filter(u => u.division === 'SORTIR_JAKARTA');

              return (
                <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden shadow-xs">
                  {/* Header Utama Divisi Sortir */}
                  <div className="px-5 py-3.5 bg-indigo-50/80 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-600 text-white">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900">3. Divisi Sortir (3 Jalur Operasional)</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            Total {totalOrgSortir} Orang ({allSortirItems.length} Under)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Jalur Bodebek (Bogor/Depok/Bekasi), Jalur Sumatraan, & Jalur DKI Jakarta
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenAddUnder('SORTIR_BODEBEK')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Under Sortir
                      </button>
                    </div>
                  </div>

                  {/* 3 Sub-Jalur Sortir */}
                  <div className="p-5 space-y-5">
                    
                    {/* 3.A Jalur Bodebek */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                          <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                            JALUR 1: SORTIR BODEBEK (A)
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            {bodebekItems.reduce((s, u) => s + u.totalHeadcount, 0)} Orang
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('SORTIR_BODEBEK')}
                          className="text-[11px] font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Tambah Regu Bodebek (A)
                        </button>
                      </div>

                      {bodebekItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">Belum ada regu Under di Jalur Bodebek (A).</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {bodebekItems.map((u) => renderUnderCard(u))}
                        </div>
                      )}
                    </div>

                    {/* 3.B Jalur Sumatraan */}
                    <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                          <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider">
                            JALUR 2: SORTIR SUMATRAAN (B)
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            {sumatraanItems.reduce((s, u) => s + u.totalHeadcount, 0)} Orang
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('SORTIR_SUMATRAAN')}
                          className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Tambah Regu Sumatraan (B)
                        </button>
                      </div>

                      {sumatraanItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">Belum ada regu Under di Jalur Sumatraan (B).</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {sumatraanItems.map((u) => renderUnderCard(u))}
                        </div>
                      )}
                    </div>

                    {/* 3.C Jalur Jakarta */}
                    <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                          <h3 className="text-xs font-black text-teal-950 uppercase tracking-wider">
                            JALUR 3: SORTIR JAKARTA (C)
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                            {jakartaItems.reduce((s, u) => s + u.totalHeadcount, 0)} Orang
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('SORTIR_JAKARTA')}
                          className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Tambah Regu Jakarta
                        </button>
                      </div>

                      {jakartaItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">Belum ada regu Under di Jalur Jakarta.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {jakartaItems.map((u) => renderUnderCard(u))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* DIVISI 4: FIFO */}
            {(() => {
              const divKey = 'FIFO';
              const def = DIVISION_DEFINITIONS.find(d => d.key === divKey)!;
              const items = filteredUnder.filter(u => u.division === divKey);
              const totalOrg = items.reduce((s, u) => s + u.totalHeadcount, 0);
              const totalReg = items.reduce((s, u) => s + u.regularCount, 0);
              const totalAdd = items.reduce((s, u) => s + u.additionalCount, 0);

              return (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900">4. Divisi FIFO</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {totalOrg} Orang ({items.length} Under)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          First-In First-Out staging & arus alur paket ({totalReg} Reg + {totalAdd} Add)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddUnder('FIFO')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Under FIFO
                    </button>
                  </div>

                  <div className="p-5">
                    {items.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-semibold">Belum ada regu Under di Divisi FIFO.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('FIFO')}
                          className="mt-2 text-xs font-bold text-emerald-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Under Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map((u) => renderUnderCard(u))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* DIVISI 5: REPACK */}
            {(() => {
              const divKey = 'REPACK';
              const def = DIVISION_DEFINITIONS.find(d => d.key === divKey)!;
              const items = filteredUnder.filter(u => u.division === divKey);
              const totalOrg = items.reduce((s, u) => s + u.totalHeadcount, 0);
              const totalReg = items.reduce((s, u) => s + u.regularCount, 0);
              const totalAdd = items.reduce((s, u) => s + u.additionalCount, 0);

              return (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-rose-50/70 border-b border-rose-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-600 text-white">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-black text-slate-900">5. Divisi Repack</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            {totalOrg} Orang ({items.length} Under)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pengemasan ulang paket & sortir rapel ({totalReg} Reg + {totalAdd} Add)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddUnder('REPACK')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Under Repack
                    </button>
                  </div>

                  <div className="p-5">
                    {items.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-semibold">Belum ada regu Under di Divisi Repack.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddUnder('REPACK')}
                          className="mt-2 text-xs font-bold text-rose-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Under Sekarang
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {items.map((u) => renderUnderCard(u))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MODAL INPUT / EDIT ABSEN MASUK VENDOR                             */}
      {/* ==================================================================== */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            
            {/* Header Modal Vendor */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  Serah Terima Kontingen Vendor
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {getShortVendorName(selectedPlotingan.vendor.name)} ({selectedPlotingan.vendor.name}) &bull; Shift {selectedPlotingan.shift.name} ({selectedDate})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVendorSubmit} className="space-y-5 mt-4">
              
              {/* Box Realisasi Kehadiran Masuk */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Realisasi Orang Hadir Masuk
                  </span>
                  <span className="text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Target Kuota: {selectedPlotingan.targetHeadcount} Org
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Hadir Regular */}
                  <div className="bg-white rounded-xl p-3 border border-blue-200 shadow-2xs">
                    <label className="block text-xs font-bold text-blue-800 mb-1">
                      Hadir Regular (Org):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={actualRegular === 0 ? '' : actualRegular}
                      onChange={(e) => setActualRegular(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-lg font-black text-slate-900 bg-blue-50/50 border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-[10px] text-blue-600 block mt-1 font-medium">
                      Target Reg: {selectedPlotingan.targetRegular || 0}
                    </span>
                  </div>

                  {/* Hadir Additional */}
                  <div className="bg-white rounded-xl p-3 border border-amber-200 shadow-2xs">
                    <label className="block text-xs font-bold text-amber-800 mb-1">
                      Hadir Additional (Org):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={actualAdditional === 0 ? '' : actualAdditional}
                      onChange={(e) => setActualAdditional(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-lg font-black text-slate-900 bg-amber-50/50 border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-amber-600 block mt-1 font-medium">
                      Target Add: {selectedPlotingan.targetAdditional || 0}
                    </span>
                  </div>
                </div>

                {/* Total Hadir Bar */}
                <div className="flex items-center justify-between text-xs pt-1 px-1 font-bold">
                  <span className="text-slate-600">Total Masuk Fisik:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {totalHeadcountInput} Orang
                  </span>
                </div>
              </div>

              {/* Upload Foto Kontingen Vendor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-blue-600" />
                      Foto Bukti Kontingen Vendor
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Vendor dapat mengunggah 1 foto kontingen full bersama, atau foto per barisan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRegularSlot}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center gap-1 border border-blue-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Tambah Foto
                  </button>
                </div>

                {/* Slot Foto Regular */}
                <div className="space-y-3">
                  {regularPhotoSlots.map((slot, index) => (
                    <div key={slot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Foto #{index + 1} ({slot.section})
                        </span>
                        {regularPhotoSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRegularSlot(slot.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Preview & File Input */}
                      <div className="flex items-center gap-3 pt-1">
                        {slot.preview ? (
                          <div
                            onClick={() => setLightboxPhoto({ url: slot.preview!, title: `Pratinjau Foto: ${slot.section}` })}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-blue-300 shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 relative group"
                          >
                            <img src={slot.preview} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ZoomIn className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                            <Camera className="w-3.5 h-3.5 text-blue-600" />
                            {slot.preview ? 'Ganti Foto' : 'Ambil / Pilih Foto'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handleRegularFileChange(slot.id, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                          <span className="block text-[10px] text-slate-400 mt-1">
                            Foto akan dikompres otomatis agar hemat kuota server
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catatan Masuk */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Masuk Vendor (Opsional):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Hadir lengkap tepat jam 07:00, siap diarahkan ke pos masing-masing..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>

              {/* Validasi Foto Alert */}
              {!canSubmitVendor && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Wajib mengisi jumlah orang hadir dan melampirkan minimal 1 foto bukti fisik kontingen vendor!</span>
                </div>
              )}

              {/* Action Buttons */}
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
                  disabled={!canSubmitVendor || isSubmitting}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                    canSubmitVendor && !isSubmitting
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  {!canSubmitVendor ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      Lengkapi Foto Terlebih Dahulu
                    </>
                  ) : isSubmitting ? (
                    'Menyimpan Data...'
                  ) : (
                    'Simpan Absen Masuk'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MODAL FORM TAMBAH / EDIT UNDER LAPANGAN (SUB-TAB 2)                */}
      {/* ==================================================================== */}
      {isUnderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            
            {/* Header Modal Under */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900">
                  {editingUnder ? 'Edit Data Regu Under Lapangan' : '+ Tambah Regu Under Lapangan'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Leader J&T pembawa anak-anak Reg/Add per divisi ({selectedDate})
                </p>
              </div>
              <button
                onClick={() => setIsUnderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnder} className="space-y-4 mt-4">
              
              {/* Pilihan Shift Kerja */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Shift Kerja:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableShifts.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setModalShiftId(s.id)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        modalShiftId === s.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {s.name.toLowerCase().includes('pagi') ? (
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-indigo-300" />
                      )}
                      Shift {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pilihan Divisi Operasional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Divisi Penempatan:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {DIVISION_DEFINITIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setModalDivision(d.key)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        modalDivision === d.key
                          ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600 text-indigo-950 font-black'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                      }`}
                    >
                      <span className="text-xs block">{d.name}</span>
                      <span className="text-[10px] text-slate-400 block font-normal truncate">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama Under / Leader */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Under / Leader Lapangan:
                </label>
                <input
                  type="text"
                  required
                  value={modalUnderName}
                  onChange={(e) => setModalUnderName(e.target.value)}
                  placeholder="Misal: Under Budi, Under Dani, Under 1..."
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Jumlah Anak Regular & Additional yang Dipegang */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 uppercase">
                    Jumlah Anak yang Dipegang
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Total: {modalRegularCount + modalAdditionalCount} Orang
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 mb-1">
                      Jumlah Regular:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={modalRegularCount === 0 ? '' : modalRegularCount}
                      onChange={(e) => setModalRegularCount(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-base font-black text-slate-900 bg-white border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 mb-1">
                      Jumlah Additional:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={modalAdditionalCount === 0 ? '' : modalAdditionalCount}
                      onChange={(e) => setModalAdditionalCount(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-base font-black text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Rincian Pasukan per Vendor */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Rincian Asal Vendor Pasukan (Opsional):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVendorBreakdown}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-indigo-200"
                  >
                    <Plus className="w-3 h-3" /> + Vendor
                  </button>
                </div>

                {modalVendorBreakdown.length > 0 ? (
                  <div className="space-y-2">
                    {modalVendorBreakdown.map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                        <select
                          value={item.vendorId}
                          onChange={(e) => handleUpdateVendorBreakdown(idx, 'vendorId', e.target.value)}
                          className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded p-1.5"
                        >
                          {activeVendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {getShortVendorName(v.name)} ({v.name})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-blue-700">Reg:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.regular === 0 ? '' : item.regular}
                              onChange={(e) => handleUpdateVendorBreakdown(idx, 'regular', e.target.value)}
                              placeholder="0"
                              className="w-14 text-center font-bold border border-blue-200 rounded p-1 bg-blue-50/50"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-amber-700">Add:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.additional === 0 ? '' : item.additional}
                              onChange={(e) => handleUpdateVendorBreakdown(idx, 'additional', e.target.value)}
                              placeholder="0"
                              className="w-14 text-center font-bold border border-amber-200 rounded p-1 bg-amber-50/50"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVendorBreakdown(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500">
                        Total dari rincian: {modalVendorBreakdown.reduce((s, b) => s + (b.regular || 0) + (b.additional || 0), 0)} MP
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyBreakdownTotals}
                        className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                      >
                        Terapkan ke Total Jumlah Anak
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    Belum ada rincian vendor. Klik "+ Vendor" jika ingin mencatat anak regu ini berasal dari vendor mana saja.
                  </p>
                )}
              </div>

              {/* Foto Regu Bersama Under (WAJIB DENGAN TIMESTAMP) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Bukti Apel Regu Bersama Under (Wajib Ber-Timestamp):
                  </label>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                    * WAJIB
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {modalPhotoPreview ? (
                    <div className="flex flex-col items-center">
                      <div
                        onClick={() => setLightboxPhoto({ url: modalPhotoPreview!, title: `Regu: ${modalUnderName}` })}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-indigo-300 shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400 relative group"
                      >
                        <img src={modalPhotoPreview} alt="Preview Regu" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
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
                      {modalPhotoPreview ? 'Ganti Foto Regu' : 'Ambil Foto Regu Lapangan'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleModalPhotoChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {modalPhotoPreview ? (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>TIMESTAMP TERVERIFIKASI &bull; {selectedDate} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                      </div>
                    ) : (
                      <span className="block text-[10px] text-rose-500 font-medium mt-1">
                        * Under wajib melampirkan foto apel regu bersama sebelum menyimpan.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Catatan Lapangan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pos / Dock (Opsional):
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Misal: Posisi di Dock 3-4, muatan padat..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              {(() => {
                const hasUnderPhoto = !!modalPhotoFile || !!editingUnder?.photoUrl;
                const canSubmitUnder = hasUnderPhoto && modalShiftId && modalDivision && modalUnderName.trim() && (modalRegularCount + modalAdditionalCount > 0);

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
                      disabled={!canSubmitUnder || isSubmittingUnder}
                      className={`flex-1 py-2.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                        canSubmitUnder && !isSubmittingUnder
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      }`}
                    >
                      {!hasUnderPhoto ? (
                        <>
                          <Lock className="w-4 h-4 text-slate-400" />
                          Wajib Foto Regu
                        </>
                      ) : isSubmittingUnder ? (
                        'Menyimpan...'
                      ) : editingUnder ? (
                        'Update Regu Under'
                      ) : (
                        'Simpan Regu Under'
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
      {/* 4.B MODAL INPUT SUSULAN / TELAT VENDOR                                */}
      {/* ==================================================================== */}
      {isLateModalOpen && selectedLatePlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Input Pekerja Susulan / Telat
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {getShortVendorName(selectedLatePlotingan.vendor.name)} &bull; Shift {selectedLatePlotingan.shift.name} ({selectedDate})
                </p>
              </div>
              <button
                onClick={() => setIsLateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLate} className="space-y-4 mt-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Pencatatan Kedatangan Susulan:
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  Input ini untuk pekerja yang tiba telat 1-2 orang di tengah shift. Angka akan otomatis menambah total hadir dan tersimpan dalam rekapitulasi audit.
                </p>
              </div>

              {/* Jumlah Susulan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    Susulan Regular (Org):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lateRegular === 0 ? '' : lateRegular}
                    onChange={(e) => setLateRegular(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-blue-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Susulan Additional (Org):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lateAdditional === 0 ? '' : lateAdditional}
                    onChange={(e) => setLateAdditional(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-base font-black text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Jam Tiba */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jam Kedatangan di Lapangan:
                </label>
                <input
                  type="text"
                  required
                  value={lateTime}
                  onChange={(e) => setLateTime(e.target.value)}
                  placeholder="07:30"
                  className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Catatan / Alasan Telat */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Alasan Keterlambatan:
                </label>
                <input
                  type="text"
                  value={lateNotes}
                  onChange={(e) => setLateNotes(e.target.value)}
                  placeholder="Misal: Kendala angkot, baru tiba dari Bogor..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Foto Bukti Susulan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Foto Bukti Hadir Pos / Gerbang (Opsional):
                </label>
                <div className="flex items-center gap-3">
                  {latePhotoPreview ? (
                    <div
                      onClick={() => setLightboxPhoto({ url: latePhotoPreview!, title: `Susulan: ${selectedLatePlotingan.vendor.name}` })}
                      className="w-14 h-14 rounded-xl overflow-hidden border border-amber-300 shrink-0 cursor-pointer"
                    >
                      <img src={latePhotoPreview} alt="Preview Susulan" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0 bg-slate-50">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      {latePhotoPreview ? 'Ganti Foto' : 'Ambil Foto Susulan'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleLatePhotoChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLateModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={lateRegular + lateAdditional <= 0 || isSubmittingLate}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-sm transition-all shadow-md ${
                    lateRegular + lateAdditional > 0 && !isSubmittingLate
                      ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  {isSubmittingLate ? 'Menyimpan...' : 'Simpan Pekerja Susulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. LIGHTBOX MODAL PREVIEW FOTO FULLSCREEN                            */}
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

  // --------------------------------------------------------------------------
  // HELPER MENGGAMBAR KARTU UNDER LAPANGAN
  // --------------------------------------------------------------------------
  function renderUnderCard(u: any) {
    return (
      <div
        key={u.id}
        className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
      >
        <div>
          {/* Header Kartu Under */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">{u.underName}</h4>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                  Shift {u.shift?.name || 'Pagi'}
                </span>
              </div>
            </div>

            {/* Badges Total */}
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              {u.totalHeadcount} MP
            </span>
          </div>

          {/* Rincian Regular & Additional */}
          <div className="flex items-center gap-2 text-[11px] font-bold mt-2 pt-2 border-t border-slate-100">
            <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
              Reg: {u.regularCount}
            </span>
            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              Add: {u.additionalCount}
            </span>
          </div>

          {/* Foto Regu */}
          {u.photoUrl ? (
            <div
              onClick={() => setLightboxPhoto({ url: u.photoUrl, title: `Regu: ${u.underName} (${u.division})` })}
              className="mt-2.5 relative h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group"
            >
              <img src={u.photoUrl} alt="Foto Regu" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <div className="mt-2.5 h-12 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 gap-1">
              <Camera className="w-3.5 h-3.5" /> Belum ada foto
            </div>
          )}

          {/* Catatan Pos */}
          {u.notes && (
            <p className="text-[10px] text-slate-500 italic mt-2 line-clamp-2">
              "{u.notes}"
            </p>
          )}
        </div>

        {/* Action Buttons: Edit & Delete */}
        <div className="flex items-center justify-end gap-1.5 pt-2.5 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => handleOpenEditUnder(u)}
            className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Edit Under"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteUnder(u.id, u.underName)}
            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Hapus Under"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
}