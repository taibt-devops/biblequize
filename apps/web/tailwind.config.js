/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Stitch Design System — "The Sacred Modernist"
        background: "#11131e",
        surface: {
          DEFAULT: "#11131e",
          dim: "#11131e",
          bright: "#373845",
          container: {
            DEFAULT: "#1d1f2a",
            low: "#191b26",
            high: "#272935",
            highest: "#323440",
            lowest: "#0b0e18",
          },
          variant: "#323440",
          tint: "#c0c4e8",
        },
        primary: {
          DEFAULT: "#c0c4e8",
          container: "#1a1f3a",
          fixed: { DEFAULT: "#dee1ff", dim: "#c0c4e8" },
        },
        secondary: {
          DEFAULT: "#e8a832",
          container: "#bc8709",
          fixed: { DEFAULT: "#ffdea7", dim: "#f8bd45" },
        },
        tertiary: {
          DEFAULT: "#e7c268",
          container: "#2b1f00",
          fixed: { DEFAULT: "#ffdf96", dim: "#e7c268" },
        },
        error: {
          DEFAULT: "#ffb4ab",
          container: "#93000a",
        },
        outline: {
          DEFAULT: "#919098",
          variant: "#46464d",
        },
        // "on-" colors for text
        "on-surface": "#e1e1f1",
        "on-surface-variant": "#c7c5ce",
        "on-background": "#e1e1f1",
        "on-primary": "#2a2f4a",
        "on-primary-container": "#8286a7",
        "on-secondary": "#412d00",
        "on-secondary-container": "#392600",
        "on-tertiary": "#3e2e00",
        "on-tertiary-container": "#a48431",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "inverse-surface": "#e1e1f1",
        "inverse-on-surface": "#2e303c",
        "inverse-primary": "#585d7b",
        // Legacy compatibility
        neon: {
          green: '#00ff41',
          pink: '#ff0080',
          orange: '#ff6600',
          blue: '#00bfff',
        },
        // Answer Color Mapping (Quiz screen) — DESIGN_TOKENS.md "Game Mode Accent"
        // A=top-left, B=top-right, C=bottom-left, D=bottom-right.
        // Vị trí cố định, shuffle content KHÔNG shuffle vị trí màu.
        answer: {
          a: '#E8826A', // Coral — cảm xúc ấm
          b: '#6AB8E8', // Sky — tin cậy, calm
          c: '#E8C76A', // Gold — năng lượng, joy (ấm hơn primary gold)
          d: '#7AB87A', // Sage — bình an, growth
        },
        // HR-1 Modern Spiritual atmosphere tokens — used by HomeBanner,
        // FeaturedDailyCard, HeroRankedCard, VerseFooter. Hardcoded hex
        // (memory: CSS variables cause white-background rendering bug).
        ivory: '#f5f0e6',
        'ivory-dim': '#b8b1a3',
        'ivory-faint': '#6e6a60',
        'gold-deep': '#c98a1c',
        'gold-shadow': '#7a5818',
        // Hero Đấu Hạng — Variant 02 Radial Glow (sprint 2026-05-14)
        'gold-bright': '#f4d178',
        'gold-cream': '#fff5dc',
        maroon: '#7c2d3a',
        sage: '#4a6b52',
        // "Khung Sáng" jewel palette (KS migration W0-1). CSS-var backed for
        // season-theming (data-season). Additive — does NOT touch Sacred
        // Modernist tokens. Defined in src/styles/tokens.css.
        bq: {
          paper:   'var(--bq-paper)',
          white:   'var(--bq-white)',
          inset:   'var(--bq-paper-sunk)',
          hair:    'var(--bq-hairline)',
          ink:     'var(--bq-ink)',
          ink2:    'var(--bq-ink-soft)',
          ink3:    'var(--bq-ink-faint)',
          sapphire:'var(--bq-sapphire)',
          emerald: 'var(--bq-emerald)',
          amber:   'var(--bq-amber)',
          amberd:  'var(--bq-amber-deep)',
          ruby:    'var(--bq-ruby)',
          ember:   'var(--bq-ember)',
          // Lữ Khách (LKD-2)
          leaf:    'var(--bq-leaf)',
          wood:    'var(--bq-wood)',
          woodlt:  'var(--bq-wood-lt)',
          woodink: 'var(--bq-wood-ink)',
          parch:   'var(--bq-parch)',
          track:   'var(--bq-track)',
        },
      },
      fontFamily: {
        // "Lữ Khách" (LKD-1): Baloo 2 is the UI face everywhere; Be Vietnam Pro
        // stays only for long reading text (`font-read`, `font-body`).
        sans: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        headline: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        body: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        read: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        label: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        sora: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        // Verse text joins the storybook face (was Literata / Cormorant italic).
        literata: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        verse: ['"Baloo 2"', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        // Legacy
        serif: ['Playfair Display', 'serif'],
        cursive: ['Caveat', 'cursive'],
        mono: ['Orbitron', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
        // Lữ Khách card radius (was Khung Sáng 22px)
        bq: "26px",
        'bq-btn': "18px",
      },
      // Khung Sáng signature gradients / shadows / typography (KS W0-1)
      fontSize: {
        hero:    'clamp(40px,5.6vw,66px)',
        verse:   '25px',
        eyebrow: '11px',
      },
      letterSpacing: { eyebrow: '.22em' },
      backgroundImage: {
        'bq-spectrum': 'var(--bq-spectrum)',
        'bq-action':   'var(--bq-action)',
        'bq-flame':    'var(--bq-flame)',
      },
      boxShadow: {
        'bq-soft':   'var(--bq-shadow-soft)',
        'bq-sap':    'var(--bq-shadow-sap)',
        'bq-sap-h':  'var(--bq-shadow-sap-h)',
        'bq-rub':    'var(--bq-shadow-rub)',
        'bq-rub-h':  'var(--bq-shadow-rub-h)',
        'bq-eme':    'var(--bq-shadow-eme)',
        'bq-eme-h':  'var(--bq-shadow-eme-h)',
        'bq-amb':    'var(--bq-shadow-amb)',
        'bq-action': 'var(--bq-glow-action)',
        'bq-flame':  'var(--bq-glow-flame)',
        // Lữ Khách hard shadows (LKD-2)
        'bq-card':     'var(--bq-shadow-card)',
        'bq-card-h':   'var(--bq-shadow-card-h)',
        'bq-btn':      'var(--bq-shadow-btn)',
        'bq-btn-down': 'var(--bq-shadow-btn-down)',
      },
      transitionTimingFunction: { bq: 'cubic-bezier(.2,.7,.3,1)' },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
        // Khung Sáng
        flick:   'flick 2.6s ease-in-out infinite',
        shimmer: 'shimmer 7s ease-in-out infinite',
        sweep:   'sweep 3.2s ease-in-out infinite',
        // Lữ Khách idle bob for the traveller sprite
        bob:     'bob 1.6s ease-in-out infinite',
      },
      keyframes: {
        // Khung Sáng
        flick:   { '0%,100%': { transform: 'scaleY(1) scaleX(1)' }, '48%': { transform: 'scaleY(1.12) scaleX(.92)' }, '72%': { transform: 'scaleY(.95) scaleX(1.05)' } },
        shimmer: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        // Light glint sweeping left→right with a rest off-screen (balanced base stays put).
        sweep:   { '0%': { transform: 'translateX(-140%)' }, '55%,100%': { transform: 'translateX(140%)' } },
        bob:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
