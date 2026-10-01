/*
# Vertiq — Notifications, Messages, Reports, Blocks, Admin

1. New Tables
   - notifications: like/follow/comment/bookmark events targeting a user
   - messages: direct messages between two users
   - reports: user-reported videos with reason + status
   - blocks: user-to-user block relationships

2. Column additions
   - profiles.is_private (boolean, default false) — private accounts
   - profiles.role (text, default 'user') — 'user' or 'admin'
   - profiles.is_blocked (boolean, default false) — admin can block users

3. Automation
   - Triggers fire AFTER insert on likes/follows/comments/bookmarks to create
     notification rows automatically.

4. Security — RLS on every new table
   - notifications: read/update/delete own only
   - messages: read where sender or receiver, insert as sender, delete own, update receiver (for read receipts)
   - reports: insert own, select/update admin only
   - blocks: read own (both sides), insert/delete own

5. Realtime
   - notifications, messages, reports tables added to realtime publication

6. Notes
   - user_id columns default to auth.uid()
   - All FKs ON DELETE CASCADE
   - Notification triggers skip self-notifications
*/

-- ── Add columns to profiles ──────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- ── notifications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like','follow','comment','bookmark')),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  text text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, created_at DESC);

-- ── messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own"
  ON messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender"
  ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own"
  ON messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id, created_at DESC);

-- ── reports ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_admin" ON reports;
CREATE POLICY "reports_select_admin"
  ON reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin"
  ON reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);

-- ── blocks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select_own" ON blocks;
CREATE POLICY "blocks_select_own"
  ON blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON blocks;
CREATE POLICY "blocks_insert_own"
  ON blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON blocks;
CREATE POLICY "blocks_delete_own"
  ON blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- ── Notification triggers ────────────────────────────────

-- like + follow trigger
CREATE OR REPLACE FUNCTION like_follow_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user uuid;
  ntype text;
  vid uuid;
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
    SELECT user_id INTO target_user FROM videos WHERE id = NEW.video_id;
    ntype := 'like';
    vid := NEW.video_id;
  ELSIF TG_TABLE_NAME = 'follows' THEN
    target_user := NEW.following_id;
    ntype := 'follow';
    vid := NULL;
  END IF;

  IF target_user IS NOT NULL AND target_user <> COALESCE(NEW.user_id, NEW.follower_id) THEN
    IF ntype = 'like' THEN
      INSERT INTO notifications (user_id, actor_id, type, video_id)
      VALUES (target_user, NEW.user_id, ntype, vid);
    ELSE
      INSERT INTO notifications (user_id, actor_id, type)
      VALUES (target_user, NEW.follower_id, ntype);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_like_notify ON likes;
CREATE TRIGGER trg_like_notify AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION like_follow_notify();

DROP TRIGGER IF EXISTS trg_follow_notify ON follows;
CREATE TRIGGER trg_follow_notify AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION like_follow_notify();

-- comment trigger
CREATE OR REPLACE FUNCTION comment_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user uuid;
BEGIN
  SELECT user_id INTO target_user FROM videos WHERE id = NEW.video_id;
  IF target_user IS NOT NULL AND target_user <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id, text)
    VALUES (target_user, NEW.user_id, 'comment', NEW.video_id, NEW.text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_notify ON comments;
CREATE TRIGGER trg_comment_notify AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION comment_notify();

-- bookmark trigger
CREATE OR REPLACE FUNCTION bookmark_notify()
RETURNS TRIGGER AS $$
DECLARE
  target_user uuid;
BEGIN
  SELECT user_id INTO target_user FROM videos WHERE id = NEW.video_id;
  IF target_user IS NOT NULL AND target_user <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id)
    VALUES (target_user, NEW.user_id, 'bookmark', NEW.video_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bookmark_notify ON bookmarks;
CREATE TRIGGER trg_bookmark_notify AFTER INSERT ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION bookmark_notify();

-- ── Realtime publication ─────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON notifications TO authenticated;
GRANT SELECT ON messages TO authenticated;
GRANT SELECT ON reports TO authenticated;
