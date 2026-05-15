export type ProviderType = 'openai' | 'mj-proxy' | 'custom'
export type ImageSource = 'text-to-image' | 'image-to-image' | 'manual-upload'
export type ThemeMode = 'light' | 'dark' | 'system'

export type EncryptedSecret = {
  version: 1
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2'
  salt: string
  iv: string
  ciphertext: string
}

export type AIProviderConfig = {
  id: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKeyEncrypted?: EncryptedSecret
  apiKey?: string
  defaultModel: string
  enabled: boolean
}

export type AppSettings = {
  autoSave: boolean
  rememberApiKey: boolean
  theme: ThemeMode
  activeProviderId?: string
  providers: AIProviderConfig[]
  imageDefaults: {
    size: '1024x1024' | '1024x1792' | '1792x1024'
    quality: 'standard' | 'hd'
    style: 'vivid' | 'natural'
  }
}

export type AuthSession = { token: string; expiresAt: string }

export type GalleryImage = {
  id: string
  url: string
  thumbnailUrl?: string
  filename?: string
  prompt: string
  negativePrompt?: string
  model: string
  provider: string
  width?: number
  height?: number
  size?: number
  mimeType?: string
  source: ImageSource
  createdAt: string
  generationParams?: Record<string, unknown>
}

export type PaginatedImages = {
  items: GalleryImage[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type GenerationStatus = 'idle' | 'generating' | 'fetching-image' | 'uploading' | 'saved' | 'failed'
export type GeneratedImage = { id: string; previewUrl: string; publicUrl?: string; status: GenerationStatus; error?: string }
