/**
 * Kompresi gambar di sisi klien menggunakan HTML5 Canvas.
 * Mengubah foto berukuran besar (misal 5MB - 15MB langsung dari kamera HP)
 * menjadi ukuran optimal (~1600px resolusi, JPEG 0.82) dengan bobot ~200KB - 450KB.
 * Tetap sangat tajam untuk bukti audit absensi fisik & serah terima.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<File> {
  // Hanya proses jika file adalah gambar
  if (!file.type.startsWith('image/')) return file;

  // Jika file sudah kecil (< 350KB), langsung gunakan tanpa re-encode
  if (file.size < 350 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Pertahankan rasio aspek gambar saat resize
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

        // Gambar ulang foto ke canvas dengan dimensi yang sudah dioptimasi
        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor ke blob JPEG
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
