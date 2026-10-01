import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { FeedPage } from '@/pages/FeedPage';
import { UploadPage } from '@/pages/UploadPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SearchPage } from '@/pages/SearchPage';
import { BookmarksPage } from '@/pages/BookmarksPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MePage } from '@/pages/MePage';
import { AdminPage } from '@/pages/AdminPage';
import { LivePage } from '@/pages/LivePage';
import { GoLivePage } from '@/pages/GoLivePage';
import { LiveViewerPage } from '@/pages/LiveViewerPage';
import { AudioChatPage } from '@/pages/AudioChatPage';
import { AudioRoomPage } from '@/pages/AudioRoomPage';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

function Router() {
  const { user, loading } = useAuth();
  const hash = useHashRoute();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (hash === '#/upload') return <UploadPage />;
  if (hash === '#/search') return <SearchPage />;
  if (hash === '#/saved') return <BookmarksPage />;
  if (hash === '#/notifications') return <NotificationsPage />;
  if (hash === '#/messages') return <MessagesPage />;
  if (hash === '#/settings') return <SettingsPage />;
  if (hash === '#/me') return <MePage />;
  if (hash === '#/admin') return <AdminPage />;
  if (hash === '#/live') return <LivePage />;
  if (hash === '#/audio') return <AudioChatPage />;

  const liveHostMatch = hash.match(/^#\/live\/host\/(.+)$/);
  if (liveHostMatch) return <GoLivePage streamId={liveHostMatch[1]} />;

  const liveViewMatch = hash.match(/^#\/live\/view\/(.+)$/);
  if (liveViewMatch) return <LiveViewerPage streamId={liveViewMatch[1]} />;

  const audioRoomMatch = hash.match(/^#\/audio\/room\/(.+)$/);
  if (audioRoomMatch) return <AudioRoomPage roomId={audioRoomMatch[1]} />;

  const profileMatch = hash.match(/^#\/profile\/(.+)$/);
  if (profileMatch) return <ProfilePage userId={profileMatch[1]} />;

  return <FeedPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="max-w-md mx-auto bg-black min-h-screen relative">
        <Router />
      </div>
    </AuthProvider>
  );
}
