import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingState, ErrorState } from '@/components/States';
import { createSignaling, createPeerConnection, handleSignal } from '@/lib/webrtc';
import { X, Mic, MicOff, Headphones, Volume2, Users } from 'lucide-react';

interface Props {
  roomId: string;
}

interface Participant {
  id: string;
  username: string;
  isHost: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
}

export function AudioRoomPage({ roomId }: Props) {
  const { user } = useAuth();
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const signalingRef = useRef<ReturnType<typeof createSignaling> | null>(null);
  const [roomName, setRoomName] = useState('');
  const [hostId, setHostId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [isListener, setIsListener] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  // Load room
  useEffect(() => {
    async function loadRoom() {
      const { data, error: err } = await supabase
        .from('audio_rooms')
        .select('id, host_id, name, status')
        .eq('id', roomId)
        .maybeSingle();

      if (err || !data) {
        setError(err?.message ?? 'Room not found');
        setLoading(false);
        return;
      }

      if (data.status === 'ended') {
        setError('This room has ended.');
        setLoading(false);
        return;
      }

      setRoomName(data.name);
      setHostId(data.host_id);
      setIsListener(user?.id !== data.host_id);
      setLoading(false);
    }
    loadRoom();
  }, [roomId, user]);

  // Get mic access for speakers
  const initAudio = useCallback(async () => {
    if (!user || isListener) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      setError(`Microphone access denied: ${(err as Error).message}`);
    }
  }, [user, isListener]);

  useEffect(() => {
    if (loading || error || isListener) return;
    initAudio();
  }, [loading, error, isListener, initAudio]);

  // Set up signaling and peer connections (mesh topology)
  useEffect(() => {
    if (loading || error || !user) return;

    const signaling = createSignaling({
      table: 'room_signals',
      foreignKey: 'room_id',
      sessionId: roomId,
      myId: user.id,
      onSignal: async (fromId, type, payload) => {
        if (type === 'offer') {
          if (peersRef.current.has(fromId)) return;
          const pc = createPeerConnection();
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);

          pc.ontrack = (e) => {
            audioEl.srcObject = e.streams[0];
          };
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              signaling.sendSignal(fromId, 'ice', JSON.stringify(e.candidate));
            }
          };

          localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });

          peersRef.current.set(fromId, { pc, audioEl });
          await pc.setRemoteDescription(JSON.parse(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signaling.sendSignal(fromId, 'answer', JSON.stringify(answer));
          setConnectedIds((prev) => new Set(prev).add(fromId));
        } else {
          const peer = peersRef.current.get(fromId);
          if (peer) {
            await handleSignal(peer.pc, type, payload);
            if (type === 'answer') {
              setConnectedIds((prev) => new Set(prev).add(fromId));
            }
          }
        }
      },
    });
    signalingRef.current = signaling;

    // Presence: track who's in the room
    const presenceChannel = supabase.channel(`room-presence-${roomId}`);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const allParticipants: Participant[] = [];
        for (const [id, metas] of Object.entries(state)) {
          const meta = metas[0] as unknown as { user_id: string; username: string; is_host: boolean; muted: boolean };
          allParticipants.push({
            id: meta.user_id,
            username: meta.username,
            isHost: meta.is_host,
            isMuted: meta.muted,
            isSpeaking: false,
          });
        }
        setParticipants(allParticipants);

        // Initiate connections to new participants (lower ID initiates to avoid duplicates)
        const myId = user.id;
        for (const p of allParticipants) {
          if (p.id === myId) continue;
          if (peersRef.current.has(p.id)) continue;
          if (myId < p.id) {
            // I initiate
            initiateConnection(p.id, signaling);
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        for (const left of leftPresences) {
          const meta = left as unknown as { user_id: string };
          const peer = peersRef.current.get(meta.user_id);
          if (peer) {
            peer.pc.close();
            peer.audioEl.remove();
            peersRef.current.delete(meta.user_id);
          }
          setConnectedIds((prev) => {
            const next = new Set(prev);
            next.delete(meta.user_id);
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            username: (await getUserUsername(user.id)) ?? 'user',
            is_host: hostId === user.id,
            muted,
          });
        }
      });

    // Realtime for room status
    const roomChannel = supabase
      .channel(`room-status-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'audio_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new as { status: string };
        if (updated.status === 'ended') {
          setError('This room has ended.');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(roomChannel);
      peersRef.current.forEach((p) => {
        p.pc.close();
        p.audioEl.remove();
      });
      peersRef.current.clear();
      signaling.cleanupSignals();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, user, roomId, hostId]);

  async function initiateConnection(peerId: string, signaling: ReturnType<typeof createSignaling>) {
    if (peersRef.current.has(peerId)) return;
    const pc = createPeerConnection();
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);

    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signaling.sendSignal(peerId, 'ice', JSON.stringify(e.candidate));
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    peersRef.current.set(peerId, { pc, audioEl });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signaling.sendSignal(peerId, 'offer', JSON.stringify(offer));
  }

  async function getUserUsername(uid: string): Promise<string | null> {
    const { data } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
    return data?.username ?? null;
  }

  function toggleMute() {
    const audio = localStreamRef.current?.getAudioTracks();
    if (audio && audio[0]) {
      audio[0].enabled = muted; // if currently muted, enable; if not, disable
      setMuted(!muted);
      // Update presence
      const channel = supabase.channel(`room-presence-${roomId}`);
      channel.track({
        user_id: user!.id,
        username: participants.find((p) => p.id === user!.id)?.username ?? 'user',
        is_host: hostId === user!.id,
        muted: !muted,
      });
    }
  }

  async function leaveRoom() {
    if (user && hostId === user.id) {
      await supabase.from('audio_rooms').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', roomId);
    }
    signalingRef.current?.cleanupSignals();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    window.location.hash = '#/live';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <LoadingState label="Joining room…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <a href="#/live" className="text-gray-400 hover:text-white transition-colors mb-4 text-sm">
          Back to Live
        </a>
        <ErrorState message={error} />
      </div>
    );
  }

  const speakers = participants.filter((p) => !p.isMuted);
  const listeners = participants.filter((p) => p.isMuted);

  return (
    <div className="min-h-screen bg-black text-white pb-6">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{roomName}</h1>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {participants.length} in room
          </p>
        </div>
        <button
          onClick={leaveRoom}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Leave
        </button>
      </div>

      <div className="px-4 py-6">
        {/* Speakers */}
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
          <Mic className="w-3.5 h-3.5" />
          Speakers · {speakers.length}
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {speakers.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center ${connectedIds.has(p.id) || p.id === user?.id ? '' : 'opacity-40'}`}>
                <span className="text-black font-bold text-xl">{p.username[0]?.toUpperCase()}</span>
                {p.isHost && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#00FF88] flex items-center justify-center border-2 border-black">
                    <Mic className="w-2.5 h-2.5 text-black" />
                  </div>
                )}
                {p.id === user?.id && !muted && (
                  <div className="absolute inset-0 rounded-full border-2 border-[#00FF88] animate-pulse" />
                )}
              </div>
              <p className="text-xs font-medium truncate max-w-full">@{p.username}</p>
              {p.id === user?.id && (
                <span className="text-[10px] text-[#00FF88] font-medium">You</span>
              )}
            </div>
          ))}
        </div>

        {/* Listeners */}
        {listeners.length > 0 && (
          <>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
              <Headphones className="w-3.5 h-3.5" />
              Listening · {listeners.length}
            </h2>
            <div className="flex flex-wrap gap-2">
              {listeners.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center">
                    <span className="text-black font-bold text-xs">{p.username[0]?.toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-gray-400">@{p.username}</span>
                  {p.id === user?.id && <span className="text-[10px] text-[#00FF88]">You</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Headphones className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">Waiting for others to join…</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-30 bg-black/95 backdrop-blur-lg border-t border-white/10 py-4 px-4">
        <div className="flex items-center justify-center gap-4">
          {isListener ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Headphones className="w-5 h-5" />
              <span>You're listening</span>
            </div>
          ) : (
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 font-semibold px-6 py-3 rounded-2xl transition-colors ${
                muted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-[#00FF88]/20 text-[#00FF88] hover:bg-[#00FF88]/30'
              }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {muted ? 'Muted' : 'Speaking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
