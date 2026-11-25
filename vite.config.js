import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const appVersion = JSON.parse(
  readFileSync(new URL('./public/version.json', import.meta.url), 'utf8'),
);

// Inject the same version metadata used by the Android Gradle build so the web
// client can compare its own bundled version against the latest published one.
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_SF_VERSION_CODE': JSON.stringify(appVersion.versionCode),
    'import.meta.env.VITE_SF_VERSION_NAME': JSON.stringify(appVersion.versionName),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Listen on all network addresses (LAN / WiFi)
    port: 5173,
    allowedHosts: true, // Allow all hosts for tunneling & external testing
  },
});
