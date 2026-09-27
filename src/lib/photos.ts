import type { Photo } from '../domain/types'

/** Turns a stored photo into something an <img src> can use. */
export function photoSrc(photo: Photo): string | undefined {
  if (!photo) return undefined
  if (photo.startsWith('data:')) return photo
  return import.meta.env.BASE_URL + photo
}

const MAX_EDGE = 960

/** Shrinks a photo picked on the device and returns it as a data: URL, so it stays small enough to store. */
export async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Browsers that can't encode WebP silently return a (much larger) PNG instead; use JPEG then.
  const webp = canvas.toDataURL('image/webp', 0.75)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.8)
}
