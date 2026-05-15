import type { SizePreset, PromptTemplate } from '../types';

/**
 * Pre-defined image size presets.
 * Width and height represent base dimensions at 1K resolution.
 */
export const SIZE_PRESETS: SizePreset[] = [
  { label: '正方形 1:1', width: 1024, height: 1024, ratio: '1:1' },
  { label: '横版 16:9', width: 1792, height: 1024, ratio: '16:9' },
  { label: '竖版 9:16', width: 1024, height: 1792, ratio: '9:16' },
  { label: '横版 4:3', width: 1280, height: 960, ratio: '4:3' },
  { label: '竖版 3:4', width: 960, height: 1280, ratio: '3:4' },
  { label: '横版 3:2', width: 1536, height: 1024, ratio: '3:2' },
  { label: '竖版 2:3', width: 1024, height: 1536, ratio: '2:3' },
];

export type ResolutionLevel = '1k' | '2k' | '4k';

export const RESOLUTION_OPTIONS: { value: ResolutionLevel; label: string; multiplier: number }[] = [
  { value: '1k', label: '⚡ 1K 标准', multiplier: 1 },
  { value: '2k', label: '★ 2K 高清', multiplier: 2 },
  { value: '4k', label: '👑 4K 超清', multiplier: 4 },
];

/** Models that support the quality parameter (DALL-E only). */
export const QUALITY_MODELS = ['dall-e-3', 'dall-e-2'];

/** Models that support the style parameter (DALL-E 3 only). */
export const STYLE_MODELS = ['dall-e-3'];

/** Models that explicitly do NOT support quality/style (will error if sent). */
export const NO_QUALITY_MODELS = ['gpt-image-2', 'gpt-image-2-vip'];

/** Prompt templates */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    key: 'product',
    label: '📦 产品摄影',
    content: 'professional product photography of {subject}, white background, studio lighting, 8k',
  },
  {
    key: 'anime',
    label: '🎨 二次元插画',
    content: 'anime style illustration of {subject}, vibrant colors, detailed linework, trending on pixiv',
  },
  {
    key: 'photo',
    label: '📷 写实照片',
    content: 'photorealistic image of {subject}, natural lighting, 85mm lens, f/1.8, sharp focus',
  },
  {
    key: 'logo',
    label: '🔷 极简Logo',
    content: 'minimalist logo design of {subject}, vector art, clean lines, flat colors',
  },
  {
    key: 'landscape',
    label: '🌅 梦幻风景',
    content: 'dreamy landscape of {subject}, ethereal atmosphere, soft colors, concept art',
  },
];

/** Default system prompt for prompt optimization */
export const DEFAULT_OPTIMIZER_SYSTEM_PROMPT = `You are an expert AI image generation prompt engineer.
Your task is to transform a user's brief description into a high-quality English image generation prompt that will produce excellent results with DALL-E 3 and similar models.

Rules:
1. Output ONLY the optimized prompt, no explanations, no markdown.
2. Keep it under 500 characters.
3. Include: subject, style, composition, lighting, color palette, mood, and technical quality keywords.
4. Use natural descriptive language. Do NOT use comma-separated keyword dumps.
5. Add standard quality boosters: "highly detailed, professional lighting, sharp focus, 8k resolution" when appropriate.
6. Preserve the user's original intent and subject.
7. If the user prompt is in Chinese, translate and optimize to English.`;

/** Default model presets for the model selector */
export const MODEL_PRESETS = [
  { value: 'dall-e-3', label: 'DALL-E 3' },
  { value: 'dall-e-2', label: 'DALL-E 2' },
  { value: 'gpt-image-2', label: 'gpt-image-2' },
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro' },
];

/** Default API configuration */
export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_MODEL = 'gpt-image-2';
export const DEFAULT_OPTIMIZER_MODEL = 'gpt-4o-mini';
