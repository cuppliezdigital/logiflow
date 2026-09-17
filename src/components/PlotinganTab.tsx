'use client';

// ============================================================================
// KOMPONEN TAB 1: PLOTINGAN TARGET MANPOWER (H-1 PLANNING)
// Fitur Baru:
// 1. Dropdown pilihan vendor dengan warna teks kontras tinggi (jelas terbaca).
// 2. 1 Form langsung mencakup Target Regular & Target Additional sekaligus.
// 3. Pilihan Shift Pagi (☀️) vs Shift Malam (🌙) & Jam Kerja Fleksibel.
// 4. Tabel Daftar Plotingan rapi: 1 baris per vendor per shift.
// ============================================================================

import React, { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Users, 
  Clock, 
  Building2, 
  AlertCircle,
  X,
  Sun,
  Moon,
  Settings,
  Layers,
  TrendingUp,
  CheckCircle2,
  Zap,
  Copy,
  RotateCcw,
  Loader2,
  Sparkles,
  Check
} from 'lucide-react';
import { 
  createPlotingan, 
  updatePlotingan, 
  deletePlotingan,
  saveBatchPlotingan,
  getPlotinganForCopy 
} from '@/app/actions';
import VendorModal from '@/components/VendorModal';

// Definisi properti input untuk komponen PlotinganTab
interface PlotinganTabProps {
  plotingans: any[];            // Daftar data plotingan pada tanggal yang dipilih
  vendors: any[];               // Daftar master vendor aktif untuk opsi dropdown
  shifts: any[];                // Daftar master shift kerja (Pagi & Malam)
  selectedDate: string;         // Tanggal yang sedang aktif dimonitor (YYYY-MM-DD)
  onRefresh: () => void;        // Callback untuk me-refresh data plotingan
  onVendorsChanged?: () => void;// Callback untuk me-refresh daftar vendor saat ada perubahan
}

export default function PlotinganTab({
  plotingans,
  vendors,
  shifts,
  selectedDate,
  onRefresh,
  onVendorsChanged,
}: PlotinganTabProps) {
  // Deduplikasi shifts & vendors agar UI selalu bersih tanpa ganda/dobel
  const uniqueShifts = shifts.filter(
    (s, idx, arr) =>
      idx === arr.findIndex((t) => t.name.toLowerCase().trim() === s.name.toLowerCase().trim())
  );
  const uniqueVendors = vendors.filter(
    (v, idx, arr) =>
      idx === arr.findIndex((t) => t.name.toLowerCase().trim() === v.name.toLowerCase().trim())
  );

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Mengatur visibilitas modal dialog tambah/edit plotingan
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Mengatur visibilitas modal kelola vendor mitra
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // STATE FITUR BARU: Input Plotingan Sekaligus (Batch Massal)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchShiftId, setBatchShiftId] = useState(uniqueShifts[0]?.id || shifts[0]?.id || '');
  const [batchDefaultHours, setBatchDefaultHours] = useState('');
  const [batchRows, setBatchRows] = useState<{
    [vendorId: string]: {
      targetHeadcount: number;
      workingHours: string;
      notes: string;
    };
  }>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Menyimpan data plotingan yang sedang diedit (null jika mode tambah baru)
  const [editingItem, setEditingItem] = useState<any>(null);
  // Indikator loading saat form sedang dikirim ke server
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State untuk input data plotingan terpadu
  const [vendorId, setVendorId] = useState(uniqueVendors[0]?.id || vendors[0]?.id || '');
  const [shiftId, setShiftId] = useState(uniqueShifts[0]?.id || shifts[0]?.id || '');
  
  // Target total kebutuhan Manpower (MP) per vendor
  const [targetHeadcount, setTargetHeadcount] = useState<number>(20);

  const [workingHours, setWorkingHours] = useState(''); // Jam kerja bebas/opsional
  const [notes, setNotes] = useState('');

  // --------------------------------------------------------------------------
  // KALKULASI RINGKASAN DATA
  // --------------------------------------------------------------------------
  const totalTarget = plotingans.reduce((sum, p) => sum + p.targetHeadcount, 0);
  const uniqueVendorsCount = new Set(plotingans.map((p) => p.vendorId)).size;
  const totalMasuk = plotingans.reduce((sum, p) => sum + (p.attendanceIn?.actualHeadcount || 0), 0);
  const overallFulfillment = totalTarget > 0 ? Math.round((totalMasuk / totalTarget) * 100) : 0;

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------
  
  // Buka modal untuk menambah plotingan baru
  const handleOpenAdd = () => {
    setEditingItem(null);
    setVendorId(uniqueVendors[0]?.id || vendors[0]?.id || '');
    setShiftId(uniqueShifts[0]?.id || shifts[0]?.id || '');
    setTargetHeadcount(20);
    setWorkingHours('');
    setNotes('');
    setIsModalOpen(true);
  };

  // Buka modal untuk mengedit plotingan yang sudah ada
  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setVendorId(item.vendorId);
    setShiftId(item.shiftId);
    setTargetHeadcount(item.targetHeadcount);
    setWorkingHours(item.workingHours || '');
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  // Menghapus data plotingan dengan konfirmasi
  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus plotingan ini? Data absensi terkait juga akan terhapus.')) {
      await deletePlotingan(id);
      onRefresh();
    }
  };

  // ============================================================================
  // FUNGSI BARU: INISIALISASI / BUKA MODAL INPUT SEKALIGUS (MASSAL)
  // Menyiapkan baris untuk setiap vendor aktif dengan nilai existing atau default 0
  // ============================================================================
  const handleOpenBatchModal = (targetShiftId?: string) => {
    const activeShiftId = targetShiftId || batchShiftId || shifts[0]?.id || '';
    setBatchShiftId(activeShiftId);
    setCopyFeedback(null);
    setBatchDefaultHours('');

    // Siapkan baris data per vendor aktif
    const initialRows: { [vendorId: string]: { targetHeadcount: number; workingHours: string; notes: string } } = {};
    vendors.forEach((v) => {
      // Cari apakah vendor ini sudah punya plotingan pada tanggal & shift yang dipilih
      const existing = plotingans.find((p) => p.vendorId === v.id && p.shiftId === activeShiftId);
      initialRows[v.id] = {
        targetHeadcount: existing ? existing.targetHeadcount : 0,
        workingHours: existing?.workingHours || '',
        notes: existing?.notes || '',
      };
    });

    setBatchRows(initialRows);
    setIsBatchModalOpen(true);
  };

  // ============================================================================
  // FUNGSI BARU: GANTI SHIFT PADA MODAL INPUT MASSAL
  // ============================================================================
  const handleBatchShiftChange = (newShiftId: string) => {
    setBatchShiftId(newShiftId);
    setCopyFeedback(null);

    const updatedRows: { [vendorId: string]: { targetHeadcount: number; workingHours: string; notes: string } } = {};
    vendors.forEach((v) => {
      const existing = plotingans.find((p) => p.vendorId === v.id && p.shiftId === newShiftId);
      updatedRows[v.id] = {
        targetHeadcount: existing ? existing.targetHeadcount : 0,
        workingHours: existing?.workingHours || '',
        notes: existing?.notes || '',
      };
    });
    setBatchRows(updatedRows);
  };

  // ============================================================================
  // FUNGSI BARU: SALIN PLOTINGAN DARI KEMARIN (H-1)
  // Menarik data kuota vendor dari 1 hari sebelumnya pada shift yang sama.
  // ============================================================================
  const handleCopyFromYesterday = async () => {
    setIsCopying(true);
    setCopyFeedback(null);
    try {
      // Hitung tanggal H-1
      const dateObj = new Date(selectedDate);
      dateObj.setDate(dateObj.getDate() - 1);
      const yesterdayDate = dateObj.toISOString().split('T')[0];

      const res = await getPlotinganForCopy(yesterdayDate, batchShiftId);
      if (!res.success || !res.data || res.data.length === 0) {
        setCopyFeedback({
          type: 'error',
          message: `Tidak ada data plotingan pada kemarin (${yesterdayDate}) untuk shift ini.`,
        });
        return;
      }

      // Terapkan kuota kemarin ke baris form
      const newRows = { ...batchRows };
      let matchedCount = 0;

      res.data.forEach((item: any) => {
        if (newRows[item.vendorId] !== undefined) {
          newRows[item.vendorId] = {
            targetHeadcount: item.targetHeadcount,
            workingHours: item.workingHours || '',
            notes: item.notes || '',
          };
          matchedCount++;
        }
      });

      setBatchRows(newRows);
      setCopyFeedback({
        type: 'success',
        message: `Berhasil menyalin kuota ${matchedCount} vendor dari kemarin (${yesterdayDate})! Cek & sesuaikan jika ada perbedaan angka.`,
      });
    } catch (err: any) {
      setCopyFeedback({
        type: 'error',
        message: 'Gagal mengambil data dari kemarin: ' + err.message,
      });
    } finally {
      setIsCopying(false);
    }
  };

  // ============================================================================
  // FUNGSI: RESET SEMUA TARGET KUOTA KE 0
  // ============================================================================
  const handleResetBatchToZero = () => {
    const resetRows = { ...batchRows };
    Object.keys(resetRows).forEach((id) => {
      resetRows[id] = { ...resetRows[id], targetHeadcount: 0 };
    });
    setBatchRows(resetRows);
  };

  // ============================================================================
  // FUNGSI: ISI CEPAT SEMUA TARGET VENDOR DENGAN ANGKA TERTENTU
  // ============================================================================
  const handleQuickSetAll = (val: number) => {
    const updatedRows = { ...batchRows };
    Object.keys(updatedRows).forEach((id) => {
      updatedRows[id] = { ...updatedRows[id], targetHeadcount: val };
    });
    setBatchRows(updatedRows);
  };

  // ============================================================================
  // FUNGSI: SIMPAN PLOTINGAN MASSAL KE DATABASE
  // ============================================================================
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBatchSubmitting(true);
    try {
      const items = Object.entries(batchRows).map(([vId, data]) => ({
        vendorId: vId,
        targetHeadcount: Number(data.targetHeadcount) || 0,
        workingHours: data.workingHours,
        notes: data.notes,
      }));

      const activeItems = items.filter((item) => item.targetHeadcount > 0);
      if (activeItems.length === 0) {
        alert('Mohon isi target kuota minimal 1 orang pada salah satu vendor.');
        setIsBatchSubmitting(false);
        return;
      }

      const res = await saveBatchPlotingan({
        date: selectedDate,
        shiftId: batchShiftId,
        defaultWorkingHours: batchDefaultHours,
        items,
      });

      if (!res.success) {
        alert(res.error || 'Gagal menyimpan data plotingan massal.');
        return;
      }

      setIsBatchModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data plotingan massal.');
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  // Mengirim data form (create / update) ke Server Actions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', selectedDate);
      formData.append('vendorId', vendorId);
      formData.append('shiftId', shiftId);
      formData.append('targetHeadcount', targetHeadcount.toString());
      formData.append('workingHours', workingHours);
      formData.append('notes', notes);

      if (editingItem) {
        await updatePlotingan(editingItem.id, formData);
      } else {
        const res = await createPlotingan(formData);
        if (res && !res.success) {
          alert(res.error || 'Gagal membuat plotingan.');
          return;
        }
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan plotingan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. KARTU STATISTIK RINGKASAN DI BAGIAN ATAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Target Kebutuhan (MP) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Target Kebutuhan</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalTarget} <span className="text-sm font-semibold text-slate-500">MP</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Vendor Terjadwal */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor Terjadwal</p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              {uniqueVendorsCount} <span className="text-sm font-semibold text-slate-500">Vendor</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Realisasi Hadir Pasukan di Awal Shift */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Realisasi Hadir</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {totalMasuk} <span className="text-sm font-semibold text-slate-500">Orang</span>
              {totalTarget > 0 && (
                <span className="text-xs font-bold ml-2 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {overallFulfillment}%
                </span>
              )}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. HEADER TABEL, TOMBOL KELOLA VENDOR & TOMBOL INPUT SEKALIGUS / SATUAN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Daftar Plotingan ({selectedDate})</h2>
          <p className="text-xs text-slate-500">Kebutuhan total Manpower (MP) per vendor. Pembagian Reg & Add ditentukan saat absen masuk di hari H.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Buka Modal Kelola Vendor */}
          <button
            type="button"
            onClick={() => setIsVendorModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer"
            title="Tambah atau kelola daftar vendor mitra"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            Kelola Vendor
          </button>

          {/* Tombol Tambah Plotingan Satuan */}
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer"
            title="Tambah kuota 1 vendor saja"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            Tambah Satuan
          </button>

          {/* TOMBOL UTAMA: Input Ploting Sekaligus (Massal) */}
          <button
            onClick={() => handleOpenBatchModal()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
            title="Input kuota seluruh vendor sekaligus dalam 1 tabel cepat"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            Input Sekaligus (Massal)
          </button>
        </div>
      </div>

      {/* 3. TABEL DAFTAR PLOTINGAN (1 Baris per Vendor per Shift) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {plotingans.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">Belum Ada Plotingan di Tanggal Ini</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Gunakan tombol <b>Input Sekaligus</b> untuk mengisi seluruh kuota vendor dalam 1 layar, atau salin otomatis dari H-1!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              <button
                onClick={() => handleOpenBatchModal()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                Input Ploting Sekaligus
              </button>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                Tambah Satuan
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Vendor</th>
                  <th className="py-3.5 px-4">Shift & Jam Kerja</th>
                  <th className="py-3.5 px-4 text-center">Target Manpower (MP)</th>
                  {/* Hapus kata Fisik, cukup Realisasi Hadir */}
                  <th className="py-3.5 px-4 text-center">Realisasi Hadir</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plotingans.map((p) => {
                  const masuk = p.attendanceIn?.actualHeadcount;
                  const masukReg = p.attendanceIn?.actualRegular ?? 0;
                  const masukAdd = p.attendanceIn?.actualAdditional ?? 0;
                  const fulfillment = masuk !== undefined ? Math.round((masuk / p.targetHeadcount) * 100) : null;
                  const isPagi = p.shift.name.toLowerCase().includes('pagi');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Vendor & Info PIC */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-extrabold text-slate-900">{p.vendor.name}</span>
                        </div>
                        {p.vendor.picName && (
                          <p className="text-xs text-slate-400 mt-0.5 ml-6">PIC: {p.vendor.picName} ({p.vendor.phone || '-'})</p>
                        )}
                      </td>

                      {/* Shift Kerja & Jam Kerja (Teks Jam Fleksibel dibuat tebal & gelap kontras tinggi) */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {isPagi ? (
                            <Sun className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Moon className="w-4 h-4 text-indigo-500" />
                          )}
                          {p.shift.name}
                        </div>
                        {p.workingHours ? (
                          <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-600" />
                            {p.workingHours}
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            Jam Fleksibel
                          </p>
                        )}
                      </td>

                      {/* Kuota Target Manpower (MP) */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-black text-base text-slate-900">
                          {p.targetHeadcount} <span className="text-xs font-semibold text-slate-500">MP</span>
                        </span>
                      </td>

                      {/* Realisasi Kehadiran (Teks Reg & Add dibuat tebal, kontras, dan berwarna jelas) */}
                      <td className="py-4 px-4 text-center">
                        {masuk !== undefined ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-extrabold text-emerald-600 text-sm">
                              {masuk} Org ({fulfillment}%)
                            </span>
                            {/* Rincian Reg & Add Tebal & Jelas */}
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold">
                              <span className="text-blue-700">Reg: {masukReg}</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="text-amber-700">Add: {masukAdd}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-medium">
                            Menunggu Masuk
                          </span>
                        )}
                      </td>

                      {/* Catatan Plotingan */}
                      <td className="py-4 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {p.notes || '-'}
                      </td>

                      {/* Tombol Edit & Hapus */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Plotingan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Plotingan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL FORM: TAMBAH ATAU EDIT PLOTINGAN (TERPADU REG + ADD) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {editingItem ? 'Edit Plotingan' : 'Tambah Plotingan Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Input */}
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tanggal</label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="w-full bg-slate-100 text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold"
                />
              </div>

              {/* Pilihan Vendor (DENGAN WARNA TEKS GELAP KONTRAS TINGGI) */}
              {!editingItem && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">Pilih Vendor</label>
                    <button
                      type="button"
                      onClick={() => setIsVendorModalOpen(true)}
                      className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      + Tambah / Kelola Vendor
                    </button>
                  </div>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full border-2 border-slate-300 bg-white rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
                  >
                    {uniqueVendors.map((v) => (
                      <option 
                        key={v.id} 
                        value={v.id}
                        className="text-slate-900 bg-white font-bold py-1.5"
                      >
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pilihan Shift: Shift Pagi (☀️) vs Shift Malam (🌙) */}
              {!editingItem && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pilih Shift Kerja</label>
                  <div className="grid grid-cols-2 gap-3">
                    {uniqueShifts.map((s) => {
                      const isPagi = s.name.toLowerCase().includes('pagi');
                      const isSelected = shiftId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setShiftId(s.id)}
                          className={`py-2.5 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? isPagi
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isPagi ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Input Jam Kerja Bebas / Fleksibel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Jam Kerja (Opsional / Bebas)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="Misal: 07:00 - 15:30 atau Fleksibel"
                    className="w-full border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* TARGET KEBUTUHAN MANPOWER (MP) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Target Kebutuhan Manpower (MP)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetHeadcount}
                  onChange={(e) => setTargetHeadcount(parseInt(e.target.value) || 0)}
                  placeholder="Contoh: 20"
                  className="w-full border-2 border-blue-300 bg-white rounded-xl px-4 py-2.5 text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Catatan: Keterangan pembagian kuota saat proses absen masuk */}
                <p className="text-[11px] text-slate-500">
                  Total kuota orang yang diminta ke vendor. Pembagian Regular & Additional akan ditentukan saat absen masuk di hari H.
                </p>
              </div>

              {/* Catatan Opsional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Catatan (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: 10 orang additional khusus area unloading..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Plotingan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL KELOLA VENDOR */}
      <VendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        vendors={vendors}
        onVendorsChanged={() => {
          if (onVendorsChanged) onVendorsChanged();
          onRefresh();
        }}
      />

      {/* ==================================================================== */}
      {/* 6. MODAL DIALOG: INPUT PLOTINGAN SEKALIGUS (BATCH MASSAL)           */}
      {/* Memungkinkan pengisian target kuota semua vendor dalam 1 layar cepat*/}
      {/* dilengkapi fitur pintar Salin dari Kemarin (H-1) & live kalkulator. */}
      {/* ==================================================================== */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 overflow-hidden">
            
            {/* Header Modal Batch */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                    Input Plotingan Sekaligus (Massal)
                    <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                      {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Isi target manpower seluruh vendor dalam 1 tabel cepat tanpa repot buka-tutup modal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header Kontrol: Pilih Shift & Shortcut Salin H-1 */}
            <div className="p-4 bg-slate-50/90 border-b border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Switcher Pilihan Shift Kerja */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">Pilih Shift:</span>
                  <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
                    {uniqueShifts.map((s) => {
                      const isPagi = s.name.toLowerCase().includes('pagi');
                      const isSelected = batchShiftId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleBatchShiftChange(s.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? isPagi
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {isPagi ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Jam Kerja Default Otomatis (Opsional) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase whitespace-nowrap">Jam Default:</span>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={batchDefaultHours}
                      onChange={(e) => setBatchDefaultHours(e.target.value)}
                      placeholder="07:00 - 15:30 (Opsional)"
                      className="text-xs font-semibold pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg w-44 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Toolbar Aksi Cepat: Salin dari Kemarin & Preset Angka */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                <div className="flex items-center gap-2">
                  {/* Tombol Cerdas: Salin dari Kemarin (H-1) */}
                  <button
                    type="button"
                    onClick={handleCopyFromYesterday}
                    disabled={isCopying}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-300 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Otomatis menyalin kuota dari shift kemarin"
                  >
                    {isCopying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {isCopying ? 'Menyalin data H-1...' : '📋 Salin dari Kemarin (H-1)'}
                  </button>

                  <span className="text-xs text-slate-400">|</span>

                  {/* Isi Cepat Preset */}
                  <button
                    type="button"
                    onClick={() => handleQuickSetAll(20)}
                    className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    title="Set semua vendor ke 20 MP"
                  >
                    Set Semua 20 MP
                  </button>

                  <button
                    type="button"
                    onClick={handleResetBatchToZero}
                    className="text-xs font-semibold text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    title="Reset semua target ke 0"
                  >
                    Reset ke 0
                  </button>
                </div>

                <div className="text-[11px] font-semibold text-slate-500">
                  Tekan <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-mono text-[10px]">Tab</kbd> untuk berpindah cepat ke vendor berikutnya
                </div>
              </div>

              {/* Feedback Banner Hasil Salin Kemarin */}
              {copyFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                    copyFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {copyFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{copyFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCopyFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs ml-2 cursor-pointer font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Form Tabel Grid Seluruh Vendor (Scrollable) */}
            <form onSubmit={handleSubmitBatch} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto overflow-x-auto p-4">
                <table className="w-full text-left text-sm text-slate-600 border-collapse">
                  <thead className="bg-slate-100/90 text-xs font-bold text-slate-700 uppercase sticky top-0 z-10 border-b border-slate-200 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-4">Nama Vendor</th>
                      <th className="py-2.5 px-4 text-center w-48">Target Manpower (MP)</th>
                      <th className="py-2.5 px-4 w-52">Jam Kerja (Opsional)</th>
                      <th className="py-2.5 px-4">Catatan Khusus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {uniqueVendors.map((v, idx) => {
                      const rowData = batchRows[v.id] || { targetHeadcount: 0, workingHours: '', notes: '' };
                      const isFilled = Number(rowData.targetHeadcount) > 0;
                      const hasExisting = plotingans.some((p) => p.vendorId === v.id && p.shiftId === batchShiftId);

                      return (
                        <tr
                          key={v.id}
                          className={`transition-colors ${
                            isFilled
                              ? 'bg-blue-50/40 hover:bg-blue-50/70'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Nomor Urut */}
                          <td className="py-3 px-3 text-center text-xs font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Nama Vendor & Info PIC */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className={`w-4 h-4 ${isFilled ? 'text-blue-600' : 'text-slate-400'}`} />
                              <div>
                                <span className={`font-extrabold ${isFilled ? 'text-blue-950' : 'text-slate-900'}`}>
                                  {v.name}
                                </span>
                                {v.picName && (
                                  <span className="text-[11px] text-slate-400 block">
                                    PIC: {v.picName} {v.phone ? `(${v.phone})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasExisting && (
                              <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded mt-0.5">
                                Sudah terploting sebelumnya
                              </span>
                            )}
                          </td>

                          {/* Input Target MP (Keyboard friendly: Tab / Enter, dengan tombol +/-) */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  const currentVal = Number(rowData.targetHeadcount) || 0;
                                  const nextVal = Math.max(0, currentVal - 1);
                                  setBatchRows({
                                    ...batchRows,
                                    [v.id]: { ...rowData, targetHeadcount: nextVal },
                                  });
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
                              >
                                -
                              </button>
                              
                              <input
                                type="number"
                                min="0"
                                value={rowData.targetHeadcount === 0 ? '' : rowData.targetHeadcount}
                                placeholder="0"
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  setBatchRows({
                                    ...batchRows,
                                    [v.id]: {
                                      ...rowData,
                                      targetHeadcount: isNaN(parsed) ? 0 : Math.max(0, parsed),
                                    },
                                  });
                                }}
                                className={`w-20 text-center font-black text-lg py-1 px-2 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isFilled
                                    ? 'border-blue-500 bg-white text-blue-900 shadow-xs'
                                    : 'border-slate-300 bg-white text-slate-800'
                                }`}
                              />

                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  const currentVal = Number(rowData.targetHeadcount) || 0;
                                  const nextVal = currentVal + 1;
                                  setBatchRows({
                                    ...batchRows,
                                    [v.id]: { ...rowData, targetHeadcount: nextVal },
                                  });
                                }}
                                className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-base flex items-center justify-center cursor-pointer transition-colors border border-blue-200"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Jam Kerja Khusus (Opsional) */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={rowData.workingHours}
                              placeholder={batchDefaultHours ? `Default: ${batchDefaultHours}` : 'Fleksibel'}
                              onChange={(e) => {
                                setBatchRows({
                                  ...batchRows,
                                  [v.id]: { ...rowData, workingHours: e.target.value },
                                });
                              }}
                              className="w-full text-xs font-medium px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                          </td>

                          {/* Catatan Tambahan */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={rowData.notes}
                              placeholder="Catatan khusus vendor..."
                              onChange={(e) => {
                                setBatchRows({
                                  ...batchRows,
                                  [v.id]: { ...rowData, notes: e.target.value },
                                });
                              }}
                              className="w-full text-xs font-medium px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Sticky Modal Batch: Live Total & Tombol Simpan */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Total Ringkasan MP Terisi */}
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Vendor Terisi</span>
                    <span className="text-base font-extrabold text-slate-800">
                      {Object.values(batchRows).filter((r) => Number(r.targetHeadcount) > 0).length} / {vendors.length} Vendor
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Total Target Manpower</span>
                    <span className="text-xl font-black text-blue-700">
                      {Object.values(batchRows).reduce((sum, r) => sum + (Number(r.targetHeadcount) || 0), 0)}{' '}
                      <span className="text-xs font-bold text-slate-500">MP</span>
                    </span>
                  </div>
                </div>

                {/* Tombol Batal & Simpan Semua */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isBatchSubmitting}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isBatchSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menyimpan Semua...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        Simpan Semua Plotingan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}