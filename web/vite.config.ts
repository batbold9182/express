import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  // `import Icon from './x.svg?react'` → an inline-SVG React component that inherits currentColor
  // and takes width/height/className props. Plain `import url from './x.svg'` still resolves to the URL.
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      '@tunelog/shared': path.resolve(__dirname, '../shared'),
    },
  },
});
