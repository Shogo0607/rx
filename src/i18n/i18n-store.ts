import { create } from 'zustand'
import type { Locale } from './types'
import en from './locales/en'
import ja from './locales/ja'

const STORAGE_KEY = 'rx-locale'

const translations = { en, ja } as const

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ja') return stored
  const systemLang = navigator.language.slice(0, 2)
  return systemLang === 'en' ? 'en' : 'ja'
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: keyof typeof en) => string
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),

  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale)
    set({ locale })
  },

  t: (key) => {
    const { locale } = get()
    return translations[locale][key] ?? translations.en[key] ?? key
  },
}))
