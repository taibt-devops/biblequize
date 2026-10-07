import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeOnBackdropClick?: boolean
  showCloseButton?: boolean
  /** Accessible label for the dialog (screen readers). */
  ariaLabel?: string
}

const SIZE_MAX_WIDTH: Record<NonNullable<ModalProps['size']>, number> = {
  sm: 340,
  md: 400,
  lg: 480,
}

/**
 * Lữ Khách base modal — cream sticker card (ink outline, hard shadow) on a dimmed backdrop.
 *
 * Hardcoded hex values throughout (no CSS variables — they render against a
 * white background in the portal layer due to a known token-resolution bug).
 *
 * Behavior: Esc closes, backdrop click closes (opt-out via prop), body scroll
 * locked while open, focus trapped within the dialog, portal-rendered at
 * document.body so z-index always wins.
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  showCloseButton = true,
  ariaLabel,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  // Focus trap — keep Tab cycling inside the dialog
  useEffect(() => {
    if (!isOpen) return
    const node = contentRef.current
    if (!node) return
    const focusables = node.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length > 0) focusables[0].focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      role="presentation"
      onClick={closeOnBackdropClick ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(29, 43, 34, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
        animation: 'bq-modal-fade-in 0.3s ease',
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#FFF8E7',
          border: '3px solid #1D2B22',
          borderRadius: 26,
          padding: '32px 24px 24px 24px',
          maxWidth: SIZE_MAX_WIDTH[size],
          width: '100%',
          boxShadow: '6px 10px 0 rgba(29, 43, 34, 0.35)',
          animation: 'bq-modal-slide-up 0.4s ease',
        }}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              background: '#FFF8E7',
              border: '3px solid #1D2B22',
              boxShadow: '0 3px 0 #1D2B22',
              color: '#1D2B22',
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        )}
        {children}
      </div>
      <style>{`
        @keyframes bq-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bq-modal-slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  )
}
