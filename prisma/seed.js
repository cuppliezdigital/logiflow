// ============================================================================
// DATA SEEDER AWAL LOGIFLOW
// Menyiapkan data default untuk:
// 1. Shift Kerja: Cuma 2 Shift ("Shift Pagi" dan "Shift Malam")
// 2. 10 Vendor Mitra Utama Logistik
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

  // 2. 10 VENDOR MITRA RESMI LOGIFLOW
  const vendors = [
    { name: 'PT Maximus Integrasi Indonesia' },
    { name: 'PT Sahabat Dua Muda' },
    { name: 'PT BAL Logistik Internasional' },
    { name: 'PT Esa Gemilang Sakti' },
    { name: 'PT Dollar Information' },
    { name: 'PT Majapahit Solusi Bersama' },
    { name: 'PT Karya Megah Intemusa' },
    { name: 'PT Solusi Mitra Pertama' },
    { name: 'PT Dwi Rajendra Samudra' },
    { name: 'PT Dewi Buana Mulia' },
  ];

  for (const v of vendors) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (!existing) {
      await prisma.vendor.create({
        data: {
          name: v.name,
          status: 'ACTIVE',
        },
      });
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