-- Create storage bucket for match media
-- Note: This needs to be run in Supabase dashboard SQL editor or via Supabase CLI
-- as storage bucket creation requires special permissions

INSERT INTO storage.buckets (id, name, public)
VALUES ('match-media', 'match-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to match-media bucket
CREATE POLICY "Public can view match media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'match-media');

-- Allow authenticated users to upload to match-media bucket
CREATE POLICY "Authenticated users can upload match media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'match-media' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own match media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'match-media' 
  AND auth.uid() = owner
);
