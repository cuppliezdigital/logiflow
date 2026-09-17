import { createClient } from '@supabase/supabase-js';

// Membaca konfigurasi Supabase dari environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Utamakan Service Role Key untuk bypass RLS di sisi server, atau fallback ke Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Memeriksa apakah kredensial Supabase sudah terisi di environment
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * Instance Supabase Client untuk backend/server
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

/**
 * Fungsi pembantu untuk mengunggah file foto ke Supabase Storage (Bucket: logiflow-uploads).
 * Mengembalikan URL publik HTTPS yang permanen dan dapat diakses dari mana saja.
 */
export async function uploadToSupabaseStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType = 'image/jpeg',
  bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'absensi-uploads'
): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('Peringatan: Gagal upload ke Supabase Storage:', error.message);
      return null;
    }

    // Ambil URL publik langsung dari bucket publik Supabase
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error saat menghubungi Supabase Storage:', err);
    return null;
  }
}

