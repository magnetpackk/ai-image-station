import { useState } from 'react'
import { deleteImage, listImages } from '../api/backend'
import { Button } from '../components/Button'
import { CopyButton } from '../components/CopyButton'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { useAppStore } from '../stores/appStore'
import type { GalleryImage } from '../types'

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function GalleryPage() {
  const { session } = useAppStore()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [keyword, setKeyword] = useState('')
  const [source, setSource] = useState('')
  const [sort, setSort] = useState('createdAt_desc')
  const [selected, setSelected] = useState<GalleryImage>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function refresh() {
    if (!session) return
    setLoading(true); setError(undefined)
    try {
      const data = await listImages(session.token, { keyword, source, sort, page: 1, pageSize: 30 })
      setImages(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取画廊失败')
    } finally { setLoading(false) }
  }

  async function remove(image: GalleryImage) {
    if (!session) return
    await deleteImage(session.token, image.id)
    setImages((items) => items.filter((item) => item.id !== image.id))
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <div><h1 className="text-3xl font-black">图片画廊</h1><p className="mt-2 text-slate-500">浏览本地图床中的图片，复制直链、Markdown 或 HTML img 标签。</p></div>
    <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1fr_180px_180px_auto]">
      <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索 prompt" />
      <Select value={source} onChange={(e) => setSource(e.target.value)}><option value="">全部来源</option><option value="text-to-image">文生图</option><option value="image-to-image">图生图</option><option value="manual-upload">手动上传</option></Select>
      <Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="createdAt_desc">最新优先</option><option value="createdAt_asc">最早优先</option><option value="size_desc">体积最大</option><option value="size_asc">体积最小</option></Select>
      <Button onClick={refresh} disabled={loading}>{loading ? '刷新中' : '刷新'}</Button>
    </section>
    <ErrorAlert message={error} />
    {images.length === 0 ? <EmptyState title="暂无图片" description="生成图片并自动保存后会出现在这里。" /> : <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{images.map((image) => <article key={image.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><button className="block w-full" onClick={() => setSelected(image)}><img loading="lazy" src={image.thumbnailUrl ?? image.url} alt={image.prompt} className="aspect-square w-full object-cover" /></button><div className="space-y-3 p-4"><p className="line-clamp-2 text-sm font-medium">{image.prompt}</p><div className="flex flex-wrap gap-2 text-xs text-slate-500"><span>{image.model}</span><span>{image.source}</span></div><div className="flex flex-wrap gap-2"><CopyButton value={image.url} label="直链" /><Button type="button" className="bg-red-600 hover:bg-red-500" onClick={() => remove(image)}>删除</Button></div></div></article>)}</section>}
    {selected && <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/70 p-4" onClick={() => setSelected(undefined)}><article className="max-h-[90vh] max-w-4xl overflow-auto rounded-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}><img src={selected.url} alt={selected.prompt} className="max-h-[60vh] w-full rounded-2xl object-contain" /><h2 className="mt-4 text-xl font-bold">{selected.prompt}</h2><div className="mt-4 flex flex-wrap gap-2"><CopyButton value={selected.url} label="复制直链" /><CopyButton value={`![${selected.prompt}](${selected.url})`} label="复制 Markdown" /><CopyButton value={`<img src="${escapeHtmlAttribute(selected.url)}" alt="${escapeHtmlAttribute(selected.prompt)}" />`} label="复制 HTML" /><Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={() => setSelected(undefined)}>关闭</Button></div></article></div>}
  </div>
}
