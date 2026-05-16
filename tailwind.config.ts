import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          critical: '#A32D2D',
          'critical-bg': '#FCEBEB',
          high: '#993C1D',
          'high-bg': '#FAECE7',
          medium: '#854F0B',
          'medium-bg': '#FAEEDA',
          low: '#3B6D11',
          'low-bg': '#EAF3DE',
        },
        fhir: {
          DEFAULT: '#185FA5',
          bg: '#E6F1FB',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
