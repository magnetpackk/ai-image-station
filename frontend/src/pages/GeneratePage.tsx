import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { generateWithCustomProvider, generateWithOpenAI } from '../api/aiProviders'
import { uploadImage } from '../api/backend'
import { Button } from '../components/Button'
import { CopyButton } from '../components/CopyButton'
import { ErrorAlert } from '../components/ErrorAlert'
import { Select } from '../components/Select'
import { Textarea } from '../components/Textarea'
import { imageSizeFromSetting, urlToBlob } from '../lib/image'
import { randomUUID } from '../lib/crypto'
import { useAppStore } from '../stores/appStore'
import type { GeneratedImage } from '../types'

export function GeneratePage() {
  const { settings, session, setActivePage } = useAppStore()
  const provider = useMemo(() => settings.providers.find((item) => item.id === settings.activeProviderId) ?? settings.providers[0], [settings])
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [count, setCount] = useState(1)
  const [results, setResults] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!provider?.apiKey) { setError('请先到设置页填写 API Key'); setActivePage('settings'); return }
    setLoading(true); setError(undefined)
    try {
      const generator = provider.type === 'openai' ? generateWithOpenAI : generateWithCustomProvider
      const urls = await generator(provider, { prompt, negativePrompt, n: count, apiKey: provider.apiKey, ...settings.imageDefaults })
      const next: GeneratedImage[] = []
      for (const url of urls) {
        const item: GeneratedImage = { id: randomUUID(), previewUrl: url, status: settings.autoSave ? 'uploading' : 'saved' }
        next.push(item); setResults([...next])
        if (settings.autoSave && session) {
          const blob = await urlToBlob(url)
          const { width, height } = imageSizeFromSetting(settings.imageDefaults.size)
          const saved = await uploadImage(session.token, { file: blob, prompt, negativePrompt, provider: provider.type, model: provider.defaultModel, width, height, source: 'text-to-image', generationParams: settings.imageDefaults })
          item.publicUrl = saved.url; item.status = 'saved'; setResults([...next])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally { setLoading(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-3xl font-black">生成图片</h1><p className="mt-2 text-slate-500">前端直接调用 AI API，Key 不经过服务器；开启自动保存后会上传图片 Blob 到 /api/images。</p></div>
    <form onSubmit={generate} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm font-medium">正向 Prompt<Textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="a cute cat sitting on the moon, cinematic lighting" /></label>
        <label className="mt-4 block text-sm font-medium">反向 Prompt<Textarea rows={3} value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="blurry, low quality" /></label>
      </section>
      <aside className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div><div className="text-sm text-slate-500">当前 Provider</div><div className="font-semibold">{provider?.name ?? '未配置'} · {provider?.defaultModel}</div></div>
        <label className="block text-sm font-medium">生成数量<Select value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={4}>4</option></Select></label>
        <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">浏览器直连第三方 API 可能遇到 CORS。如失败，可尝试支持浏览器调用的 OpenAI-compatible 网关。</div>
        <Button className="w-full" disabled={!prompt || loading}>{loading ? '生成中...' : '开始生成'}</Button>
      </aside>
    </form>
    <ErrorAlert message={error} />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><img src={item.previewUrl} alt={prompt} className="aspect-square w-full object-cover" /><div className="space-y-3 p-4"><div className="text-sm text-slate-500">状态：{item.status}</div>{item.publicUrl && <CopyButton value={item.publicUrl} label="复制直链" />}<Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={() => window.open(item.previewUrl)}>下载/打开</Button></div></article>)}</section>
  </div>
}
