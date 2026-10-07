import { useTranslation } from 'react-i18next'

/**
 * Flat vector hero illustration for the guest landing page (light theme).
 * Replaces the dark photoreal Bible photo — open Bible + warm light rays + a
 * floating quiz card using the canonical answer colors A=Coral/B=Sky/C=Gold/D=Sage (C5).
 * Drop-in for the previous <img>: same rounded card frame + aspect ratio.
 */
export default function HeroIllustration({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <svg
      viewBox="0 0 600 450"
      role="img"
      aria-label={t('landing.heroImageAlt')}
      className={`relative w-full aspect-[4/3] rounded-[2rem] border border-bq-hair shadow-bq-soft ${className}`}
    >
      <defs>
        <linearGradient id="hi-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF7" />
          <stop offset="1" stopColor="#F4F1E7" />
        </linearGradient>
        <radialGradient id="hi-halo" cx="50%" cy="42%" r="46%">
          <stop offset="0" stopColor="#FFE7B0" stopOpacity=".95" />
          <stop offset="55%" stopColor="#FCD98A" stopOpacity=".35" />
          <stop offset="100%" stopColor="#FCD98A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hi-pageL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3EFE4" />
        </linearGradient>
        <linearGradient id="hi-pageR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3EFE4" />
        </linearGradient>
        <linearGradient id="hi-cover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A5A" />
          <stop offset="1" stopColor="#B3452F" />
        </linearGradient>
        <linearGradient id="hi-ray" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F8C65A" stopOpacity="0" />
          <stop offset="1" stopColor="#F8C65A" stopOpacity=".55" />
        </linearGradient>
        <filter id="hi-cardShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#1D2B22" floodOpacity=".16" />
        </filter>
      </defs>

      {/* backdrop */}
      <rect width="600" height="450" fill="url(#hi-bg)" />
      <circle cx="300" cy="205" r="240" fill="url(#hi-halo)" />

      {/* light rays fanning up from the book */}
      <g opacity=".9">
        <polygon points="300,210 250,-30 290,-30" fill="url(#hi-ray)" />
        <polygon points="300,210 305,-30 345,-30" fill="url(#hi-ray)" opacity=".8" />
        <polygon points="300,210 150,-10 205,-30" fill="url(#hi-ray)" opacity=".55" />
        <polygon points="300,210 400,-30 450,-10" fill="url(#hi-ray)" opacity=".55" />
        <polygon points="300,210 60,80 95,30" fill="url(#hi-ray)" opacity=".35" />
        <polygon points="300,210 505,30 540,80" fill="url(#hi-ray)" opacity=".35" />
      </g>

      {/* floating cross above the book */}
      <g transform="translate(300,86)" opacity=".95">
        <rect x="-6" y="-34" width="12" height="74" rx="6" fill="#F8C65A" />
        <rect x="-22" y="-12" width="44" height="12" rx="6" fill="#F8C65A" />
      </g>

      {/* open book */}
      <g>
        <path d="M300 300 L96 268 Q86 300 118 360 L300 338 Z" fill="url(#hi-cover)" />
        <path d="M300 300 L504 268 Q514 300 482 360 L300 338 Z" fill="#C92A41" />
        <path d="M300 246 L300 338" stroke="#B9213A" strokeWidth="6" opacity=".25" />

        <path d="M300 250 L110 282 Q124 308 138 332 L300 328 Z" fill="url(#hi-pageL)" stroke="#C9B58C" strokeWidth="1.5" />
        <path d="M300 250 L490 282 Q476 308 462 332 L300 328 Z" fill="url(#hi-pageR)" stroke="#C9B58C" strokeWidth="1.5" />
        <path d="M300 250 L300 328" stroke="#D9D4C6" strokeWidth="3" opacity=".7" />

        <g stroke="#CFC9BA" strokeWidth="3" strokeLinecap="round" opacity=".8">
          <line x1="160" y1="288" x2="276" y2="276" />
          <line x1="166" y1="300" x2="276" y2="289" />
          <line x1="172" y1="312" x2="276" y2="302" />
        </g>
        <g stroke="#CFC9BA" strokeWidth="3" strokeLinecap="round" opacity=".8">
          <line x1="324" y1="276" x2="440" y2="288" />
          <line x1="324" y1="289" x2="434" y2="300" />
          <line x1="324" y1="302" x2="428" y2="312" />
        </g>
        <path d="M300 250 L300 372 L290 360 L280 372 L280 252 Z" fill="#F59E0B" />
      </g>

      {/* floating quiz answer card — answer colors A=Coral B=Sky C=Gold D=Sage (C5) */}
      <g transform="translate(372,70) rotate(5)" filter="url(#hi-cardShadow)">
        <rect x="0" y="0" width="196" height="138" rx="18" fill="#FFFFFF" stroke="#C9B58C" strokeWidth="1.5" />
        <rect x="18" y="18" width="120" height="9" rx="4.5" fill="#1D2B22" />
        <rect x="18" y="33" width="86" height="7" rx="3.5" fill="#CFC9BA" />

        <rect x="18" y="54" width="78" height="30" rx="9" fill="#FF7A5A" opacity=".16" />
        <circle cx="35" cy="69" r="9" fill="#FF7A5A" />
        <text x="31.5" y="73" fontSize="12" fontWeight="700" fill="#fff">A</text>
        <rect x="50" y="65" width="38" height="7" rx="3.5" fill="#FF7A5A" opacity=".55" />

        <rect x="102" y="54" width="78" height="30" rx="9" fill="#2F6FB0" opacity=".16" />
        <circle cx="119" cy="69" r="9" fill="#2F6FB0" />
        <text x="115.5" y="73" fontSize="12" fontWeight="700" fill="#fff">B</text>
        <rect x="134" y="65" width="38" height="7" rx="3.5" fill="#2F6FB0" opacity=".55" />

        <rect x="18" y="92" width="78" height="30" rx="9" fill="#F59E0B" opacity=".22" stroke="#F59E0B" strokeWidth="2" />
        <circle cx="35" cy="107" r="9" fill="#F59E0B" />
        <text x="31.5" y="111" fontSize="12" fontWeight="700" fill="#fff">C</text>
        <rect x="50" y="103" width="26" height="7" rx="3.5" fill="#D97F06" opacity=".7" />
        <path d="M82 107 l3.5 3.5 L92 103" fill="none" stroke="#2E7D4F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="102" y="92" width="78" height="30" rx="9" fill="#46C89A" opacity=".16" />
        <circle cx="119" cy="107" r="9" fill="#2E7D4F" />
        <text x="115.5" y="111" fontSize="12" fontWeight="700" fill="#fff">D</text>
        <rect x="134" y="103" width="38" height="7" rx="3.5" fill="#2E7D4F" opacity=".5" />
      </g>

      {/* sparkles */}
      <g fill="#F8C65A">
        <path d="M150 150 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" />
        <path d="M470 170 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" opacity=".8" />
        <path d="M118 232 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" opacity=".7" />
      </g>
    </svg>
  )
}
