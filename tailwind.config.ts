import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecf5ff',
          100: '#dcecff',
          200: '#bedcff',
          300: '#91c4ff',
          400: '#5ea3ff',
          500: '#347fff',
          600: '#1f62f3',
          700: '#184ddd',
          800: '#1b40b2',
          900: '#1c398c',
        },
      },
    },
  },
  plugins: [],
}

export default config
