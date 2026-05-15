import { describe, expect, it } from 'vitest'
import { base64ToBlob, normalizeImageUrl, urlToFilename } from './image'

describe('image helpers', () => {
  it('converts base64 data urls to image blobs', () => {
    const blob = base64ToBlob('data:image/png;base64,aGVsbG8=')

    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(5)
  })

  it('normalizes provider image payloads', () => {
    expect(normalizeImageUrl({ url: 'https://example.com/a.png' })).toBe('https://example.com/a.png')
    expect(normalizeImageUrl({ b64_json: 'abc' })).toBe('data:image/png;base64,abc')
  })

  it('extracts a safe filename from urls', () => {
    expect(urlToFilename('https://example.com/path/cat.png?x=1')).toBe('cat.png')
    expect(urlToFilename('data:image/png;base64,abc')).toBe('generated-image.png')
  })
})
