/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Single palette ──
        accent: '#ea580c',
        'accent-soft': '#fff1e9',
        'accent-dark': '#c2410c',
        ink: '#1a1a1a',
        muted: '#6b7280',
        surface: '#f6f5f1',
        card: '#ffffff',
        line: '#e6e4de',
        ok: '#16a34a',
        warn: '#f59e0b',
        danger: '#dc2626',
        'ok-soft': '#e9f6ee',
        'warn-soft': '#fef3da',
        'danger-soft': '#fbe9e9',
        // ── compatibility tokens (mapped into the one palette) ──
        'ink-secondary': '#6b7280',
        'grey-light': '#f6f5f1',
        mid: '#d8d6cf',
        blue: '#1d70b8',
        'blue-dark': '#c2410c',
        green: '#16a34a',
        red: '#dc2626',
        'tag-blue-bg': '#fff1e9',
        'tag-blue-text': '#c2410c',
        'tag-green-bg': '#e9f6ee',
        'tag-green-text': '#15803d',
        'tag-orange-bg': '#fff1e9',
        'tag-orange-text': '#c2410c',
        'tag-red-bg': '#fbe9e9',
        'tag-red-text': '#b91c1c',
        'tag-grey-bg': '#eceae3',
        'tag-grey-text': '#4b5563',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        pixel: ['"Geist Pixel Grid"', '"Pixelify Sans"', 'monospace'],
      },
    },
  },
  plugins: [],
}
