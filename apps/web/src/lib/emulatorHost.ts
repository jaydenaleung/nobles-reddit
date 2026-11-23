/**
 * Where the Firebase emulators are, from the browser's point of view.
 * On your own computer that is 127.0.0.1. When the page was opened from another
 * device over the local network (npm run dev:lan, e.g. http://192.168.1.20:5173),
 * 127.0.0.1 would be that device itself, so the emulators are reached at the
 * same address the page came from.
 */
const LOCAL = new Set(['', 'localhost', '127.0.0.1', '[::1]']);

export const EMULATOR_HOST: string = LOCAL.has(window.location.hostname)
  ? '127.0.0.1'
  : window.location.hostname;
