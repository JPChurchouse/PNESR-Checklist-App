import { useState, type ReactNode } from 'react'
import { SPECIALTY_LABELS, type Photo as PhotoValue, type Specialty } from '../domain/types'
import { photoSrc } from '../lib/photos'

/** Shows a vehicle photo, or a placeholder if there is none or the image file is missing. */
export function Photo({ photo, alt, className = 'photo' }: { photo: PhotoValue; alt: string; className?: string }) {
  const src = photoSrc(photo)
  const [failedSrc, setFailedSrc] = useState<string>()
  if (!src || src === failedSrc) return <div className={`${className} photo-missing`}>{className === 'photo' && 'No photo yet'}</div>
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailedSrc(src)} />
}

export function ServiceBadge({ inService }: { inService: boolean }) {
  return <span className={`badge ${inService ? 'ok' : 'danger'}`}>{inService ? 'In service' : 'Out of service'}</span>
}

export function SpecialtyBadge({ specialty }: { specialty: Specialty }) {
  if (specialty === 'standard') return null
  return <span className="badge role">{SPECIALTY_LABELS[specialty]}</span>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label} {hint && <span className="hint">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="notice error" role="alert">
      {message}
    </div>
  )
}
