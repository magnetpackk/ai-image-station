type Tab = 'generate' | 'gallery' | 'settings';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  connected?: boolean;
}

export function Header({ activeTab, onTabChange, connected = true }: HeaderProps) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'generate', label: '生成图片', icon: '🎨' },
    { key: 'gallery', label: '图片画廊', icon: '🖼️' },
    { key: 'settings', label: '设置', icon: '⚙️' },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              AI
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">AI Image Station</h1>
              <p className="text-xs text-slate-400">v1.1</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                connected
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {connected ? '● 已连接' : '○ 未连接'}
            </span>
            <button
              onClick={() => onTabChange('settings')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="设置"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-5 py-3.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.icon} {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
