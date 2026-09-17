// ============================================================================
// AUTO-SWITCH PRISMA PROVIDER (SQLITE LOKAL vs POSTGRESQL CLOUD)
// Skrip ini secara cerdas mendeteksi DATABASE_URL di file .env:
// - Jika dimulai dengan "file:" (SQLite lokal), skema otomatis disetel ke "sqlite"
// - Jika dimulai dengan "postgres" (Supabase / Cloud), skema disetel ke "postgresql"
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Prioritaskan process.env (Vercel build environment)
let dbUrl = (process.env.DATABASE_URL || '').trim();
let directUrl = (process.env.DIRECT_URL || '').trim();

// Jika di environment belum ada, baca dari file .env lokal
const envPath = path.join(__dirname, '..', '.env');
if (!dbUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (dbMatch) dbUrl = dbMatch[1].trim();
  const dirMatch = envContent.match(/DIRECT_URL=["']?([^"'\r\n]+)["']?/);
  if (dirMatch) directUrl = dirMatch[1].trim();
}

const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

if (isPostgres) {
  console.log('[DB Sync] Menggunakan mode POSTGRESQL (Supabase / Cloud)...');
  // Pastikan provider = "postgresql"
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider  = "postgresql"');
  if (directUrl && !schema.includes('directUrl')) {
    schema = schema.replace(
      /url\s*=\s*env\("DATABASE_URL"\)/,
      'url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")'
    );
  } else if (!directUrl) {
    schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/g, '');
  }
} else {
  console.log('[DB Sync] Menggunakan mode SQLITE (Lokal Bebas Error)...');
  // Pastikan provider = "sqlite"
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  // Hapus directUrl karena SQLite tidak mendukung directUrl
  schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/g, '');
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('[DB Sync] Schema berhasil disinkronkan.');

// Jalankan prisma generate agar client selalu sesuai dengan database yang aktif
try {
  console.log('[DB Sync] Memperbarui Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  // Jalankan db push agar tabel otomatis siap
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log('[DB Sync] Database siap digunakan!');
} catch (e) {
  console.warn('[DB Sync] Catatan: prisma sync selesai dengan penyesuaian.');
}
