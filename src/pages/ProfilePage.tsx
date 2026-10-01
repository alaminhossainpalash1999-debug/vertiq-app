import { useEffect, useState } from 'react';
import { supabase, type Profile, type Video } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { ArrowLeft, UserPlus, UserCheck, LogOut, Ban, MessageCircle, Lock, Shield, Settings as SettingsIcon } from 'lucide-react';

interface Props {
  userId: string;
}

export function ProfilePage({ userId }: Props) {
  const { user: currentUser, profile: myProfile, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: profileData, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at, is_private, role, is_blocked')
        .eq('id', userId)
        .maybeSingle();

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }
      setProfile(profileData as Profile | null);

      const { data: videoData } = await supabase
        .from('videos')
        .select('id, user_id, video_url, caption, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setVideos((videoData ?? []) as Video[]);

      const [{ count: fCount }, { count: fgCount }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      ]);
      setFollowerCount(fCount ?? 0);
      setFollowingCount(fgCount ?? 0);

      if (currentUser && !isOwnProfile) {
        const { data: followData } = await supabase
          .from('follows')
          .select('follower_id, following_id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .maybeSingle();
        setFollowing(!!followData);

        const { data: blockData } = await supabase
          .from('blocks')
          .select('blocker_id, blocked_id')
          .eq('blocker_id', currentUser.id)
          .eq('blocked_id', userId)
          .maybeSingle();
        setIsBlocked(!!blockData);
      }

      setLoading(false);
    }
    load();
  }, [userId, currentUser, isOwnProfile]);

  async function toggleFollow() {
    if (!currentUser || isOwnProfile) return;
    setActionLoading(true);
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
      setFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: userId });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setActionLoading(false);
  }

  async function toggleBlock() {
    if (!currentUser || isOwnProfile) return;
    setActionLoading(true);
    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', userId);
      setIsBlocked(false);
    } else {
      await supabase.from('blocks').insert({ blocker_id: currentUser.id, blocked_id: userId });
      setIsBlocked(true);
      if (following) {
        await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      }
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <LoadingState label="Loading profile…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black px-4 pt-6">
        <a href="#/" className="text-gray-400 hover:text-white transition-colors mb-4 inline-block">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black">
        <div className="px-4 pt-6">
          <a href="#/" className="text-gray-400 hover:text-white transition-colors mb-4 inline-block">
            <ArrowLeft className="w-6 h-6" />
          </a>
        </div>
        <EmptyState title="User not found" description="This profile doesn't exist or has been deleted." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <a href="#/" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <h1 className="text-lg font-bold flex-1">@{profile.username}</h1>
        {profile.role === 'admin' && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-[#00FF88] bg-[#00FF88]/10 px-2 py-1 rounded-full">
            <Shield className="w-3 h-3" />
            ADMIN
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center px-6 pb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center mb-4">
            <span className="text-black font-black text-3xl">
              {profile.username[0]?.toUpperCase()}
            </span>
          </div>
          {profile.is_private && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-black border-2 border-black flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-[#0088FF]" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold">@{profile.username}</h2>
        {profile.is_private && (
          <p className="text-[#0088FF] text-xs mt-1 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Private Account
          </p>
        )}

        <div className="flex gap-8 mt-4">
          <div className="text-center">
            <p className="text-xl font-bold">{videos.length}</p>
            <p className="text-xs text-gray-500">Videos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{followerCount}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{followingCount}</p>
            <p className="text-xs text-gray-500">Following</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex gap-2 flex-wrap justify-center">
          {isOwnProfile ? (
            <>
              <a
                href="#/settings"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </a>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-400 font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </>
          ) : (
            <>
              {!isBlocked && (
                <>
                  <button
                    onClick={toggleFollow}
                    disabled={actionLoading}
                    className={`flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 ${
                      following
                        ? 'bg-white/10 text-white hover:bg-white/15'
                        : 'bg-gradient-to-r from-[#00FF88] to-[#0088FF] text-black'
                    }`}
                  >
                    {following ? <><UserCheck className="w-4 h-4" />Following</> : <><UserPlus className="w-4 h-4" />Follow</>}
                  </button>
                  <a
                    href="#/messages"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </a>
                </>
              )}
              <button
                onClick={toggleBlock}
                disabled={actionLoading}
                className={`flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                  isBlocked
                    ? 'bg-[#00FF88]/15 text-[#00FF88] hover:bg-[#00FF88]/25'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Ban className="w-4 h-4" />
                {isBlocked ? 'Unblock' : 'Block'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Video grid */}
      <div className="px-4 pb-24">
        {isBlocked ? (
          <EmptyState icon={Ban} title="You blocked this user" description="Unblock them to see their videos." />
        ) : videos.length === 0 ? (
          <EmptyState title="No videos yet" description={isOwnProfile ? 'Upload your first video!' : 'This user hasn\'t posted any videos.'} />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {videos.map((v) => (
              <a
                key={v.id}
                href={`#/v/${v.id}`}
                className="relative aspect-[9/16] rounded-md overflow-hidden bg-white/5 group"
              >
                <video
                  src={v.video_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>

      <BottomNav current={isOwnProfile ? 'settings' : 'feed'} />
    </div>
  );
}
