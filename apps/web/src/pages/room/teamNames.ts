import { useTranslation } from 'react-i18next'

/**
 * PCV-14 — tên hai đội trong Đội đấu đội (design §2.3): mỗi phòng một cặp nhân vật Kinh Thánh từng
 * cùng phục vụ, chọn theo mã phòng nên mọi máy trong phòng ra cùng một cặp, không cần máy chủ lưu.
 */
export const TEAM_PAIRS: { vi: [string, string]; en: [string, string] }[] = [
  { vi: ['Giô-suê', 'Ca-lép'], en: ['Joshua', 'Caleb'] },
  { vi: ['Phi-e-rơ', 'Giăng'], en: ['Peter', 'John'] },
  { vi: ['Đa-vít', 'Giô-na-than'], en: ['David', 'Jonathan'] },
  { vi: ['Ru-tơ', 'Na-ô-mi'], en: ['Ruth', 'Naomi'] },
  { vi: ['Ê-li', 'Ê-li-sê'], en: ['Elijah', 'Elisha'] },
  { vi: ['Mô-se', 'A-rôn'], en: ['Moses', 'Aaron'] },
]

/** Cặp tên (chưa kèm chữ "Đội") cho phòng {@code seed}; null khi chưa biết phòng. */
export function teamPair(seed: string | null | undefined, lang: string): { A: string; B: string } | null {
  if (!seed) return null
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const pair = TEAM_PAIRS[h % TEAM_PAIRS.length]
  const names = lang.startsWith('en') ? pair.en : pair.vi
  return { A: names[0], B: names[1] }
}

/** Tên hiển thị của hai đội ("Đội Giô-suê" / "Team Joshua"); chưa biết phòng thì "Đội A" / "Đội B". */
export function useTeamNames(seed: string | null | undefined): { A: string; B: string } {
  const { t, i18n } = useTranslation()
  const pair = teamPair(seed, i18n.language ?? 'vi')
  if (!pair) return { A: t('room.team.fallbackA'), B: t('room.team.fallbackB') }
  return { A: t('room.team.name', { name: pair.A }), B: t('room.team.name', { name: pair.B }) }
}
