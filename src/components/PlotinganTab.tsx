'use client';

// ============================================================================
// KOMPONEN TAB 1: PLOTINGAN TARGET MANPOWER (H-1 PLANNING)
// Fitur:
// 1. Kartu Ringkasan Kebutuhan Total, Regular, & Additional
// 2. Tombol "+ Kelola Vendor" untuk Menambah/Mengubah Mitra Langsung dari UI
// 3. Pilihan Shift Kerja Sederhana: Shift Pagi (☀️) vs Shift Malam (🌙)
// 4. Input Jam Kerja Fleksibel / Bebas (Opsional)
// 5. Tabel Daftar Plotingan & Modal Tambah / Edit
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
  Settings
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

  // Form State untuk input data plotingan
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  const [status, setStatus] = useState('REGULAR'); // REGULAR atau ADDITIONAL
  const [targetHeadcount, setTargetHeadcount] = useState(20);
  const [workingHours, setWorkingHours] = useState(''); // Jam kerja bebas/opsional
  const [notes, setNotes] = useState('');

  // --------------------------------------------------------------------------
  // KALKULASI RINGKASAN DATA
  // --------------------------------------------------------------------------
  // Total keseluruhan orang yang dibutuhkan pada tanggal ini
  const totalTarget = plotingans.reduce((sum, p) => sum + p.targetHeadcount, 0);
  // Total kebutuhan kuota reguler (rutin harian)
  const totalReg = plotingans.filter(p => p.status === 'REGULAR').reduce((sum, p) => sum + p.targetHeadcount, 0);
  // Total kebutuhan kuota additional (tambahan lembur/peak day)
  const totalAdd = plotingans.filter(p => p.status === 'ADDITIONAL').reduce((sum, p) => sum + p.targetHeadcount, 0);

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------
  
  // Buka modal untuk menambah plotingan baru
  const handleOpenAdd = () => {
    setEditingItem(null);
    setVendorId(vendors[0]?.id || '');
    setShiftId(shifts[0]?.id || '');
    setStatus('REGULAR');
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
    setStatus(item.status);
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
      formData.append('status', status);
      formData.append('targetHeadcount', targetHeadcount.toString());
      formData.append('workingHours', workingHours);
      formData.append('notes', notes);

      if (editingItem) {
        await updatePlotingan(editingItem.id, formData);
      } else {
        await createPlotingan(formData);
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
        {/* Total Target Kebutuhan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Target Kebutuhan</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalTarget} <span className="text-sm font-semibold text-slate-500">Orang</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Target Kuota Reguler */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Regular (Reg)</p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              {totalReg} <span className="text-sm font-semibold text-slate-500">Orang</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            REG
          </div>
        </div>

        {/* Target Kuota Additional */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Additional (Add)</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {totalAdd} <span className="text-sm font-semibold text-slate-500">Orang</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
            ADD
          </div>
        </div>
      </div>

      {/* 2. HEADER TABEL, TOMBOL KELOLA VENDOR & TOMBOL TAMBAH PLOTINGAN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Daftar Plotingan ({selectedDate})</h2>
          <p className="text-xs text-slate-500">Target kebutuhan orang yang diset untuk vendor pada tanggal ini.</p>
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

      {/* 3. TABEL DAFTAR PLOTINGAN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {plotingans.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">Belum Ada Plotingan di Tanggal Ini</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Silakan klik tombol "Tambah Plotingan" untuk menentukan target jumlah orang untuk shift dan vendor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Vendor</th>
                  <th className="py-3.5 px-4">Shift & Jam Kerja</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Target</th>
                  <th className="py-3.5 px-4 text-center">Realisasi Hadir</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plotingans.map((p) => {
                  const masuk = p.attendanceIn?.actualHeadcount;
                  const fulfillment = masuk !== undefined ? Math.round((masuk / p.targetHeadcount) * 100) : null;
                  const isPagi = p.shift.name.toLowerCase().includes('pagi');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Nama Vendor & Info PIC */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-900">{p.vendor.name}</span>
                        </div>
                        {p.vendor.picName && (
                          <p className="text-xs text-slate-400 mt-0.5 ml-6">PIC: {p.vendor.picName} ({p.vendor.phone || '-'})</p>
                        )}
                      </td>

                      {/* Shift Kerja (Pagi / Malam) & Jam Kerja Fleksibel */}
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
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {p.workingHours}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5 italic">Jam Fleksibel</p>
                        )}
                      </td>

                      {/* Status Kuota: Regular vs Additional */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${
                            p.status === 'REGULAR'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {p.status === 'REGULAR' ? 'Regular' : 'Additional'}
                        </span>
                      </td>

                      {/* Target Headcount yang Diminta */}
                      <td className="py-4 px-4 text-center font-extrabold text-base text-slate-900">
                        {p.targetHeadcount}
                      </td>

                      {/* Realisasi Kehadiran Fisik (Absen Masuk) */}
                      <td className="py-4 px-4 text-center">
                        {masuk !== undefined ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-emerald-600 text-sm">
                              {masuk} Org ({fulfillment}%)
                            </span>
                            <span className="text-[10px] text-slate-400">Tercatat Masuk</span>
                          </div>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">
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

      {/* 4. MODAL FORM: TAMBAH ATAU EDIT PLOTINGAN */}
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
              {/* Tanggal (Read-only sesuai tanggal aktif) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tanggal</label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium"
                />
              </div>

              {/* Pilihan Vendor & Tombol Cepat Tambah Vendor */}
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
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
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
                          className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
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

              {/* Input Jam Kerja Bebas / Fleksibel (Opsional) */}
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
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Boleh dikosongkan jika jam kerja tidak tentu.
                </span>
              </div>

              {/* Pemilih Tipe Status (Regular vs Additional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status Tenaga Kerja</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('REGULAR')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      status === 'REGULAR'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Regular (Reg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('ADDITIONAL')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      status === 'ADDITIONAL'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Additional (Add)
                  </button>
                </div>
              </div>

              {/* Target Headcount (Jumlah Orang) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Jumlah Plotingan (Target Orang)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetHeadcount}
                  onChange={(e) => setTargetHeadcount(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Catatan Opsional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Catatan (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Tambahan tim sortation inbound..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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