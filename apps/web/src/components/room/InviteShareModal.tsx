import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Props = {
  open: boolean;
  roomCode: string;
  onClose: () => void;
};

const InviteShareModal: React.FC<Props> = ({ open, roomCode, onClose }) => {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  // Route registered ở main.tsx là /room/join (NOT /join). QR phải match
  // exact path — bug user report 2026-05-23.
  const joinUrl = `${window.location.origin}/room/join?code=${roomCode}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async (kind: 'code' | 'link') => {
    const text = kind === 'code' ? roomCode : joinUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mời bạn bè"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-sm p-6 rounded-2xl"
        style={{ border: '1px solid rgba(232,168,50,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Mời bạn bè</h3>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="text-center mb-4">
          <div className="text-[12px] text-on-surface-variant mb-1 font-bold">
            Mã phòng
          </div>
          <div
            className="font-mono font-extrabold text-secondary"
            style={{ fontSize: 32, letterSpacing: 6 }}
          >
            {roomCode}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl flex items-center justify-center mb-4">
          <QRCodeSVG value={joinUrl} size={160} level="M" includeMargin={false} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => copy('code')}
            className="px-3 py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(232,168,50,0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(232,168,50,0.3)',
            }}
          >
            <span className="material-symbols-outlined text-base">content_copy</span>
            {copied === 'code' ? 'Đã copy' : 'Copy mã'}
          </button>
          <button
            onClick={() => copy('link')}
            className="px-3 py-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(232,168,50,0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(232,168,50,0.3)',
            }}
          >
            <span className="material-symbols-outlined text-base">link</span>
            {copied === 'link' ? 'Đã copy' : 'Copy link'}
          </button>
        </div>

        <p className="text-[11px] text-on-surface-variant text-center mt-3">
          Quét QR hoặc chia sẻ mã/link để mời bạn bè.
        </p>
      </div>
    </div>
  );
};

export default InviteShareModal;
