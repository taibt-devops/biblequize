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
        // Stitch "Sacred Modernist" names, re-pointed to the Lu Khach storybook palette
        // (LKD-18, 2026-10-08). Names kept so old screens follow the new look; new code
        // uses bq-* tokens. Text roles are dark (ink, deep gold, ruby) for cream paper.
        background: "#EFE3C3",
        surface: {
          DEFAULT: "#EFE3C3",
          dim: "#EFE3C3",
          bright: "#FFF8E7",
          container: {
            DEFAULT: "#FFF8E7",
            low: "#F9ECC8",
            high: "#F3E6C4",
            highest: "#F0DFB8",
            lowest: "#FFF8E7",
          },
          variant: "#F0DFB8",
          tint: "#2F6FB0",
        },
        primary: {
          DEFAULT: "#2F6FB0",
          container: "#F9ECC8",
          fixed: { DEFAULT: "#FFF8E7", dim: "#F0DFB8" },
        },
        secondary: {
          DEFAULT: "#8A5A12",
          container: "#FFC93C",
          fixed: { DEFAULT: "#F9ECC8", dim: "#FFC93C" },
        },
        tertiary: {
          DEFAULT: "#8A5A12",
          container: "#F9ECC8",
          fixed: { DEFAULT: "#F9ECC8", dim: "#FFC93C" },
        },
        error: {
          DEFAULT: "#B3452F",
          container: "#F7D9CF",
        },
        outline: {
          DEFAULT: "#6B5530",
          variant: "#C9B58C",
        },
        // "on-" colors for text
        "on-surface": "#1D2B22",
        "on-surface-variant": "#4D3A1F",
        "on-background": "#1D2B22",
        "on-primary": "#FFF8E7",
        "on-primary-container": "#2F6FB0",
        "on-secondary": "#1D2B22",
        "on-secondary-container": "#1D2B22",
        "on-tertiary": "#1D2B22",
        "on-tertiary-container": "#8A5A12",
        "on-error": "#FFF8E7",
        "on-error-container": "#7A2E1F",
        "inverse-surface": "#1D2B22",
        "inverse-on-surface": "#FFF8E7",
        "inverse-primary": "#FFC93C",
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
          paper:   'rgb(var(--bq-paper-rgb) / <alpha-value>)',
          white:   'rgb(var(--bq-white-rgb) / <alpha-value>)',
          inset:   'rgb(var(--bq-paper-sunk-rgb) / <alpha-value>)',
          hair:    'rgb(var(--bq-hairline-rgb) / <alpha-value>)',
          ink:     'rgb(var(--bq-ink-rgb) / <alpha-value>)',
          ink2:    'rgb(var(--bq-ink-soft-rgb) / <alpha-value>)',
          ink3:    'rgb(var(--bq-ink-faint-rgb) / <alpha-value>)',
          sapphire:'rgb(var(--bq-sapphire-rgb) / <alpha-value>)',
          emerald: 'rgb(var(--bq-emerald-rgb) / <alpha-value>)',
          amber:   'rgb(var(--bq-amber-rgb) / <alpha-value>)',
          amberd:  'rgb(var(--bq-amber-deep-rgb) / <alpha-value>)',
          ruby:    'rgb(var(--bq-ruby-rgb) / <alpha-value>)',
          ember:   'rgb(var(--bq-ember-rgb) / <alpha-value>)',
          // Lữ Khách (LKD-2)
          leaf:    'rgb(var(--bq-leaf-rgb) / <alpha-value>)',
          wood:    'rgb(var(--bq-wood-rgb) / <alpha-value>)',
          woodlt:  'rgb(var(--bq-wood-lt-rgb) / <alpha-value>)',
          woodink: 'rgb(var(--bq-wood-ink-rgb) / <alpha-value>)',
          parch:   'rgb(var(--bq-parch-rgb) / <alpha-value>)',
          track:   'rgb(var(--bq-track-rgb) / <alpha-value>)',
          cream:   'rgb(var(--bq-cream-rgb) / <alpha-value>)',
          silver:  'rgb(var(--bq-silver-rgb) / <alpha-value>)',
          bronze:  'rgb(var(--bq-bronze-rgb) / <alpha-value>)',
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
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
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
