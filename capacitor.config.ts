import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bingola.app',
  appName: 'Bingola',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '785435369497-bpall80a7ssrm9sq5i25rfp1bsfhmfjd.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
