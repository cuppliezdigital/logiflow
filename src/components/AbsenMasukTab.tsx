'use client';

// ============================================================================
// KOMPONEN TAB 2: ABSEN MASUK & SERAH TERIMA PASUKAN (APEL SHIFT GUDANG)
// Fitur Lengkap:
// 1. 1 Kartu Terpadu per Vendor per Shift (mencakup Regular & Additional).
// 2. Input Hadir Fisik Terpisah: Hadir Regular & Hadir Additional.
// 3. Multi-Foto Dinamis per Bagian Gudang (Bongkar, Muat, Sortir, Repack, FIFO, dll):
//    - Tombol "+ Tambah Foto Bagian" untuk Regular dan Additional.
//    - Quick Chips pilihan bagian gudang standar + Input teks kustom manual.
// 4. Validasi Ketat (Strict Validation):
//    - Jika kuota Regular > 0, WAJIB ada foto barisan Regular (Bongkar/Muat/dsb).
//    - Jika kuota Additional > 0, WAJIB ada foto barisan Additional.
//    - Tombol simpan otomatis DISABLED & muncul peringatan merah jika belum ada foto.
// 5. Galeri Foto & Lightbox Preview Modal langsung dari kartu absensi.
// 6. Seluruh baris kode dilengkapi komentar penjelasan Bahasa Indonesia.
// ============================================================================

import React, { useState } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { submitAbsenMasuk } from '@/app/actions';

// Daftar opsi preset area kerja / bagian gudang standar
const SECTION_PRESETS = ['Bongkar', 'Muat', 'Sortir', 'Repack', 'FIFO'];

// Struktur data untuk setiap slot upload foto bagian gudang
interface SectionPhotoSlot {
  id: string;                 // Identifier unik untuk tracking key React
  section: string;            // Nama bagian (misal: 'Bongkar', 'Muat', 'Sortir', dll)
  file: File | null;          // File foto baru yang diunggah pengguna
  preview: string | null;     // Object URL atau URL server untuk pratinjau gambar
  existingUrl?: string | null;// URL foto lama jika mode edit data
}

// Definisi props untuk komponen AbsenMasukTab
interface AbsenMasukTabProps {
  plotingans: any[];          // Seluruh data plotingan pada tanggal operasional terpilih
  selectedDate: string;       // Tanggal aktif saat ini (format YYYY-MM-DD)
  onRefresh: () => void;      // Callback memuat ulang data setelah submit berhasil
}

export default function AbsenMasukTab({
  plotingans,
  selectedDate,
  onRefresh,
}: AbsenMasukTabProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT KOMPONEN
  // --------------------------------------------------------------------------
  const [selectedPlotingan, setSelectedPlotingan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State kuota hadir fisik terpisah
  const [actualRegular, setActualRegular] = useState<number>(0);
  const [actualAdditional, setActualAdditional] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // State dynamic slot foto per bagian untuk Pasukan Regular
  const [regularPhotoSlots, setRegularPhotoSlots] = useState<SectionPhotoSlot[]>([]);

  // State dynamic slot foto per bagian untuk Pasukan Additional
  const [additionalPhotoSlots, setAdditionalPhotoSlots] = useState<SectionPhotoSlot[]>([]);

  // State loading status saat submit ke server
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State lightbox modal untuk melihat foto ukuran penuh
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // --------------------------------------------------------------------------
  // HELPER PENGELOLAAN SLOT FOTO DINAMIS
  // --------------------------------------------------------------------------

  // Tambah 1 slot foto baru untuk kategori Regular (bisa insert di bawah slot tertentu atau di akhir)
  const handleAddRegularSlot = (insertIndex?: number) => {
    // Tentukan rekomendasi bagian default berdasarkan jumlah slot yang sudah ada
    const nextSection = SECTION_PRESETS[regularPhotoSlots.length % SECTION_PRESETS.length] || 'Bongkar';
    const newSlot: SectionPhotoSlot = {
      id: `reg-slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setRegularPhotoSlots((prev) => {
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < prev.length) {
        const updated = [...prev];
        updated.splice(insertIndex + 1, 0, newSlot);
        return updated;
      }
      return [...prev, newSlot];
    });
  };

  // Hapus slot foto Regular tertentu
  const handleRemoveRegularSlot = (id: string) => {
    setRegularPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  // Perbarui nama bagian pada slot foto Regular
  const handleUpdateRegularSection = (id: string, sectionName: string) => {
    setRegularPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  // Upload file foto pada slot Regular tertentu
  const handleRegularFileChange = (id: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setRegularPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file, preview: previewUrl } : slot))
    );
  };

  // Tambah 1 slot foto baru untuk kategori Additional (bisa insert di bawah slot tertentu atau di akhir)
  const handleAddAdditionalSlot = (insertIndex?: number) => {
    const nextSection = SECTION_PRESETS[additionalPhotoSlots.length % SECTION_PRESETS.length] || 'Sortir';
    const newSlot: SectionPhotoSlot = {
      id: `add-slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      section: nextSection,
      file: null,
      preview: null,
    };
    setAdditionalPhotoSlots((prev) => {
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < prev.length) {
        const updated = [...prev];
        updated.splice(insertIndex + 1, 0, newSlot);
        return updated;
      }
      return [...prev, newSlot];
    });
  };

  // Hapus slot foto Additional tertentu
  const handleRemoveAdditionalSlot = (id: string) => {
    setAdditionalPhotoSlots((prev) => prev.filter((slot) => slot.id !== id));
  };

  // Perbarui nama bagian pada slot foto Additional
  const handleUpdateAdditionalSection = (id: string, sectionName: string) => {
    setAdditionalPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, section: sectionName } : slot))
    );
  };

  // Upload file foto pada slot Additional tertentu
  const handleAdditionalFileChange = (id: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setAdditionalPhotoSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, file, preview: previewUrl } : slot))
    );
  };

  // --------------------------------------------------------------------------
  // EVENT HANDLER: MEMBUKA MODAL & INISIALISASI DATA
  // --------------------------------------------------------------------------
  const handleOpenModal = (plot: any) => {
    setSelectedPlotingan(plot);
    const existing = plot.attendanceIn;

    const targetReg = plot.targetRegular ?? (plot.status === 'REGULAR' ? plot.targetHeadcount : 0);
    const targetAdd = plot.targetAdditional ?? (plot.status === 'ADDITIONAL' ? plot.targetHeadcount : 0);

    // Tetapkan nilai awal hadir fisik (mengambil dari data yang tersimpan atau default ke target kuota)
    const initReg = existing ? (existing.actualRegular ?? existing.actualHeadcount) : targetReg;
    const initAdd = existing ? (existing.actualAdditional ?? 0) : targetAdd;
    setActualRegular(initReg);
    setActualAdditional(initAdd);
    setNotes(existing ? existing.notes || '' : '');

    // Inisialisasi slot foto REGULAR dari database JSON array
    let parsedRegSlots: SectionPhotoSlot[] = [];
    if (existing?.photosRegularJson) {
      try {
        const arr = JSON.parse(existing.photosRegularJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedRegSlots = arr.map((item: any, idx: number) => ({
            id: `init-reg-${idx}-${Date.now()}`,
            section: item.section || 'Bongkar',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {
        console.error('Gagal parse photosRegularJson:', e);
      }
    }

    // Fallback jika belum ada multi-foto tapi ada foto tunggal sebelumnya
    if (parsedRegSlots.length === 0 && (existing?.photoInRegularUrl || existing?.photoInUrl)) {
      parsedRegSlots = [{
        id: `init-reg-0-${Date.now()}`,
        section: 'Bongkar',
        file: null,
        preview: existing.photoInRegularUrl || existing.photoInUrl,
        existingUrl: existing.photoInRegularUrl || existing.photoInUrl,
      }];
    }

    // Jika masih kosong dan kuota regular > 0, sediakan 1 slot default kosong
    if (parsedRegSlots.length === 0 && initReg > 0) {
      parsedRegSlots = [{
        id: `init-reg-empty-${Date.now()}`,
        section: 'Bongkar',
        file: null,
        preview: null,
      }];
    }
    setRegularPhotoSlots(parsedRegSlots);

    // Inisialisasi slot foto ADDITIONAL dari database JSON array
    let parsedAddSlots: SectionPhotoSlot[] = [];
    if (existing?.photosAdditionalJson) {
      try {
        const arr = JSON.parse(existing.photosAdditionalJson);
        if (Array.isArray(arr) && arr.length > 0) {
          parsedAddSlots = arr.map((item: any, idx: number) => ({
            id: `init-add-${idx}-${Date.now()}`,
            section: item.section || 'Sortir',
            file: null,
            preview: item.url,
            existingUrl: item.url,
          }));
        }
      } catch (e) {
        console.error('Gagal parse photosAdditionalJson:', e);
      }
    }

    if (parsedAddSlots.length === 0 && existing?.photoInAdditionalUrl) {
      parsedAddSlots = [{
        id: `init-add-0-${Date.now()}`,
        section: 'Sortir',
        file: null,
        preview: existing.photoInAdditionalUrl,
        existingUrl: existing.photoInAdditionalUrl,
      }];
    }

    if (parsedAddSlots.length === 0 && (initAdd > 0 || targetAdd > 0)) {
      parsedAddSlots = [{
        id: `init-add-empty-${Date.now()}`,
        section: 'Sortir',
        file: null,
        preview: null,
      }];
    }
    setAdditionalPhotoSlots(parsedAddSlots);

    setIsModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // LOGIKA VALIDASI KETAT (STRICT VALIDATION)
  // --------------------------------------------------------------------------
  // Hitung jumlah foto valid yang sudah memiliki file atau existing URL
  const validRegularPhotos = regularPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);
  const validAdditionalPhotos = additionalPhotoSlots.filter((s) => !!s.file || !!s.existingUrl);

  // Kriteria wajib foto:
  const needRegularPhoto = actualRegular > 0;
  const isRegularPhotoMissing = needRegularPhoto && validRegularPhotos.length === 0;

  const needAdditionalPhoto = actualAdditional > 0;
  const isAdditionalPhotoMissing = needAdditionalPhoto && validAdditionalPhotos.length === 0;

  const totalHeadcountInput = actualRegular + actualAdditional;
  const isHeadcountZero = totalHeadcountInput <= 0;

  // Syarat tombol submit aktif: Total headcount > 0 dan semua foto wajib sudah terpenuhi
  const canSubmit = !isHeadcountZero && !isRegularPhotoMissing && !isAdditionalPhotoMissing;

  // --------------------------------------------------------------------------
  // SUBMIT FORM KE SERVER ACTION
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlotingan) return;

    if (!canSubmit) {
      alert('Harap penuhi kelengkapan foto barisan apel sebelum menyimpan!');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('plotinganId', selectedPlotingan.id);
      formData.append('actualRegular', actualRegular.toString());
      formData.append('actualAdditional', actualAdditional.toString());
      formData.append('notes', notes);

      // Kirim multi-foto Pasukan Regular
      formData.append('photoInRegular_count', validRegularPhotos.length.toString());
      validRegularPhotos.forEach((slot, index) => {
        formData.append(`photoInRegular_section_${index}`, slot.section.trim() || 'Bongkar');
        if (slot.file) {
          formData.append(`photoInRegular_file_${index}`, slot.file);
        }
        if (slot.existingUrl) {
          formData.append(`photoInRegular_existing_${index}`, slot.existingUrl);
        }
      });

      // Kirim multi-foto Pasukan Additional
      formData.append('photoInAdditional_count', validAdditionalPhotos.length.toString());
      validAdditionalPhotos.forEach((slot, index) => {
        formData.append(`photoInAdditional_section_${index}`, slot.section.trim() || 'Sortir');
        if (slot.file) {
          formData.append(`photoInAdditional_file_${index}`, slot.file);
        }
        if (slot.existingUrl) {
          formData.append(`photoInAdditional_existing_${index}`, slot.existingUrl);
        }
      });

      const res = await submitAbsenMasuk(formData);
      if (!res.success) {
        alert(res.error || 'Gagal menyimpan absensi masuk.');
        return;
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menyimpan absensi masuk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper kalkulasi target & fulfillment pada modal aktif
  const targetRegModal = selectedPlotingan ? (selectedPlotingan.targetRegular ?? (selectedPlotingan.status === 'REGULAR' ? selectedPlotingan.targetHeadcount : 0)) : 0;
  const targetAddModal = selectedPlotingan ? (selectedPlotingan.targetAdditional ?? (selectedPlotingan.status === 'ADDITIONAL' ? selectedPlotingan.targetHeadcount : 0)) : 0;
  const totalTargetModal = targetRegModal + targetAddModal;
  const fulfillmentModal = totalTargetModal > 0 ? Math.round((totalHeadcountInput / totalTargetModal) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI FASE ABSEN MASUK DENGAN STANDAR AREA GUDANG */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-4 rounded-r-xl">
        <h2 className="text-base font-bold text-slate-900">FASE 2: Absen Masuk & Serah Terima Pasukan (Apel Gudang)</h2>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
          Diisi saat apel/briefing awal shift. Wajib merekam bukti foto fisik barisan per bagian kerja gudang 
          (<strong className="text-blue-700">Bongkar, Muat, Sortir, Repack, FIFO</strong>, atau input manual).
          <span className="font-semibold text-rose-700"> Form tidak dapat disubmit jika foto barisan belum dilampirkan!</span>
        </p>
      </div>

      {/* 2. DAFTAR KARTU PLOTINGAN (1 KARTU PER VENDOR PER SHIFT) */}
      {plotingans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">Belum Ada Plotingan untuk Absen Masuk</p>
          <p className="text-xs text-slate-400 mt-1">
            Silakan buat jadwal plotingan terlebih dahulu pada Tab 1 (Plotingan H-1).
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
            const rate = p.targetHeadcount > 0 ? Math.round((actualTotal / p.targetHeadcount) * 100) : 0;

            // Ekstrak multi-foto per bagian dari string JSON
            let cardRegPhotos: Array<{ section: string; url: string }> = [];
            if (p.attendanceIn?.photosRegularJson) {
              try {
                const parsed = JSON.parse(p.attendanceIn.photosRegularJson);
                if (Array.isArray(parsed)) cardRegPhotos = parsed;
              } catch (e) {}
            }
            // Fallback jika hanya ada single url
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

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                  hasCheckedIn
                    ? 'border-emerald-200'
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div>
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
                          Sudah Absen Masuk ({actualTotal} Org)
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
                      {/* Baris Pasukan Regular */}
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

                      {/* Baris Pasukan Additional */}
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

                      {/* Total Headcount */}
                      <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-1.5 font-extrabold">
                        <span className="text-slate-600 uppercase">Total Headcount:</span>
                        <span className={hasCheckedIn ? 'text-emerald-700' : 'text-slate-500'}>
                          {hasCheckedIn ? `${actualTotal} Org` : '-'} (Target: {p.targetHeadcount} Org)
                        </span>
                      </div>
                    </div>

                    {/* Indikator Fulfillment & Galeri Foto per Bagian */}
                    {hasCheckedIn && (
                      <div className="space-y-2 pt-1">
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

                        {/* Galeri Multi-Foto per Bagian Gudang */}
                        {totalPhotosOnCard > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                              Foto Barisan per Bagian ({totalPhotosOnCard}):
                            </span>
                            
                            <div className="grid grid-cols-3 gap-1.5">
                              {/* Foto-foto Regular */}
                              {cardRegPhotos.map((photo, pIdx) => (
                                <div
                                  key={`card-reg-${pIdx}`}
                                  onClick={() => setLightboxPhoto({ url: photo.url, title: `Regular: ${photo.section}` })}
                                  className="group relative rounded-lg overflow-hidden border border-blue-200 h-18 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                  title={`Klik untuk perbesar - Regular: ${photo.section}`}
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Regular ${photo.section}`}
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

                              {/* Foto-foto Additional */}
                              {cardAddPhotos.map((photo, pIdx) => (
                                <div
                                  key={`card-add-${pIdx}`}
                                  onClick={() => setLightboxPhoto({ url: photo.url, title: `Additional: ${photo.section}` })}
                                  className="group relative rounded-lg overflow-hidden border border-amber-200 h-18 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all"
                                  title={`Klik untuk perbesar - Additional: ${photo.section}`}
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Additional ${photo.section}`}
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
                    )}
                  </div>
                </div>

                {/* Tombol Aksi Input / Edit Absen Masuk */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => handleOpenModal(p)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      hasCheckedIn
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {hasCheckedIn ? 'Edit Absen Masuk & Foto Bagian' : 'Input Absen Masuk (Wajib Foto)'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. MODAL FORM INPUT ABSEN MASUK DENGAN MULTI-FOTO PER BAGIAN GUDANG */}
      {isModalOpen && selectedPlotingan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Form Absen Masuk & Foto Bagian</h3>
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

            {/* Form Input Terpadu */}
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              
              {/* Box Realisasi Kehadiran Fisik Apel */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Realisasi Orang Hadir (Fisik Apel)
                  </span>
                  <span className="text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Target Kuota: {totalTargetModal} Org
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Input Hadir Pasukan Regular */}
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

                  {/* Input Hadir Pasukan Additional */}
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
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Total Masuk & Tingkat Kehadiran:
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
                    {totalHeadcountInput} Org ({fulfillmentModal}%)
                  </span>
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* 1. SEKSI FOTO PASUKAN REGULAR PER BAGIAN GUDANG               */}
              {/* ------------------------------------------------------------ */}
              <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      1. Foto Barisan REGULAR per Bagian
                    </h4>
                    <p className="text-[11px] text-blue-700">
                      {actualRegular > 0 ? (
                        <span className="font-bold text-rose-600">
                          *Wajib ada minimal 1 foto barisan fisik untuk {actualRegular} orang Regular.
                        </span>
                      ) : (
                        'Kuota regular kosong.'
                      )}
                    </p>
                  </div>
                  
                  {/* Tombol Tambah Foto Bagian Regular */}
                  <button
                    type="button"
                    onClick={() => handleAddRegularSlot()}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Bagian</span>
                  </button>
                </div>

                {/* List Slot Foto Regular */}
                {regularPhotoSlots.length === 0 ? (
                  <div className="p-4 bg-white/80 rounded-xl border border-dashed border-blue-300 text-center">
                    <p className="text-xs text-blue-600 font-medium">
                      Belum ada slot foto bagian untuk Regular.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddRegularSlot()}
                      className="mt-2 text-xs font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Foto Bagian Regular Sekarang</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regularPhotoSlots.map((slot, sIdx) => (
                      <div
                        key={slot.id}
                        className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs space-y-2.5"
                      >
                        {/* Header Slot & Pilihan Preset Bagian */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wide">
                              Bagian Kerja #{sIdx + 1}:
                            </span>
                            
                            {/* Quick Chips Preset: Bongkar, Muat, Sortir, Repack, FIFO */}
                            <div className="flex flex-wrap gap-1">
                              {SECTION_PRESETS.map((preset) => (
                                <button
                                  type="button"
                                  key={preset}
                                  onClick={() => handleUpdateRegularSection(slot.id, preset)}
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

                            {/* Input Teks Manual untuk Nama Bagian Kustom */}
                            <input
                              type="text"
                              value={slot.section}
                              onChange={(e) => handleUpdateRegularSection(slot.id, e.target.value)}
                              placeholder="Ketik nama bagian manual (misal: Staging / Inbound)..."
                              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Tombol Aksi di Samping Kartu (Tambah & Hapus) */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddRegularSlot(sIdx)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Tambah Bagian Baru di Bawah Ini"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRegularSlot(slot.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus slot bagian ini"
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
                              alt={`Foto ${slot.section}`}
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
                                  onChange={(e) => handleRegularFileChange(slot.id, e.target.files?.[0] || null)}
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
                            <span>Unggah / Ambil Foto Barisan "{slot.section || 'Bagian'}"</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handleRegularFileChange(slot.id, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    ))}

                    {/* Tombol Tambah di Bawah List agar Tidak Perlu Scroll ke Atas */}
                    <button
                      type="button"
                      onClick={() => handleAddRegularSlot()}
                      className="w-full py-2 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bagian Regular</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------ */}
              {/* 2. SEKSI FOTO PASUKAN ADDITIONAL PER BAGIAN GUDANG           */}
              {/* ------------------------------------------------------------ */}
              {(targetAddModal > 0 || actualAdditional > 0) && (
                <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                        2. Foto Barisan ADDITIONAL per Bagian
                      </h4>
                      <p className="text-[11px] text-amber-700">
                        {actualAdditional > 0 ? (
                          <span className="font-bold text-rose-600">
                            *Wajib ada minimal 1 foto barisan fisik untuk {actualAdditional} orang Additional.
                          </span>
                        ) : (
                          'Kuota additional kosong.'
                        )}
                      </p>
                    </div>
                    
                    {/* Tombol Tambah Foto Bagian Additional */}
                    <button
                      type="button"
                      onClick={() => handleAddAdditionalSlot()}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bagian</span>
                    </button>
                  </div>

                  {/* List Slot Foto Additional */}
                  {additionalPhotoSlots.length === 0 ? (
                    <div className="p-4 bg-white/80 rounded-xl border border-dashed border-amber-300 text-center">
                      <p className="text-xs text-amber-600 font-medium">
                        Belum ada slot foto bagian untuk Additional.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddAdditionalSlot()}
                        className="mt-2 text-xs font-bold text-amber-700 underline hover:text-amber-900 cursor-pointer flex items-center justify-center gap-1 mx-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Foto Bagian Additional Sekarang</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {additionalPhotoSlots.map((slot, sIdx) => (
                        <div
                          key={slot.id}
                          className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs space-y-2.5"
                        >
                          {/* Header Slot & Pilihan Preset Bagian */}
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
                                    onClick={() => handleUpdateAdditionalSection(slot.id, preset)}
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
                                onChange={(e) => handleUpdateAdditionalSection(slot.id, e.target.value)}
                                placeholder="Ketik nama bagian manual (misal: Sortir Outbound)..."
                                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>

                            {/* Tombol Aksi di Samping Kartu (Tambah & Hapus) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAddAdditionalSlot(sIdx)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Tambah Bagian Baru di Bawah Ini"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAdditionalSlot(slot.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus slot bagian ini"
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
                                alt={`Foto ${slot.section}`}
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
                                    onChange={(e) => handleAdditionalFileChange(slot.id, e.target.files?.[0] || null)}
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
                              <span>Unggah / Ambil Foto Barisan "{slot.section || 'Bagian'}"</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleAdditionalFileChange(slot.id, e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      ))}

                      {/* Tombol Tambah di Bawah List agar Tidak Perlu Scroll ke Atas */}
                      <button
                        type="button"
                        onClick={() => handleAddAdditionalSlot()}
                        className="w-full py-2 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50 text-amber-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Bagian Additional</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Catatan Apel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Catatan Apel Masuk (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Pasukan bongkar muat lengkap, 1 orang regular di bagian FIFO izin 10 menit..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* ------------------------------------------------------------ */}
              {/* KOTAK PERINGATAN VALIDASI KETAT (STRICT VALIDATION BANNER)    */}
              {/* ------------------------------------------------------------ */}
              {!canSubmit && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-800 space-y-1 text-xs animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-extrabold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Validasi Ketat: Syarat Simpan Belum Terpenuhi!</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium text-rose-700">
                    {isHeadcountZero && <li>Jumlah kehadiran fisik tidak boleh 0 orang.</li>}
                    {isRegularPhotoMissing && (
                      <li>
                        <strong>Foto Pasukan Regular Wajib:</strong> Anda mengisi {actualRegular} orang Regular tapi belum mengunggah foto barisannya (Bongkar/Muat/dsb).
                      </li>
                    )}
                    {isAdditionalPhotoMissing && (
                      <li>
                        <strong>Foto Pasukan Additional Wajib:</strong> Anda mengisi {actualAdditional} orang Additional tapi belum mengunggah foto barisannya.
                      </li>
                    )}
                  </ul>
                  <p className="text-[10px] text-rose-600 italic font-semibold">
                    *Tombol "Simpan Absen Masuk" dikunci dan tidak dapat diklik hingga foto dilampirkan.
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
                      ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  }`}
                >
                  {!canSubmit ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      Lengkapi Foto Barisan Dahulu
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