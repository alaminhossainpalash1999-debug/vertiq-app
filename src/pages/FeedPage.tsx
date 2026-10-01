import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, type VideoWithProfile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { VideoCard } from '@/components/VideoCard';
import { CommentSheet } from '@/components/CommentSheet';
import { BottomNav } from '@/components/BottomNav';
import { ReportSheet } from '@/components/ReportSheet';
import { ErrorState } from '@/components/States';

type FeedTab = 'foryou' | 'following';

interface DemoVideo {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
}

const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: 'demo-1',
    user_id: 'demo-user-1',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption: 'Hiya live • Dancing in the park ✨ #dance #feelgood',
    created_at: new Date().toISOString(),
    profiles: { username: 'hiya_live', avatar_url: null },
    like_count: 120500,
    comment_count: 8200,
    liked_by_me: false,
    saved_by_me: false,
  },
  {
    id: 'demo-2',
    user_id: 'demo-user-2',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    caption: 'Best moments from the weekend trip 🌊 #travel #vibes',
    created_at: new Date().toISOString(),
    profiles: { username: 'travel_diaries', avatar_url: null },
    like_count: 89200,
    comment_count: 5100,
    liked_by_me: false,
    saved_by_me: false,
  },
  {
    id: 'demo-3',
    user_id: 'demo-user-3',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption: 'Cooking something special today 🔥 #food #cooking',
    created_at: new Date().toISOString(),
    profiles: { username: 'chef_maya', avatar_url: null },
    like_count: 34000,
    comment_count: 2300,
    liked_by_me: false,
    saved_by_me: false,
  },
];

export function FeedPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [videos, setVideos] = useState<VideoWithProfile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [reportVideoId, setReportVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const enrichVideos = useCallback(
    async (videosRaw: VideoWithProfile[]): Promise<VideoWithProfile[]> => {
      if (videosRaw.length === 0 || !user) return videosRaw;
      const videoIds = videosRaw.map((v) => v.id);
      const [likesRes, commentsRes, myLikesRes, myBookmarksRes] = await Promise.all([
        supabase.from('likes').select('video_id').in('video_id', videoIds),
        supabase.from('comments').select('video_id').in('video_id', videoIds),
        supabase.from('likes').select('video_id').eq('user_id', user.id).in('video_id', videoIds),
        supabase.from('bookmarks').select('video_id').eq('user_id', user.id).in('video_id', videoIds),
      ]);

      const likeMap = new Map<string, number>();
      for (const l of likesRes.data ?? []) {
        likeMap.set(l.video_id, (likeMap.get(l.video_id) ?? 0) + 1);
      }
      const commentMap = new Map<string, number>();
      for (const c of commentsRes.data ?? []) {
        commentMap.set(c.video_id, (commentMap.get(c.video_id) ?? 0) + 1);
      }
      const myLikeSet = new Set((myLikesRes.data ?? []).map((l) => l.video_id));
      const myBookmarkSet = new Set((myBookmarksRes.data ?? []).map((b) => b.video_id));

      return videosRaw.map((v) => ({
        ...v,
        like_count: likeMap.get(v.id) ?? 0,
        comment_count: commentMap.get(v.id) ?? 0,
        liked_by_me: myLikeSet.has(v.id),
        saved_by_me: myBookmarkSet.has(v.id),
      }));
    },
    [user],
  );

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setActiveIndex(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;

    let baseQuery;

    if (tab === 'following') {
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id);

      const followingIds = (followsData ?? []).map((f) => f.following_id);

      if (followingIds.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      baseQuery = supabase
        .from('videos')
        .select(`
          id, user_id, video_url, caption, created_at,
          profiles:profiles!videos_user_id_fkey (username, avatar_url)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(50);
    } else {
      baseQuery = supabase
        .from('videos')
        .select(`
          id, user_id, video_url, caption, created_at,
          profiles:profiles!videos_user_id_fkey (username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
    }

    const { data, error: queryError } = await baseQuery;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setError(null);

    const videosRaw = (data ?? []) as unknown as VideoWithProfile[];
    const enriched = await enrichVideos(videosRaw);

    if (enriched.length === 0) {
      setVideos(DEMO_VIDEOS as unknown as VideoWithProfile[]);
    } else {
      setVideos(enriched);
    }
    setLoading(false);
  }, [tab, user, enrichVideos]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!container) return;
        const idx = Math.round(container.scrollTop / container.clientHeight);
        if (idx !== activeIndex && idx >= 0) {
          setActiveIndex(idx);
        }
        ticking = false;
      });
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeIndex, videos.length]);

  async function toggleLike(videoId: string, currentlyLiked: boolean) {
    if (videoId.startsWith('demo-')) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, liked_by_me: !currentlyLiked, like_count: (v.like_count ?? 0) + (currentlyLiked ? -1 : 1) }
            : v,
        ),
      );
      return;
    }
    if (!user) return;
    if (currentlyLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('video_id', videoId);
    } else {
      await supabase.from('likes').insert({ user_id: user.id, video_id: videoId });
    }
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? { ...v, liked_by_me: !currentlyLiked, like_count: (v.like_count ?? 0) + (currentlyLiked ? -1 : 1) }
          : v,
      ),
    );
  }

  async function toggleBookmark(videoId: string, currentlySaved: boolean) {
    if (videoId.startsWith('demo-')) {
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, saved_by_me: !currentlySaved } : v)));
      return;
    }
    if (!user) return;
    if (currentlySaved) {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('video_id', videoId);
    } else {
      await supabase.from('bookmarks').insert({ user_id: user.id, video_id: videoId });
    }
    setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, saved_by_me: !currentlySaved } : v)));
  }

  const commentVideo = commentVideoId ? videos.find((v) => v.id === commentVideoId) : null;

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Video feed */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-[#FF2D55] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading feed…</p>
            </div>
          </div>
        )}

        {videos.map((video, idx) => (
          <div key={video.id} className="h-full w-full snap-start snap-always relative">
            <VideoCard
              video={video}
              active={idx === activeIndex}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onOpenComments={() => setCommentVideoId(video.id)}
              onToggleLike={() => toggleLike(video.id, video.liked_by_me ?? false)}
              onToggleBookmark={() => toggleBookmark(video.id, video.saved_by_me ?? false)}
              onOpenProfile={() => {
                if (!video.user_id.startsWith('demo-')) {
                  window.location.hash = `#/profile/${video.user_id}`;
                }
              }}
              onReport={() => setReportVideoId(video.id)}
            />
          </div>
        ))}
      </div>

      {/* Error state */}
      {!loading && error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-8">
          <ErrorState message={error} onRetry={loadVideos} />
        </div>
      )}

      {/* Top bar — white bar with LIVE badge, Following/For You tabs, search icon */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white px-4 pt-3 pb-2 flex items-center justify-between">
        {/* LIVE badge top-left */}
        <div className="flex items-center gap-1 bg-[#FF2D55] px-2 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>

        {/* Tabs center */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setTab('following')}
            className={`text-sm transition-all ${
              tab === 'following' ? 'text-black font-bold' : 'text-gray-400 font-medium'
            }`}
          >
            Following
          </button>
          <div className="relative">
            <button
              onClick={() => setTab('foryou')}
              className={`text-sm transition-all ${
                tab === 'foryou' ? 'text-black font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              For You
            </button>
            {tab === 'foryou' && (
              <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#FF2D55] rounded-full" />
            )}
          </div>
        </div>

        {/* Search icon top-right */}
        <a
          href="#/search"
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </a>
      </div>

      {commentVideo && (
        <CommentSheet
          videoId={commentVideo.id}
          onClose={() => setCommentVideoId(null)}
        />
      )}

      {reportVideoId && (
        <ReportSheet
          videoId={reportVideoId}
          onClose={() => setReportVideoId(null)}
        />
      )}

      <BottomNav current="feed" />
    </div>
  );
}
