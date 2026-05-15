import type { GenerateParams } from '../types';
import { decryptSecret } from '../lib/crypto';
import { useSettingsStore } from '../stores/useSettingsStore';

/**
 * Fetch an image from a URL and return it as a Blob.
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}

/**
 * Convert a Blob to a base64 data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Determine if a model supports the style parameter.
 */
function supportsStyle(model: string): boolean {
  return model === 'dall-e-3';
}

/**
 * Determine if a model supports the quality parameter.
 */
function supportsQuality(model: string): boolean {
  return model === 'dall-e-3' || model === 'dall-e-2';
}

/**
 * Compute the actual output resolution given a size preset and resolution multiplier.
 */
function computeOutputSize(params: GenerateParams): { width: number; height: number } {
  const multipliers: Record<string, number> = { '1k': 1, '2k': 2, '4k': 4 };
  const mult = multipliers[params.resolution] || 1;
  return {
    width: params.customWidth * mult,
    height: params.customHeight * mult,
  };
}

/**
 * Build the DALL-E / OpenAI images generations request body.
 */
function buildDalleBody(params: GenerateParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: params.quantity,
    size: `${params.customWidth}x${params.customHeight}`,
    response_format: 'url',
  };
  if (supportsQuality(params.model)) {
    body.quality = params.quality;
  }
  if (supportsStyle(params.model)) {
    body.style = params.style;
  }
  // For gpt-image-2 via chat completions, we need a different path
  return body;
}

/**
 * Build a Gemini image generation request body.
 */
function buildGeminiBody(params: GenerateParams): Record<string, unknown> {
  const { width, height } = computeOutputSize(params);
  const parts: unknown[] = [{ text: params.prompt }];

  // Add reference images if present
  for (const ref of params.referenceImages) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: ref.dataUrl.split(',')[1] || ref.dataUrl,
      },
    });
  }

  return {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(width && height ? { imageConfig: { aspectRatio: `${width}:${height}` } } : {}),
    },
  };
}

export interface GenerateResult {
  url: string;
  width?: number;
  height?: number;
}

/**
 * Generate images via the configured AI provider.
 * This calls the provider's API directly from the frontend.
 */
export async function generateImage(params: GenerateParams): Promise<GenerateResult[]> {
  const store = useSettingsStore.getState();
  const provider = store.provider;

  if (!provider.apiKeyEncrypted) {
    throw new Error('API Key 未配置，请在设置中配置');
  }

  const apiKey = await decryptSecret(JSON.parse(provider.apiKeyEncrypted));
  const baseUrl = provider.baseUrl.replace(/\/$/, '');

  const model = params.model || provider.defaultModel;
  const isGemini = model.includes('gemini');
  const isGptImage = model.includes('gpt-image-2');

  if (isGemini) {
    // Gemini path
    const body = buildGeminiBody(params);
    const endpoint = `${baseUrl}/models/${model}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API 错误 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const results: GenerateResult[] = [];
    // Gemini response structure: candidates[0].content.parts[]
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const blob = new Blob(
            [Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0))],
            { type: part.inlineData.mimeType || 'image/png' }
          );
          const dataUrl = await blobToDataUrl(blob);
          results.push({ url: dataUrl });
        }
      }
    }
    return results;
  }

  if (isGptImage) {
    // gpt-image-2 uses chat completions endpoint
    const messages: unknown[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: params.prompt }],
      },
    ];

    // Add reference images as content parts
    if (params.referenceImages.length > 0) {
      const userContent = (messages[0] as Record<string, unknown>).content as unknown[];
      for (const ref of params.referenceImages) {
        userContent.push({
          type: 'image_url',
          image_url: { url: ref.dataUrl },
        });
      }
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 4096,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`gpt-image-2 API 错误 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const results: GenerateResult[] = [];
    const choice = data.choices?.[0];
    if (choice?.message?.content) {
      const content = choice.message.content;

      // Standard format: content is an array of parts
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            results.push({ url: part.image_url.url });
          }
        }
      }

      // String format: some proxies return text with markdown image links
      if (typeof content === 'string') {
        // Try extracting markdown image URLs: ![alt](url)
        const mdImgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
        let match;
        while ((match = mdImgRegex.exec(content)) !== null) {
          results.push({ url: match[1] });
        }
        // Try extracting bare image URLs
        if (results.length === 0) {
          const urlRegex = /(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|gif|webp)[^\s"']*)/gi;
          while ((match = urlRegex.exec(content)) !== null) {
            results.push({ url: match[1] });
          }
        }
      }
    }

    // Also check top-level data.images or data.data (alternative formats)
    if (results.length === 0 && data.images) {
      for (const img of data.images) {
        if (img.url) results.push({ url: img.url });
      }
    }
    if (results.length === 0 && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.url) results.push({ url: item.url });
        if (item.b64_json) results.push({ url: `data:image/png;base64,${item.b64_json}` });
      }
    }

    if (results.length === 0) {
      throw new Error(`gpt-image-2 未返回图片。原始响应: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return results;
  }

  // Default: OpenAI Images API (DALL-E)
  const body = buildDalleBody(params);

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = `API 错误 (${response.status})`;
    try {
      const err = JSON.parse(errText);
      message = err.error?.message || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await response.json();
  const items = (data.data || []).map((item: { url?: string; b64_json?: string }) => ({
    url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
  }));
  if (items.length === 0 || !items[0].url) {
    throw new Error(`API 未返回图片。原始响应: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return items;
}

/**
 * Optimize a prompt using an LLM API.
 */
export async function optimizePrompt(rawPrompt: string): Promise<string> {
  const store = useSettingsStore.getState();
  const optimizer = store.optimizer;

  if (!optimizer.apiKeyEncrypted) {
    throw new Error('请在设置中配置优化模型');
  }

  const apiKey = await decryptSecret(JSON.parse(optimizer.apiKeyEncrypted));
  const baseUrl = optimizer.baseUrl.replace(/\/$/, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: optimizer.model,
        messages: [
          { role: 'system', content: optimizer.systemPrompt },
          { role: 'user', content: rawPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let message = `优化失败 (${response.status})`;
      try { message = JSON.parse(errText).error?.message || message; } catch { /* ignore */ }
      throw new Error(message);
    }

    const data = await response.json();
    const optimized = data.choices?.[0]?.message?.content?.trim();
    if (!optimized) {
      throw new Error('优化模型返回空内容，请检查配置');
    }
    return optimized;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('提示词优化超时（15秒），请稍后重试');
    }
    throw err;
  }
}
