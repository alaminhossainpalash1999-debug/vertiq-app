import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, type LiveStreamWithHost } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingState, ErrorState } from '@/components/States';
import { createSignaling, createPeerConnection, handleSignal } from '@/lib/webrtc';
import { X, Users, ArrowLeft } from 'lucide-react';

interface Props {
  streamId: string;
}

export function LiveViewerPage({ streamId }: Props) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<ReturnType<typeof createSignaling> | null>(null);
  const [stream, setStream] = useState<LiveStreamWithHost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const loadStream = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('live_streams')
      .select(`
        id, host_id, title, status, viewer_count, created_at, ended_at,
        host:profiles!live_streams_host_id_fkey (username, avatar_url)
      `)
      .eq('id', streamId)
      .maybeSingle();

    if (err || !data) {
      setError(err?.message ?? 'Stream not found');
      setLoading(false);
      return;
    }

    const streamData = data as unknown as LiveStreamWithHost;
    if (streamData.status === 'ended') {
      setError('This stream has ended.');
      setLoading(false);
      return;
    }

    setStream(streamData);
    setViewerCount(streamData.viewer_count);
    setLoading(false);
  }, [streamId]);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  // Connect to host's stream via WebRTC
  const connectToHost = useCallback(async () => {
    if (!user || !stream) return;

    const hostId = stream.host_id;
    const pc = createPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setConnected(true);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signalingRef.current?.sendSignal(hostId, 'ice', JSON.stringify(e.candidate));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
      }
    };

    // Create offer and send to host
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signalingRef.current?.sendSignal(hostId, 'offer', JSON.stringify(offer));

    // Increment viewer count
    await supabase.from('live_streams').update({ viewer_count: stream.viewer_count + 1 }).eq('id', streamId);
  }, [user, stream, streamId]);

  useEffect(() => {
    if (loading || error || !stream || !user) return;

    const signaling = createSignaling({
      table: 'stream_signals',
      foreignKey: 'stream_id',
      sessionId: streamId,
      myId: user.id,
      onSignal: (fromId, type, payload) => {
        if (fromId === stream.host_id && pcRef.current) {
          handleSignal(pcRef.current, type, payload);
        }
      },
    });
    signalingRef.current = signaling;

    connectToHost();

    // Realtime for stream updates (viewer count, status changes)
    const channel = supabase
      .channel(`viewer-stream-${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` }, (payload) => {
        const updated = payload.new as { viewer_count: number; status: string };
        setViewerCount(updated.viewer_count);
        if (updated.status === 'ended') {
          setError('This stream has ended.');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      pcRef.current?.close();
      signaling.cleanupSignals();
      // Decrement viewer count
      if (stream) {
        supabase
          .from('live_streams')
          .update({ viewer_count: Math.max(0, viewerCount - 1) })
          .eq('id', streamId)
          .then();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, stream, user, streamId, connectToHost]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <LoadingState label="Loading stream…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <a href="#/live" className="text-gray-400 hover:text-white transition-colors mb-4 flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Live
        </a>
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Remote video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />

      {/* Connecting overlay */}
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Connecting to stream…</p>
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-6 pb-3 px-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <a href="#/live" className="text-white/80 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </a>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-red-500 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold">LIVE</span>
          </div>
          <span className="flex items-center gap-1 text-white/80 text-xs">
            <Users className="w-3.5 h-3.5" />
            {viewerCount}
          </span>
        </div>
      </div>

      {/* Stream info */}
      <div className="absolute top-16 left-4 z-30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center">
            <span className="text-black font-bold text-sm">
              {(stream?.host?.username ?? '?')[0]?.toUpperCase()}
            </span>
          </div>
          <span className="text-white font-semibold text-sm">@{stream?.host?.username ?? 'unknown'}</span>
        </div>
        <p className="text-white font-bold text-lg drop-shadow-lg">{stream?.title}</p>
      </div>
    </div>
  );
}
