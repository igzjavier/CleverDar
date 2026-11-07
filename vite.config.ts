import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path para GitHub Pages: https://<usuario>.github.io/cleverdar/
export default defineConfig({
  base: '/cleverdar/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      manifest: {
        name: 'CleverDar',
        short_name: 'CleverDar',
        description: 'Agenda unificada y planificador de estudio',
        lang: 'es-CL',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',
        display: 'standalone',
        start_url: './#/hoy',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
} as any);
