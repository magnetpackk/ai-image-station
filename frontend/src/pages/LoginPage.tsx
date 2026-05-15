import type { FormEvent } from 'react'
import { useState } from 'react'
import { login } from '../api/backend'
import { Button } from '../components/Button'
import { ErrorAlert } from '../components/ErrorAlert'
import { Input } from '../components/Input'
import { useAppStore } from '../stores/appStore'

export function LoginPage() {
  const { setSession } = useAppStore()
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      setSession(await login(accessCode))
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
    <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-sm text-indigo-200">私有部署 · Key 不过服务器 · 即画即分享</span>
        <h1 className="mt-8 text-5xl font-black tracking-tight md:text-7xl">AI Image Station</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">个人 AI 绘图与图床一体化工作站。浏览器直连 AI API，生成图片自动保存为公网直链，并提供画廊管理。</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {['Access Code 防护', '自动保存图床', '本地加密 API Key'].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{item}</div>)}
        </div>
      </section>
      <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-white p-8 text-slate-900 shadow-2xl">
        <h2 className="text-2xl font-bold">进入工作站</h2>
        <p className="mt-2 text-sm text-slate-500">请输入服务器配置的 Access Code，成功后 token 将保存在 sessionStorage。</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="access-code">Access Code</label>
        <div className="mt-2"><Input id="access-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="your-access-code" /></div>
        <div className="mt-4"><ErrorAlert message={error} /></div>
        <Button className="mt-6 w-full" disabled={!accessCode || loading}>{loading ? '校验中...' : '进入工作站'}</Button>
      </form>
    </div>
  </main>
}
