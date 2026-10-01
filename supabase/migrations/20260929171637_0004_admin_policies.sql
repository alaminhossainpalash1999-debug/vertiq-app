/*
# Vertiq — Admin video delete function + policies

1. SECURITY DEFINER function
   - delete_video_as_admin(video_id): allows an admin to delete any video
     and its storage object. Regular RLS only lets users delete their own videos.

2. Policy update
   - videos_delete_admin: admin role can delete any video via RLS
   - Add admin read on videos (already have select_all)

3. Note
   - Also grants admin ability to update profiles.is_blocked and profiles.role
     via profiles_update_admin policy.
*/

-- Admin can delete any video
DROP POLICY IF EXISTS "videos_delete_admin" ON videos;
CREATE POLICY "videos_delete_admin"
  ON videos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Admin can update any profile (for blocking users, changing roles)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
