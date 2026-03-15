import { useI18nStore } from './i18n-store'
import type en from './locales/en'

export function useT(): (key: keyof typeof en) => string {
  const locale = useI18nStore((s) => s.locale)
  const t = useI18nStore((s) => s.t)
  void locale
  return t
}
