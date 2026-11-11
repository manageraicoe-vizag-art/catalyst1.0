import colors from 'tailwindcss/colors'

/**
 * THEME NOTE: the event poster is a dark theme (black, poster pink, pixel type).
 * Rather than sprinkling `dark:` everywhere, every colour scale here is *inverted*:
 * step 50 is the faintest tint against the black background and step 950 is the
 * strongest contrast (brightest). `white` is the card surface (near-black).
 * So read `bg-white` as "surface", `text-slate-950` as "primary ink",
 * `bg-brand-50` as "faint pink tint", `bg-brand-800` as "poster pink".
 * Use `black` / `go` / `flame` when you need a fixed colour.
 */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const invert = (scale) => Object.fromEntries(STEPS.map((s, i) => [s, scale[STEPS[STEPS.length - 1 - i]]]))

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      black: '#000000',
      white: '#0f0f10', // card / sheet surface
      paper: '#ffffff', // true white when needed
      slate: {
        50: '#050505', // page
        100: '#161617', // subtle fill
        200: '#27272a', // hairline borders
        300: '#3f3f46', // input rings, stronger borders
        400: '#71717a', // placeholder, muted icons
        500: '#9b9ba3', // muted text
        600: '#b9b9c0', // secondary text
        700: '#d4d4d8',
        800: '#e6e6e9',
        900: '#f4f4f5',
        950: '#ffffff', // primary ink
      },
      brand: {
        50: '#1f0f17',
        100: '#2e1522',
        200: '#4a2236',
        300: '#6e3150',
        400: '#a34a76',
        500: '#d06a9a',
        600: '#e486b0',
        700: '#f29cc0',
        800: '#f6a8c8', // poster pink
        900: '#fac0d8',
        950: '#fde0ec',
      },
      go: '#34d27b', // poster green (C1/26) — "now pitching", live
      flame: '#ff7f3f', // poster orange
      amber: invert(colors.amber),
      emerald: invert(colors.emerald),
      red: invert(colors.red),
      violet: invert(colors.violet),
      sky: invert(colors.sky),
    },
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        pixel: ['Silkscreen', '"Courier New"', 'monospace'],
        display: ['"Josefin Sans"', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      keyframes: {
        flash: {
          '0%': { backgroundColor: 'rgba(246,168,200,0.45)' },
          '100%': { backgroundColor: 'transparent' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.85)' },
        },
      },
      animation: {
        flash: 'flash 2.4s ease-out',
        rise: 'rise .18s ease-out',
        twinkle: 'twinkle 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
