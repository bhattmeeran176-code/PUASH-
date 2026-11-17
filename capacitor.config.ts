import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puash.app',
  appName: 'PUASH',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#f3f5ed',
  android: {
    allowMixedContent: false,
  },
};

export default config;
