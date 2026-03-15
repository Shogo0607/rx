import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useI18nStore } from '../i18n'

const LOCALE_MAP = { en: 'en-US', ja: 'ja-JP' } as const

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const locale = LOCALE_MAP[useI18nStore.getState().locale]
  return new Date(dateStr).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(dateStr: string): string {
  const locale = LOCALE_MAP[useI18nStore.getState().locale]
  return new Date(dateStr).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}
