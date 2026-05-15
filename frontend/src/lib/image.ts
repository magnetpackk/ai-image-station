export function base64ToBlob(input: string): Blob {
  const [meta, payload] = input.includes(',') ? input.split(',', 2) : ['data:image/png;base64', input]
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) return base64ToBlob(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error('无法下载生成图片，可能被 CORS 拦截')
  return response.blob()
}

export function normalizeImageUrl(payload: { url?: string; b64_json?: string }): string {
  if (payload.url) return payload.url
  if (payload.b64_json) return `data:image/png;base64,${payload.b64_json}`
  throw new Error('AI API 响应中没有图片 URL 或 base64')
}

export function urlToFilename(url: string): string {
  if (url.startsWith('data:')) return 'generated-image.png'
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || 'generated-image.png'
  } catch {
    return 'generated-image.png'
  }
}

export function imageSizeFromSetting(size: string) {
  const [width, height] = size.split('x').map(Number)
  return { width, height }
}
