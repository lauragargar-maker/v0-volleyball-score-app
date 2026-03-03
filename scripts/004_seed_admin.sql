-- Insert a default admin (replace with actual admin email)
-- You can add more admins by inserting into this table
INSERT INTO admins (email) VALUES ('admin@example.com')
ON CONFLICT (email) DO NOTHING;
