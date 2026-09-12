'use client';

// ============================================================================
// MODAL KELOLA VENDOR (TAMBAH, EDIT, & HAPUS MITRA PENYALUR)
// Komponen ini memungkinkan user untuk mengelola daftar vendor mitra logistik
// secara langsung dari UI web tanpa perlu membuka database manual.
// ============================================================================

import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Phone, 
  User, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { createVendor, updateVendor, deleteVendor } from '@/app/actions';

// Definisi properti input untuk VendorModal
interface VendorModalProps {
  isOpen: boolean;            // Status buka/tutup modal
  onClose: () => void;        // Fungsi menutup modal
  vendors: any[];             // Daftar vendor saat ini
  onVendorsChanged: () => void; // Callback refresh setelah ada vendor ditambah/diedit/dihapus
}

export default function VendorModal({
  isOpen,
  onClose,
  vendors,
  onVendorsChanged,
}: VendorModalProps) {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  // Mode edit vendor (berisi objek vendor jika sedang mengedit, null jika tambah baru)
  const [editingVendor, setEditingVendor] = useState<any>(null);
  
  // State form input vendor
  const [name, setName] = useState('');
  const [picName, setPicName] = useState('');
  const [phone, setPhone] = useState('');

  // Status loading saat request dikirim ke server
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // EVENT HANDLERS
  // --------------------------------------------------------------------------

  // Reset form ke kondisi kosong (siap tambah baru)
  const resetForm = () => {
    setEditingVendor(null);
    setName('');
    setPicName('');
    setPhone('');
    setErrorMessage('');
  };

  // Pilih vendor untuk mulai mode edit
  const handleStartEdit = (v: any) => {
    setEditingVendor(v);
    setName(v.name);
    setPicName(v.picName || '');
    setPhone(v.phone || '');
    setErrorMessage('');
  };

  // Hapus vendor
  const handleDelete = async (id: string, vendorName: string) => {
    if (confirm(`Yakin ingin menghapus vendor "${vendorName}"?`)) {
      setIsSubmitting(true);
      try {
        await deleteVendor(id);
        onVendorsChanged();
        if (editingVendor?.id === id) {
          resetForm();
        }
      } catch (err: any) {
        alert('Gagal menghapus vendor: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Submit form tambah atau update vendor
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Nama vendor wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('picName', picName);
      formData.append('phone', phone);

      if (editingVendor) {
        // Update vendor yang sudah ada
        await updateVendor(editingVendor.id, formData);
      } else {
        // Buat vendor baru
        await createVendor(formData);
      }

      resetForm();
      onVendorsChanged(); // Muat ulang data vendor di parent
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        
        {/* 1. HEADER MODAL */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Kelola Daftar Vendor Mitra</h3>
              <p className="text-xs text-slate-400">Tambah, ubah, atau hapus perusahaan penyedia manpower</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. FORM TAMBAH / EDIT VENDOR */}
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-slate-700">
              {editingVendor ? 'Edit Data Vendor' : 'Tambah Vendor Baru'}
            </span>
            {editingVendor && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                + Batalkan & Buat Baru
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Nama Vendor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Nama Perusahaan / Vendor <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: PT Karya Prima Mandiri"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Nama PIC & Nomor Telepon / WA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nama PIC Vendor (Opsional)
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={picName}
                    onChange={(e) => setPicName(e.target.value)}
                    placeholder="Misal: Pak Hendra"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  No HP / WA PIC (Opsional)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Misal: 081234567890"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorMessage}
              </p>
            )}

            {/* Tombol Simpan */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {editingVendor ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Memperbarui...' : 'Simpan Perubahan Vendor'}
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Menyimpan...' : 'Tambahkan Vendor Ini'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* 3. DAFTAR VENDOR YANG TERDAFTAR */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Vendor Terdaftar ({vendors.length})
          </p>

          {vendors.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Belum ada vendor terdaftar. Silakan tambahkan lewat form di atas.
            </p>
          ) : (
            <div className="space-y-2">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{v.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      PIC: {v.picName || '-'} &bull; No: {v.phone || '-'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(v)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Vendor"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(v.id, v.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Vendor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. FOOTER MODAL */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Selesai / Tutup
          </button>
        </div>

      </div>
    </div>
  );
}

