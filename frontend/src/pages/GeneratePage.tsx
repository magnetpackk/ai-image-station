import { useState, useCallback } from 'react';
import { useGenerateStore } from '../stores/useGenerateStore';
import { generateImage, fetchImageAsBlob } from '../api/aiProviders';
import { uploadImage } from '../api/backend';
import { showToast } from '../hooks/useToast';
import { generateUUID } from '../lib/crypto';
import {
  SIZE_PRESETS,
  RESOLUTION_OPTIONS,
  MODEL_PRESETS,
  PROMPT_TEMPLATES,
} from '../lib/constants';
import type { GenerationResult } from '../types';
import { ReferenceUpload } from '../components/generate/ReferenceUpload';
import { PromptOptimizer } from '../components/generate/PromptOptimizer';

export function GeneratePage() {
  const params = useGenerateStore((s) => s.params);
  const setParams = useGenerateStore((s) => s.setParams);
  const setPrompt = useGenerateStore((s) => s.setPrompt);
  const setModel = useGenerateStore((s) => s.setModel);
  const results = useGenerateStore((s) => s.results);
  const addResult = useGenerateStore((s) => s.addResult);
  const removeResult = useGenerateStore((s) => s.removeResult);
  const clearResults = useGenerateStore((s) => s.clearResults);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modelSupportsQuality = params.model === 'dall-e-3' || params.model === 'dall-e-2';
  const modelSupportsStyle = params.model === 'dall-e-3';
  const isGemini = params.model.includes('gemini');

  const handleGenerate = useCallback(async () => {
    if (!params.prompt.trim()) {
      showToast('请输入提示词', 'error');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    try {
      const genResults = await generateImage(params);

      const savedResults: GenerationResult[] = [];
      for (const genResult of genResults) {
        const resultId = generateUUID();
        try {
          // Fetch image as blob and upload to backend
          let blob: Blob;
          if (genResult.url.startsWith('data:')) {
            const base64Response = await fetch(genResult.url);
            blob = await base64Response.blob();
          } else {
            blob = await fetchImageAsBlob(genResult.url);
          }

          // Upload to backend
          const uploadResp = await uploadImage(blob, {
            prompt: params.prompt,
            negativePrompt: params.negativePrompt || undefined,
            model: params.model,
            provider: isGemini ? 'gemini' : 'openai',
            width: genResult.width,
            height: genResult.height,
            source: params.referenceImages.length > 0 ? 'image-to-image' : 'text-to-image',
          });

          if (uploadResp.success) {
            savedResults.push({
              id: resultId,
              url: uploadResp.data.url,
              prompt: params.prompt,
              model: params.model,
              status: 'saved',
              width: genResult.width,
              height: genResult.height,
            });
            addResult(savedResults[savedResults.length - 1]);
          } else {
            // Fallback: use the direct URL
            savedResults.push({
              id: resultId,
              url: genResult.url,
              prompt: params.prompt,
              model: params.model,
              status: 'saved',
              width: genResult.width,
              height: genResult.height,
            });
            addResult(savedResults[savedResults.length - 1]);
          }
        } catch {
          // If upload fails, still show the result with direct URL
          savedResults.push({
            id: resultId,
            url: genResult.url,
            prompt: params.prompt,
            model: params.model,
            status: 'saved',
            width: genResult.width,
            height: genResult.height,
          });
          addResult(savedResults[savedResults.length - 1]);
        }
      }

      showToast(`成功生成 ${savedResults.length} 张图片`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生成失败';
      setErrorMessage(message);
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [params, isGemini, addResult]);

  const applyTemplate = (content: string) => {
    setParams({ prompt: content });
    setShowTemplates(false);
  };

  const setSizePreset = (ratio: string) => {
    const preset = SIZE_PRESETS.find((p) => p.ratio === ratio);
    if (preset) {
      setParams({ sizePreset: ratio, customWidth: preset.width, customHeight: preset.height });
    }
  };

  // Compute final display resolution
  const resMultiplier = RESOLUTION_OPTIONS.find((r) => r.value === params.resolution)?.multiplier || 1;
  const displayWidth = params.customWidth * resMultiplier;
  const displayHeight = params.customHeight * resMultiplier;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-5">
          {/* Prompt Input */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">📝 提示词</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-xs text-slate-500 hover:text-primary-600 transition px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    📋 模板
                  </button>
                  {showTemplates && (
                    <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-lg shadow-lg z-30 w-56 py-1">
                      {PROMPT_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.key}
                          onClick={() => applyTemplate(tpl.content)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-primary-600 transition"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <PromptOptimizer />
              </div>
            </div>
            <textarea
              value={params.prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片...（支持中文/英文）"
              rows={4}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition resize-none"
            />
            <input
              type="text"
              value={params.negativePrompt}
              onChange={(e) => setParams({ negativePrompt: e.target.value })}
              placeholder="反向提示词（可选）：不希望出现的内容..."
              className="w-full mt-2 px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition"
            />
          </div>

          {/* Reference Upload */}
          <ReferenceUpload />

          {/* Model Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">🤖 模型选择</h3>
            <div className="flex flex-wrap gap-2">
              {MODEL_PRESETS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    params.model === m.value
                      ? 'bg-primary-50 text-primary-700 border-primary-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-700">⚙️ 生成参数</h3>

            {/* Size Preset */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">尺寸</label>
              <select
                value={params.sizePreset}
                onChange={(e) => setSizePreset(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
              >
                {SIZE_PRESETS.map((p) => (
                  <option key={p.ratio} value={p.ratio}>
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  value={params.customWidth}
                  onChange={(e) => setParams({ customWidth: Number(e.target.value), sizePreset: 'custom' })}
                  placeholder="宽"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
                <span className="text-slate-400 self-center">×</span>
                <input
                  type="number"
                  value={params.customHeight}
                  onChange={(e) => setParams({ customHeight: Number(e.target.value), sizePreset: 'custom' })}
                  placeholder="高"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
                <span className="text-xs text-slate-400 self-center">px</span>
              </div>
            </div>

            {/* Resolution */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">分辨率</label>
              <div className="flex gap-1">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setParams({ resolution: opt.value })}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      params.resolution === opt.value
                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality (DALL-E only) */}
            {modelSupportsQuality && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">质量</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setParams({ quality: 'standard' })}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      params.quality === 'standard'
                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    标准
                  </button>
                  <button
                    onClick={() => setParams({ quality: 'hd' })}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      params.quality === 'hd'
                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    HD 高清
                  </button>
                </div>
              </div>
            )}

            {/* Style (DALL-E 3 only) */}
            {modelSupportsStyle && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">风格</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setParams({ style: 'natural' })}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      params.style === 'natural'
                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    🌿 自然
                  </button>
                  <button
                    onClick={() => setParams({ style: 'vivid' })}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${
                      params.style === 'vivid'
                        ? 'bg-primary-50 text-primary-700 border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    🎨 生动
                  </button>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">生成数量</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setParams({ quantity: Math.max(1, params.quantity - 1) })}
                  className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-semibold text-slate-700">{params.quantity}</span>
                <button
                  onClick={() => setParams({ quantity: Math.min(4, params.quantity + 1) })}
                  className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Final resolution info */}
            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
              最终分辨率：{displayWidth} × {displayHeight} px
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg">❌</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700 mb-1">生成失败</p>
                  <p className="text-xs text-red-600 break-all">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-600 shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !params.prompt.trim()}
            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition shadow-sm text-sm flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                正在生成...
              </>
            ) : (
              <>
                🚀 开始生成
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              📊 生成结果
              {results.length > 0 && (
                <span className="text-xs text-slate-400 font-normal ml-2">({results.length})</span>
              )}
            </h3>
            {results.length > 0 && (
              <button
                onClick={clearResults}
                className="text-xs text-slate-400 hover:text-red-500 transition"
              >
                清空全部
              </button>
            )}
          </div>

          {results.length === 0 && !isGenerating && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="1.5">
                  <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                  <path d="M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">生成的图片将显示在这里</p>
              <p className="text-xs text-slate-400 mt-1">输入提示词并选择参数后点击生成</p>
            </div>
          )}

          {results.map((result, idx) => (
            <div
              key={result.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-up"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <img
                src={result.url}
                alt={result.prompt}
                className="w-full object-cover cursor-pointer"
                style={{ maxHeight: '400px' }}
                onClick={() => window.open(result.url, '_blank')}
              />
              <div className="p-4">
                <p className="text-xs text-slate-600 line-clamp-2 mb-2">{result.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {MODEL_PRESETS.find((m) => m.value === result.model)?.label || result.model}
                  </span>
                  <button
                    onClick={() => removeResult(result.id)}
                    className="text-xs text-slate-400 hover:text-red-500 transition"
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3">
                <svg className="animate-spin w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">正在生成图片...</p>
              <p className="text-xs text-slate-400 mt-1">这可能需要 10-60 秒</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
