# LOGIFLOW - Sistem Monitoring & Integritas Manpower Logistik

LogiFlow adalah sistem monitoring kehadiran, pemenuhan kuota (*fulfillment*), dan audit integritas tenaga kerja harian vendor penyedia tenaga kerja di operasional gudang/logistik.

---

## 🌟 Fitur Utama

1. **FASE 1: Plotingan (Target Headcount H-1)**
   - Menentukan kuota kebutuhan manpower per vendor & per shift (Shift Pagi & Shift Malam).
   - Klasifikasi kuota: **Regular (Reg)** vs **Additional (Add)**.
   - Jam kerja fleksibel / bebas diketik sesuai kebutuhan operasional.
   - Fitur **Kelola Vendor** langsung dari antarmuka web (Tambah, Edit, Hapus).

2. **FASE 2: Absen Masuk & Serah Terima Pasukan (Apel Pagi)**
   - Pencatatan orang fisik yang hadir di barisan apel awal shift.
   - Upload / jepret foto barisan apel langsung dari kamera HP atau galeri.
   - Penghitungan otomatis persentase *fulfillment* awal terhadap target.

3. **FASE 3: Absen Pulang, Tumbang & Audit Integritas**
   - Pencatatan orang yang pulang utuh selesai shift.
   - Pencatatan tenaga kerja yang tumbang (sakit/cedera) + catatan medis & foto bukti penanganan klinik P3K.
   - Upload foto apel checkout kepulangan.
   - **Audit Integritas Otomatis:** Rumus `Masuk = Pulang Utuh + Tumbang`. Jika kurang, otomatis terdata sebagai pekerja kabur/selisih.

4. **FASE 4: Laporan KPI & Validasi Invoice Excel**
   - Ringkasan KPI: Total Target, Aktual Masuk (% Fulfillment), Pulang Utuh (% Retention), Total Tumbang, dan Total Selisih.
   - Filter rentang tanggal (*start date* s.d. *end date*) dan filter vendor.
   - **Download Rekap Excel (.xlsx)** otomatis untuk keperluan validasi tagihan/invoice vendor.

---

## 🚀 Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling & UI:** Tailwind CSS + Lucide React Icons
- **Database & ORM:** SQLite (`dev.db`) + Prisma ORM
- **Export Laporan:** Library `xlsx`

---

## 💻 Cara Menjalankan Project

1. **Clone repository:**
   ```bash
   git clone <URL_REPO_GITHUB>
   cd logiflow
   ```

2. **Install dependensi:**
   ```bash
   npm install
   ```

3. **Setup environment & database:**
   ```bash
   cp .env.example .env
   npx prisma generate
   npx prisma db push
   node prisma/seed.js
   ```

4. **Jalankan development server:**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser.
