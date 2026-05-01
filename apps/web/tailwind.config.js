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
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        headline: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        body: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        label: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
        // V3 design — "Sacred Modernist Gaming"
        sora: ['Sora', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        verse: ['"Crimson Pro"', 'Playfair Display', 'serif'],
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
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
      },
      keyframes: {
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
