// ============================================================================
// DATA SEEDER AWAL LOGIFLOW
// Menyiapkan data default untuk:
// 1. Shift Kerja: Cuma 2 Shift ("Shift Pagi" dan "Shift Malam")
// 2. Vendor Mitra Awal
// 3. Contoh Plotingan Hari Ini
// ============================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Menyiapkan data operasional logistik...');

  // 1. SHIFT KERJA (Hanya Pagi dan Malam, jam kerja fleksibel)
  const shifts = [
    { name: 'Shift Pagi' },
    { name: 'Shift Malam' },
  ];

  for (const s of shifts) {
    const existing = await prisma.shift.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.shift.create({ data: s });
      console.log(`+ Berhasil membuat shift: ${s.name}`);
    }
  }

  // 2. VENDOR MITRA AWAL
  const vendors = [
    { name: 'PT Sumber Makmur Mandiri', picName: 'Joko Susanto', phone: '081234567890' },
    { name: 'PT Cipta Karya Logistik', picName: 'Dewi Lestari', phone: '081987654321' },
    { name: 'PT Garda Mandiri Outsource', picName: 'Bambang Irawan', phone: '085678901234' },
  ];

  for (const v of vendors) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (!existing) {
      await prisma.vendor.create({ data: v });
      console.log(`+ Berhasil mendaftarkan vendor: ${v.name}`);
    }
  }

  console.log('Seeding data selesai dengan sukses!');
}

main()
  .catch((e) => {
    console.error('Terjadi error saat seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });