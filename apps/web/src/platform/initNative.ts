// One-time native shell setup for the Capacitor (mobile) target.
// Called from main.tsx; a no-op on web. Failures are swallowed so a missing
// plugin never blocks app startup.

import { isCapacitor } from './capacitor'

export function initNative(): void {
  if (!isCapacitor()) return

  // Marker class for native-only CSS (overscroll/text-select tweaks).
  document.documentElement.classList.add('capacitor')

  // Status bar: dark app chrome (#1D2B22) with light icons, not overlaying
  // the WebView so content starts below it (top bar still adds safe-area pad).
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      StatusBar.setBackgroundColor({ color: '#1D2B22' }).catch(() => {})
    })
    .catch(() => {})

  // Keyboard: the native resize doesn't always scroll a focused input clear of
  // the keyboard (notably code/text fields low on the page). Once the keyboard
  // is fully shown, nudge the active element into view. Best-effort; swallowed
  // if the plugin is missing.
  import('@capacitor/keyboard')
    .then(({ Keyboard }) => {
      Keyboard.addListener('keyboardDidShow', () => {
        const el = document.activeElement as HTMLElement | null
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }).catch(() => {})
    })
    .catch(() => {})

  // Hide the splash screen once the web app has booted.
  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => {
      SplashScreen.hide().catch(() => {})
    })
    .catch(() => {})
}
