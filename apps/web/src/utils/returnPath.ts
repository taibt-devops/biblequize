// PCV-24 — đăng nhập xong quay về đúng trang người dùng đang mở (vd. /room/create?passage=… từ app
// Đọc hằng ngày). Đăng nhập Google rời app sang Google rồi về /auth/callback, nên đường dẫn được nhớ
// trong sessionStorage của tab. Chỉ nhận đường dẫn trong app — không thành lỗ chuyển hướng ra ngoài.

const KEY = 'bq.returnPath'
const MAX_AGE_MS = 30 * 60_000

/** Đường dẫn trong app ("/..."), không phải "//host" hay "/\host", không phải trang đăng nhập/callback. */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false
  return !/^\/(login|register|auth\/callback)(?=$|[/?#])/.test(path)
}

export function rememberReturnPath(path: string | null | undefined): void {
  if (!isSafeReturnPath(path)) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch { /* trình duyệt chặn lưu trữ — đăng nhập xong về trang chủ */ }
}

/** Trả đường dẫn đã nhớ (một lần) — quá 30 phút thì bỏ. */
export function takeReturnPath(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number }
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) return null
    return isSafeReturnPath(path) ? path : null
  } catch {
    return null
  }
}
