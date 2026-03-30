import type React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import { MotionProvider } from '@/lib/providers/motion-provider';
import { PublicEnvScript } from 'next-runtime-env';
import { translations, type Language } from '@/lib/translations';
import './globals.css';

const supportedLanguages = new Set(Object.keys(translations) as Language[]);
const defaultLanguage = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE as Language | undefined) ?? 'en';

function resolveLanguage(value: string | undefined): Language {
  return value && supportedLanguages.has(value as Language) ? (value as Language) : defaultLanguage;
}

export const metadata: Metadata = {
  title: 'Minepanel',
  description: 'Minecraft Server Management Panel',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({ children }: { readonly children: React.ReactNode }) {
  const cookieStore = await cookies();
  const htmlLang = resolveLanguage(cookieStore.get('mp_language')?.value);

  return (
    <html lang={htmlLang}>
      <head>
        <PublicEnvScript />
      </head>
      <body>
        <MotionProvider>
          <LanguageProvider initialLanguage={htmlLang}>
            {children}
            <Toaster />
          </LanguageProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
