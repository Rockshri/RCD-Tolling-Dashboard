/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: '#0c5f64',
        header: '#083e42',
        page: '#e7ebf0',
        card: '#ffffff',
        bord: '#c9d2db',
        ink: '#101922',
        good: '#17803d',
        warn: '#b3630c',
        bad: '#b32219',
        grey: '#5a6773',
        darkgrey: '#2b333d',
      },
      fontFamily: {
        body: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Barlow Semi Condensed"', 'Barlow', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        kpi: ['38px', { lineHeight: '1.05', fontWeight: '700' }],
        count: ['18px', { lineHeight: '1.1', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
