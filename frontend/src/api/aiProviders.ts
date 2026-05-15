import type { AIProviderConfig } from '../types'
import { normalizeImageUrl } from '../lib/image'

export type GenerateInput = { prompt: string; negativePrompt?: string; size: string; quality: string; style: string; n: number; apiKey: string }

function buildURL(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '')
  if (!url.endsWith('/v1')) url += '/v1'
  return url
}

async function safeJSON(response: Response): Promise<any> {
  const ct = response.headers.get('Content-Type') || ''
  if (!ct.includes('application/json')) {
    const text = await response.text()
    throw new Error(`AI API 返回了非 JSON 响应 (${response.status})。请检查 Base URL 是否正确。\nContent-Type: ${ct}\n前100字符: ${text.slice(0, 100)}`)
  }
  return response.json()
}

export async function generateWithOpenAI(provider: AIProviderConfig, input: GenerateInput): Promise<string[]> {
  const baseUrl = buildURL(provider.baseUrl)
  const model = provider.defaultModel || 'dall-e-3'
  const body: Record<string, any> = {
    model,
    prompt: input.negativePrompt ? `${input.prompt}\nNegative prompt: ${input.negativePrompt}` : input.prompt,
    size: input.size,
    n: input.n,
  }
  // Only send DALL-E specific params for DALL-E models
  if (model.startsWith('dall-e')) {
    if (input.quality) body.quality = input.quality
    if (input.style) body.style = input.style
  }
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errBody = await safeJSON(response).catch(() => ({}))
    const message = errBody?.error?.message || response.statusText
    throw new Error(`AI API 调用失败 (${response.status}): ${message}`)
  }
  const data = await safeJSON(response) as { data?: Array<{ url?: string; b64_json?: string }> }
  return (data.data ?? []).map(normalizeImageUrl)
}

export const generateWithCustomProvider = generateWithOpenAI
