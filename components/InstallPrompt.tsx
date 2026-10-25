'use client'
// Oct 25 2026: nudges mobile visitors to add GreekNova to their home screen,
// now that app/layout.tsx links a manifest + icons (see that commit) and the
// site is actually installable. Deliberately mounted in RootLayout, not in
// Navbar -- Navbar is imported per-page (55 pages) so anything mounted there
// remounts and re-runs its effects on every page nav, which is exactly the
// "feels naggy" mistake made earlier with the trial phone-number prompt.
// RootLayout mounts once per app load, so this shows at most once per
// browser, ever: a dismiss (or an actual install) sets a permanent
// localStorage flag and it never asks again. No countdown, no re-prompt
// timer, no snooze -- one ask, then silence, same lesson as the phone ask.
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'gn_install_prompt_done'

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      return
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const isAndroidMobile = /Android/.test(ua) && /Mobile/.test(ua)

    if (isIOS) {
      setPlatform('ios')
      setVisible(true)
      return
    }

    if (isAndroidMobile) {
      const onBeforeInstall = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setPlatform('android')
        setVisible(true)
      }
      window.addEventListener('beforeinstallprompt', onBeforeInstall)
      return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setVisible(false)
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      try {
        await deferredPrompt.userChoice
      } catch {}
    }
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-900/40 bg-[#0d1220] px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      role="dialog"
      aria-label="Add GreekNova to your home screen"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-extrabold text-white">
          GN
        </div>
        <div className="flex-1 text-xs leading-snug text-gray-200">
          {platform === 'ios' ? (
            <>
              Add GreekNova to your Home Screen: tap{' '}
              <span className="font-semibold text-emerald-400">Share</span> below, then{' '}
              <span className="font-semibold text-emerald-400">Add to Home Screen</span>.
            </>
          ) : (
            <>Install GreekNova for full-screen access from your home screen — no browser needed.</>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {platform === 'android' && (
            <button
              onClick={install}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Install
            </button>
          )}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-md px-2 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            {platform === 'ios' ? 'Got it' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  )
}
