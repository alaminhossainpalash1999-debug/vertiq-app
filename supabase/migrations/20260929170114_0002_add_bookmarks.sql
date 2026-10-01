/*
# Add bookmarks table for Save/Bookmark feature

1. New Tables
   - bookmarks (user_id uuid, video_id uuid, composite PK, cascading deletes)
     Stores which videos a user has saved/bookmarked.

2. Security
   - Enable RLS on bookmarks.
   - Read all (authenticated) so bookmark counts could be shown.
   - Insert/delete own only — users can only bookmark/unbookmark for themselves.

3. Index
   - idx_bookmarks_user_id for fast "my bookmarks" queries.
*/

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_select_all" ON bookmarks;
CREATE POLICY "bookmarks_select_all"
  ON bookmarks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;
CREATE POLICY "bookmarks_delete_own"
  ON bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id);
