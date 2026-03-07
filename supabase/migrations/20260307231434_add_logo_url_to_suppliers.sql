-- Add logo_url field for Cloudinary media to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo_url TEXT;
