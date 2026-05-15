import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GenerateParams, GenerationResult, ReferenceImage, OptimizeState } from '../types';

const defaultParams: GenerateParams = {
  prompt: '',
  negativePrompt: '',
  model: 'gpt-image-2',
  sizePreset: '16:9',
  customWidth: 1792,
  customHeight: 1024,
  resolution: '2k',
  quality: 'standard',
  style: 'vivid',
  quantity: 1,
  referenceImages: [],
};

const defaultOptimizeState: OptimizeState = {
  original: '',
  optimized: '',
  isOptimizing: false,
};

interface GenerateState {
  params: GenerateParams;
  results: GenerationResult[];
  optimizeState: OptimizeState;
  // Actions
  setParams: (partial: Partial<GenerateParams>) => void;
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (negativePrompt: string) => void;
  setModel: (model: string) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  addResult: (result: GenerationResult) => void;
  removeResult: (id: string) => void;
  clearResults: () => void;
  resetParams: () => void;
  // Optimize
  setOptimizeState: (partial: Partial<OptimizeState>) => void;
  resetOptimize: () => void;
}

export const useGenerateStore = create<GenerateState>()(
  persist(
    (set) => ({
      params: defaultParams,
      results: [],
      optimizeState: defaultOptimizeState,

      setParams: (partial) =>
        set((state) => ({ params: { ...state.params, ...partial } })),
      setPrompt: (prompt) =>
        set((state) => ({ params: { ...state.params, prompt } })),
      setNegativePrompt: (negativePrompt) =>
        set((state) => ({ params: { ...state.params, negativePrompt } })),
      setModel: (model) =>
        set((state) => ({ params: { ...state.params, model } })),

      addReferenceImage: (image) =>
        set((state) => {
          if (state.params.referenceImages.length >= 3) return state;
          return {
            params: {
              ...state.params,
              referenceImages: [...state.params.referenceImages, image],
            },
          };
        }),
      removeReferenceImage: (id) =>
        set((state) => ({
          params: {
            ...state.params,
            referenceImages: state.params.referenceImages.filter((r) => r.id !== id),
          },
        })),
      clearReferenceImages: () =>
        set((state) => ({
          params: { ...state.params, referenceImages: [] },
        })),

      addResult: (result) =>
        set((state) => ({ results: [result, ...state.results] })),
      removeResult: (id) =>
        set((state) => ({ results: state.results.filter((r) => r.id !== id) })),
      clearResults: () => set({ results: [] }),

      resetParams: () => set({ params: defaultParams, results: [], optimizeState: defaultOptimizeState }),

      setOptimizeState: (partial) =>
        set((state) => ({ optimizeState: { ...state.optimizeState, ...partial } })),
      resetOptimize: () => set({ optimizeState: defaultOptimizeState }),
    }),
    {
      name: 'ai-image-station:generate',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
