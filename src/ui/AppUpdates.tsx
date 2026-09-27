import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../lib/install'

/**
 * Tells people when a new version of the app has downloaded, and lets them switch to it when
 * convenient (every form saves as it goes, so nothing is lost by updating).
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (needRefresh)
    return (
      <div className="app-toast" role="status">
        <span>A new version of the app is ready.</span>
        <button type="button" className="btn primary" onClick={() => updateServiceWorker(true)}>
          Update now
        </button>
        <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    )
  if (offlineReady)
    return (
      <div className="app-toast" role="status">
        <span>The app is saved on this device and now works without signal.</span>
        <button type="button" className="btn" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    )
  return null
}

/** "Install app" button where the browser supports it, or instructions on iPhone and iPad. */
export function InstallPrompt() {
  const [, rerender] = useState(0)
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), [])

  if (isInstalled()) return null
  if (canPromptInstall())
    return (
      <div className="notice ok completed-banner">
        <span>Install the app on this device for a home-screen icon and full-screen use, even without signal.</span>
        <button type="button" className="btn primary" onClick={() => promptInstall()}>
          Install app
        </button>
      </div>
    )
  if (isIos())
    return (
      <div className="notice ok">
        To install on this iPhone or iPad: tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
      </div>
    )
  return null
}
