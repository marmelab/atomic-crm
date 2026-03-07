-- Add Cloudinary media fields to CRM tables

-- Client logo (Cloudinary secure_url)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Contact photo/avatar (Cloudinary secure_url)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Payment proof (screenshot bonifico, ricevuta, etc.)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Expense proof (ricevuta, fattura fotografata, etc.)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS proof_url TEXT;
