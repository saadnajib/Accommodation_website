export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_EDGE = 1600
export const JPEG_QUALITY = 0.82

/** Returns an error message if the file can't be accepted, otherwise null. */
export function checkImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Not an image file.'
  if (file.size > MAX_UPLOAD_BYTES) return 'Larger than 15 MB.'
  return null
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

/**
 * Decodes an image file, downscales it so the long edge is at most 1600px and re-encodes it as
 * JPEG (quality 0.82). Returns a data URL. EXIF orientation is applied by the browser on decode.
 */
export async function processImageFile(file: File): Promise<string> {
  const img = await loadImage(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) throw new Error('decode')
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  // JPEG has no alpha: paint transparent areas white instead of black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
