import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, type VideoWithProfile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { VideoCard } from '@/components/VideoCard';
import { CommentSheet } from '@/components/CommentSheet';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { ReportSheet } from '@/components/ReportSheet';
import { ErrorState } from '@/components/States';

export function BookmarksPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoWithProfile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [reportVideoId, setReportVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadVideos = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get bookmarked video IDs
    const { data: bookmarksData, error: bmError } = await supabase
      .from('bookmarks')
      .select('video_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (bmError) {
      setError(bmError.message);
      setLoading(false);
      return;
    }

    const videoIds = (bookmarksData ?? []).map((b) => b.video_id);
    if (videoIds.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('videos')
      .select(`
        id, user_id, video_url, caption, created_at,
        profiles:profiles!videos_user_id_fkey (username, avatar_url)
      `)
      .in('id', videoIds)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const videosRaw = (data ?? []) as unknown as VideoWithProfile[];

    // Enrich with counts + liked_by_me + saved_by_me (all are saved)
    const [likesRes, commentsRes, myLikesRes] = await Promise.all([
      supabase.from('likes').select('video_id').in('video_id', videoIds),
      supabase.from('comments').select('video_id').in('video_id', videoIds),
      supabase.from('likes').select('video_id').eq('user_id', user.id).in('video_id', videoIds),
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

    setVideos(
      videosRaw.map((v) => ({
        ...v,
        like_count: likeMap.get(v.id) ?? 0,
        comment_count: commentMap.get(v.id) ?? 0,
        liked_by_me: myLikeSet.has(v.id),
        saved_by_me: true,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Track which video is in view
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
    if (!user) return;
    if (currentlySaved) {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('video_id', videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } else {
      await supabase.from('bookmarks').insert({ user_id: user.id, video_id: videoId });
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, saved_by_me: true } : v)));
    }
  }

  const commentVideo = commentVideoId ? videos.find((v) => v.id === commentVideoId) : null;

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-6 pb-3 px-4 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent">
        <a href="#/" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <h1 className="text-white font-bold text-lg">Saved Videos</h1>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="h-full flex items-center justify-center px-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <Bookmark className="w-10 h-10 text-gray-600" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No saved videos</h2>
              <p className="text-gray-500 text-sm">Tap the bookmark icon on any video to save it here.</p>
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
                window.location.hash = `#/profile/${video.user_id}`;
              }}
              onReport={() => setReportVideoId(video.id)}
            />
          </div>
        ))}
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

      {!loading && error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-8">
          <ErrorState message={error} onRetry={loadVideos} />
        </div>
      )}
    </div>
  );
}
