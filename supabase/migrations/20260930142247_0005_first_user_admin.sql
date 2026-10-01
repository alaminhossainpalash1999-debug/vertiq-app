/*
# Auto-admin for first user

1. Trigger
   - After a profile is inserted, if no other profiles exist, set role='admin'.
   - This ensures the first person to sign up gets admin access to the dashboard.
*/

CREATE OR REPLACE FUNCTION set_first_user_admin()
RETURNS TRIGGER AS $$
DECLARE
  profile_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  IF profile_count = 0 THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_first_user_admin ON profiles;
CREATE TRIGGER trg_first_user_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_first_user_admin();
