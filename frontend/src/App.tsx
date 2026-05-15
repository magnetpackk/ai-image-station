import { AppLayout } from './components/AppLayout'
import { GalleryPage } from './pages/GalleryPage'
import { GeneratePage } from './pages/GeneratePage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppStoreProvider, useAppStore } from './stores/appStore'

function AppContent() {
  const { session, activePage } = useAppStore()
  if (!session) return <LoginPage />
  return <AppLayout>{activePage === 'generate' ? <GeneratePage /> : activePage === 'gallery' ? <GalleryPage /> : <SettingsPage />}</AppLayout>
}

export default function App() {
  return <AppStoreProvider><AppContent /></AppStoreProvider>
}
