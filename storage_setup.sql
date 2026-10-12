-- Minimal, safe Supabase Storage setup for Personal Agent Chat Images
-- Run this in your Supabase Project -> SQL Editor

-- 1. Create the storage bucket for chat images if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-images',
    'chat-images',
    false, -- Private bucket with authenticated signed URLs
    10485760, -- 10MB maximum file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Enable RLS on storage.objects (normally enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Authenticated users can upload to their own user-scoped directory
-- Storage folder structure: <user_id>/<conversation_id>/<filename>
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload own chat images'
    ) THEN
        CREATE POLICY "Authenticated users can upload own chat images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'chat-images' 
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- 4. Policy: Authenticated users can view/download their own chat images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can view own chat images'
    ) THEN
        CREATE POLICY "Authenticated users can view own chat images"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (
            bucket_id = 'chat-images' 
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;

-- 5. Policy: Authenticated users can update/delete their own chat images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete own chat images'
    ) THEN
        CREATE POLICY "Authenticated users can delete own chat images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'chat-images' 
            AND (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END $$;
