import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import qrcode from 'qrcode-generator';
import { defineConfig, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

/**
 * Reads configuration from the repo root.
 *   --mode emulator  -> .env.emulator (fake values, committed)
 *   anything else    -> .env.local    (real values, git-ignored)
 * Only the fields picked below reach the browser. Server-side values such as
 * the Anthropic key are never read into the bundle.
 */
function readEnv(mode: string): Record<string, string> {
  const file = path.join(repoRoot, mode === 'emulator' ? '.env.emulator' : '.env.local');
  const fromFile = existsSync(file) ? dotenv.parse(readFileSync(file)) : {};
  return { ...fromFile };
}

function publicUrl(env: Record<string, string>): string {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
  return `https://${env.FIREBASE_PROJECT_ID ?? 'localhost'}.web.app`;
}

/** Builds the QR code for the hall screen at build time, as SVG path data. */
function joinQrPlugin(url: string): Plugin {
  const id = 'virtual:join-qr';
  return {
    name: 'commons-join-qr',
    resolveId(source) {
      return source === id ? `\0${id}` : null;
    },
    load(loaded) {
      if (loaded !== `\0${id}`) return null;
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const size = qr.getModuleCount();
      let d = '';
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return `export const qrSize = ${size};\nexport const qrPath = ${JSON.stringify(d)};\nexport const joinUrl = ${JSON.stringify(url)};\n`;
    },
  };
}

/**
 * `vite preview` serves the built app with the same security headers as
 * Firebase Hosting (read from firebase.json), so the end-to-end tests run
 * under the real Content-Security-Policy. The only change is that the local
 * emulator addresses are allowed as connection targets.
 */
function hostingHeadersPlugin(): Plugin {
  return {
    name: 'commons-hosting-headers',
    configurePreviewServer(server) {
      const firebaseJson = JSON.parse(readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
      const headers: { key: string; value: string }[] = firebaseJson.hosting.headers[0].headers;
      server.middlewares.use((_req, res, next) => {
        for (const { key, value } of headers) {
          if (key === 'Strict-Transport-Security') continue;
          if (key === 'Content-Security-Policy') {
            const local = value
              .replace('connect-src', 'connect-src http://127.0.0.1:* ws://127.0.0.1:* http://localhost:*')
              .replace('; upgrade-insecure-requests', '');
            res.setHeader(key, local);
          } else {
            res.setHeader(key, value);
          }
        }
        next();
      });
    },
  };
}

/**
 * Dev server only, emulator mode only. Lets the color palette on /dev write a
 * changed color back into src/styles/tokens.css.
 */
function paletteSavePlugin(): Plugin {
  const file = path.join(here, 'src/styles/tokens.css');
  return {
    name: 'commons-palette-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__palette', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 20_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const { theme, tokens } = JSON.parse(raw) as { theme: string; tokens: Record<string, string> };
            if (!['paper', 'night', 'board'].includes(theme)) throw new Error('Unknown theme.');
            const lines = readFileSync(file, 'utf8').split('\n');
            const start = theme === 'paper' ? ':root, [data-theme="paper"]' : `[data-theme="${theme}"]`;
            const index = lines.findIndex((line) => line.startsWith(start));
            if (index < 0) throw new Error('Theme not found in tokens.css.');
            let line = lines[index]!;
            for (const [name, value] of Object.entries(tokens)) {
              if (!/^--[a-z-]+$/.test(name) || !/^#[0-9a-fA-F]{6}$/.test(value))
                throw new Error('Bad value.');
              const pattern = new RegExp(`(?<![\\w-])(${name}:)#[0-9a-fA-F]{6}`);
              if (!pattern.test(line)) throw new Error(`${name} is not in the ${theme} theme.`);
              line = line.replace(pattern, `$1${value.toUpperCase()}`);
            }
            lines[index] = line;
            writeFileSync(file, lines.join('\n'));
            res.end('saved');
          } catch (err) {
            res.statusCode = 400;
            res.end(err instanceof Error ? err.message : 'Bad request.');
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = readEnv(mode);
  const useEmulators = mode === 'emulator';
  const appConfig = {
    firebase: {
      apiKey: env.FIREBASE_WEB_API_KEY ?? '',
      authDomain: env.FIREBASE_AUTH_DOMAIN ?? '',
      projectId: env.FIREBASE_PROJECT_ID ?? '',
      storageBucket: env.FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: env.FIREBASE_APP_ID ?? '',
    },
    region: env.FUNCTIONS_REGION || 'us-east1',
    allowedDomains: (env.ALLOWED_EMAIL_DOMAINS || 'nobles.edu')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    classYearMin: Number(env.CLASS_YEAR_MIN || 2027),
    classYearMax: Number(env.CLASS_YEAR_MAX || 2033),
    recaptchaSiteKey: env.RECAPTCHA_ENTERPRISE_SITE_KEY ?? '',
    publicUrl: publicUrl(env),
    useEmulators,
  };

  return {
    root: here,
    plugins: [
      react(),
      joinQrPlugin(appConfig.publicUrl),
      hostingHeadersPlugin(),
      ...(useEmulators ? [paletteSavePlugin()] : []),
    ],
    define: {
      __APP_CONFIG__: JSON.stringify(appConfig),
      // A plain boolean, so the emulator-only sign-in code is removed from production builds.
      __USE_EMULATORS__: JSON.stringify(useEmulators),
    },
    // No env files are auto-loaded into import.meta.env: everything goes through __APP_CONFIG__.
    envDir: path.join(here, 'no-env-here'),
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
    },
    // `npm run dev:lan` sets LAN_DEV so other devices on the local network can open the dev server.
    server: { host: process.env.LAN_DEV ? '0.0.0.0' : '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 5000, strictPort: true },
  };
});
