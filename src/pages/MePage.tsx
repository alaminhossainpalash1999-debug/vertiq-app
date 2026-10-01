import { useEffect, useState } from 'react';
import { supabase, type Video } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState } from '@/components/States';
import { Settings as SettingsIcon, Shield } from 'lucide-react';

export function MePage() {
  const { user, profile } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: videoData } = await supabase
        .from('videos')
        .select('id, user_id, video_url, caption, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      setVideos((videoData ?? []) as Video[]);

      const [{ count: fCount }, { count: fgCount }, { count: lCount }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user!.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user!.id),
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      setFollowerCount(fCount ?? 0);
      setFollowingCount(fgCount ?? 0);
      setLikeCount(lCount ?? 0);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <LoadingState label="Loading profile…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Top bar with gear icon */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">@{profile?.username ?? 'me'}</h1>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <a
              href="#/admin"
              className="flex items-center gap-1 text-[10px] font-bold text-[#00FF88] bg-[#00FF88]/10 px-2 py-1 rounded-full"
            >
              <Shield className="w-3 h-3" />
              ADMIN
            </a>
          )}
          <a
            href="#/settings"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <SettingsIcon className="w-5 h-5 text-white" />
          </a>
        </div>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center px-6 pt-4 pb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center mb-4">
          <span className="text-black font-black text-3xl">
            {profile?.username?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>

        <h2 className="text-xl font-bold">@{profile?.username ?? 'me'}</h2>
        <p className="text-gray-500 text-sm mt-1">No bio yet</p>

        {/* Stats */}
        <div className="flex gap-8 mt-5">
          <div className="text-center">
            <p className="text-xl font-bold">{followingCount}</p>
            <p className="text-xs text-gray-500">Following</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{followerCount}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{likeCount}</p>
            <p className="text-xs text-gray-500">Likes</p>
          </div>
        </div>

        {/* Edit Profile button */}
        <a
          href="#/settings"
          className="mt-5 bg-white/10 hover:bg-white/15 text-white font-semibold px-8 py-2.5 rounded-lg transition-colors text-sm"
        >
          Edit Profile
        </a>
      </div>

      {/* Video grid */}
      <div className="px-2 pb-4">
        {videos.length === 0 ? (
          <div className="pt-8">
            <EmptyState title="No videos yet" description="Upload your first video to see it here!" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {videos.map((v) => (
              <div
                key={v.id}
                className="relative aspect-[9/16] rounded-sm overflow-hidden bg-white/5"
              >
                <video
                  src={v.video_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute bottom-1 left-1 text-white text-[10px] font-medium drop-shadow-lg">
                  {v.caption?.slice(0, 20) ?? ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav current="me" />
    </div>
  );
}
