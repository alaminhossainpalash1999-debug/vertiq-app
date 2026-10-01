import { supabase } from '@/lib/supabase';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type SignalTable = 'stream_signals' | 'room_signals';
export type SignalForeignKey = 'stream_id' | 'room_id';

interface SignalingOptions {
  table: SignalTable;
  foreignKey: SignalForeignKey;
  sessionId: string;
  myId: string;
  onSignal: (fromId: string, type: string, payload: string) => void;
}

/**
 * Creates a signaling channel backed by a Supabase table + realtime subscription.
 * Returns helpers to send signals and clean up.
 */
export function createSignaling(opts: SignalingOptions) {
  const { table, foreignKey, sessionId, myId, onSignal } = opts;

  const channel = supabase
    .channel(`signals-${sessionId}-${myId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: `receiver_id=eq.${myId}`,
      },
      (payload) => {
        const row = payload.new as { sender_id: string; type: string; payload: string };
        onSignal(row.sender_id, row.type, row.payload);
      },
    )
    .subscribe();

  async function sendSignal(receiverId: string, type: 'offer' | 'answer' | 'ice', payload: string) {
    await supabase.from(table).insert({
      [foreignKey]: sessionId,
      sender_id: myId,
      receiver_id: receiverId,
      type,
      payload,
    });
  }

  async function cleanupSignals() {
    await supabase.from(table).delete().eq('sender_id', myId).eq(foreignKey, sessionId);
    supabase.removeChannel(channel);
  }

  return { sendSignal, cleanupSignals };
}

/**
 * Creates an RTCPeerConnection with standard config.
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(ICE_CONFIG);
}

/**
 * Negotiate a one-way stream: host sends track, viewer receives.
 * Host side: create offer, send to viewer, await answer.
 */
export async function hostNegotiate(
  pc: RTCPeerConnection,
  sendSignal: (receiverId: string, type: 'offer' | 'answer' | 'ice', payload: string) => void,
  viewerId: string,
) {
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal(viewerId, 'ice', JSON.stringify(e.candidate));
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendSignal(viewerId, 'offer', JSON.stringify(offer));
}

/**
 * Viewer side: receive offer, create answer, send back to host.
 */
export async function viewerNegotiate(
  pc: RTCPeerConnection,
  sendSignal: (receiverId: string, type: 'offer' | 'answer' | 'ice', payload: string) => void,
  hostId: string,
  offerSdp: string,
) {
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal(hostId, 'ice', JSON.stringify(e.candidate));
    }
  };

  await pc.setRemoteDescription(JSON.parse(offerSdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendSignal(hostId, 'answer', JSON.stringify(answer));
}

/**
 * Handle an incoming signal on a peer connection.
 */
export async function handleSignal(pc: RTCPeerConnection, type: string, payload: string) {
  if (type === 'answer') {
    await pc.setRemoteDescription(JSON.parse(payload));
  } else if (type === 'ice') {
    try {
      await pc.addIceCandidate(JSON.parse(payload));
    } catch {
      // ICE candidate may arrive before remote description — ignore
    }
  }
}
