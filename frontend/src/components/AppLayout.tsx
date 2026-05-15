import { useAppStore } from '../stores/appStore'

const nav = [
  { id: 'generate', label: '生成图片' },
  { id: 'gallery', label: '图片画廊' },
  { id: 'settings', label: '设置' },
] as const

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { activePage, setActivePage, setSession } = useAppStore()
  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-slate-950 p-5 text-white lg:block">
      <div className="text-xl font-black">AI Image Station</div>
      <p className="mt-2 text-xs text-slate-400">画图、存档、复制直链，一站完成。</p>
      <nav className="mt-8 space-y-2">{nav.map((item) => <button key={item.id} onClick={() => setActivePage(item.id)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${activePage === item.id ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}>{item.label}</button>)}</nav>
      <button onClick={() => setSession(undefined)} className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">退出登录</button>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
        <div className="flex gap-2 lg:hidden">{nav.map((item) => <button key={item.id} onClick={() => setActivePage(item.id)} className={`rounded-lg px-3 py-2 text-sm ${activePage === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{item.label}</button>)}</div>
        <div className="hidden lg:block text-sm text-slate-500">MVP · 前端直连 AI API · 本地图床管理</div>
      </header>
      <main className="p-4 lg:p-8">{children}</main>
    </div>
  </div>
}
