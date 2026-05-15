import type { ApiResponse, ImageMeta, PaginatedData } from '../types';

const BASE_URL = '';

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('ai-image-station:token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const json = JSON.parse(body);
      message = json.error?.message || json.message || message;
    } catch { /* ignore */ }
    return { success: false, error: { code: `HTTP_${response.status}`, message } } as ApiResponse<T>;
  }
  return response.json();
}

/** Upload an image and its metadata to the backend. */
export async function uploadImage(file: Blob, metadata: {
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: string;
  width?: number;
  height?: number;
  source: string;
  generationParams?: Record<string, unknown>;
}): Promise<ApiResponse<ImageMeta>> {
  const formData = new FormData();
  formData.append('file', file, 'generated.png');
  formData.append('prompt', metadata.prompt);
  if (metadata.negativePrompt) formData.append('negativePrompt', metadata.negativePrompt);
  formData.append('model', metadata.model);
  formData.append('provider', metadata.provider);
  if (metadata.width) formData.append('width', String(metadata.width));
  if (metadata.height) formData.append('height', String(metadata.height));
  formData.append('source', metadata.source);
  if (metadata.generationParams) {
    formData.append('generationParams', JSON.stringify(metadata.generationParams));
  }

  const response = await fetch(`${BASE_URL}/api/images`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    const body = await response.text();
    let message = `HTTP ${response.status}`;
    try { message = JSON.parse(body).error?.message || message; } catch { /* ignore */ }
    return { success: false, error: { code: 'UPLOAD_FAILED', message } } as ApiResponse<ImageMeta>;
  }
  return response.json();
}

/** List images from the gallery. */
export async function listImages(params?: {
  page?: number;
  pageSize?: number;
  sort?: string;
  source?: string;
  keyword?: string;
}): Promise<ApiResponse<PaginatedData<ImageMeta>>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.source) searchParams.set('source', params.source);
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  const qs = searchParams.toString();
  return request<PaginatedData<ImageMeta>>(`/api/images${qs ? `?${qs}` : ''}`);
}

/** Get a single image's details. */
export async function getImage(id: string): Promise<ApiResponse<ImageMeta>> {
  return request<ImageMeta>(`/api/images/${id}`);
}

/** Delete an image. */
export async function deleteImage(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
  return request(`/api/images/${id}`, { method: 'DELETE' });
}

/** Login with access code and store token. */
export async function login(accessCode: string): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
  const resp = await request<{ token: string; expiresAt: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ accessCode }),
  });
  if (resp.success && resp.data.token) {
    sessionStorage.setItem('ai-image-station:token', resp.data.token);
  }
  return resp;
}

/** Check current session. */
export async function getMe(): Promise<ApiResponse<{ authenticated: boolean; expiresAt: string }>> {
  return request('/api/auth/session');
}
