// CRR-1 — Sticky right-column "Tổng quan" preview for the Create Room page.
// All state lives in CreateRoom.tsx; this component is purely presentational
// + owns the primary CTA (submit) at the bottom.

import type { ModeMeta } from './modeMeta'

interface Props {
  mode: ModeMeta
  /** Translated mode label, e.g. "Đua tốc độ". */
  modeLabel: string
  roomName: string
  questionCount: number
  timePerQuestion: number
  difficultyLabel: string
  bookScopeLabel: string
  isPublic: boolean
  questionSource: 'DATABASE' | 'CUSTOM'
  /** Selected custom set — undefined when source = DATABASE or no set picked. */
  selectedSet: { name: string; questionCount: number } | null
  loading: boolean
  /** False → CTA disabled + warning shown. */
  canSubmit: boolean
  missingSetWarning?: string
  error?: string | null
  onSubmit: () => void
}

export default function PreviewPanel({
  mode, modeLabel, roomName, questionCount, timePerQuestion, difficultyLabel,
  bookScopeLabel, isPublic, questionSource, selectedSet,
  loading, canSubmit, missingSetWarning, error, onSubmit,
}: Props) {
  const estimateMin = Math.max(1, Math.ceil((questionCount * timePerQuestion) / 60))
  const nameTrimmed = roomName.trim()
  const setLabel = questionSource === 'DATABASE'
    ? `Ngân hàng hệ thống · ${bookScopeLabel}`
    : selectedSet ? `${selectedSet.name} · ${selectedSet.questionCount} câu`
    : 'Chưa chọn bộ câu hỏi'
  const setMissing = questionSource === 'CUSTOM' && !selectedSet

  return (
    <div className="md:sticky md:top-[86px]">
      <div className="rounded-[20px] overflow-hidden bg-bq-white border border-bq-hair shadow-bq-soft">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-bq-inset border-b border-bq-hair">
          <span className="text-[12.5px] font-bold text-bq-ink2">Tổng quan</span>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: mode.badge.bg, color: mode.badge.fg, border: `1px solid ${mode.badge.border}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{mode.icon}</span>
            <span>{modeLabel}</span>
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <div
            className={`text-[19px] font-bold leading-tight ${nameTrimmed ? 'text-bq-ink' : 'text-bq-ink3 italic font-medium'}`}
          >
            {nameTrimmed || 'Tên mặc định'}
          </div>
          <div className="text-[12.5px] text-bq-ink2 mt-1 mb-[18px]">
            Bạn là quản trò · {questionCount > 0 ? `${questionCount} câu` : '—'}
          </div>

          {/* Stats 2×2 */}
          <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
            <StatBox value={`${questionCount}`} unit="câu" label="Số câu hỏi" />
            <StatBox value={`${timePerQuestion}`} unit="s" label="Mỗi câu" />
            <StatBox value={`~${estimateMin}`} unit="phút" label="Tổng thời gian" />
            <StatBox value={difficultyLabel} textOnly label="Độ khó" />
          </div>

          {/* Info rows */}
          <div className="flex flex-col gap-2.5 pt-4 border-t border-bq-hair">
            <InfoRow
              icon={questionSource === 'CUSTOM' ? 'menu_book' : 'library_books'}
              text={setLabel}
              missing={setMissing}
            />
            <InfoRow icon="auto_stories" text={bookScopeLabel} />
            <InfoRow
              icon={isPublic ? 'public' : 'lock'}
              text={isPublic ? 'Công khai · ai cũng có thể tham gia' : 'Riêng tư · chỉ ai có mã'}
            />
          </div>
        </div>

        {/* Footer: warning + CTA */}
        <div className="px-5 pt-4 pb-5 border-t border-bq-hair bg-bq-inset">
          {setMissing && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 mb-3 rounded-[9px] text-[12.5px] font-medium text-bq-ruby"
              style={{
                background: 'rgba(179,69,47,0.08)',
                border: '1px solid rgba(179,69,47,0.25)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              <span>{missingSetWarning || 'Chọn bộ câu hỏi để tiếp tục'}</span>
            </div>
          )}
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 mb-3 rounded-[9px] text-[12.5px] font-medium text-bq-ruby"
              style={{
                background: 'rgba(179,69,47,0.10)',
                border: '1px solid rgba(179,69,47,0.30)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
              <span>{error}</span>
            </div>
          )}
          <button
            data-testid="create-room-submit-btn"
            type="submit"
            onClick={onSubmit}
            disabled={loading || !canSubmit}
            className={`w-full inline-flex items-center justify-center gap-2 px-[18px] py-[14px] rounded-[12px] text-[15px] font-bold transition-all disabled:cursor-not-allowed ${
              canSubmit && !loading
                ? 'bg-bq-action text-bq-ink shadow-bq-action'
                : 'bg-bq-inset text-bq-ink3'
            }`}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                Đang tạo...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videogame_asset</span>
                <span>Tạo phòng &amp; điều phối</span>
              </>
            )}
          </button>
          <p className="text-[11.5px] text-bq-ink3 text-center mt-2.5">
            Sau khi tạo, bạn sẽ nhận mã phòng để chia sẻ
          </p>
        </div>
      </div>
    </div>
  )
}

function StatBox({ value, unit, label, textOnly }: { value: string; unit?: string; label: string; textOnly?: boolean }) {
  return (
    <div className="rounded-[11px] p-3 bg-bq-inset border border-bq-hair">
      <div className={textOnly ? 'text-sm font-bold text-bq-ink leading-tight' : 'text-[18px] font-bold text-bq-ink leading-tight'}>
        {value}
        {unit && !textOnly && <span className="text-[13px] font-medium text-bq-ink2 ml-0.5">{unit}</span>}
      </div>
      <div className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-bq-ink2 mt-1">{label}</div>
    </div>
  )
}

function InfoRow({ icon, text, missing }: { icon: string; text: string; missing?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-[13px] ${missing ? 'text-bq-ruby' : 'text-bq-ink2'}`}>
      <span className={`material-symbols-outlined ${missing ? 'text-bq-ruby' : 'text-bq-ink3'}`} style={{ fontSize: 16 }}>
        {icon}
      </span>
      <span>{text}</span>
    </div>
  )
}
