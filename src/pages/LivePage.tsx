import { useEffect, useState, useCallback } from 'react';
import { supabase, type LiveStreamWithHost } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { timeAgo } from '@/lib/format';
import { Radio, Video, Mic, Users } from 'lucide-react';

export function LivePage() {
  const { user } = useAuth();
  const [streams, setStreams] = useState<LiveStreamWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState<'live' | 'audio' | null>(null);
  const [title, setTitle] = useState('');

  const loadStreams = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('live_streams')
      .select(`
        id, host_id, title, status, viewer_count, created_at, ended_at,
        host:profiles!live_streams_host_id_fkey (username, avatar_url)
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setStreams((data ?? []) as unknown as LiveStreamWithHost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStreams();

    const channel = supabase
      .channel('live-page-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, loadStreams)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadStreams]);

  async function startLiveStream() {
    if (!user || !title.trim()) return;
    const { data, error: err } = await supabase
      .from('live_streams')
      .insert({ host_id: user.id, title: title.trim() })
      .select('id')
      .maybeSingle();

    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      window.location.hash = `#/live/host/${data.id}`;
    }
  }

  async function startAudioRoom() {
    if (!user || !title.trim()) return;
    const { data, error: err } = await supabase
      .from('audio_rooms')
      .insert({ host_id: user.id, name: title.trim() })
      .select('id')
      .maybeSingle();

    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      window.location.hash = `#/audio/room/${data.id}`;
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10">
        <h1 className="text-lg font-bold mb-3">Live</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowCreate('live'); setTitle(''); }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold py-2.5 rounded-xl transition-colors"
          >
            <Video className="w-4 h-4" />
            Go Live
          </button>
          <button
            onClick={() => { setShowCreate('audio'); setTitle(''); }}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0088FF]/15 hover:bg-[#0088FF]/25 text-[#0088FF] font-semibold py-2.5 rounded-xl transition-colors"
          >
            <Mic className="w-4 h-4" />
            Audio Room
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading && <LoadingState label="Loading live streams…" />}

        {!loading && error && <ErrorState message={error} onRetry={loadStreams} />}

        {!loading && !error && streams.length === 0 && !showCreate && (
          <EmptyState
            icon={Radio}
            title="No live streams right now"
            description="Start your own live stream or audio room above!"
          />
        )}

        {!loading && !error && streams.length > 0 && (
          <div className="space-y-3">
            {streams.map((s) => (
              <a
                key={s.id}
                href={`#/live/view/${s.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors active:scale-[0.98]"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center">
                    <span className="text-black font-bold text-lg">
                      {(s.host?.username ?? '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">@{s.host?.username ?? 'unknown'}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <Users className="w-3 h-3" />
                      {s.viewer_count}
                    </span>
                    <span className="text-gray-600 text-xs">{timeAgo(s.created_at)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setShowCreate(null)}>
          <div className="bg-[#111] rounded-2xl w-full max-w-sm p-6 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              {showCreate === 'live' ? <Video className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-[#0088FF]" />}
              <h3 className="text-white font-bold text-lg">
                {showCreate === 'live' ? 'Start Live Stream' : 'Create Audio Room'}
              </h3>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={showCreate === 'live' ? 'Stream title…' : 'Room name…'}
              autoFocus
              maxLength={100}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(null)}
                className="flex-1 bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreate === 'live' ? startLiveStream : startAudioRoom}
                disabled={!title.trim()}
                className={`flex-1 font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 ${
                  showCreate === 'live'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[#0088FF] text-white hover:bg-[#0077dd]'
                }`}
              >
                {showCreate === 'live' ? 'Go Live' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav current="live" />
    </div>
  );
}
