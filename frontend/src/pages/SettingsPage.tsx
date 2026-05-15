import type { FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { useAppStore } from '../stores/appStore'
import type { AIProviderConfig } from '../types'

export function SettingsPage() {
  const { settings, setSettings, clearLocalSettings } = useAppStore()
  const active = settings.providers.find((provider) => provider.id === settings.activeProviderId) ?? settings.providers[0]
  const [provider, setProvider] = useState<AIProviderConfig>(active)
  const [apiKey, setApiKey] = useState(active.apiKey ?? '')

  function save(event: FormEvent) {
    event.preventDefault()
    const nextProvider = { ...provider, apiKey: settings.rememberApiKey ? apiKey : undefined }
    const providers = settings.providers.some((item) => item.id === nextProvider.id) ? settings.providers.map((item) => item.id === nextProvider.id ? nextProvider : item) : [...settings.providers, nextProvider]
    setSettings({ ...settings, providers, activeProviderId: nextProvider.id })
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-3xl font-black">设置</h1><p className="mt-2 text-slate-500">配置 AI Provider、API Key 本地保存策略和默认生成参数。</p></div>
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold">Provider 设置</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">Provider Name<Input value={provider.name} onChange={(e) => setProvider({ ...provider, name: e.target.value })} /></label>
          <label className="block text-sm font-medium">Provider Type<Select value={provider.type} onChange={(e) => setProvider({ ...provider, type: e.target.value as AIProviderConfig['type'] })}><option value="openai">OpenAI Compatible</option><option value="custom">Custom</option><option value="mj-proxy">MJ Proxy</option></Select></label>
          <label className="block text-sm font-medium">Base URL<Input value={provider.baseUrl} onChange={(e) => setProvider({ ...provider, baseUrl: e.target.value })} /></label>
          <label className="block text-sm font-medium">API Key<Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." /></label>
          <label className="block text-sm font-medium">Default Model<Input value={provider.defaultModel} onChange={(e) => setProvider({ ...provider, defaultModel: e.target.value })} /></label>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold">生成默认值</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">默认尺寸<Select value={settings.imageDefaults.size} onChange={(e) => setSettings({ ...settings, imageDefaults: { ...settings.imageDefaults, size: e.target.value as typeof settings.imageDefaults.size } })}><option>1024x1024</option><option>1024x1792</option><option>1792x1024</option></Select></label>
          <label className="block text-sm font-medium">质量<Select value={settings.imageDefaults.quality} onChange={(e) => setSettings({ ...settings, imageDefaults: { ...settings.imageDefaults, quality: e.target.value as typeof settings.imageDefaults.quality } })}><option>standard</option><option>hd</option></Select></label>
          <label className="block text-sm font-medium">风格<Select value={settings.imageDefaults.style} onChange={(e) => setSettings({ ...settings, imageDefaults: { ...settings.imageDefaults, style: e.target.value as typeof settings.imageDefaults.style } })}><option>vivid</option><option>natural</option></Select></label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.autoSave} onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })} /> 自动保存到图床</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.rememberApiKey} onChange={(e) => setSettings({ ...settings, rememberApiKey: e.target.checked })} /> 记住 API Key（本地浏览器）</label>
        </div>
      </section>
      <div className="flex gap-3 lg:col-span-2"><Button>保存设置</Button><Button type="button" className="bg-red-600 hover:bg-red-500" onClick={clearLocalSettings}>清除全部本地设置</Button></div>
    </form>
  </div>
}
