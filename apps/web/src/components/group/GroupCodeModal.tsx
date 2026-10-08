import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  groupName: string;
  groupCode: string;
  open: boolean;
  onClose: () => void;
}

export default function GroupCodeModal({ groupName, groupCode, open, onClose }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/groups?code=${encodeURIComponent(groupCode)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-testid="group-code-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bq-white rounded-2xl max-w-md w-full p-6 border border-bq-hair shadow-bq-soft"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-bq-ink">
            {t('groups.qrModal.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-bq-ink3 hover:text-bq-ink w-8 h-8 rounded-md hover:bg-bq-inset flex items-center justify-center text-[20px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="text-bq-ink2 text-[12px] mb-4 text-center">
          {t('groups.qrModal.subtitle', { name: groupName })}
        </div>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-xl border border-bq-hair">
            <QRCodeSVG value={joinUrl} size={180} level="M" />
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="text-[12px] text-bq-ink3 mb-1">
            {t('groups.qrModal.codeLabel')}
          </div>
          <div className="text-[30px] font-display font-extrabold text-bq-ink tracking-[0.18em] mb-1.5">
            {groupCode}
          </div>
          <button
            type="button"
            onClick={() => copyText(groupCode)}
            data-testid="qr-modal-copy-code"
            className="text-[11px] text-bq-ink2 hover:text-bq-amberd transition-colors inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? t('groups.copied') : t('groups.qrModal.copyCode')}
          </button>
        </div>

        <div className="border-t border-bq-hair pt-3">
          <div className="text-[12px] text-bq-ink3 mb-1.5">
            {t('groups.qrModal.linkLabel')}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-bq-inset px-3 py-2 rounded text-[11px] text-bq-ink2 font-mono truncate">
              {joinUrl}
            </code>
            <button
              type="button"
              onClick={() => copyText(joinUrl)}
              data-testid="qr-modal-copy-link"
              className="bg-bq-action text-bq-ink shadow-bq-action rounded-md px-3 py-2 text-[11px] font-bold hover:brightness-110 transition-all whitespace-nowrap"
            >
              {t('groups.qrModal.copyLink')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
