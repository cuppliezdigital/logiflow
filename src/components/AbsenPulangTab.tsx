'use client';

// ============================================================================
// KOMPONEN TAB 3: ABSEN PULANG, TUMBANG & AUDIT INTEGRITAS PER BAGIAN GUDANG
// Fitur Lengkap:
// 1. 1 Kartu Terpadu per Vendor per Shift dengan rincian Regular & Additional.
// 2. Input Kepulangan Utuh & Tumbang dipisah untuk Regular dan Additional.
// 3. Multi-Foto Dinamis per Bagian Gudang untuk Checkout Kepulangan:
//    - Tombol "+ Tambah Bagian" untuk Checkout Regular & Additional.
//    - Quick Chips pilihan bagian (Bongkar, Muat, Sortir, Repack, FIFO) + Input manual.
// 4. Validasi Ketat Wajib Foto (Strict Validation):
//    - Jika ada orang pulang Regular > 0, WAJIB lampirkan foto checkout Regular.
//    - Jika ada orang pulang Additional > 0, WAJIB lampirkan foto checkout Additional.
//    - Jika ada orang tumbang > 0, WAJIB lampirkan foto surat dokter / klinik P3K.
//    - Tombol submit otomatis terkunci (DISABLED) jika syarat foto belum dipenuhi!
// 5. Audit Integritas Otomatis: Deteksi selisih kabur (Masuk vs Pulang + Tumbang).
// 6. Galeri Foto Checkout & Lightbox Fullscreen Preview pada setiap kartu.
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
  Layers,
  Plus,
  Trash2,
  Lock,
  ZoomIn,
  Image as ImageIcon
} from 'lucide-react';
import { submitAbsenPulang } from '@/app/actions';
import { compressImage } from '@/lib/compressImage';

// Daftar opsi preset area kerja / bagian gudang standar
const SECTION_PRESETS = ['Bongkar', 'Muat', 'Sortir', 'Repack', 'FIFO'];

// Struktur data untuk slot foto checkout kepulangan
interface SectionPhotoSlot {
  id: string;                 // ID unik slot
  section: string;            // Nama bagian gudang
  file: File | null;          // File baru yang diunggah
  preview: string | null;     // Object URL atau URL pratinjau gambar
  existingUrl?: string | null;// URL foto lama jika mode edit
}

// ============================================================================
// FUNGSI PEMBANTU: FORMAT WAKTU 24 JAM STANDAR LOGISTIK (00:00 - 23:59)
// Menghilangkan format AM/PM bawaan browser dan memastikan waktu selalu 24 jam.
// ============================================================================

// Helper mendapatkan jam dan menit saat ini dalam format 24 jam (HH:mm)
export const getCurrent24HourTime = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

// Helper konversi/normalisasi teks waktu ke format 24 jam ketat (00:00 s.d. 23:59)
// Mengonversi format 12 jam (AM/PM) ke 24 jam jika ditemukan string lama
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

// Struktur data untuk multi-kejadian pekerja tumbang / izin di jam kerja
// Mendukung pencatatan lebih dari 1 orang dengan jam keluar berbeda dan foto bukti mandiri
interface TumbangIncidentSlot {
  id: string;                         // ID unik lokal
  category: 'REGULAR' | 'ADDITIONAL'; // Status pasukan
  time: string;                       // Jam keluar / izin (misal: "10:30")
  type: string;                       // Jenis kendala ("Sakit / Klinik", "Izin Darurat", dll)
  notes: string;                      // Catatan detail kendala
  file: File | null;                  // File foto bukti mandiri baru
  preview: string | null;             // Pratinjau gambar
  existingUrl?: string | null;        // URL gambar lama dari server
}

// Definisi props untuk komponen AbsenPulangTab
interface AbsenPulangTabProps {
  plotingans: any[];          // Seluruh data plotingan pada tanggal terpilih
  selectedDate: string;       // Tanggal aktif saat ini (YYYY-MM-DD)
  onRefresh: () => void;      // Callback me-refresh data setelah submit
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

  // State orang tumbang di jam kerja (terpisah Reg & Add)
  const [tumbangRegular, setTumbangRegular] = useState<number>(0);
  const [tumbangAdditional, setTumbangAdditional] = useState<number>(0);
  const [tumbangNotes, setTumbangNotes] = useState('');

  // State multi-kejadian pekerja tumbang/izin (beda jam & beda foto)
  const [tumbangIncidents, setTumbangIncidents] = useState<TumbangIncidentSlot[]>([]);

  // State dynamic slot foto checkout per bagian untuk Pasukan Regular
  const [pulangRegPhotoSlots, setPulangRegPhotoSlots] = useState<SectionPhotoSlot[]>([]);

  // State dynamic slot foto checkout per bagian untuk Pasukan Additional
  const [pulangAddPhotoSlots, setPulangAddPhotoSlots] = useState<SectionPhotoSlot[]>([]);

  // State upload foto bukti surat dokter / klinik P3K (fallback legacy)
  const [photoTumbangPreview, setPhotoTumbangPreview] = useState<string | null>(null);
  const [photoTumbangFile, setPhotoTumbangFile] = useState<File | null>(null);
  const [existingPhotoTumbang, setExistingPhotoTumbang] = useState<string | null>(null);

  // State loading status submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State lightbox modal fullscreen
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // --------------------------------------------------------------------------
  // HELPER PENGELOLAAN SLOT FOTO DINAMIS CHECKOUT
  // --------------------------------------------------------------------------

  // Tambah slot foto checkout Regular (bisa insert di bawah slot tertentu atau di akhir)
  const handleAddPulangRegSlot = (insertIndex?: number) => {
    const nextSection = SECTION_PRESETS[pulangRegPhotoSlots.length % SECTION_PRESETS.length] || 'Bongkar';
    const newSlot: SectionPhotoSlot = {
      id: `out-reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setPulangRegPhotoSlots((prev) => {
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < prev.length) {
        const updated = [...prev];
        updated.splice(insertIndex + 1, 0, newSlot);
        return updated;
      }
      return [...prev, newSlot];
    });
  };

  // Hapus slot foto checkout Regular
  const handleRemovePulangRegSlot = (id: string) => {
    setPulangRegPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  // Ubah nama bagian checkout Regular
  const handleUpdatePulangRegSection = (id: string, sectionName: string) => {
    setPulangRegPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  // Unggah file foto checkout Regular (dengan kompresi otomatis di browser)
  const handlePulangRegFileChange = async (id: string, file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setPulangRegPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file: compressed, preview: previewUrl } : slot))
    );
  };

  // Tambah slot foto checkout Additional (bisa insert di bawah slot tertentu atau di akhir)
  const handleAddPulangAddSlot = (insertIndex?: number) => {
    const nextSection = SECTION_PRESETS[pulangAddPhotoSlots.length % SECTION_PRESETS.length] || 'Sortir';
    const newSlot: SectionPhotoSlot = {
      id: `out-add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setPulangAddPhotoSlots((prev) => {
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < prev.length) {
        const updated = [...prev];
        updated.splice(insertIndex + 1, 0, newSlot);
        return updated;
      }
      return [...prev, newSlot];
    });
  };

  // Hapus slot foto checkout Additional
  const handleRemovePulangAddSlot = (id: string) => {
    setPulangAddPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  // Ubah nama bagian checkout Additional
  const handleUpdatePulangAddSection = (id: string, sectionName: string) => {
    setPulangAddPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  // Unggah file foto checkout Additional (dengan kompresi otomatis di browser)
  const handlePulangAddFileChange = async (id: string, file: File | null) => {
    if (!file) return;
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setPulangAddPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file: compressed, preview: previewUrl } : slot))
    );
  };

  // Unggah foto surat klinik / P3K untuk pekerja tumbang (dengan kompresi otomatis di browser)
  const handlePhotoTumbangChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setPhotoTumbangFile(compressed);
      setPhotoTumbangPreview(URL.createObjectURL(compressed));
    }
  };

  // --------------------------------------------------------------------------
  // HELPER PENGELOLAAN MULTI-KEJADIAN ORANG TUMBANG / IZIN DI JAM KERJA
  // --------------------------------------------------------------------------

  // Helper sinkronisasi jumlah Tumbang & Pulang dari daftar kejadian
  const syncCountsFromIncidents = (list: TumbangIncidentSlot[], inReg: number, inAdd: number) => {
    const regCount = list.filter((i) => i.category === 'REGULAR').length;
    const addCount = list.filter((i) => i.category === 'ADDITIONAL').length;
    setTumbangRegular(regCount);
    setTumbangAdditional(addCount);
    setPulangRegular(Math.max(0, inReg - regCount));
    setPulangAdditional(Math.max(0, inAdd - addCount));
  };

  // Tambah kejadian tumbang baru (otomatis set waktu saat ini dalam format 24 jam)
  const handleAddIncident = (forcedCat?: 'REGULAR' | 'ADDITIONAL') => {
    const inReg = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount) : 0;
    const inAdd = selectedPlotingan?.attendanceIn?.actualAdditional ?? 0;
    const defaultCat = forcedCat || (inAdd > 0 && tumbangAdditional < inAdd ? 'ADDITIONAL' : 'REGULAR');
    // Format 24 jam murni tanpa AM/PM (HH:mm)
    const nowTime = getCurrent24HourTime();
    const newInc: TumbangIncidentSlot = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: defaultCat,
      time: nowTime,
      type: 'Sakit / Klinik',
      notes: '',
      file: null,
      preview: null,
    };
    const updated = [...tumbangIncidents, newInc];
    setTumbangIncidents(updated);
    syncCountsFromIncidents(updated, inReg, inAdd);
  };

  // Hapus satu kejadian tumbang
  const handleRemoveIncident = (id: string) => {
    const inReg = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount) : 0;
    const inAdd = selectedPlotingan?.attendanceIn?.actualAdditional ?? 0;
    const updated = tumbangIncidents.filter((i) => i.id !== id);
    setTumbangIncidents(updated);
    syncCountsFromIncidents(updated, inReg, inAdd);
  };

  // Update nilai atribut dalam kejadian tumbang
  const handleUpdateIncident = (id: string, field: keyof TumbangIncidentSlot, value: any) => {
    const inReg = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount) : 0;
    const inAdd = selectedPlotingan?.attendanceIn?.actualAdditional ?? 0;
    const updated = tumbangIncidents.map((inc) => (inc.id === id ? { ...inc, [field]: value } : inc));
    setTumbangIncidents(updated);
    if (field === 'category') {
      syncCountsFromIncidents(updated, inReg, inAdd);
    }
  };

  // Unggah foto khusus untuk 1 kejadian tumbang
  const handleIncidentFileChange = async (id: string, file: File) => {
    const compressed = await compressImage(file);
    const previewUrl = URL.createObjectURL(compressed);
    setTumbangIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, file: compressed, preview: previewUrl } : inc))
    );
  };

  // Hapus foto dari kejadian tumbang
  const handleRemoveIncidentPhoto = (id: string) => {
    setTumbangIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, file: null, preview: null, existingUrl: null } : inc))
    );
  };

  // --------------------------------------------------------------------------
  // BUKA MODAL DAN LOAD DATA SEBELUMNYA
  // --------------------------------------------------------------------------
  const handleOpenModal = (plotingan: any) => {
    setSelectedPlotingan(plotingan);

    const existingOut = plotingan.attendanceIn?.attendanceOut;
    const inReg = plotingan.attendanceIn ? (plotingan.attendanceIn.actualRegular ?? plotingan.attendanceIn.actualHeadcount) : 0;
    const inAdd = plotingan.attendanceIn?.actualAdditional ?? 0;

    const currentTumbangReg = existingOut ? existingOut.tumbangRegular : 0;
    const currentTumbangAdd = existingOut ? existingOut.tumbangAdditional : 0;

    setTumbangRegular(currentTumbangReg);
    setTumbangAdditional(currentTumbangAdd);
    setTumbangNotes(existingOut?.tumbangNotes || '');

    // Default pulang: Masuk - Tumbang (terkunci seimbang)
    if (existingOut) {
      setPulangRegular(existingOut.pulangRegular ?? existingOut.pulangHeadcount ?? Math.max(0, inReg - currentTumbangReg));
      setPulangAdditional(existingOut.pulangAdditional ?? Math.max(0, inAdd - currentTumbangAdd));
    } else {
      setPulangRegular(inReg);
      setPulangAdditional(inAdd);
    }

    // Inisialisasi foto tumbang tunggal (legacy)
    if (existingOut?.photoTumbangUrl) {
      setPhotoTumbangPreview(existingOut.photoTumbangUrl);
      setExistingPhotoTumbang(existingOut.photoTumbangUrl);
    } else {
      setPhotoTumbangPreview(null);
      setExistingPhotoTumbang(null);
    }
    setPhotoTumbangFile(null);

    // Inisialisasi daftar multi-kejadian tumbang dari database
    let parsedIncidents: TumbangIncidentSlot[] = [];
    if (existingOut?.tumbangNotes) {
      try {
        const arr = JSON.parse(existingOut.tumbangNotes);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedIncidents = arr.map((item: any, idx: number) => ({
            id: `init-inc-${idx}-${Date.now()}`,
            category: item.category || 'REGULAR',
            // Konversi ke format 24 jam murni tanpa AM/PM
            time: convertTo24Hour(item.time),
            type: item.type || 'Sakit / Klinik',
            notes: item.notes || '',
            file: null,
            preview: item.url || null,
            existingUrl: item.url || null,
          }));
        }
      } catch (e) {}
    }

    if (parsedIncidents.length === 0 && existingOut && (existingOut.tumbangHeadcount > 0 || existingOut.photoTumbangUrl)) {
      parsedIncidents = [{
        id: `init-inc-legacy-${Date.now()}`,
        category: existingOut.tumbangRegular > 0 ? 'REGULAR' : 'ADDITIONAL',
        time: getCurrent24HourTime(),
        type: 'Sakit / Kendala',
        notes: existingOut.tumbangNotes || '',
        file: null,
        preview: existingOut.photoTumbangUrl || null,
        existingUrl: existingOut.photoTumbangUrl || null,
      }];
    }
    setTumbangIncidents(parsedIncidents);

    // Inisialisasi slot foto checkout REGULAR
    let parsedRegSlots: SectionPhotoSlot[] = [];
    if (existingOut?.photosPulangRegularJson) {
      try {
        const arr = JSON.parse(existingOut.photosPulangRegularJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedRegSlots = arr.map((item: any, idx: number) => ({
            id: `init-out-reg-${idx}-${Date.now()}`,
            section: item.section || 'Bongkar',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {
        console.error('Gagal parse photosPulangRegularJson:', e);
      }
    }

    if (parsedRegSlots.length === 0 && (existingOut?.photoPulangRegularUrl || existingOut?.photoPulangUrl)) {
      parsedRegSlots = [{
        id: `init-out-reg-0-${Date.now()}`,
        section: 'Bongkar',
        file: null,
        preview: existingOut.photoPulangRegularUrl || existingOut.photoPulangUrl,
        existingUrl: existingOut.photoPulangRegularUrl || existingOut.photoPulangUrl,
      }];
    }

    if (parsedRegSlots.length === 0 && inReg > 0) {
      parsedRegSlots = [{
        id: `init-out-reg-empty-${Date.now()}`,
        section: 'Bongkar',
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
            section: item.section || 'Sortir',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {
        console.error('Gagal parse photosPulangAdditionalJson:', e);
      }
    }

    if (parsedAddSlots.length === 0 && existingOut?.photoPulangAdditionalUrl) {
      parsedAddSlots = [{
        id: `init-out-add-0-${Date.now()}`,
        section: 'Sortir',
        file: null,
        preview: existingOut.photoPulangAdditionalUrl,
        existingUrl: existingOut.photoPulangAdditionalUrl,
      }];
    }

    if (parsedAddSlots.length === 0 && inAdd > 0) {
      parsedAddSlots = [{
        id: `init-out-add-empty-${Date.now()}`,
        section: 'Sortir',
        file: null,
        preview: null,
      }];
    }
    setPulangAddPhotoSlots(parsedAddSlots);

    setIsModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // LOGIKA AUDIT INTEGRITAS & VALIDASI KETAT WAJIB FOTO
  // --------------------------------------------------------------------------
  const inRegModal = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualRegular ?? selectedPlotingan.attendanceIn.actualHeadcount) : 0;
  const inAddModal = selectedPlotingan?.attendanceIn ? (selectedPlotingan.attendanceIn.actualAdditional ?? 0) : 0;
  const inTotalModal = inRegModal + inAddModal;

  // Audit selisih pekerja kabur
  const selisihRegModal = inRegModal - (pulangRegular + tumbangRegular);
  const selisihAddModal = inAddModal - (pulangAdditional + tumbangAdditional);
  const selisihTotalModal = selisihRegModal + selisihAddModal;
  const isBalancedModal = selisihTotalModal === 0;

  const totalTumbangModal = tumbangRegular + tumbangAdditional;

  // Validasi ketat wajib foto checkout untuk Pasukan Regular dan Additional
  const validPulangRegPhotos = pulangRegPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);
  const validPulangAddPhotos = pulangAddPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);
  // Validasi foto bukti tumbang: jika menggunakan multi-kejadian, setiap kejadian wajib melampirkan foto bukti
  const hasValidTumbangPhoto =
    totalTumbangModal === 0 ||
    (tumbangIncidents.length > 0
      ? tumbangIncidents.every((inc) => !!inc.file || !!inc.existingUrl)
      : !!photoTumbangFile || !!existingPhotoTumbang);

  const isPulangRegPhotoMissing = pulangRegular > 0 && validPulangRegPhotos.length === 0;
  const isPulangAddPhotoMissing = pulangAdditional > 0 && validPulangAddPhotos.length === 0;
  const isTumbangPhotoMissing = totalTumbangModal > 0 && !hasValidTumbangPhoto;

  // Syarat submit checkout aktif (seimbang & semua foto wajib lengkap)
  const canSubmit = isBalancedModal && !isPulangRegPhotoMissing && !isPulangAddPhotoMissing && !isTumbangPhotoMissing;

  // --------------------------------------------------------------------------
  // SUBMIT FORM KE SERVER ACTION
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan?.attendanceIn?.id) return;

    if (!canSubmit) {
      alert('Harap lengkapi seluruh foto checkout kepulangan dan bukti surat/faskes orang tumbang sebelum menyimpan!');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('attendanceInId', selectedPlotingan.attendanceIn.id);
      formData.append('pulangRegular', pulangRegular.toString());
      formData.append('pulangAdditional', pulangAdditional.toString());
      formData.append('tumbangRegular', tumbangRegular.toString());
      formData.append('tumbangAdditional', tumbangAdditional.toString());
      formData.append('tumbangNotes', tumbangNotes);

      // Kirim multi-foto checkout Pasukan Regular
      formData.append('photoPulangRegular_count', validPulangRegPhotos.length.toString());
      validPulangRegPhotos.forEach((slot, index) => {
        formData.append(`photoPulangRegular_section_${index}`, slot.section.trim() || 'Bongkar');
        if (slot.file) {
          formData.append(`photoPulangRegular_file_${index}`, slot.file);
        }
        if (slot.existingUrl) {
          formData.append(`photoPulangRegular_existing_${index}`, slot.existingUrl);
        }
      });

      // Kirim multi-foto checkout Pasukan Additional
      formData.append('photoPulangAdditional_count', validPulangAddPhotos.length.toString());
      validPulangAddPhotos.forEach((slot, index) => {
        formData.append(`photoPulangAdditional_section_${index}`, slot.section.trim() || 'Sortir');
        if (slot.file) {
          formData.append(`photoPulangAdditional_file_${index}`, slot.file);
        }
        if (slot.existingUrl) {
          formData.append(`photoPulangAdditional_existing_${index}`, slot.existingUrl);
        }
      });

      // Kirim multi-kejadian tumbang & foto bukti mandiri per orang
      formData.append('photoTumbang_count', tumbangIncidents.length.toString());
      tumbangIncidents.forEach((inc, index) => {
        formData.append(`photoTumbang_category_${index}`, inc.category);
        formData.append(`photoTumbang_time_${index}`, inc.time || '');
        formData.append(`photoTumbang_type_${index}`, inc.type || 'Sakit');
        formData.append(`photoTumbang_notes_${index}`, inc.notes || '');
        if (inc.file) {
          formData.append(`photoTumbang_file_${index}`, inc.file);
        }
        if (inc.existingUrl) {
          formData.append(`photoTumbang_existing_${index}`, inc.existingUrl);
        }
      });

      // Fallback foto bukti tunggal jika legacy
      if (photoTumbangFile) {
        formData.append('photoTumbang', photoTumbangFile);
      }
      if (existingPhotoTumbang) {
        formData.append('photoTumbang_existing', existingPhotoTumbang);
      }

      const res = await submitAbsenPulang(formData);
      if (!res.success) {
        alert(res.error || 'Gagal menyimpan absensi pulang.');
        return;
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan absensi pulang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN PULANG */}
      <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-l-4 border-blue-600 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 3: Absen Pulang, Tumbang & Audit Integritas per Bagian</h2>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
          Diisi di akhir shift. Wajib melampirkan foto checkout per bagian kerja gudang 
          (<strong className="text-blue-700">Bongkar, Muat, Sortir, Repack, FIFO</strong>). 
          Sistem mengaudit integritas: <span className="font-bold text-slate-900">Masuk = Pulang Utuh + Tumbang</span>.
          <span className="font-semibold text-rose-700"> Form dikunci jika foto checkout belum diunggah!</span>
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

            const outRecord = p.attendanceIn?.attendanceOut;
            const pulangReg = outRecord?.pulangRegular ?? outRecord?.pulangHeadcount ?? 0;
            const pulangAdd = outRecord?.pulangAdditional ?? 0;
            const pulangTotal = outRecord?.pulangHeadcount ?? (pulangReg + pulangAdd);

            const tumbangTotal = outRecord?.tumbangHeadcount ?? 0;
            const selisihCard = outRecord?.selisihCount ?? 0;
            const isMatch = outRecord?.isBalanced ?? false;

            const targetReg = p.targetRegular ?? (p.status === 'REGULAR' ? p.targetHeadcount : 0);
            const targetAdd = p.targetAdditional ?? (p.status === 'ADDITIONAL' ? p.targetHeadcount : 0);

            // Ekstrak multi-foto checkout
            let cardPulangRegPhotos: Array<{ section: string; url: string }> = [];
            if (outRecord?.photosPulangRegularJson) {
              try {
                const parsed = JSON.parse(outRecord.photosPulangRegularJson);
                if (Array.isArray(parsed)) cardPulangRegPhotos = parsed;
              } catch (e) {}
            }
            if (cardPulangRegPhotos.length === 0 && outRecord?.photoPulangRegularUrl) {
              cardPulangRegPhotos = [{ section: 'Regular', url: outRecord.photoPulangRegularUrl }];
            }

            let cardPulangAddPhotos: Array<{ section: string; url: string }> = [];
            if (outRecord?.photosPulangAdditionalJson) {
              try {
                const parsed = JSON.parse(outRecord.photosPulangAdditionalJson);
                if (Array.isArray(parsed)) cardPulangAddPhotos = parsed;
              } catch (e) {}
            }
            if (cardPulangAddPhotos.length === 0 && outRecord?.photoPulangAdditionalUrl) {
              cardPulangAddPhotos = [{ section: 'Additional', url: outRecord.photoPulangAdditionalUrl }];
            }

            const totalPulangPhotos = cardPulangRegPhotos.length + cardPulangAddPhotos.length;

            // Ekstrak data multi-kejadian orang tumbang / izin di jam kerja
            let cardTumbangIncidents: Array<{ category: string; time: string; type: string; notes: string; url: string }> = [];
            if (outRecord?.tumbangNotes) {
              try {
                const parsed = JSON.parse(outRecord.tumbangNotes);
                if (Array.isArray(parsed)) cardTumbangIncidents = parsed;
              } catch (e) {}
            }
            if (cardTumbangIncidents.length === 0 && outRecord?.photoTumbangUrl) {
              cardTumbangIncidents = [{
                category: (outRecord.tumbangRegular ?? 0) > 0 ? 'REGULAR' : 'ADDITIONAL',
                time: '',
                type: 'Kendala',
                notes: outRecord.tumbangNotes || '',
                url: outRecord.photoTumbangUrl,
              }];
            }

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                  !hasCheckedIn
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : hasCheckedOut
                    ? 'border-emerald-300'
                    : 'border-amber-300'
                }`}
              >
                <div>
                  {/* Strip Status di Atas Kartu */}
                  <div
                    className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
                      !hasCheckedIn
                        ? 'bg-slate-100 text-slate-500'
                        : hasCheckedOut
                        ? 'bg-emerald-50 text-emerald-700'
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
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Selesai Shift &bull; {pulangTotal} Pulang{tumbangTotal > 0 ? ` • ${tumbangTotal} Tumbang` : ''}
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
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
                      <p className="text-xs text-slate-500 mt-0.5">
                        Target Kuota: <strong className="text-slate-800 font-bold">{p.targetHeadcount} MP</strong>
                        {p.workingHours ? ` &bull; ${p.workingHours}` : ''}
                      </p>
                    </div>

                    {/* Grid Rincian Headcount Terpadu */}
                    {hasCheckedIn ? (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                        <div className="grid grid-cols-4 gap-1 text-center border-b border-slate-200 pb-1 text-[10px] uppercase font-bold text-slate-400">
                          <span>Status</span>
                          <span>Masuk</span>
                          <span>Pulang</span>
                          <span>Tumbang</span>
                        </div>
                        
                        {/* Baris Regular */}
                        <div className="grid grid-cols-4 gap-1 text-center text-xs font-semibold">
                          <span className="text-blue-700 font-bold text-left pl-1">Regular</span>
                          <span className="text-slate-900 font-extrabold">{inReg}</span>
                          <span className={hasCheckedOut ? 'text-blue-600 font-extrabold' : 'text-slate-400'}>
                            {hasCheckedOut ? pulangReg : '-'}
                          </span>
                          <span className={hasCheckedOut ? 'text-amber-700 font-black' : 'text-slate-400'}>
                            {hasCheckedOut ? (outRecord?.tumbangRegular ?? 0) : '-'}
                          </span>
                        </div>

                        {/* Baris Additional */}
                        {inAdd > 0 && (
                          <div className="grid grid-cols-4 gap-1 text-center text-xs font-semibold">
                            <span className="text-amber-700 font-bold text-left pl-1">Additional</span>
                            <span className="text-slate-900 font-extrabold">{inAdd}</span>
                            <span className={hasCheckedOut ? 'text-amber-600 font-extrabold' : 'text-slate-400'}>
                              {hasCheckedOut ? pulangAdd : '-'}
                            </span>
                            <span className={hasCheckedOut ? 'text-amber-700 font-black' : 'text-slate-400'}>
                              {hasCheckedOut ? (outRecord?.tumbangAdditional ?? 0) : '-'}
                            </span>
                          </div>
                        )}

                        {/* Baris Total Ringkasan */}
                        <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 font-semibold">
                            Tumbang: <strong className="text-amber-600 font-black">{hasCheckedOut ? tumbangTotal : 0} Org</strong>
                          </span>
                          <span className="text-slate-600 font-semibold">
                            Pulang Utuh: <strong className="text-blue-700 font-black">{hasCheckedOut ? pulangTotal : 0} Org</strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-400">
                        Plotingan ini belum melakukan Absen Masuk di Tab 2.
                      </div>
                    )}

                    {/* Keterangan Multi-Kejadian Tumbang jika ada */}
                    {hasCheckedOut && tumbangTotal > 0 && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-amber-800">
                          <div className="flex items-center gap-1">
                            <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                            <span>Keterangan Kendala ({tumbangTotal} Orang):</span>
                          </div>
                        </div>
                        {cardTumbangIncidents.length > 0 ? (
                          <div className="space-y-1">
                            {cardTumbangIncidents.map((inc, iIdx) => (
                              <div key={iIdx} className="flex items-center justify-between text-[11px] bg-white/90 p-1.5 rounded-lg border border-amber-200/60 shadow-2xs">
                                <div className="flex items-center gap-1.5 truncate mr-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${inc.category === 'REGULAR' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {inc.category === 'REGULAR' ? 'Reg' : 'Add'}
                                  </span>
                                  {inc.time && (
                                    <span className="font-mono font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                      {convertTo24Hour(inc.time)}
                                    </span>
                                  )}
                                  <span className="text-slate-800 font-medium truncate">{inc.notes || inc.type}</span>
                                </div>
                                {inc.url && (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxPhoto({ url: inc.url, title: `Bukti Kendala: ${p.vendor.name} (${inc.time || ''})` })}
                                    className="text-[10px] text-amber-700 hover:text-amber-900 underline font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Camera className="w-3 h-3" />
                                    Foto
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-700 italic">
                            "{outRecord?.tumbangNotes || 'Tidak ada catatan kendala rinci'}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Galeri Multi-Foto Checkout Kepulangan */}
                    {hasCheckedOut && totalPulangPhotos > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          Foto Checkout ({totalPulangPhotos}):
                        </span>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          {/* Foto-foto Pulang Regular */}
                          {cardPulangRegPhotos.map((photo, pIdx) => (
                            <div
                              key={`card-pulang-reg-${pIdx}`}
                              onClick={() => setLightboxPhoto({ url: photo.url, title: `Pulang Regular: ${photo.section}` })}
                              className="group relative rounded-lg overflow-hidden border border-blue-200 h-16 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                              title={`Checkout Regular: ${photo.section}`}
                            >
                              <img
                                src={photo.url}
                                alt={`Checkout Regular ${photo.section}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                              <span className="absolute bottom-0 inset-x-0 bg-blue-900/85 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                                {photo.section}
                              </span>
                            </div>
                          ))}

                          {/* Foto-foto Pulang Additional */}
                          {cardPulangAddPhotos.map((photo, pIdx) => (
                            <div
                              key={`card-pulang-add-${pIdx}`}
                              onClick={() => setLightboxPhoto({ url: photo.url, title: `Pulang Additional: ${photo.section}` })}
                              className="group relative rounded-lg overflow-hidden border border-amber-200 h-16 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all"
                              title={`Checkout Additional: ${photo.section}`}
                            >
                              <img
                                src={photo.url}
                                alt={`Checkout Additional ${photo.section}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                              <span className="absolute bottom-0 inset-x-0 bg-amber-900/85 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                                Add: {photo.section}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tombol Input / Edit Absen Pulang */}
                <div className="p-4 pt-0">
                  {hasCheckedIn && (
                    <button
                      onClick={() => handleOpenModal(p)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        hasCheckedOut
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
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

      {/* 3. MODAL FORM INPUT ABSEN PULANG, TUMBANG & MULTI-FOTO PER BAGIAN */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Form Absen Pulang & Audit Integritas</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedPlotingan.vendor.name} &bull; {selectedPlotingan.shift.name} ({selectedDate})
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
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              
              {/* Ringkasan Hadir Masuk di Apel Awal */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 uppercase">Tercatat Hadir Masuk:</span>
                <span className="font-black text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  Reg: {inRegModal} &bull; Add: {inAddModal} (Total: {inTotalModal} Org)
                </span>
              </div>

              {/* 1. INPUT KEPULANGAN UTUH */}
              <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200 space-y-2">
                <label className="block text-xs font-bold text-blue-900 uppercase">
                  1. Orang Pulang Utuh (Selesai Shift Kerja)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-blue-700 block mb-1">Pulang Regular (Maks: {inRegModal}):</span>
                    <input
                      type="number"
                      min="0"
                      max={inRegModal}
                      required
                      value={pulangRegular}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        const clamped = Math.min(Math.max(0, val), inRegModal);
                        setPulangRegular(clamped);
                        // Otomatis sesuaikan tumbang jika user ubah pulang langsung
                        setTumbangRegular(Math.max(0, inRegModal - clamped));
                      }}
                      className="w-full border-2 border-blue-300 bg-white rounded-xl px-3 py-1.5 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 block mb-1">Pulang Additional (Maks: {inAddModal}):</span>
                    <input
                      type="number"
                      min="0"
                      max={inAddModal}
                      value={pulangAdditional}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        const clamped = Math.min(Math.max(0, val), inAddModal);
                        setPulangAdditional(clamped);
                        // Otomatis sesuaikan tumbang jika user ubah pulang langsung
                        setTumbangAdditional(Math.max(0, inAddModal - clamped));
                      }}
                      className="w-full border-2 border-amber-300 bg-white rounded-xl px-3 py-1.5 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. INPUT ORANG TUMBANG (SAKIT / CEDERA) */}
              <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2">
                <label className="block text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                  2. Orang Tumbang di Jam Kerja (Sakit / Cedera / P3K)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-blue-700">Tumbang Regular:</span>
                      <span className="text-[10px] text-slate-400 font-medium">(Auto-potong Pulang)</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={inRegModal}
                      value={tumbangRegular}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        const clamped = Math.min(Math.max(0, val), inRegModal);
                        setTumbangRegular(clamped);
                        // Otomatis kurangi pulangRegular: Masuk - Tumbang
                        setPulangRegular(Math.max(0, inRegModal - clamped));
                      }}
                      className="w-full border border-slate-300 bg-white rounded-xl px-3 py-1.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-amber-700">Tumbang Additional:</span>
                      <span className="text-[10px] text-slate-400 font-medium">(Auto-potong Pulang)</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={inAddModal}
                      value={tumbangAdditional}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                        const clamped = Math.min(Math.max(0, val), inAddModal);
                        setTumbangAdditional(clamped);
                        // Otomatis kurangi pulangAdditional: Masuk - Tumbang
                        setPulangAdditional(Math.max(0, inAddModal - clamped));
                      }}
                      className="w-full border border-slate-300 bg-white rounded-xl px-3 py-1.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* KOTAK REKAPITULASI KEPULANGAN & INTEGRITAS (Clean tanpa kata Total Akhir) */}
              <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-900">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Rekapitulasi Akhir Shift:
                  </span>
                  <span className="font-black px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                    Total: {pulangRegular + pulangAdditional + tumbangRegular + tumbangAdditional} Org
                  </span>
                </div>

                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between bg-white px-2.5 py-1 rounded border border-slate-200">
                    <span className="text-slate-600">Regular: Masuk {inRegModal} = Pulang {pulangRegular} + Tumbang {tumbangRegular}</span>
                    <strong className="text-blue-700 font-extrabold">
                      Total: {pulangRegular + tumbangRegular} Org
                    </strong>
                  </div>
                  {inAddModal > 0 && (
                    <div className="flex justify-between bg-white px-2.5 py-1 rounded border border-slate-200">
                      <span className="text-slate-600">Additional: Masuk {inAddModal} = Pulang {pulangAdditional} + Tumbang {tumbangAdditional}</span>
                      <strong className="text-amber-700 font-extrabold">
                        Total: {pulangAdditional + tumbangAdditional} Org
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* SEKSI MULTI-KEJADIAN ORANG TUMBANG / IZIN DI JAM KERJA        */}
              {/* Mendukung > 1 orang dengan jam keluar berbeda & foto bukti mandiri */}
              {/* ------------------------------------------------------------ */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                  <div>
                    <label className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-amber-600" />
                      Daftar Kejadian Tumbang / Izin ({tumbangIncidents.length} Orang)
                    </label>
                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                      Catat setiap orang yang pulang awal/sakit dengan jam keluar dan foto bukti masing-masing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddIncident()}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Catat Orang Tumbang / Izin
                  </button>
                </div>

                {tumbangIncidents.length === 0 ? (
                  <div className="bg-white/80 rounded-xl p-4 text-center border border-dashed border-amber-200">
                    <p className="text-xs font-bold text-amber-900">Tidak ada pekerja yang tumbang / sakit</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Jika semua pekerja menyelesaikan shift sampai selesai, lewati bagian ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddIncident()}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Catat Kejadian Tumbang / Izin
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tumbangIncidents.map((inc, idx) => (
                      <div key={inc.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-[11px]">
                              {idx + 1}
                            </span>
                            Kejadian #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveIncident(inc.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Status Pasukan (Reg vs Add) */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Status Pasukan</label>
                            <select
                              value={inc.category}
                              onChange={(e) => handleUpdateIncident(inc.id, 'category', e.target.value)}
                              className="w-full text-xs font-bold rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <option value="REGULAR">🔵 Regular</option>
                              {inAddModal > 0 && <option value="ADDITIONAL">🟠 Additional</option>}
                            </select>
                          </div>

                          {/* Jam Keluar / Izin (Format 24 Jam Murni: 00:00 - 23:59 WIB, Bebas AM/PM) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Jam Keluar (24 Jam)
                              </label>
                              <span className="text-[9px] font-black text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded">
                                24 Jam
                              </span>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                required
                                value={inc.time}
                                placeholder="Contoh: 23:27"
                                maxLength={5}
                                onChange={(e) => {
                                  // Ambil hanya angka dan titik dua
                                  let val = e.target.value.replace(/[^0-9:]/g, '');
                                  // Otomatis sisipkan tanda ':' setelah 2 digit jam
                                  if (val.length === 2 && !val.includes(':') && e.target.value.length > (inc.time || '').length) {
                                    val = val + ':';
                                  }
                                  handleUpdateIncident(inc.id, 'time', val);
                                }}
                                onBlur={(e) => {
                                  // Normalisasi ketat ke format 24 jam (00:00 s.d. 23:59)
                                  const formatted = convertTo24Hour(e.target.value);
                                  handleUpdateIncident(inc.id, 'time', formatted);
                                }}
                                className="w-full text-xs font-black font-mono rounded-lg border border-slate-300 pl-2.5 pr-16 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              {/* Tombol Cepat: Jam Sekarang (WIB 24 Jam) */}
                              <button
                                type="button"
                                onClick={() => handleUpdateIncident(inc.id, 'time', getCurrent24HourTime())}
                                className="absolute right-1 px-1.5 py-0.5 text-[10px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors cursor-pointer"
                                title="Set ke jam saat ini (WIB)"
                              >
                                Sekarang
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                              00:00 s.d. 23:59 WIB (Tanpa AM/PM)
                            </span>
                          </div>

                          {/* Jenis Kendala */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Jenis Kendala</label>
                            <select
                              value={inc.type}
                              onChange={(e) => handleUpdateIncident(inc.id, 'type', e.target.value)}
                              className="w-full text-xs font-bold rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <option value="Sakit / Klinik">Sakit / Klinik</option>
                              <option value="Izin Darurat">Izin Darurat</option>
                              <option value="Cedera Kerja">Cedera Kerja</option>
                              <option value="Meninggalkan Tugas / Kabur">Meninggalkan Tugas / Kabur</option>
                              <option value="Lainnya">Lainnya</option>
                            </select>
                          </div>
                        </div>

                        {/* Catatan Keterangan Detail */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                            Catatan Detail / Diagnosa / Alasan (Wajib)
                          </label>
                          <input
                            type="text"
                            required
                            value={inc.notes}
                            onChange={(e) => handleUpdateIncident(inc.id, 'notes', e.target.value)}
                            placeholder="Contoh: Sakit lambung kambuh, izin urusan keluarga mendadak..."
                            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Upload Foto Bukti Khusus Kejadian Ini */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase">
                              Foto Bukti Surat Dokter / Klinik / Pos Security
                            </label>
                            <span className="text-[10px] text-rose-600 font-bold">*Wajib Foto</span>
                          </div>

                          {inc.preview ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 h-24 bg-slate-100 flex items-center justify-center">
                              <img src={inc.preview} alt={`Bukti ${inc.category}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveIncidentPhoto(inc.id)}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer shadow-xs"
                                title="Hapus foto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <span className="absolute bottom-0 inset-x-0 bg-amber-900/85 text-white text-[9px] font-bold text-center py-0.5">
                                Bukti Terlampir ({inc.category} • {inc.time})
                              </span>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-lg p-3 bg-amber-50/40 hover:bg-amber-50/80 cursor-pointer text-xs font-bold text-amber-800 transition-colors">
                              <Camera className="w-4 h-4 text-amber-600" />
                              <span>Unggah Foto Bukti ({inc.category} • {inc.time || 'Jam Pulang'})</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleIncidentFileChange(inc.id, file);
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/* 1. SEKSI FOTO CHECKOUT REGULAR PER BAGIAN GUDANG              */}
              {/* ------------------------------------------------------------ */}
              <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      Foto Barisan Checkout REGULAR per Bagian
                    </h4>
                    <p className="text-[11px] text-blue-700">
                      {pulangRegular > 0 ? (
                        <span className="font-bold text-rose-600">
                          *Wajib minimal 1 foto barisan checkout untuk {pulangRegular} orang Regular.
                        </span>
                      ) : (
                        'Tidak ada kepulangan regular.'
                      )}
                    </p>
                  </div>
                  
                  {/* Tombol Tambah Bagian Checkout Regular */}
                  <button
                    type="button"
                    onClick={() => handleAddPulangRegSlot()}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Bagian</span>
                  </button>
                </div>

                {/* List Slot Foto Checkout Regular */}
                {pulangRegPhotoSlots.length === 0 ? (
                  <div className="p-3.5 bg-white/80 rounded-xl border border-dashed border-blue-300 text-center">
                    <p className="text-xs text-blue-600 font-medium">
                      Belum ada slot foto checkout untuk Regular.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddPulangRegSlot()}
                      className="mt-1.5 text-xs font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Slot Foto Checkout Regular</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pulangRegPhotoSlots.map((slot, sIdx) => (
                      <div
                        key={slot.id}
                        className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wide">
                              Bagian Kerja #{sIdx + 1}:
                            </span>
                            
                            {/* Quick Chips Preset */}
                            <div className="flex flex-wrap gap-1">
                              {SECTION_PRESETS.map((preset) => (
                                <button
                                  type="button"
                                  key={preset}
                                  onClick={() => handleUpdatePulangRegSection(slot.id, preset)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                    slot.section === preset
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50'
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>

                            {/* Input Teks Manual */}
                            <input
                              type="text"
                              value={slot.section}
                              onChange={(e) => handleUpdatePulangRegSection(slot.id, e.target.value)}
                              placeholder="Ketik nama bagian checkout manual..."
                              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Tombol Aksi di Samping Kartu (Tambah & Hapus) */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddPulangRegSlot(sIdx)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Tambah Bagian Baru di Bawah Ini"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePulangRegSlot(slot.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus slot ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Upload Foto & Pratinjau */}
                        {slot.preview ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100 group">
                            <img
                              src={slot.preview}
                              alt={`Checkout ${slot.section}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1.5 right-1.5 flex gap-1">
                              <label className="bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-xs">
                                <Camera className="w-3 h-3" />
                                Ganti
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => handlePulangRegFileChange(slot.id, e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            <span className="absolute bottom-0 inset-x-0 bg-blue-900/85 text-white text-[10px] font-bold text-center py-0.5">
                              Bagian: {slot.section || 'Belum dinamai'}
                            </span>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl p-3 bg-blue-50/30 hover:bg-blue-50 transition-colors cursor-pointer text-xs font-bold text-blue-700">
                            <Camera className="w-4 h-4 text-blue-600" />
                            <span>Unggah Foto Checkout "{slot.section || 'Bagian'}"</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePulangRegFileChange(slot.id, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/* 2. SEKSI FOTO CHECKOUT ADDITIONAL PER BAGIAN GUDANG           */}
              {/* ------------------------------------------------------------ */}
              {(inAddModal > 0 || pulangAdditional > 0) && (
                <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                        Foto Barisan Checkout ADDITIONAL per Bagian
                      </h4>
                      <p className="text-[11px] text-amber-700">
                        {pulangAdditional > 0 ? (
                          <span className="font-bold text-rose-600">
                            *Wajib minimal 1 foto barisan checkout untuk {pulangAdditional} orang Additional.
                          </span>
                        ) : (
                          'Tidak ada kepulangan additional.'
                        )}
                      </p>
                    </div>
                    
                    {/* Tombol Tambah Bagian Checkout Additional */}
                    <button
                      type="button"
                      onClick={() => handleAddPulangAddSlot()}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bagian</span>
                    </button>
                  </div>

                  {/* List Slot Foto Checkout Additional */}
                  {pulangAddPhotoSlots.length === 0 ? (
                    <div className="p-3.5 bg-white/80 rounded-xl border border-dashed border-amber-300 text-center">
                      <p className="text-xs text-amber-600 font-medium">
                        Belum ada slot foto checkout untuk Additional.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddPulangAddSlot()}
                        className="mt-1.5 text-xs font-bold text-amber-700 underline hover:text-amber-900 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Slot Foto Checkout Additional</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pulangAddPhotoSlots.map((slot, sIdx) => (
                        <div
                          key={slot.id}
                          className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1.5">
                              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide">
                                Bagian Kerja #{sIdx + 1}:
                              </span>
                              
                              {/* Quick Chips Preset */}
                              <div className="flex flex-wrap gap-1">
                                {SECTION_PRESETS.map((preset) => (
                                  <button
                                    type="button"
                                    key={preset}
                                    onClick={() => handleUpdatePulangAddSection(slot.id, preset)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                      slot.section === preset
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>

                              {/* Input Teks Manual */}
                              <input
                                type="text"
                                value={slot.section}
                                onChange={(e) => handleUpdatePulangAddSection(slot.id, e.target.value)}
                                placeholder="Ketik nama bagian checkout manual..."
                                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>

                            {/* Tombol Aksi di Samping Kartu (Tambah & Hapus) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAddPulangAddSlot(sIdx)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Tambah Bagian Baru di Bawah Ini"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePulangAddSlot(slot.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus slot ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Upload Foto & Pratinjau */}
                          {slot.preview ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-100 group">
                              <img
                                src={slot.preview}
                                alt={`Checkout ${slot.section}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1.5 right-1.5 flex gap-1">
                                <label className="bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg px-2 py-1 text-[10px] font-bold cursor-pointer flex items-center gap-1 shadow-xs">
                                  <Camera className="w-3 h-3" />
                                  Ganti
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => handlePulangAddFileChange(slot.id, e.target.files?.[0] || null)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <span className="absolute bottom-0 inset-x-0 bg-amber-900/85 text-white text-[10px] font-bold text-center py-0.5">
                                Bagian: {slot.section || 'Belum dinamai'}
                              </span>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl p-3 bg-amber-50/30 hover:bg-amber-50 transition-colors cursor-pointer text-xs font-bold text-amber-700">
                              <Camera className="w-4 h-4 text-amber-600" />
                              <span>Unggah Foto Checkout "{slot.section || 'Bagian'}"</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handlePulangAddFileChange(slot.id, e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------ */}
              {/* KOTAK PERINGATAN VALIDASI KETAT WAJIB FOTO CHECKOUT           */}
              {/* ------------------------------------------------------------ */}
              {!canSubmit && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 space-y-1 text-xs animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-extrabold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Validasi Ketat: Syarat Simpan Belum Lengkap!</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium text-rose-700">
                    {isPulangRegPhotoMissing && (
                      <li>
                        <strong>Foto Checkout Regular Wajib:</strong> Ada {pulangRegular} orang Regular pulang tapi belum ada foto barisan checkout.
                      </li>
                    )}
                    {isPulangAddPhotoMissing && (
                      <li>
                        <strong>Foto Checkout Additional Wajib:</strong> Ada {pulangAdditional} orang Additional pulang tapi belum ada foto barisan checkout.
                      </li>
                    )}
                    {isTumbangPhotoMissing && (
                      <li>
                        <strong>Foto Surat Klinik P3K Wajib:</strong> Tercatat {totalTumbangModal} orang sakit/tumbang, wajib lampirkan foto surat dokter/P3K.
                      </li>
                    )}
                  </ul>
                  <p className="text-[10px] text-rose-600 italic font-semibold">
                    *Tombol "Simpan Data Pulang" dikunci hingga foto bukti diunggah.
                  </p>
                </div>
              )}

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
                  disabled={!canSubmit || isSubmitting}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                    canSubmit && !isSubmitting
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  {!canSubmit ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      Lengkapi Foto Checkout Dahulu
                    </>
                  ) : isSubmitting ? (
                    'Menyimpan Data...'
                  ) : (
                    'Simpan Data Pulang'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. LIGHTBOX MODAL PREVIEW FOTO FULLSCREEN */}
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
