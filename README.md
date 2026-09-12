This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
# LOGIFLOW - Sistem Monitoring & Integritas Manpower Logistik

## Getting Started
LogiFlow adalah sistem monitoring kehadiran, pemenuhan kuota (*fulfillment*), dan audit integritas tenaga kerja harian vendor penyedia tenaga kerja di operasional gudang/logistik.

First, run the development server:
---

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
## 🌟 Fitur Utama

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
1. **FASE 1: Plotingan (Target Headcount H-1)**
   - Menentukan kuota kebutuhan manpower per vendor & per shift (Shift Pagi & Shift Malam).
   - Klasifikasi kuota: **Regular (Reg)** vs **Additional (Add)**.
   - Jam kerja fleksibel / bebas diketik sesuai kebutuhan operasional.
   - Fitur **Kelola Vendor** langsung dari antarmuka web (Tambah, Edit, Hapus).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.
2. **FASE 2: Absen Masuk & Serah Terima Pasukan (Apel Pagi)**
   - Pencatatan orang fisik yang hadir di barisan apel awal shift.
   - Upload / jepret foto barisan apel langsung dari kamera HP atau galeri.
   - Penghitungan otomatis persentase *fulfillment* awal terhadap target.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
3. **FASE 3: Absen Pulang, Tumbang & Audit Integritas**
   - Pencatatan orang yang pulang utuh selesai shift.
   - Pencatatan tenaga kerja yang tumbang (sakit/cedera) + catatan medis & foto bukti penanganan klinik P3K.
   - Upload foto apel checkout kepulangan.
   - **Audit Integritas Otomatis:** Rumus `Masuk = Pulang Utuh + Tumbang`. Jika kurang, otomatis terdata sebagai pekerja kabur/selisih.

## Learn More
4. **FASE 4: Laporan KPI & Validasi Invoice Excel**
   - Ringkasan KPI: Total Target, Aktual Masuk (% Fulfillment), Pulang Utuh (% Retention), Total Tumbang, dan Total Selisih.
   - Filter rentang tanggal (*start date* s.d. *end date*) dan filter vendor.
   - **Download Rekap Excel (.xlsx)** otomatis untuk keperluan validasi tagihan/invoice vendor.

To learn more about Next.js, take a look at the following resources:
---

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
## 🚀 Tech Stack

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
- **Framework:** Next.js (App Router) + TypeScript
- **Styling & UI:** Tailwind CSS + Lucide React Icons
- **Database & ORM:** SQLite (`dev.db`) + Prisma ORM
- **Export Laporan:** Library `xlsx`

## Deploy on Vercel
---

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
## 💻 Cara Menjalankan Project

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
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
