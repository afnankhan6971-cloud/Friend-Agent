import { SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'chat-images';

export interface StorageUploadResult {
  success: boolean;
  filePath?: string;
  url?: string;
  error?: string;
}

/**
 * Upload an image buffer or base64 data to Supabase Storage in a user-scoped folder.
 * Folder convention: <userId>/<conversationId>/<filename>
 */
export async function uploadImageToStorage(
  userDb: SupabaseClient,
  userId: string,
  conversationId: string,
  fileNamePrefix: 'upload' | 'generated' | 'edited',
  data: Buffer | string, // Buffer or base64 string
  mimeType: string = 'image/png'
): Promise<StorageUploadResult> {
  try {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const filePath = `${userId}/${conversationId}/${fileNamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

    const { data: uploadData, error: uploadError } = await userDb.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.warn(`[Storage] Upload to bucket '${STORAGE_BUCKET}' failed:`, uploadError.message);
      return {
        success: false,
        error: uploadError.message
      };
    }

    // Attempt to create a signed URL (valid for 7 days)
    const { data: signedData, error: signError } = await userDb.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    let url = signedData?.signedUrl;
    if (!url || signError) {
      // Fallback to public URL in case bucket is public
      const { data: publicData } = userDb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      url = publicData?.publicUrl;
    }

    return {
      success: true,
      filePath,
      url: url || undefined
    };
  } catch (err: any) {
    console.error('[Storage] Error during image upload:', err);
    return {
      success: false,
      error: err.message || 'Unknown storage upload error'
    };
  }
}

/**
 * Resolve accessible signed URL for a stored file path.
 */
export async function getImageUrl(
  userDb: SupabaseClient,
  filePath: string
): Promise<string | null> {
  try {
    const { data, error } = await userDb.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (error || !data?.signedUrl) {
      const { data: publicData } = userDb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
      return publicData?.publicUrl || null;
    }

    return data.signedUrl;
  } catch (e) {
    console.error('[Storage] Error creating signed URL for', filePath, e);
    return null;
  }
}
