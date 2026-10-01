import { useEffect, useState, useCallback } from 'react';
import { supabase, type AudioRoomWithHost } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { timeAgo } from '@/lib/format';
import { Mic, Users, Headphones, ArrowLeft } from 'lucide-react';

export function AudioChatPage() {
  const [rooms, setRooms] = useState<AudioRoomWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('audio_rooms')
      .select(`
        id, host_id, name, status, speaker_count, listener_count, created_at, ended_at,
        host:profiles!audio_rooms_host_id_fkey (username, avatar_url)
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRooms((data ?? []) as unknown as AudioRoomWithHost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRooms();

    const channel = supabase
      .channel('audio-chat-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_rooms' }, loadRooms)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRooms]);

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10 flex items-center gap-3">
        <a href="#/live" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className="text-lg font-bold">Audio Rooms</h1>
      </div>

      <div className="px-4 py-4">
        {loading && <LoadingState label="Loading audio rooms…" />}

        {!loading && error && <ErrorState message={error} onRetry={loadRooms} />}

        {!loading && !error && rooms.length === 0 && (
          <EmptyState
            icon={Headphones}
            title="No active audio rooms"
            description="Go back to the Live tab to start a new audio room."
          />
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="space-y-3">
            {rooms.map((r) => (
              <a
                key={r.id}
                href={`#/audio/room/${r.id}`}
                className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-[#0088FF]/10 to-transparent border border-[#0088FF]/20 hover:bg-[#0088FF]/10 transition-colors active:scale-[0.98]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#0088FF]/20 flex items-center justify-center shrink-0">
                  <Mic className="w-6 h-6 text-[#0088FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">@{r.host?.username ?? 'unknown'}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[#00FF88] text-xs">
                      <Mic className="w-3 h-3" />
                      {r.speaker_count} speaking
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <Users className="w-3 h-3" />
                      {r.listener_count} listening
                    </span>
                    <span className="text-gray-600 text-xs">{timeAgo(r.created_at)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <BottomNav current="live" />
    </div>
  );
}
