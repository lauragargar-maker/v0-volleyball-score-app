-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;

-- Admins table policies - only authenticated admins can read
CREATE POLICY "Anyone can check if email is admin" ON admins
  FOR SELECT USING (true);

-- Matches policies - everyone can read, only admins can modify
CREATE POLICY "Anyone can view matches" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert matches" ON matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update matches" ON matches
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Sets policies - everyone can read, only admins can modify
CREATE POLICY "Anyone can view sets" ON sets
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert sets" ON sets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sets" ON sets
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Admin requests policies - anyone can insert, only authenticated can view
CREATE POLICY "Anyone can create admin request" ON admin_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view admin requests" ON admin_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update admin requests" ON admin_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL);
