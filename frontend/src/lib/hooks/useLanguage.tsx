'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { translations, Language, TranslationKey } from '../translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const isSupportedLanguage = (value: string | undefined): value is Language => {
  return !!value && value in translations;
};

const readLanguageCookie = (): Language | null => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/(?:^|; )mp_language=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return isSupportedLanguage(value ?? undefined) ? (value as Language) : null;
};

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: Language;
}) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof document !== 'undefined') {
      return readLanguageCookie() ?? initialLanguage;
    }

    return initialLanguage;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);

    if (typeof document !== 'undefined') {
      document.cookie = `mp_language=${encodeURIComponent(lang)}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return (translations[language] as Record<TranslationKey, string>)[key] || key;
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
