import type en from './locales/en'

export type Locale = 'en' | 'ja'
export type TranslationKey = keyof typeof en
