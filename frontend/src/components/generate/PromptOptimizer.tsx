import { useState } from 'react';
import { useGenerateStore } from '../../stores/useGenerateStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { optimizePrompt } from '../../api/aiProviders';
import { showToast } from '../../hooks/useToast';

export function PromptOptimizer() {
  const prompt = useGenerateStore((s) => s.params.prompt);
  const setPrompt = useGenerateStore((s) => s.setPrompt);
  const optimizeState = useGenerateStore((s) => s.optimizeState);
  const setOptimizeState = useGenerateStore((s) => s.setOptimizeState);
  const resetOptimize = useGenerateStore((s) => s.resetOptimize);

  const optimizer = useSettingsStore((s) => s.optimizer);
  const hasOptimizerKey = !!optimizer.apiKeyEncrypted;

  const [showComparison, setShowComparison] = useState(false);

  const handleOptimize = async () => {
    if (!prompt.trim()) {
      showToast('请先输入提示词', 'error');
      return;
    }

    if (!hasOptimizerKey) {
      showToast('请在设置中配置优化模型 API Key', 'error');
      return;
    }

    // Save original before optimizing
    setOptimizeState({
      original: prompt,
      isOptimizing: true,
      error: undefined,
    });

    try {
      const optimized = await optimizePrompt(prompt);
      setOptimizeState({
        optimized,
        isOptimizing: false,
      });
      setPrompt(optimized);
      setShowComparison(true);
      showToast('提示词已优化 ✨', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '优化失败';
      setOptimizeState({
        isOptimizing: false,
        error: message,
      });
      showToast(message, 'error');
    }
  };

  const handleRevert = () => {
    if (optimizeState.original) {
      setPrompt(optimizeState.original);
      showToast('已恢复原始提示词', 'info');
    }
    setShowComparison(false);
    resetOptimize();
  };

  const hasOptimized = optimizeState.original && optimizeState.optimized;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={handleOptimize}
        disabled={optimizeState.isOptimizing || !hasOptimizerKey || !prompt.trim()}
        className={`text-xs px-2.5 py-1 rounded transition font-medium ${
          hasOptimizerKey
            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed'
            : 'text-slate-400 bg-slate-100 cursor-not-allowed'
        }`}
        title={!hasOptimizerKey ? '请在设置中配置优化模型' : '使用 LLM 自动优化提示词'}
      >
        {optimizeState.isOptimizing ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            优化中...
          </span>
        ) : (
          '✨ 优化提示词'
        )}
      </button>

      {hasOptimized && (
        <>
          <button
            onClick={handleRevert}
            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
            title="恢复原始提示词"
          >
            ↩ 撤销
          </button>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
          >
            {showComparison ? '隐藏对比' : '📊 对比'}
          </button>
        </>
      )}

      {/* Comparison panel */}
      {showComparison && hasOptimized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setShowComparison(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">📊 优化前后对比</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">优化前</h4>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 whitespace-pre-wrap">
                  {optimizeState.original}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2">优化后</h4>
                <div className="bg-emerald-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {optimizeState.optimized}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={handleRevert}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  ↩ 恢复原始
                </button>
                <button
                  onClick={() => setShowComparison(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
                >
                  使用优化版
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
