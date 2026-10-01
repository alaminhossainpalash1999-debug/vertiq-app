import { useEffect, useState, useCallback } from 'react';
import { supabase, type NotificationWithActor } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { timeAgo } from '@/lib/format';
import { Heart, UserPlus, MessageCircle, Bookmark, Bell } from 'lucide-react';

const NOTIF_ICONS = {
  like: Heart,
  follow: UserPlus,
  comment: MessageCircle,
  bookmark: Bookmark,
};

const NOTIF_COLORS = {
  like: 'text-[#00FF88]',
  follow: 'text-[#0088FF]',
  comment: 'text-white',
  bookmark: 'text-[#0088FF]',
};

function notifText(n: NotificationWithActor): string {
  const name = n.actor?.username ?? 'Someone';
  switch (n.type) {
    case 'like': return `${name} liked your video`;
    case 'follow': return `${name} started following you`;
    case 'comment': return `${name} commented: ${n.text ?? ''}`;
    case 'bookmark': return `${name} saved your video`;
    default: return '';
  }
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('notifications')
      .select(`
        id, user_id, actor_id, type, video_id, text, read, created_at,
        actor:profiles!notifications_actor_id_fkey (username, avatar_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as unknown as NotificationWithActor[]);
    setLoading(false);

    // Mark all as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime: refresh when new notifications arrive
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10">
        <h1 className="text-lg font-bold">Notifications</h1>
      </div>

      <div className="px-4 py-4">
        {loading && <LoadingState label="Loading notifications…" />}

        {!loading && error && <ErrorState message={error} onRetry={loadNotifications} />}

        {!loading && !error && notifications.length === 0 && (
          <EmptyState icon={Bell} title="No notifications yet" description="When someone likes, comments on, or saves your videos, you'll see it here." />
        )}

        {!loading && !error && notifications.length > 0 && (
          <div className="space-y-1">
            {notifications.map((n) => {
              const Icon = NOTIF_ICONS[n.type] ?? Bell;
              const color = NOTIF_COLORS[n.type] ?? 'text-white';
              return (
                <a
                  key={n.id}
                  href={n.video_id ? `#/v/${n.video_id}` : (n.type === 'follow' ? `#/profile/${n.actor_id}` : '#/notifications')}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-white/5 ${!n.read ? 'bg-white/[0.03]' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center">
                      <span className="text-black font-bold text-base">
                        {(n.actor?.username ?? '?')[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                      <Icon className={`w-3 h-3 ${color}`} strokeWidth={2.5} fill={n.type === 'like' ? 'currentColor' : 'none'} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-snug">{notifText(n)}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-[#00FF88] shrink-0" />}
                </a>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav current="notifications" />
    </div>
  );
}
