import { useState, useEffect, useCallback } from 'react';
import { listImages, deleteImage } from '../api/backend';
import { copyToClipboard } from '../lib/clipboard';
import { showToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { MODEL_PRESETS } from '../lib/constants';
import type { ImageMeta } from '../types';

export function GalleryPage() {
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ImageMeta | null>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageMeta | null>(null);

  const fetchImages = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await listImages({ page: pageNum, pageSize: 30, sort: 'createdAt_desc' });
      if (resp.success) {
        setImages(resp.data.items);
        setTotalPages(resp.data.pagination.totalPages);
        setPage(resp.data.pagination.page);
      } else {
        setError(resp.error?.message || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载图片列表失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  const handleCopyLink = async (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const success = await copyToClipboard(fullUrl);
    if (success) {
      showToast('已复制到剪贴板', 'success');
    } else {
      showToast(`请手动复制：${fullUrl}`, 'info');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const resp = await deleteImage(deleteTarget.id);
      if (resp.success) {
        setImages((prev) => prev.filter((img) => img.id !== deleteTarget.id));
        showToast('图片已删除', 'success');
      } else {
        showToast(resp.error?.message || '删除失败', 'error');
      }
    } catch {
      showToast('删除失败，请重试', 'error');
    }
    setDeleteTarget(null);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {isLoading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto mb-4">
            <svg className="animate-spin w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
              <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => fetchImages(1)}
            className="mt-3 px-4 py-2 text-sm text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
          >
            重试
          </button>
        </div>
      )}

      {!isLoading && !error && images.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="1.5">
              <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
              <path d="M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">还没有生成过图片</p>
          <p className="text-xs text-slate-400 mt-1">
            去{' '}
            <span className="text-primary-600 cursor-pointer">生成页</span>{' '}
            创建第一张图片吧
          </p>
        </div>
      )}

      {!isLoading && !error && images.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group animate-fade-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setLightboxImage(img)}>
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">加载失败</text></svg>';
                    }}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                      <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-slate-600 line-clamp-2 mb-2" title={img.prompt}>
                    {img.prompt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{formatDate(img.createdAt)}</span>
                    <span>{MODEL_PRESETS.find((m) => m.value === img.model)?.label || img.model}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleCopyLink(img.url)}
                      className="text-xs text-primary-600 hover:text-primary-700 transition font-medium"
                    >
                      📋 复制
                    </button>
                    <button
                      onClick={() => setLightboxImage(img)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition"
                    >
                      🔍 查看
                    </button>
                    <button
                      onClick={() => setDeleteTarget(img)}
                      className="text-xs text-slate-400 hover:text-red-500 transition"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchImages(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                上一页
              </button>
              <span className="text-xs text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => fetchImages(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除图片"
        message={`确定要删除这张图片吗？此操作不可撤销。\n\n提示词：${deleteTarget?.prompt?.slice(0, 80) || ''}`}
        confirmLabel="删除"
        danger
      />

      {/* Lightbox */}
      <Modal
        isOpen={lightboxImage !== null}
        onClose={() => setLightboxImage(null)}
        title={lightboxImage?.prompt ? lightboxImage.prompt.slice(0, 80) + (lightboxImage.prompt.length > 80 ? '...' : '') : '图片详情'}
      >
        {lightboxImage && (
          <div className="space-y-4">
            <img
              src={lightboxImage.url}
              alt={lightboxImage.prompt}
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {lightboxImage.width && lightboxImage.height
                  ? `${lightboxImage.width} × ${lightboxImage.height}`
                  : ''}
              </span>
              <span>{formatDate(lightboxImage.createdAt)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  handleCopyLink(lightboxImage.url);
                }}
                className="flex-1 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              >
                📋 复制直链
              </button>
              <button
                onClick={() => setDeleteTarget(lightboxImage)}
                className="flex-1 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                🗑️ 删除
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
