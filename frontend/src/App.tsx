import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ToastContainer } from './components/Toast';
import { GeneratePage } from './pages/GeneratePage';
import { GalleryPage } from './pages/GalleryPage';
import { SettingsPage } from './pages/SettingsPage';

type Tab = 'generate' | 'gallery' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('generate');

  // Apply dark mode on mount
  useEffect(() => {
    const theme = localStorage.getItem('ai-image-station:settings');
    if (theme) {
      try {
        const parsed = JSON.parse(theme);
        if (parsed.state?.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } catch { /* ignore */ }
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header activeTab={activeTab} onTabChange={setActiveTab} connected={true} />

      <main>
        {activeTab === 'generate' && <GeneratePage />}
        {activeTab === 'gallery' && <GalleryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;
