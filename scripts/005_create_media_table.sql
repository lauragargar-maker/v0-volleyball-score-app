-- Create match_media table to store references to photos and videos
CREATE TABLE IF NOT EXISTS match_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by match
CREATE INDEX IF NOT EXISTS idx_match_media_match_id ON match_media(match_id);

-- Enable RLS
ALTER TABLE match_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media
CREATE POLICY "Anyone can view match media" ON match_media
  FOR SELECT USING (true);

-- Only authenticated users can insert media
CREATE POLICY "Authenticated users can insert match media" ON match_media
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only the uploader can delete media
CREATE POLICY "Uploaders can delete their media" ON match_media
  FOR DELETE USING (auth.uid() = uploaded_by);
