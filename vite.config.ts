import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const USE_HTTPS = env.VITE_DEV_HTTPS !== 'false'; // Default to true for Camera API

  return {
    server: {
      port: 3333,
      host: '127.0.0.1',
      https: USE_HTTPS ? {} : false,
    },
    plugins: [
      react(),
      USE_HTTPS && basicSsl(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], // Structural assets only
          globIgnores: ['**/node_modules/**/*', '**/*.mp3', '**/*.wav', '**/audio/**/*'], // Explicitly ignore audio
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Generous 10MB limit
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:mp3|wav|ogg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                rangeRequests: true,
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'assets-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Bingola - Bingo Social',
          short_name: 'Bingola',
          description: 'A sorte começa aqui. Jogue bingo social com seus amigos.',
          start_url: '/',
          display: 'standalone',
          background_color: '#000000',
          theme_color: '#ff3d71',
          orientation: 'portrait',
          categories: ['games', 'social'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Iniciar Jogo',
              short_name: 'Jogar',
              url: '/',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192'
                }
              ]
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      }
    }
  };
});
