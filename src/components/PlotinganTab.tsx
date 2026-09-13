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
  CheckCircle2
} from 'lucide-react';
import { createPlotingan, updatePlotingan, deletePlotingan } from '@/app/actions';
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
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Mengatur visibilitas modal dialog tambah/edit plotingan
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Mengatur visibilitas modal kelola vendor mitra
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // Menyimpan data plotingan yang sedang diedit (null jika mode tambah baru)
  const [editingItem, setEditingItem] = useState<any>(null);
  // Indikator loading saat form sedang dikirim ke server
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State untuk input data plotingan terpadu
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  
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
    setVendorId(vendors[0]?.id || '');
    setShiftId(shifts[0]?.id || '');
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

        {/* Total Realisasi Hadir (Hapus kata Apel) */}
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

      {/* 2. HEADER TABEL, TOMBOL KELOLA VENDOR & TOMBOL TAMBAH PLOTINGAN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Daftar Plotingan ({selectedDate})</h2>
          <p className="text-xs text-slate-500">Kebutuhan total Manpower (MP) per vendor. Pembagian Reg & Add ditentukan saat absen masuk di hari H.</p>
        </div>

        <div className="flex items-center gap-2">
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

          {/* Tombol Tambah Plotingan Baru */}
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Plotingan
          </button>
        </div>
      </div>

      {/* 3. TABEL DAFTAR PLOTINGAN (1 Baris per Vendor per Shift) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {plotingans.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">Belum Ada Plotingan di Tanggal Ini</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Silakan klik tombol "Tambah Plotingan" untuk menentukan target kuota regular & additional per vendor.
            </p>
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
                    {vendors.map((v) => (
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
                    {shifts.map((s) => {
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
                <p className="text-[11px] text-slate-500">
                  Total kuota orang yang diminta ke vendor. Pembagian Regular & Additional akan ditentukan saat apel masuk di hari H.
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

    </div>
  );
}