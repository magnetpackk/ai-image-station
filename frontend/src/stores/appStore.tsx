import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { decryptSecret, encryptSecret, randomUUID } from '../lib/crypto'
import type { AIProviderConfig, AppSettings, AuthSession } from '../types'

const SETTINGS_KEY = 'ai-image-station:settings'
const SESSION_KEY = 'ai-image-station:session'
const API_KEY_PASSWORD_KEY = 'ai-image-station:api-key-password'

const defaultSettings: AppSettings = {
  autoSave: true,
  rememberApiKey: true,
  theme: 'system',
  providers: [
    { id: 'openai', name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'dall-e-3', enabled: true },
  ],
  activeProviderId: 'openai',
  imageDefaults: { size: '1024x1024', quality: 'standard', style: 'vivid' },
}

function getApiKeyPassword() {
  let password = localStorage.getItem(API_KEY_PASSWORD_KEY)
  if (!password) {
    password = randomUUID()
    localStorage.setItem(API_KEY_PASSWORD_KEY, password)
  }
  return password
}

function stripPlaintextApiKeys(settings: AppSettings): AppSettings {
  return {
    ...settings,
    providers: settings.providers.map((provider) => {
      const sanitized = { ...provider }
      delete sanitized.apiKey
      return sanitized
    }),
  }
}

function loadSettings(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<AppSettings>
    return stripPlaintextApiKeys({ ...defaultSettings, ...parsed })
  } catch {
    return defaultSettings
  }
}

function loadSession(): AuthSession | undefined {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as AuthSession | null
    return session?.token ? session : undefined
  } catch {
    return undefined
  }
}

async function serializeSettings(settings: AppSettings): Promise<AppSettings> {
  const password = getApiKeyPassword()
  const providers = await Promise.all(settings.providers.map(async (provider): Promise<AIProviderConfig> => {
    if (!settings.rememberApiKey) {
      const sanitized = { ...provider }
      delete sanitized.apiKey
      delete sanitized.apiKeyEncrypted
      return sanitized
    }

    if (!provider.apiKey) {
      const sanitized = { ...provider }
      delete sanitized.apiKey
      return sanitized
    }

    const { apiKey, ...rest } = provider
    return { ...rest, apiKeyEncrypted: await encryptSecret(apiKey, password) }
  }))

  return { ...settings, providers }
}

async function decryptSettings(settings: AppSettings): Promise<AppSettings> {
  const password = getApiKeyPassword()
  const providers = await Promise.all(settings.providers.map(async (provider): Promise<AIProviderConfig> => {
    if (!provider.apiKeyEncrypted || provider.apiKey) return provider
    try {
      return { ...provider, apiKey: await decryptSecret(provider.apiKeyEncrypted, password) }
    } catch {
      return provider
    }
  }))

  return { ...settings, providers }
}

type AppStore = {
  session?: AuthSession
  settings: AppSettings
  activePage: 'generate' | 'gallery' | 'settings'
  setSession: (session?: AuthSession) => void
  setSettings: (settings: AppSettings) => void
  clearLocalSettings: () => void
  setActivePage: (page: AppStore['activePage']) => void
}

const Context = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | undefined>(() => loadSession())
  const [settings, setSettingsState] = useState<AppSettings>(() => loadSettings())
  const [activePage, setActivePage] = useState<AppStore['activePage']>('generate')

  useEffect(() => {
    let cancelled = false
    decryptSettings(settings).then((decrypted) => {
      if (!cancelled && JSON.stringify(decrypted) !== JSON.stringify(settings)) setSettingsState(decrypted)
    })
    return () => { cancelled = true }
    // Decrypt persisted settings once on mount; subsequent updates are already in memory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AppStore>(() => ({
    session,
    settings,
    activePage,
    setSession(next) {
      setSessionState(next)
      if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
      else sessionStorage.removeItem(SESSION_KEY)
    },
    setSettings(next) {
      setSettingsState(next)
      serializeSettings(next).then((serialized) => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(serialized))
      }).catch(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(stripPlaintextApiKeys(next)))
      })
    },
    clearLocalSettings() {
      localStorage.removeItem(SETTINGS_KEY)
      localStorage.removeItem(API_KEY_PASSWORD_KEY)
      setSettingsState(defaultSettings)
    },
    setActivePage,
  }), [activePage, session, settings])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppStore() {
  const value = useContext(Context)
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider')
  return value
}
