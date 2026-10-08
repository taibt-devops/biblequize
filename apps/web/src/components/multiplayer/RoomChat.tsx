import React from 'react';

/**
 * MPC-2 — shared multiplayer chat presentational components, extracted verbatim
 * from RoomLobby so the lobby AND the end-game results screen render an
 * identical chat UI. Pure presentational (no STOMP / store coupling): the
 * parent owns message state, input value, and the send handler.
 */

export type ChatMessage = {
  sender: string; text: string;
  isHost?: boolean; isSystem?: boolean; time?: string;
};

export const QUICK_EMOJIS = ['👏', '😂', '😱', '🔥', '💪', '🙏'];

export type ChatViewProps = {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  onSend: (v: string) => void;
  onClose: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
};

export const ChatBody: React.FC<{ messages: ChatMessage[]; chatEndRef: React.RefObject<HTMLDivElement | null> }> = ({ messages, chatEndRef }) => (
  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ minHeight: 0 }}>
    {messages.length === 1 && messages[0].isSystem && (
      <div className="text-center py-4 text-bq-ink3" style={{ fontSize: 11 }}>
        <span className="material-symbols-outlined text-[28px] block mb-1.5 text-bq-hair">chat</span>
        Hãy chào hỏi để bắt đầu!
      </div>
    )}
    {messages.map((msg, i) => (
      msg.isSystem ? (
        <div
          key={i}
          className="rounded-lg px-3 py-2 text-xs text-bq-sapphire"
          style={{
            background: 'color-mix(in srgb, var(--bq-sapphire) 6%, transparent)',
            borderLeft: '2px solid color-mix(in srgb, var(--bq-sapphire) 40%, transparent)',
            lineHeight: 1.5,
          }}
        >
          {msg.text}
          {msg.time && <div className="text-[9px] mt-1 text-bq-ink3">{msg.time}</div>}
        </div>
      ) : (
        <div key={i} className="flex items-start gap-2">
          <div
            className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold flex-shrink-0"
            style={{
              background: msg.isHost
                ? 'linear-gradient(135deg, var(--bq-amber-lt) 0%, var(--bq-amber-deep) 100%)'
                : 'linear-gradient(135deg, var(--bq-emerald-lt) 0%, var(--bq-emerald) 100%)',
              color: msg.isHost ? 'var(--bq-ink)' : '#fff',
            }}
          >
            {msg.sender?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold mb-0.5" style={{ color: msg.isHost ? 'var(--bq-amber-deep)' : 'var(--bq-emerald)' }}>{msg.sender}</div>
            <div className="text-xs text-bq-ink2">{msg.text}</div>
            {msg.time && <div className="text-[9px] mt-0.5 text-bq-ink3">{msg.time}</div>}
          </div>
        </div>
      )
    ))}
    <div ref={chatEndRef} />
  </div>
);

export const ChatReactionsRow: React.FC<{ onSend: (e: string) => void }> = ({ onSend }) => (
  <div className="flex gap-1.5 px-4 py-2.5 border-t border-bq-hair">
    {QUICK_EMOJIS.map(e => (
      <button
        key={e}
        type="button"
        onClick={() => onSend(e)}
        className="w-8 h-8 grid place-items-center rounded-lg text-base bg-bq-inset border border-bq-hair hover:bg-bq-paper"
      >
        {e}
      </button>
    ))}
  </div>
);

export const ChatInputRow: React.FC<{ value: string; onChange: (v: string) => void; onSend: () => void }> = ({ value, onChange, onSend }) => (
  <div className="flex gap-1.5 px-4 py-3 border-t border-bq-hair">
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSend(); }}
      placeholder="Nhắn tin trong phòng..."
      className="flex-1 px-3 py-2 rounded-lg text-xs outline-none bg-bq-inset border border-bq-hair text-bq-ink"
    />
    <button
      type="button"
      onClick={onSend}
      aria-label="Gửi"
      className="w-9 h-9 grid place-items-center rounded-lg text-bq-amberd border border-bq-amber/30"
      style={{ background: 'color-mix(in srgb, var(--bq-amber) 15%, transparent)' }}
    >
      <span className="material-symbols-outlined text-[15px]">send</span>
    </button>
  </div>
);

export type ChatPanelProps = Omit<ChatViewProps, 'onClose'> & {
  onlineCount?: number;
  cta?: React.ReactNode;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, input, setInput, onSend, chatEndRef, onlineCount, cta }) => (
  <aside
    className="flex flex-col border-l bg-bq-white border-bq-hair"
    data-testid="lobby-chat-panel"
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-bq-hair">
      <div className="inline-flex items-center gap-1.5 text-[13px] font-bold">
        <span className="text-sm">💬</span>
        <span className="text-[12.5px] text-bq-ink2">Trò chuyện</span>
      </div>
      {typeof onlineCount === 'number' && (
        <span className="text-[10px] text-bq-ink3">{onlineCount} online</span>
      )}
    </div>
    <ChatBody messages={messages} chatEndRef={chatEndRef} />
    <ChatReactionsRow onSend={onSend} />
    <ChatInputRow value={input} onChange={setInput} onSend={() => onSend(input)} />
    {cta && (
      <div className="p-3 border-t border-bq-hair">
        {cta}
      </div>
    )}
  </aside>
);

export const ChatDrawer: React.FC<ChatViewProps> = ({ messages, input, setInput, onSend, onClose, chatEndRef }) => (
  <div
    className="fixed inset-0 z-50 flex justify-end"
    style={{ background: 'rgba(20,20,30,0.5)' }}
    onClick={onClose}
    data-testid="lobby-chat-drawer"
  >
    <div
      className="flex flex-col w-full max-w-sm h-full bg-bq-white"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-bq-hair">
        <div className="inline-flex items-center gap-1.5 text-[13px] font-bold text-bq-ink">
          <span className="material-symbols-outlined text-base text-bq-ink2">chat</span>
          Trò chuyện
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chat"
          className="w-8 h-8 grid place-items-center rounded-lg text-bq-ink2 hover:bg-bq-inset"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <ChatBody messages={messages} chatEndRef={chatEndRef} />
      <ChatReactionsRow onSend={onSend} />
      <ChatInputRow value={input} onChange={setInput} onSend={() => onSend(input)} />
    </div>
  </div>
);
