// Shared presentational atoms for the multiplayer result screen
// (QuizEndScreen). Extracted so the screen stays under the 300 LOC cap.

const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const;

export const Stat: React.FC<{
  label: string;
  value: string;
  color?: string;
  border?: boolean;
}> = ({ label, value, color = '#fff', border }) => (
  <div className={border ? 'border-x' : ''} style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>
      {label}
    </div>
    <div className="font-bold text-base lg:text-lg mt-0.5" style={{ color }}>
      {value}
    </div>
  </div>
);

export const ActionButton: React.FC<{
  primary?: boolean;
  small?: boolean;
  danger?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
  testId?: string;
}> = ({ primary, small, danger, icon, label, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold ${small ? 'py-2.5 text-xs' : 'py-3 text-sm'}`}
    style={
      primary
        ? {
            background: 'linear-gradient(135deg, #e8a832 0%, #d97706 100%)',
            color: '#1D2B22',
            boxShadow: '0 6px 20px rgba(232,168,50,0.3)',
          }
        : danger
        ? {
            background: 'rgba(248,113,113,0.08)',
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.25)',
          }
        : {
            background: 'rgba(50,52,64,0.55)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.06)',
          }
    }
  >
    <span className="material-symbols-outlined text-base" style={FILL_STYLE}>{icon}</span>
    <span>{label}</span>
  </button>
);
