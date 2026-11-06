/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Parchment and ink
        parchment: {
          50: '#f6ecd2',
          100: '#efe0bd',
          200: '#e2cda0',
          300: '#d2b688',
          400: '#bf9c6a',
          500: '#a88252',
          600: '#8b6740',
          700: '#6b4d2f',
        },
        ink: '#2b1d10',
        // Gold trim of the classic UI frame
        gold: {
          200: '#f7e3a1',
          300: '#e8c66a',
          400: '#d4a942',
          500: '#b8862b',
          600: '#8f6416',
          700: '#5f420c',
        },
        // Ironhold stone and night sky
        stone: {
          900: '#0e0b08',
          800: '#14100c',
          700: '#1d1712',
          600: '#2a211a',
          500: '#3a2e23',
          400: '#4d3d2e',
        },
        // Class + resource accents
        ember: '#e05a2b',
        mana: '#2f6fd0',
        rage: '#c0392b',
        holy: '#f0c95a',
        hp: '#1e7a2e',
        quality: {
          poor: '#9d9d9d',
          common: '#ffffff',
          uncommon: '#1eff00',
          rare: '#0070dd',
          epic: '#a335ee',
          legendary: '#ff8000',
        },
      },
      fontFamily: {
        display: ['CinzelBold'],
        serif: ['Cinzel'],
        body: ['Alegreya'],
      },
      spacing: {
        hud: '6px',
        safe: 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
};
