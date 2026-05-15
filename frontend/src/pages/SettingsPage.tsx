import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { login, getMe } from '../api/backend';
import { showToast } from '../hooks/useToast';
import { MODEL_PRESETS, DEFAULT_OPTIMIZER_SYSTEM_PROMPT } from '../lib/constants';

export function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const provider = useSettingsStore((s) => s.provider);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const optimizer = useSettingsStore((s) => s.optimizer);
  const updateOptimizer = useSettingsStore((s) => s.updateOptimizer);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  // Local state for editable fields
  const [providerKey, setProviderKey] = useState('');
  const [showProviderKey, setShowProviderKey] = useState(false);
  const [providerKeySaved, setProviderKeySaved] = useState(false);

  const [optimizerKey, setOptimizerKey] = useState('');
  const [showOptimizerKey, setShowOptimizerKey] = useState(false);
  const [optimizerKeySaved, setOptimizerKeySaved] = useState(false);

  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Access Code login
  const [accessCode, setAccessCode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check if keys are already saved on mount
  useEffect(() => {
    if (provider.apiKeyEncrypted) {
      setProviderKeySaved(true);
    }
    if (optimizer.apiKeyEncrypted) {
      setOptimizerKeySaved(true);
    }
  }, [provider.apiKeyEncrypted, optimizer.apiKeyEncrypted]);

  const handleSaveProviderKey = async () => {
    if (!providerKey.trim()) {
      showToast('请输入 API Key', 'error');
      return;
    }
    try {
      const encrypted = await encryptSecret(providerKey.trim());
      updateProvider({ apiKeyEncrypted: JSON.stringify(encrypted) });
      setProviderKeySaved(true);
      setShowProviderKey(false);
      showToast('API Key 已保存', 'success');
    } catch {
      showToast('加密保存失败', 'error');
    }
  };

  const handleSaveOptimizerKey = async () => {
    if (!optimizerKey.trim()) {
      showToast('请输入优化模型 API Key', 'error');
      return;
    }
    try {
      const encrypted = await encryptSecret(optimizerKey.trim());
      updateOptimizer({ apiKeyEncrypted: JSON.stringify(encrypted) });
      setOptimizerKeySaved(true);
      setShowOptimizerKey(false);
      showToast('优化模型 API Key 已保存', 'success');
    } catch {
      showToast('加密保存失败', 'error');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let apiKey: string;
      if (provider.apiKeyEncrypted) {
        apiKey = await decryptSecret(JSON.parse(provider.apiKeyEncrypted));
      } else {
        setTestResult('请先保存 API Key');
        setIsTesting(false);
        return;
      }

      const baseUrl = provider.baseUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTestResult('✅ 连接成功');
        showToast('连接测试成功', 'success');
      } else {
        const text = await response.text();
        setTestResult(`❌ 连接失败 (${response.status}): ${text.slice(0, 100)}`);
      }
    } catch (err) {
      setTestResult(`❌ 连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Check existing session on mount
  useEffect(() => {
    getMe().then((resp) => {
      if (resp.success && resp.data.authenticated) {
        setIsLoggedIn(true);
      }
    }).catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!accessCode.trim()) {
      showToast('请输入 Access Code', 'error');
      return;
    }
    setIsLoggingIn(true);
    try {
      const resp = await login(accessCode.trim());
      if (resp.success) {
        setIsLoggedIn(true);
        showToast('登录成功', 'success');
      } else {
        showToast(resp.error?.message || '登录失败', 'error');
      }
    } catch {
      showToast('登录失败，请重试', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Theme */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">🎨 主题</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition ${
              theme === 'light'
                ? 'bg-primary-50 text-primary-700 border-primary-300'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            ☀️ 浅色
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition ${
              theme === 'dark'
                ? 'bg-primary-50 text-primary-700 border-primary-300'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            🌙 深色
          </button>
        </div>
      </div>

      {/* Access Code Login */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">🔐 访问认证</h3>
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-sm font-medium">✅ 已登录</span>
            <span className="text-xs text-slate-400">— 可正常访问画廊和生成服务</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Access Code</label>
              <input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="输入访问密码..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50 transition"
            >
              {isLoggingIn ? '登录中...' : '登录'}
            </button>
          </div>
        )}
      </div>

      {/* Provider Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">🔌 生图 API 配置</h3>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Base URL</label>
          <input
            type="text"
            value={provider.baseUrl}
            onChange={(e) => updateProvider({ baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">API Key</label>
          {providerKeySaved ? (
            <div className="flex items-center gap-2">
              <input
                type={showProviderKey ? 'text' : 'password'}
                value={showProviderKey ? (providerKey || '●●●●●●●●') : '●●●●●●●●'}
                readOnly={!showProviderKey}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none"
              />
              <button
                onClick={() => setShowProviderKey(!showProviderKey)}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                {showProviderKey ? '隐藏' : '显示'}
              </button>
              <button
                onClick={() => {
                  setProviderKeySaved(false);
                  setProviderKey('');
                  setShowProviderKey(true);
                }}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                修改
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type={showProviderKey ? 'text' : 'password'}
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
              />
              <button
                onClick={() => setShowProviderKey(!showProviderKey)}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                {showProviderKey ? '隐藏' : '显示'}
              </button>
              <button
                onClick={handleSaveProviderKey}
                className="px-4 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              >
                保存
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">默认模型</label>
          <select
            value={provider.defaultModel}
            onChange={(e) => updateProvider({ defaultModel: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
          >
            {MODEL_PRESETS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition disabled:opacity-50"
          >
            {isTesting ? '测试中...' : '🔍 测试连接'}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {testResult}
            </span>
          )}
        </div>
      </div>

      {/* Optimizer Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">✨ 提示词优化模型</h3>
        <p className="text-xs text-slate-400 -mt-2">
          用于自动优化提示词的 LLM 配置（独立于生图 API）
        </p>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Base URL</label>
          <input
            type="text"
            value={optimizer.baseUrl}
            onChange={(e) => updateOptimizer({ baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">API Key（独立于生图 Key）</label>
          {optimizerKeySaved ? (
            <div className="flex items-center gap-2">
              <input
                type={showOptimizerKey ? 'text' : 'password'}
                value={showOptimizerKey ? (optimizerKey || '●●●●●●●●') : '●●●●●●●●'}
                readOnly={!showOptimizerKey}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none"
              />
              <button
                onClick={() => setShowOptimizerKey(!showOptimizerKey)}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                {showOptimizerKey ? '隐藏' : '显示'}
              </button>
              <button
                onClick={() => {
                  setOptimizerKeySaved(false);
                  setOptimizerKey('');
                  setShowOptimizerKey(true);
                }}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                修改
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type={showOptimizerKey ? 'text' : 'password'}
                value={optimizerKey}
                onChange={(e) => setOptimizerKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
              />
              <button
                onClick={() => setShowOptimizerKey(!showOptimizerKey)}
                className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                {showOptimizerKey ? '隐藏' : '显示'}
              </button>
              <button
                onClick={handleSaveOptimizerKey}
                className="px-4 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              >
                保存
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">模型</label>
          <input
            type="text"
            value={optimizer.model}
            onChange={(e) => updateOptimizer({ model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">推荐使用便宜模型如 gpt-4o-mini</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">System Prompt（高级自定义）</label>
          <textarea
            value={optimizer.systemPrompt}
            onChange={(e) => updateOptimizer({ systemPrompt: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none font-mono text-xs"
          />
          <button
            onClick={() => updateOptimizer({ systemPrompt: DEFAULT_OPTIMIZER_SYSTEM_PROMPT })}
            className="mt-1 text-xs text-primary-600 hover:text-primary-700 transition"
          >
            恢复默认 Prompt
          </button>
        </div>
      </div>

      {/* Reset */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-red-600 mb-2">⚠️ 危险操作</h3>
        <p className="text-xs text-slate-500 mb-3">重置所有设置到默认值（不会删除已生成的图片）</p>
        <button
          onClick={() => {
            if (window.confirm('确定要重置所有设置吗？')) {
              resetSettings();
              setProviderKeySaved(false);
              setOptimizerKeySaved(false);
              setProviderKey('');
              setOptimizerKey('');
              showToast('设置已重置', 'info');
            }
          }}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
        >
          重置所有设置
        </button>
      </div>
    </div>
  );
}
