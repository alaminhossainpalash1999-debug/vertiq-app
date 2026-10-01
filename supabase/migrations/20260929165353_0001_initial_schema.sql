/*
# Vertiq — Initial Schema

1. Purpose
   Short-video app (TikTok-style). Users sign up, upload vertical videos, swipe through a feed, like, comment, and follow other users.

2. New Tables
   - profiles (id uuid PK → auth.users, username text unique, avatar_url text, created_at timestamptz)
   - videos (id uuid PK, user_id uuid → auth.users, video_url text, caption text, created_at timestamptz)
   - likes (user_id uuid, video_id uuid, composite PK, cascading deletes)
   - comments (id uuid PK, user_id uuid, video_id uuid, text text, created_at timestamptz)
   - follows (follower_id uuid, following_id uuid, composite PK)

3. Storage
   - Public bucket "videos" for video file uploads.

4. Security — RLS enabled on every table
   - profiles: read all (authenticated), insert/update own only
   - videos: read all (authenticated), insert/update/delete own only
   - likes: read all (authenticated), insert/delete own only
   - comments: read all (authenticated), insert own, delete own
   - follows: read all (authenticated), insert/delete own only

5. Notes
   - user_id columns default to auth.uid() so inserts from the client succeed even when user_id is omitted.
   - All foreign keys ON DELETE CASCADE to clean up dependent data.
*/

-- ── profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── videos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_select_all" ON videos;
CREATE POLICY "videos_select_all"
  ON videos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own"
  ON videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_update_own" ON videos;
CREATE POLICY "videos_update_own"
  ON videos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "videos_delete_own" ON videos;
CREATE POLICY "videos_delete_own"
  ON videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── likes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON likes;
CREATE POLICY "likes_select_all"
  ON likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own"
  ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own"
  ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── comments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all" ON comments;
CREATE POLICY "comments_select_all"
  ON comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── follows ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select_all" ON follows;
CREATE POLICY "follows_select_all"
  ON follows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own"
  ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own"
  ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ── indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes (video_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments (video_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows (following_id);

-- ── storage bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies so authenticated users can upload to videos bucket
DROP POLICY IF EXISTS "videos_bucket_read" ON storage.objects;
CREATE POLICY "videos_bucket_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_insert" ON storage.objects;
CREATE POLICY "videos_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_delete" ON storage.objects;
CREATE POLICY "videos_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos');
