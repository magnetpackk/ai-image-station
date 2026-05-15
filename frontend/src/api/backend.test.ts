import { describe, expect, it, vi } from 'vitest'
import { login, uploadImage } from './backend'

describe('backend api client', () => {
  it('logs in with access code and returns token data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { token: 'session-token', expiresAt: '2026-05-15T12:00:00Z' } }),
    }))

    const result = await login('secret')

    expect(result.token).toBe('session-token')
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ accessCode: 'secret' }),
    }))
  })

  it('uploads images as multipart form data with bearer auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'img_1', url: '/images/img_1.png' } }),
    }))

    const file = new File(['x'], 'cat.png', { type: 'image/png' })
    const result = await uploadImage('token', {
      file,
      prompt: 'a cat',
      provider: 'openai',
      model: 'dall-e-3',
      source: 'text-to-image',
    })

    expect(result.id).toBe('img_1')
    expect(fetch).toHaveBeenCalledWith('/api/images', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: expect.any(FormData),
    }))
  })
})
