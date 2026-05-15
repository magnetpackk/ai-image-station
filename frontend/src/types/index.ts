import type { ResolutionLevel } from '../lib/constants';

// ── Image metadata ──
export type ImageSource = 'text-to-image' | 'image-to-image' | 'manual-upload';

export interface ImageMeta {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: string;
  source: ImageSource;
  width?: number;
  height?: number;
  size: number;
  mimeType: string;
  createdAt: string;
  generationParams?: Record<string, unknown>;
}

// ── API response wrappers ──
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ── Settings ──
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEncrypted: string;
  defaultModel: string;
}

export interface OptimizerConfig {
  baseUrl: string;
  apiKeyEncrypted: string;
  model: string;
  systemPrompt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  provider: ProviderConfig;
  optimizer: OptimizerConfig;
}

// ── Generation parameters ──
export interface SizePreset {
  label: string;
  width: number;
  height: number;
  ratio: string;
}

export interface ReferenceImage {
  id: string;
  dataUrl: string;
  fileName: string;
}

export interface GenerateParams {
  prompt: string;
  negativePrompt: string;
  model: string;
  sizePreset: string; // index or 'custom' or ratio string
  customWidth: number;
  customHeight: number;
  resolution: ResolutionLevel;
  quality: 'standard' | 'hd';
  style: 'natural' | 'vivid';
  quantity: number;
  referenceImages: ReferenceImage[];
}

// ── Generation result ──
export type GenerationStatus = 'idle' | 'generating' | 'saved' | 'failed';

export interface GenerationResult {
  id: string;
  url: string;
  prompt: string;
  model: string;
  status: GenerationStatus;
  width?: number;
  height?: number;
  error?: string;
}

// ── Prompt template ──
export interface PromptTemplate {
  key: string;
  label: string;
  content: string;
}

// ── Prompt optimization state ──
export interface OptimizeState {
  original: string;
  optimized: string;
  isOptimizing: boolean;
  error?: string;
}

// ── Toast ──
export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
