/**
 * Modul Kompresi Gambar & Injeksi Stempel Tanggal (Timestamp Watermark)
 * Mengoptimalkan foto berukuran besar (misal 5MB - 15MB dari kamera HP) menjadi ~200KB - 400KB
 * sekaligus mencap stempel tanggal & waktu permanen (anti-manipulasi) untuk bukti audit presensi.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  addTimestamp?: boolean; // Default: true (otomatis mencap stempel tanggal)
  includeTime?: boolean;  // Default: true (menampilkan jam & menit/detik WIB)
  customDate?: Date;
}

/**
 * Fungsi pembantu untuk menggambar kotak bersudut tumpul (rounded rectangle) di Canvas.
 * Memiliki mekanisme fallback agar tetap berjalan di browser mobile versi lama.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

/**
 * Kompresi gambar di sisi klien + Otomatis Injeksi Stempel Tanggal di pojok foto.
 * Kompatibel dengan pemanggilan lama: compressImage(file, maxWidth, maxHeight, quality)
 * maupun pemanggilan opsi objek: compressImage(file, { maxWidth, quality, addTimestamp })
 */
export async function compressImage(
  file: File,
  maxWidthOrOptions?: number | CompressImageOptions,
  maxHeightParam = 1600,
  qualityParam = 0.82
): Promise<File> {
  // Hanya proses jika file bertipe gambar
  if (!file.type.startsWith('image/')) return file;

  // Parsing parameter agar tetap kompatibel ke belakang
  let maxWidth = 1600;
  let maxHeight = maxHeightParam;
  let quality = qualityParam;
  let addTimestamp = true;
  let includeTime = true;
  let customDate: Date | undefined;

  if (typeof maxWidthOrOptions === 'object' && maxWidthOrOptions !== null) {
    maxWidth = maxWidthOrOptions.maxWidth ?? 1600;
    maxHeight = maxWidthOrOptions.maxHeight ?? 1600;
    quality = maxWidthOrOptions.quality ?? 0.82;
    addTimestamp = maxWidthOrOptions.addTimestamp ?? true;
    includeTime = maxWidthOrOptions.includeTime ?? true;
    customDate = maxWidthOrOptions.customDate;
  } else if (typeof maxWidthOrOptions === 'number') {
    maxWidth = maxWidthOrOptions;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Pertahankan rasio aspek gambar saat melakukan penyesuaian ukuran
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Gambar ulang foto asli ke canvas sesuai dimensi yang dioptimasi
        ctx.drawImage(img, 0, 0, width, height);

        // INJEKSI STEMPEL TANGGAL (TIMESTAMP WATERMARK)
        if (addTimestamp) {
          // Gunakan tanggal file asli atau waktu saat ini
          const targetDate = customDate || (file.lastModified ? new Date(file.lastModified) : new Date());

          const pad = (n: number) => n.toString().padStart(2, '0');
          const day = pad(targetDate.getDate());
          const month = pad(targetDate.getMonth() + 1);
          const year = targetDate.getFullYear();
          const hours = pad(targetDate.getHours());
          const minutes = pad(targetDate.getMinutes());
          const seconds = pad(targetDate.getSeconds());

          // Susun teks stempel tanggal & waktu presisi
          const dateText = includeTime
            ? `${day}/${month}/${year} • ${hours}:${minutes}:${seconds} WIB`
            : `${day}/${month}/${year}`;

          // Hitung ukuran font proporsional berdasarkan resolusi foto
          const fontSize = Math.max(16, Math.round(width * 0.022));
          const paddingX = Math.round(fontSize * 0.7);
          const paddingY = Math.round(fontSize * 0.45);
          const margin = Math.round(fontSize * 0.8);

          ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          const textMetrics = ctx.measureText(dateText);
          const textWidth = textMetrics.width;
          const textHeight = fontSize;

          const badgeWidth = textWidth + paddingX * 2;
          const badgeHeight = textHeight + paddingY * 2;

          // Posisi pojok kanan bawah (standar stempel foto kamera)
          const x = width - badgeWidth - margin;
          const y = height - badgeHeight - margin;

          // Gambar badge latar belakang semi-transparan gelap agar tulisan selalu kontras & jelas
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
          drawRoundedRect(ctx, x, y, badgeWidth, badgeHeight, Math.round(fontSize * 0.35));
          ctx.fill();

          // Border tipis transparan elegan
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.05));
          ctx.stroke();

          // Tulis teks tanggal & waktu berwarna putih tajam
          ctx.fillStyle = '#FFFFFF';
          ctx.textBaseline = 'middle';
          ctx.fillText(dateText, x + paddingX, y + badgeHeight / 2);
          ctx.restore();
        }

        // Ekspor ke format file JPEG yang optimal
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
