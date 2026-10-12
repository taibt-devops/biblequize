import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

const LETTERS = ['A', 'B', 'C', 'D']

interface Props {
  questionId: string
  correctIndex: number
  /** Phương án người chơi đã chọn; null = không trả lời / khán giả. */
  selected: number | null
  /** Câu gốc đã định dạng (vd "Sáng Thế Ký 27:5–8"); null = câu hỏi không gắn câu gốc. */
  referenceLabel: string | null
  explanation?: string | null
  /** Số người chọn từng phương án. */
  answerCounts?: number[]
  /** PCV-11: chuỗi đúng liên tiếp của mình sau câu này, và điểm thưởng chuỗi (Đua tốc độ). */
  streak?: number
  streakBonus?: number
}

/**
 * PCV-3 — phần công bố sau mỗi câu trong Phòng chơi (design §1.9): câu gốc cho mọi người,
 * giải thích (mở sẵn khi trả lời sai hoặc không trả lời, gập lại khi trả lời đúng), số người
 * chọn từng phương án, và nút lưu câu để ôn. Chỉ hiện khi vòng đã đóng — mọi số liệu ở đây
 * đến từ ROUND_END.
 */
export default function RoundReveal({ questionId, correctIndex, selected, referenceLabel, explanation, answerCounts, streak, streakBonus }: Props) {
  const { t } = useTranslation()
  const gotItRight = selected !== null && selected === correctIndex
  const [open, setOpen] = useState(!gotItRight)
  const [saved, setSaved] = useState(false)
  const counts = answerCounts ?? []
  const total = counts.reduce((a, b) => a + b, 0)

  const save = () => {
    if (saved) return
    api.post('/api/me/bookmarks', { questionId }).catch(() => { /* lưu để ôn là phụ, lỗi thì thôi */ })
    setSaved(true)
  }

  return (
    <section data-testid="round-reveal" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 md:p-5 space-y-3">
      {gotItRight && (streak ?? 0) >= 2 && (streakBonus ?? 0) > 0 && (
        <div data-testid="round-reveal-streak"
             className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-bq-ink bg-bq-amber text-bq-ink text-[13px] font-extrabold">
          {t('room.reveal.streak', { n: streak, bonus: streakBonus })}
        </div>
      )}
      {referenceLabel && (
        <div className="flex items-center gap-2 text-bq-ink">
          <span className="material-symbols-outlined text-bq-amberd text-[20px]" aria-hidden>menu_book</span>
          <span className="text-[12px] font-bold text-bq-ink2">{t('room.reveal.reference')}</span>
          <span className="font-extrabold">{referenceLabel}</span>
        </div>
      )}

      {explanation && (
        <div>
          {open ? (
            <>
              <p className="text-[15px] leading-relaxed text-bq-ink">{explanation}</p>
              {gotItRight && (
                <button type="button" onClick={() => setOpen(false)} className="mt-1 text-[13px] font-bold text-bq-ink2 underline">
                  {t('room.reveal.hideExplanation')}
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-bold text-bq-sapphire underline">
              {t('room.reveal.showExplanation')}
            </button>
          )}
        </div>
      )}

      {counts.length > 0 && (
        <div>
          <div className="text-[12px] font-bold text-bq-ink2 mb-1.5">{t('room.reveal.distribution')}</div>
          <ul className="space-y-1.5">
            {counts.map((n, i) => {
              const isCorrect = i === correctIndex
              const pct = total > 0 ? Math.round((n / total) * 100) : 0
              return (
                <li key={i} data-testid={`reveal-dist-${i}`} data-correct={isCorrect ? 'true' : 'false'}
                    className="flex items-center gap-2 text-[13px]">
                  <span className={`w-6 h-6 rounded-full grid place-items-center font-black border-2 border-bq-ink ${isCorrect ? 'bg-bq-leaf' : 'bg-bq-inset'}`}>
                    {LETTERS[i] ?? i + 1}
                  </span>
                  <span className="flex-1 h-2.5 rounded-full bg-bq-inset overflow-hidden">
                    <span className={`block h-full ${isCorrect ? 'bg-bq-leaf' : 'bg-bq-amber'}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={`w-16 text-right font-bold ${selected === i ? 'text-bq-ink' : 'text-bq-ink2'}`}>
                    {t('room.reveal.people', { count: n })}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <button type="button" onClick={save} disabled={saved} data-testid="round-reveal-save"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-bq-ink2 disabled:opacity-60">
        <span className="material-symbols-outlined text-[18px]" aria-hidden>{saved ? 'bookmark_added' : 'bookmark_add'}</span>
        {saved ? t('room.reveal.saved') : t('room.reveal.save')}
      </button>
    </section>
  )
}
