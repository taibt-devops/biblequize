import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODE_LIST, playerLimits } from '../create-room/modeMeta'

export interface RoomSettings {
  mode: string
  questionCount: number
  timePerQuestion: number
  difficulty: string
}

interface Props {
  current: RoomSettings
  /** Số người đang trong phòng — mode có trần thấp hơn (Đấu vương 12) bị khóa. */
  playerCount: number
  onClose: () => void
  onSave: (settings: RoomSettings) => void
  saving?: boolean
}

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30]
const SECONDS = [10, 15, 20, 30, 45, 60]
const DIFFICULTIES = [
  { value: 'MIXED', labelKey: 'practice.mixed' },
  { value: 'EASY', labelKey: 'practice.easy' },
  { value: 'MEDIUM', labelKey: 'practice.medium' },
  { value: 'HARD', labelKey: 'practice.hard' },
]

/** Giữ giá trị hiện tại trong danh sách chọn dù nó không nằm sẵn trong đó. */
const withCurrent = (list: number[], value: number) => (list.includes(value) ? list : [...list, value].sort((a, b) => a - b))

/**
 * PCV-18 — "Đổi cách chơi" ngay trong sảnh chờ (design §2.6): chủ phòng chọn lại mode, số câu, thời gian
 * mỗi câu và độ khó mà không phải tạo phòng mới. Máy chủ kẹp lại các giá trị và báo cho cả phòng.
 */
export default function ChangeSettingsModal({ current, playerCount, onClose, onSave, saving }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(current.mode)
  const [questionCount, setQuestionCount] = useState(current.questionCount)
  const [timePerQuestion, setTimePerQuestion] = useState(current.timePerQuestion)
  const [difficulty, setDifficulty] = useState(current.difficulty || 'MIXED')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('room.settings.title')}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,20,30,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="w-full max-w-lg rounded-bq p-5 md:p-6 bg-bq-white border-[3px] border-bq-ink shadow-bq-card max-h-[90vh] overflow-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="m-0 font-display text-[20px] font-extrabold text-bq-ink">{t('room.settings.title')}</h3>
          <button onClick={onClose} aria-label={t('common.close', 'Đóng')} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-bq-inset">
            <span className="material-symbols-outlined text-bq-ink2">close</span>
          </button>
        </div>

        <div className="text-[12.5px] font-bold text-bq-ink2 mb-2">{t('room.settings.mode')}</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {MODE_LIST.map(m => {
            const tooMany = playerCount > playerLimits(m.id).max
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`settings-mode-${m.id}`}
                aria-pressed={active}
                disabled={tooMany}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left border-2 disabled:opacity-40 ${active ? 'border-bq-ink bg-bq-cream' : 'border-bq-hair bg-bq-inset'}`}
                title={tooMany ? t('room.settings.tooMany', { max: playerLimits(m.id).max }) : undefined}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: m.color }}>{m.icon}</span>
                <span className="text-sm font-bold text-bq-ink">{t(m.labelKey)}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <label className="text-[12.5px] font-bold text-bq-ink2">
            {t('room.settings.questions')}
            <select data-testid="settings-question-count" value={questionCount}
                    onChange={e => setQuestionCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-bq-hair bg-bq-white px-2 py-2 text-sm text-bq-ink">
              {withCurrent(QUESTION_COUNTS, questionCount).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[12.5px] font-bold text-bq-ink2">
            {t('room.settings.seconds')}
            <select data-testid="settings-time" value={timePerQuestion}
                    onChange={e => setTimePerQuestion(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-bq-hair bg-bq-white px-2 py-2 text-sm text-bq-ink">
              {withCurrent(SECONDS, timePerQuestion).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[12.5px] font-bold text-bq-ink2">
            {t('createRoom.difficulty')}
            <select data-testid="settings-difficulty" value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-bq-hair bg-bq-white px-2 py-2 text-sm text-bq-ink">
              {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
            </select>
          </label>
        </div>

        <p className="text-[13px] text-bq-ink2 mb-4">{t('room.settings.note')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
                  className="px-4 py-2 rounded-full border-2 border-bq-ink bg-bq-white text-[14px] font-extrabold text-bq-ink">
            {t('room.settings.cancel')}
          </button>
          <button type="button" data-testid="settings-save" disabled={saving}
                  onClick={() => onSave({ mode, questionCount, timePerQuestion, difficulty })}
                  className="px-4 py-2 rounded-full border-2 border-bq-ink bg-bq-action text-[14px] font-extrabold text-bq-ink disabled:opacity-50">
            {t('room.settings.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
