// Resizes the source photos in fleet-images/ and brand-images/ into web-sized
// copies under public/. Re-run with `npm run images` after adding or replacing a photo.
import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const fleetSrc = path.join(root, 'fleet-images')
const fleetOut = path.join(root, 'public', 'fleet')
const brandOut = path.join(root, 'public', 'brand')
const logoSrc = path.join(root, 'brand-images', 'logo no writing transperent.avif')

await mkdir(fleetOut, { recursive: true })
await mkdir(brandOut, { recursive: true })

const fleetFiles = existsSync(fleetSrc) ? await readdir(fleetSrc) : []
if (!fleetFiles.length) console.warn('No fleet photos found in fleet-images/; skipping.')
for (const file of fleetFiles) {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(file)) continue
  const name = path.parse(file).name.toLowerCase()
  await sharp(path.join(fleetSrc, file))
    .rotate()
    .resize({ width: 960, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(path.join(fleetOut, `${name}.webp`))
  console.log(`fleet/${name}.webp`)
}

if (!existsSync(logoSrc)) {
  console.warn('No logo found in brand-images/; skipping brand images.')
  process.exit(0)
}
await sharp(logoSrc).resize({ height: 160 }).webp({ quality: 85 }).toFile(path.join(brandOut, 'logo.webp'))
for (const size of [32, 192, 512]) {
  await sharp(logoSrc)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(brandOut, `icon-${size}.png`))
}
console.log('brand/logo.webp, brand/icon-*.png')
