'use client';

// ============================================================================
// KOMPONEN FASE 3: LIVE TUMBANG & KENDALA LAPANGAN (REAL-TIME REPORTING)
// Fitur Utama:
// 1. Pencatatan pekerja sakit/tumbang/izin saat shift sedang berjalan oleh Under.
// 2. Tombol 1-klik "Salin Format WhatsApp" untuk laporan instan ke Atasan / SPV.
// 3. Wajib upload bukti foto penanganan medis / surat klinik P3K (Watermarked).
// 4. Otomatis memotong kuota dan terhubung ke Absen Pulang sore hari (anti-bocor).
// ============================================================================

import React, { useState } from 'react';
import { 
  HeartPulse, 
  Plus, 
  Trash2, 
  Camera, 
  Clock, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  X, 
  ZoomIn, 
  Sun, 
  Moon, 
  Layers, 
  UserCheck,
  ShieldAlert,
  Loader2,
  FileText
} from 'lucide-react';
import { createTumbangIncident, deleteTumbangIncident } from '@/app/actions';
import { compressImage } from '@/lib/compressImage';

// Definisi preset divisi operasional standar J&T
const DIVISIONS = [
  { key: 'BONGKARAN', label: 'Bongkaran (Unloading)' },
  { key: 'MUATAN', label: 'Muatan (Loading)' },
  { key: 'SORTIR_BODEBEK', label: 'Jalur 1: Sortir Bodebek (A)' },
  { key: 'SORTIR_SUMATRAAN', label: 'Jalur 2: Sortir Sumatraan (B)' },
  { key: 'SORTIR_JAKARTA', label: 'Jalur 3: Sortir Jakarta (C)' },
  { key: 'FIFO', label: 'FIFO (Staging Area)' },
  { key: 'REPACK', label: 'Repack & Return' },
];

// Opsi jenis kendala / diagnosa
const INCIDENT_TYPES = [
  'Sakit / Drop Fisik (Klinik P3K)',
  'Cedera / Kecelakaan Kerja',
  'Izin Darurat / Pulang Cepat',
  'Mangkir / Kabur di Jam Kerja',
  'Lainnya (Catat di Kronologi)',
];

interface TumbangTabProps {
  incidents: any[];          // Data insiden tumbang hari ini
  shifts: any[];             // Master data shift (Pagi & Malam)
  vendors: any[];            // Master data vendor aktif
  selectedDate: string;      // Tanggal terpilih (YYYY-MM-DD)
  onRefresh: () => void;     // Callback refresh data
}

export default function TumbangTab({
  incidents = [],
  shifts = [],
  vendors = [],
  selectedDate,
  onRefresh,
}: TumbangTabProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [modalShiftId, setModalShiftId] = useState(shifts[0]?.id || '');
  const [modalDivision, setModalDivision] = useState('BONGKARAN');
  const [modalUnderName, setModalUnderName] = useState('');
  const [modalVendorId, setModalVendorId] = useState(vendors[0]?.id || '');
  const [modalCategory, setModalCategory] = useState<'REGULAR' | 'ADDITIONAL'>('REGULAR');
  const [modalTime, setModalTime] = useState('');
  const [modalType, setModalType] = useState(INCIDENT_TYPES[0]);
  const [modalNotes, setModalNotes] = useState('');
  const [modalPhotoFile, setModalPhotoFile] = useState<File | null>(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null);

  // State Lightbox Fullscreen Preview Foto
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // State Feedback Salin WhatsApp
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // FILTERING & STATISTIK
  // --------------------------------------------------------------------------
  const filteredIncidents = incidents.filter((item) => {
    if (shiftFilter !== 'ALL' && item.shiftId !== shiftFilter) return false;
    return true;
  });

  const totalTumbang = filteredIncidents.length;
  const totalRegular = filteredIncidents.filter((i) => i.category === 'REGULAR').length;
  const totalAdditional = filteredIncidents.filter((i) => i.category === 'ADDITIONAL').length;

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenAddModal = () => {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setModalShiftId(shiftFilter !== 'ALL' ? shiftFilter : (shifts[0]?.id || ''));
    setModalDivision('BONGKARAN');
    setModalUnderName('');
    setModalVendorId(vendors[0]?.id || '');
    setModalCategory('REGULAR');
    setModalTime(currentTimeStr);
    setModalType(INCIDENT_TYPES[0]);
    setModalNotes('');
    setModalPhotoFile(null);
    setModalPhotoPreview(null);
    setIsModalOpen(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kompresi otomatis dengan stempel watermark
    const compressed = await compressImage(file);
    setModalPhotoFile(compressed);
    setModalPhotoPreview(URL.createObjectURL(compressed));
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalShiftId || !modalDivision || !modalUnderName.trim() || !modalPhotoFile) {
      alert('Harap lengkapi shift, divisi, nama under, dan WAJIB lampirkan foto bukti surat klinik/medis.');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedVendor = vendors.find((v) => v.id === modalVendorId);

      const fd = new FormData();
      fd.append('date', selectedDate);
      fd.append('shiftId', modalShiftId);
      fd.append('division', modalDivision);
      fd.append('underName', modalUnderName.trim());
      if (modalVendorId) fd.append('vendorId', modalVendorId);
      if (selectedVendor) fd.append('vendorName', selectedVendor.name);
      fd.append('category', modalCategory);
      fd.append('time', modalTime || '10:00');
      fd.append('type', modalType);
      if (modalNotes.trim()) fd.append('notes', modalNotes.trim());
      fd.append('photo', modalPhotoFile);

      const res = await createTumbangIncident(fd);
      if (res.success) {
        setIsModalOpen(false);
        onRefresh();
      } else {
        alert(res.error || 'Gagal menyimpan data tumbang.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan insiden tumbang ini?')) return;
    const res = await deleteTumbangIncident(id);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Gagal menghapus insiden.');
    }
  };

  // --------------------------------------------------------------------------
  // GENERATE TEKS FORMAT WHATSAPP LAPORAN KE ATASAN
  // --------------------------------------------------------------------------
  const handleCopyWhatsApp = (item: any) => {
    const divisionObj = DIVISIONS.find((d) => d.key === item.division);
    const divName = divisionObj ? divisionObj.label : item.division;
    const shiftName = item.shift?.name || 'Shift Pagi';

    const text = `*LAPORAN INSIDEN PEKERJA TUMBANG (GUDANG LOGISTIK)*
━━━━━━━━━━━━━━━━━━━━
 *Tanggal:* ${item.date}
 *Jam Keluar:* ${item.time} WIB
 *Shift:* ${shiftName}
 *Divisi Pos:* ${divName}
 *Under Lapangan:* ${item.underName}
 *Vendor Mitra:* ${item.vendorName || '-'} (Pasukan: *${item.category}*)
 *Kendala / Diagnosa:* ${item.type}
 *Kronologi & Penanganan:* ${item.notes || 'Sudah diarahkan ke Posko P3K / Klinik Gudang.'}
━━━━━━━━━━━━━━━━━━━━
_Laporan otomatis via Absensi Manpower Control_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. BANNER INFORMASI & ALUR KERJA */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border-l-4 border-amber-500 p-4 rounded-r-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Tanggal: {selectedDate}</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-2">
              Live Tumbang, Sakit & Kendala Lapangan
            </h2>
            <p className="hidden md:block text-xs text-slate-600 mt-0.5">
              PIC Lapangan mencatat langsung pekerja yang drop fisik atau izin saat shift berjalan. Dilengkapi 1-klik format laporan WhatsApp ke Atasan.
            </p>
          </div>

          {/* Tombol Tambah Insiden Baru */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Lapor Pekerja Tumbang</span>
          </button>
        </div>
      </div>

      {/* 2. RINGKASAN STATISTIK & TOOLBAR FILTER (3 KOLOM KOMPAK DI HP) */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-4">
        {/* Total Insiden */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 shadow-xs">
          <span className="text-[10px] md:text-xs font-bold text-slate-500 block uppercase">Total Kasus</span>
          <div className="flex items-baseline gap-1 md:gap-2 mt-1">
            <span className="text-xl md:text-2xl font-black text-slate-900">{totalTumbang}</span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400">Org</span>
          </div>
        </div>

        {/* Regular Tumbang */}
        <div className="bg-white rounded-2xl border border-blue-100 p-3 md:p-4 shadow-xs">
          <span className="text-[10px] md:text-xs font-bold text-blue-600 block uppercase">Regular</span>
          <div className="flex items-baseline gap-1 md:gap-2 mt-1">
            <span className="text-xl md:text-2xl font-black text-blue-700">{totalRegular}</span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400">MP</span>
          </div>
        </div>

        {/* Additional Tumbang */}
        <div className="bg-white rounded-2xl border border-amber-100 p-3 md:p-4 shadow-xs">
          <span className="text-[10px] md:text-xs font-bold text-amber-600 block uppercase">Additional</span>
          <div className="flex items-baseline gap-1 md:gap-2 mt-1">
            <span className="text-xl md:text-2xl font-black text-amber-700">{totalAdditional}</span>
            <span className="text-[10px] md:text-xs font-bold text-slate-400">MP</span>
          </div>
        </div>

        {/* Filter Shift (Di Mobile jadi baris penuh di bawahnya) */}
        <div className="col-span-3 md:col-span-1 bg-white rounded-2xl border border-slate-200 p-2.5 md:p-4 shadow-xs flex flex-col justify-center">
          <span className="text-[10px] md:text-xs font-bold text-slate-500 block uppercase mb-1 md:mb-1.5">Filter Shift:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setShiftFilter('ALL')}
              className={`flex-1 py-1 rounded-lg font-bold text-center transition-all cursor-pointer ${
                shiftFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
            {shifts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setShiftFilter(s.id)}
                className={`flex-1 py-1 rounded-lg font-bold text-center transition-all cursor-pointer ${
                  shiftFilter === s.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {s.name.includes('Pagi') ? 'Pagi' : 'Malam'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. DAFTAR FEED INSIDEN TUMBANG */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Kondisi Lapangan Aman Terkendali</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Belum ada laporan pekerja yang tumbang atau sakit pada tanggal dan shift ini. Jika ada insiden di tengah jam kerja, Under Lapangan dapat langsung klik tombol lapor di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIncidents.map((item) => {
            const isReg = item.category === 'REGULAR';
            const divObj = DIVISIONS.find((d) => d.key === item.division);
            const divLabel = divObj ? divObj.label : item.division;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Header Kartu: Jam & Divisi */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {item.time} WIB
                      </span>
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                        isReg ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.category}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteIncident(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                      title="Hapus laporan ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Info Pos & Under */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-start gap-1.5 text-xs">
                      <span className="font-bold text-slate-500 w-24 shrink-0">Divisi Pos:</span>
                      <span className="font-extrabold text-slate-900">{divLabel}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs">
                      <span className="font-bold text-slate-500 w-24 shrink-0">Under Pelapor:</span>
                      <span className="font-extrabold text-indigo-700">{item.underName}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs">
                      <span className="font-bold text-slate-500 w-24 shrink-0">Vendor Asal:</span>
                      <span className="font-extrabold text-slate-800">{item.vendorName || '-'}</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs">
                      <span className="font-bold text-slate-500 w-24 shrink-0">Diagnosa:</span>
                      <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        {item.type}
                      </span>
                    </div>
                  </div>

                  {/* Catatan Kronologi */}
                  {item.notes && (
                    <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 border border-slate-200 mb-3">
                      <span className="font-bold text-slate-700 block mb-0.5">Kronologi / Penanganan:</span>
                      <p className="italic">{item.notes}</p>
                    </div>
                  )}

                  {/* Foto Bukti Medis */}
                  {item.photoUrl && (
                    <div className="mb-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Bukti Surat / Foto Medis:</span>
                      <div 
                        onClick={() => setLightboxPhoto({ url: item.photoUrl, title: `Bukti Tumbang: ${item.underName} (${item.time} WIB)` })}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 cursor-pointer h-32 bg-slate-100"
                      >
                        <img 
                          src={item.photoUrl} 
                          alt="Bukti Medis" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <ZoomIn className="w-4 h-4" />
                          <span>Perbesar Foto</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tombol Salin Laporan WhatsApp */}
                <button
                  type="button"
                  onClick={() => handleCopyWhatsApp(item)}
                  className={`w-full py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    copiedId === item.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                  }`}
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Format WA Tersalin! Siap Paste</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-emerald-700" />
                      <span>📋 Salin Format WhatsApp ke Atasan</span>
                    </>
                  )}
                </button>

              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL FORM TAMBAH INSIDEN TUMBANG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-extrabold text-sm">Lapor Pekerja Tumbang / Kendala</h3>
                  <p className="text-[11px] text-amber-100">Dicatat real-time saat shift berjalan oleh Under Lapangan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Isi Form (Scrollable) */}
            <form onSubmit={handleSaveIncident} className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Pilihan Shift */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Shift Kerja</label>
                <div className="grid grid-cols-2 gap-2">
                  {shifts.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setModalShiftId(s.id)}
                      className={`py-2 px-3 rounded-xl border-2 font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        modalShiftId === s.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {s.name.includes('Pagi') ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      <span>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pilihan Divisi Pos Kerja */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Divisi Pos Kerja</label>
                <select
                  value={modalDivision}
                  onChange={(e) => setModalDivision(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {DIVISIONS.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Nama Under & Jam Keluar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nama Under Pelapor *</label>
                  <input
                    type="text"
                    required
                    value={modalUnderName}
                    onChange={(e) => setModalUnderName(e.target.value)}
                    placeholder="Misal: Under Budi"
                    className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Jam Keluar / Izin *</label>
                  <input
                    type="text"
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    placeholder="00:00"
                    className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Asal Vendor & Kategori Pasukan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Asal Vendor Pekerja</label>
                  <select
                    value={modalVendorId}
                    onChange={(e) => setModalVendorId(e.target.value)}
                    className="w-full border-2 border-slate-300 bg-white rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Kategori Pasukan</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModalCategory('REGULAR')}
                      className={`py-2 rounded-xl font-bold border-2 text-center cursor-pointer ${
                        modalCategory === 'REGULAR'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalCategory('ADDITIONAL')}
                      className={`py-2 rounded-xl font-bold border-2 text-center cursor-pointer ${
                        modalCategory === 'ADDITIONAL'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Additional
                    </button>
                  </div>
                </div>
              </div>

              {/* Diagnosa / Jenis Kendala */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Jenis Kendala / Diagnosa</label>
                <select
                  value={modalType}
                  onChange={(e) => setModalType(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Catatan Kronologi */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Kronologi & Penanganan Medis</label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Misal: Kram otot saat bongkar kontainer, sudah diantar ke klinik P3K dock 2..."
                  className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Upload Foto Bukti Medis (WAJIB) */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Foto Surat Rujukan Klinik / Bukti Medis (WAJIB) *
                </label>
                
                {modalPhotoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300 h-40 bg-slate-100">
                    <img src={modalPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setModalPhotoFile(null); setModalPhotoPreview(null); }}
                      className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full shadow-md cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl cursor-pointer bg-slate-50/60 hover:bg-amber-50/40 transition-colors">
                    <Camera className="w-8 h-8 text-amber-500 mb-1" />
                    <span className="font-extrabold text-slate-700 text-xs">Jepret / Unggah Foto Bukti</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Otomatis ditempel stempel tanggal & jam</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Tombol Simpan */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !modalPhotoFile || !modalUnderName.trim()}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Insiden Tumbang</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 5. LIGHTBOX PREVIEW FOTO FULLSCREEN */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full text-white mb-2">
              <span className="text-xs font-bold">{lightboxPhoto.title}</span>
              <button 
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="text-white hover:text-rose-400 p-1 cursor-pointer font-extrabold text-lg"
              >
                ✕ Tutup
              </button>
            </div>
            <img 
              src={lightboxPhoto.url} 
              alt="Bukti Medis" 
              className="max-h-[82vh] w-auto rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

    </div>
  );
}

