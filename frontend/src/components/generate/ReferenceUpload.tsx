import { useCallback, useRef } from 'react';
import { useGenerateStore } from '../../stores/useGenerateStore';
import { generateUUID } from '../../lib/crypto';
import { showToast } from '../../hooks/useToast';
import type { ReferenceImage } from '../../types';

export function ReferenceUpload() {
  const params = useGenerateStore((s) => s.params);
  const addReferenceImage = useGenerateStore((s) => s.addReferenceImage);
  const removeReferenceImage = useGenerateStore((s) => s.removeReferenceImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = params.referenceImages;
  const maxReached = images.length >= 3;

  const processFile = useCallback(
    (file: File) => {
      if (images.length >= 3) {
        showToast('最多上传 3 张参考图', 'error');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        showToast('参考图片超过 20MB 限制，请压缩后重新上传', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('仅支持 JPG / PNG / WebP 格式', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const ref: ReferenceImage = {
          id: generateUUID(),
          dataUrl: reader.result as string,
          fileName: file.name,
        };
        addReferenceImage(ref);
      };
      reader.readAsDataURL(file);
    },
    [images.length, addReferenceImage]
  );

  const handleClick = () => {
    if (!maxReached) fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    },
    [processFile]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🖼️</span>
        <h3 className="text-sm font-semibold text-slate-700">
          参考图{' '}
          <span className="text-xs text-slate-400 font-normal">（可选，留空为文生图，最多3张）</span>
        </h3>
      </div>
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          maxReached
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
            : 'border-slate-300 hover:border-primary-400 hover:bg-indigo-50/50'
        }`}
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-primary-400', 'bg-indigo-50/50');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('border-primary-400', 'bg-indigo-50/50');
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {images.length === 0 ? (
          <div>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth="1.5">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              点击上传、拖拽文件到此区域，或 <span className="text-primary-600 font-medium">Ctrl+V 粘贴</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">支持 JPG / PNG / WebP，单文件 ≤ 20MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  alt={img.fileName}
                  className="w-24 h-24 object-cover rounded-xl shadow-sm border border-slate-200"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeReferenceImage(img.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                >
                  ✕
                </button>
                <p className="text-xs text-slate-400 text-center mt-1 truncate w-24">{img.fileName}</p>
              </div>
            ))}
            {images.length < 3 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-indigo-50/50 transition"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="1.5">
                  <path d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
