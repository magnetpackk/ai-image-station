import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, ProviderConfig, OptimizerConfig } from '../types';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_OPTIMIZER_MODEL, DEFAULT_OPTIMIZER_SYSTEM_PROMPT } from '../lib/constants';
import { generateUUID } from '../lib/crypto';

const defaultProvider: ProviderConfig = {
  id: generateUUID(),
  name: 'My Provider',
  baseUrl: DEFAULT_BASE_URL,
  apiKeyEncrypted: '',
  defaultModel: DEFAULT_MODEL,
};

const defaultOptimizer: OptimizerConfig = {
  baseUrl: DEFAULT_BASE_URL,
  apiKeyEncrypted: '',
  model: DEFAULT_OPTIMIZER_MODEL,
  systemPrompt: DEFAULT_OPTIMIZER_SYSTEM_PROMPT,
};

const defaultSettings: AppSettings = {
  theme: 'light',
  provider: defaultProvider,
  optimizer: defaultOptimizer,
};

interface SettingsState extends AppSettings {
  setTheme: (theme: 'light' | 'dark') => void;
  updateProvider: (partial: Partial<ProviderConfig>) => void;
  updateOptimizer: (partial: Partial<OptimizerConfig>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setTheme: (theme) => {
        set({ theme });
        // Apply theme class immediately for dark mode
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      updateProvider: (partial) =>
        set((state) => ({ provider: { ...state.provider, ...partial } })),
      updateOptimizer: (partial) =>
        set((state) => ({ optimizer: { ...state.optimizer, ...partial } })),
      resetSettings: () => set({ ...defaultSettings }),
    }),
    {
      name: 'ai-image-station:settings',
    }
  )
);
