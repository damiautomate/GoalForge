export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'system-ui', 'sans-serif'], display: ['Playfair Display', 'serif'] },
      colors: {
        brand: { 50: '#FFF8ED', 100: '#FFEFD4', 200: '#FFD9A0', 300: '#FFBC61', 400: '#FF9D2E', 500: '#F58407', 600: '#E66A02', 700: '#BF4D06', 800: '#983C0C', 900: '#7D330E' },
        dark: { 50: '#f6f6f4', 100: '#e7e6e1', 800: '#1a1d24', 850: '#14171e', 900: '#0c0f14', 950: '#080a0e' }
      }
    }
  },
  plugins: []
}
