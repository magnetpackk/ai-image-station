import type { AuthSession, GalleryImage, ImageSource, PaginatedImages } from '../types'

type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = (await response.json()) as ApiResponse<T>
  if (!response.ok || !payload.success) {
    const message = payload.success ? response.statusText : payload.error.message
    throw new Error(message || 'Request failed')
  }
  return payload.data
}

export function login(accessCode: string) {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode }),
  })
}

export function getMe(token: string) {
  return request<{ authenticated: boolean; expiresAt: string }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export type UploadImageInput = {
  file: File | Blob
  prompt: string
  negativePrompt?: string
  model: string
  provider: string
  width?: number
  height?: number
  source: ImageSource
  seed?: string
  generationParams?: Record<string, unknown>
}

export function uploadImage(token: string, input: UploadImageInput) {
  const form = new FormData()
  form.append('file', input.file, input.file instanceof File ? input.file.name : 'generated-image.png')
  form.append('prompt', input.prompt)
  form.append('model', input.model)
  form.append('provider', input.provider)
  form.append('source', input.source)
  if (input.negativePrompt) form.append('negativePrompt', input.negativePrompt)
  if (input.width) form.append('width', String(input.width))
  if (input.height) form.append('height', String(input.height))
  if (input.seed) form.append('seed', input.seed)
  if (input.generationParams) form.append('generationParams', JSON.stringify(input.generationParams))

  return request<GalleryImage>('/api/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
}

export function listImages(token: string, params: { page?: number; pageSize?: number; sort?: string; source?: string; keyword?: string } = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => value && query.set(key, String(value)))
  return request<PaginatedImages>(`/api/images?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function deleteImage(token: string, id: string) {
  return request<{ deleted: boolean }>(`/api/images/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getStats(token: string) {
  return request<{ totalImages: number; totalSize: number }>('/api/stats', {
    headers: { Authorization: `Bearer ${token}` },
  })
}
