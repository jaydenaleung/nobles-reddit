export interface AppConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  region: string;
  allowedDomains: string[];
  classYearMin: number;
  classYearMax: number;
  recaptchaSiteKey: string;
  publicUrl: string;
  useEmulators: boolean;
}

declare const __APP_CONFIG__: AppConfig;

/** Built from the env file at build time. Contains only values that are public by design. */
export const config: AppConfig = __APP_CONFIG__;

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1] ?? '';
  return config.allowedDomains.includes(domain);
}
