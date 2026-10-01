import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile, type VideoWithProfile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Search as SearchIcon, Hash, User as UserIcon } from 'lucide-react';

type SearchTab = 'users' | 'videos';

export function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('users');
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [videoResults, setVideoResults] = useState<VideoWithProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUserResults([]);
      setVideoResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    const term = q.trim();

    // Search users by username (ilike)
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at')
      .ilike('username', `%${term}%`)
      .limit(20);
    setUserResults((usersData ?? []) as Profile[]);

    // Search videos by caption (ilike)
    const { data: videosData } = await supabase
      .from('videos')
      .select(`
        id, user_id, video_url, caption, created_at,
        profiles:profiles!videos_user_id_fkey (username, avatar_url)
      `)
      .ilike('caption', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(30);

    const videosRaw = (videosData ?? []) as unknown as VideoWithProfile[];

    // Enrich with like/comment counts
    if (videosRaw.length > 0 && user) {
      const videoIds = videosRaw.map((v) => v.id);
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('likes').select('video_id').in('video_id', videoIds),
        supabase.from('comments').select('video_id').in('video_id', videoIds),
      ]);
      const likeMap = new Map<string, number>();
      for (const l of likesRes.data ?? []) {
        likeMap.set(l.video_id, (likeMap.get(l.video_id) ?? 0) + 1);
      }
      const commentMap = new Map<string, number>();
      for (const c of commentsRes.data ?? []) {
        commentMap.set(c.video_id, (commentMap.get(c.video_id) ?? 0) + 1);
      }
      setVideoResults(
        videosRaw.map((v) => ({
          ...v,
          like_count: likeMap.get(v.id) ?? 0,
          comment_count: commentMap.get(v.id) ?? 0,
        })),
      );
    } else {
      setVideoResults(videosRaw);
    }

    setSearching(false);
  }, [user]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  function renderCaptionWithHashtags(caption: string) {
    return caption.split(/(\s+)/).map((part, i) =>
      part.startsWith('#') ? (
        <span key={i} className="text-[#00FF88] font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <a href="#/" className="text-gray-400 hover:text-white transition-colors shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </a>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users or hashtags…"
              autoFocus
              className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
            />
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-6">
          <button
            onClick={() => setTab('users')}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
              tab === 'users' ? 'text-white border-[#00FF88]' : 'text-gray-500 border-transparent'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Users
          </button>
          <button
            onClick={() => setTab('videos')}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
              tab === 'videos' ? 'text-white border-[#00FF88]' : 'text-gray-500 border-transparent'
            }`}
          >
            <Hash className="w-4 h-4" />
            Videos
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 py-4 pb-24">
        {searching && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!searching && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SearchIcon className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-600 text-sm">Search for creators or videos by caption/hashtag</p>
          </div>
        )}

        {!searching && hasSearched && tab === 'users' && (
          <div className="space-y-2">
            {userResults.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-12">No users found.</p>
            ) : (
              userResults.map((p) => (
                <a
                  key={p.id}
                  href={`#/profile/${p.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center shrink-0">
                    <span className="text-black font-bold text-base">
                      {p.username[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">@{p.username}</p>
                    <p className="text-gray-500 text-xs">View profile</p>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {!searching && hasSearched && tab === 'videos' && (
          <div>
            {videoResults.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-12">No videos found.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {videoResults.map((v) => (
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-white text-[10px] leading-tight line-clamp-2">
                        {renderCaptionWithHashtags(v.caption)}
                      </p>
                      <p className="text-gray-400 text-[10px] mt-0.5">@{v.profiles?.username}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
