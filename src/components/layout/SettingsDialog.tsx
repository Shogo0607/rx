import { useState, useEffect } from 'react'
import { useUiStore } from '../../stores/ui-store'
import { useT } from '../../i18n'
import { ipcInvoke } from '../../lib/ipc-client'
import { X, Eye, EyeOff, Check, Loader2 } from 'lucide-react'

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsDialogOpen)
  const setOpen = useUiStore((s) => s.setSettingsDialogOpen)
  const t = useT()

  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load settings when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSaved(false)
    setShowKey(false)

    Promise.all([
      ipcInvoke('settings:get', 'openai_api_key'),
      ipcInvoke('settings:get', 'openai_base_url'),
      ipcInvoke('settings:get', 'default_model')
    ])
      .then(([key, url, model]) => {
        setApiKey(key ?? '')
        setBaseUrl(url ?? '')
        setDefaultModel(model ?? 'gpt-4o')
      })
      .catch((err) => {
        console.error('Failed to load settings:', err)
      })
      .finally(() => setLoading(false))
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        ipcInvoke('settings:set', { key: 'openai_api_key', value: apiKey }),
        ipcInvoke('settings:set', { key: 'openai_base_url', value: baseUrl }),
        ipcInvoke('settings:set', { key: 'default_model', value: defaultModel || 'gpt-4o' })
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const maskedKey = apiKey
    ? apiKey.slice(0, 7) + '...' + apiKey.slice(-4)
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="relative w-[480px] rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{t('settings.title')}</h2>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* OpenAI API Key */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('settings.apiKey')}</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={showKey ? apiKey : (apiKey ? maskedKey : '')}
                    onChange={(e) => {
                      setShowKey(true)
                      setApiKey(e.target.value)
                    }}
                    onFocus={() => setShowKey(true)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 text-sm rounded-md border border-border bg-background outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('settings.apiKeyHint')}</p>
              </div>

              {/* Base URL (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('settings.baseUrl')}</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background outline-none focus:border-primary transition-colors"
                />
                <p className="text-[11px] text-muted-foreground">{t('settings.baseUrlHint')}</p>
              </div>

              {/* Default Model */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('settings.defaultModel')}</label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="gpt-4o"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background outline-none focus:border-primary transition-colors"
                />
                <p className="text-[11px] text-muted-foreground">{t('settings.defaultModelHint')}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {saved ? t('settings.saved') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
