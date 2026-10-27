import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0A0B0E',
        card: '#14171F',
        'card-elevated': '#1D222E',
        brand: {
          DEFAULT: '#CADA03',
          hover: '#B8C702',
          glow: 'rgba(202, 218, 3, 0.25)',
          text: '#0A0B0E',
        },
        volt: {
          DEFAULT: '#CADA03',
          hover: '#B8C702',
          glow: 'rgba(202, 218, 3, 0.25)',
        },
        orange: {
          brand: '#CADA03',
          hover: '#B8C702',
          glow: 'rgba(202, 218, 3, 0.25)',
        },
        muted: '#94A3B8',
        border: '#2A303C',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
