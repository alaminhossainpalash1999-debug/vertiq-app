import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingState, ErrorState } from '@/components/States';
import { createSignaling, createPeerConnection } from '@/lib/webrtc';
import { X, Users, Mic, MicOff, Camera, CameraOff } from 'lucide-react';

interface Props {
  streamId: string;
}

interface PeerState {
  pc: RTCPeerConnection;
  viewerId: string;
}

export function GoLivePage({ streamId }: Props) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const signalingRef = useRef<ReturnType<typeof createSignaling> | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    async function loadStream() {
      const { data, error: err } = await supabase
        .from('live_streams')
        .select('id, host_id, title, status, viewer_count')
        .eq('id', streamId)
        .maybeSingle();

      if (err || !data) {
        setError(err?.message ?? 'Stream not found');
        setLoading(false);
        return;
      }

      if (data.host_id !== user?.id) {
        setError('You are not the host of this stream.');
        setLoading(false);
        return;
      }

      setStreamTitle(data.title);
      setViewerCount(data.viewer_count);
      setLoading(false);
    }
    loadStream();
  }, [streamId, user]);

  const startStreaming = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(`Failed to access camera/microphone: ${(err as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (loading || error) return;
    startStreaming();
  }, [loading, error, startStreaming]);

  useEffect(() => {
    if (loading || error || !user) return;

    const signaling = createSignaling({
      table: 'stream_signals',
      foreignKey: 'stream_id',
      sessionId: streamId,
      myId: user.id,
      onSignal: async (fromId, type, payload) => {
        if (type === 'offer') {
          const pc = createPeerConnection();
          localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              signaling.sendSignal(fromId, 'ice', JSON.stringify(e.candidate));
            }
          };

          peersRef.current.set(fromId, { pc, viewerId: fromId });
          await pc.setRemoteDescription(JSON.parse(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signaling.sendSignal(fromId, 'answer', JSON.stringify(answer));
        } else if (type === 'ice') {
          const peer = peersRef.current.get(fromId);
          if (peer) {
            try {
              await peer.pc.addIceCandidate(JSON.parse(payload));
            } catch {
              // ignore
            }
          }
        }
      },
    });
    signalingRef.current = signaling;

    const streamChannel = supabase
      .channel(`host-stream-${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` }, (payload) => {
        const updated = payload.new as { viewer_count: number };
        setViewerCount(updated.viewer_count);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamChannel);
      peersRef.current.forEach((p) => p.pc.close());
      peersRef.current.clear();
      signaling.cleanupSignals();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [loading, error, user, streamId]);

  async function endStream() {
    await supabase.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', streamId);
    signalingRef.current?.cleanupSignals();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    window.location.hash = '#/live';
  }

  function toggleMic() {
    const audio = localStreamRef.current?.getAudioTracks();
    if (audio && audio[0]) {
      audio[0].enabled = !audio[0].enabled;
      setMicOn(audio[0].enabled);
    }
  }

  function toggleCamera() {
    const video = localStreamRef.current?.getVideoTracks();
    if (video && video[0]) {
      video[0].enabled = !video[0].enabled;
      setCameraOn(video[0].enabled);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <LoadingState label="Starting stream…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black px-4 pt-6">
        <a href="#/live" className="text-gray-400 hover:text-white transition-colors mb-4 inline-block">
          <X className="w-6 h-6" />
        </a>
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 z-30 pt-6 pb-3 px-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
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
        <button onClick={endStream} className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full transition-colors">
          End Stream
        </button>
      </div>

      <div className="absolute top-16 left-4 z-30">
        <p className="text-white font-bold text-lg drop-shadow-lg">{streamTitle}</p>
        <p className="text-white/60 text-xs">You are streaming</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 pb-6 pt-4 px-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              micOn ? 'bg-white/15 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              cameraOn ? 'bg-white/15 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
