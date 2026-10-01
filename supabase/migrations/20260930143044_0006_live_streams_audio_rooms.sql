/*
# Vertiq — Live Streaming + Audio Chat

1. New Tables
   - live_streams: metadata for active live video streams
   - audio_rooms: metadata for live audio chat rooms
   - stream_signals: WebRTC signaling messages for live streams
   - room_signals: WebRTC signaling messages for audio rooms

2. Security — RLS on every table
   - live_streams: read all, insert/update/delete own only
   - audio_rooms: read all, insert/update/delete own only
   - stream_signals: read where sender or receiver, insert own, delete own
   - room_signals: read where sender or receiver, insert own, delete own

3. Realtime — all 4 tables added to publication
*/

-- ── live_streams ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Live Stream',
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  viewer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_streams_select_all" ON live_streams;
CREATE POLICY "live_streams_select_all"
  ON live_streams FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "live_streams_insert_own" ON live_streams;
CREATE POLICY "live_streams_insert_own"
  ON live_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "live_streams_update_own" ON live_streams;
CREATE POLICY "live_streams_update_own"
  ON live_streams FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "live_streams_delete_own" ON live_streams;
CREATE POLICY "live_streams_delete_own"
  ON live_streams FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams (status, created_at DESC);

-- ── audio_rooms ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audio_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Audio Room',
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  speaker_count integer NOT NULL DEFAULT 0,
  listener_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE audio_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_rooms_select_all" ON audio_rooms;
CREATE POLICY "audio_rooms_select_all"
  ON audio_rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audio_rooms_insert_own" ON audio_rooms;
CREATE POLICY "audio_rooms_insert_own"
  ON audio_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "audio_rooms_update_own" ON audio_rooms;
CREATE POLICY "audio_rooms_update_own"
  ON audio_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "audio_rooms_delete_own" ON audio_rooms;
CREATE POLICY "audio_rooms_delete_own"
  ON audio_rooms FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE INDEX IF NOT EXISTS idx_audio_rooms_status ON audio_rooms (status, created_at DESC);

-- ── stream_signals ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('offer','answer','ice')),
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stream_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stream_signals_select_own" ON stream_signals;
CREATE POLICY "stream_signals_select_own"
  ON stream_signals FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "stream_signals_insert_own" ON stream_signals;
CREATE POLICY "stream_signals_insert_own"
  ON stream_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "stream_signals_delete_own" ON stream_signals;
CREATE POLICY "stream_signals_delete_own"
  ON stream_signals FOR DELETE TO authenticated USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_stream_signals_stream ON stream_signals (stream_id, receiver_id);

-- ── room_signals ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES audio_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('offer','answer','ice')),
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE room_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_signals_select_own" ON room_signals;
CREATE POLICY "room_signals_select_own"
  ON room_signals FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "room_signals_insert_own" ON room_signals;
CREATE POLICY "room_signals_insert_own"
  ON room_signals FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "room_signals_delete_own" ON room_signals;
CREATE POLICY "room_signals_delete_own"
  ON room_signals FOR DELETE TO authenticated USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_room_signals_room ON room_signals (room_id, receiver_id);

-- ── Realtime publication ─────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE audio_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE stream_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE room_signals;

GRANT SELECT ON live_streams TO authenticated;
GRANT SELECT ON audio_rooms TO authenticated;
GRANT SELECT ON stream_signals TO authenticated;
GRANT SELECT ON room_signals TO authenticated;
