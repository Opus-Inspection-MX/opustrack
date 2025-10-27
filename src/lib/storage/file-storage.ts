/**
 * File storage abstraction layer
 * Supports both Vercel Blob and local filesystem storage
 *
 * Environment variables:
 * - FILE_STORAGE_PROVIDER: "vercel-blob" | "filesystem" (default: "vercel-blob")
 * - BLOB_READ_WRITE_TOKEN: Required for Vercel Blob
 */

import { put, del, list } from '@vercel/blob';

export type FileUploadResult = {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
  provider: 'vercel-blob' | 'filesystem';
};

export type FileStorageConfig = {
  provider: 'vercel-blob' | 'filesystem';
};

/**
 * Get storage provider from environment
 */
export function getStorageProvider(): 'vercel-blob' | 'filesystem' {
  const provider = process.env.FILE_STORAGE_PROVIDER || 'vercel-blob';

  if (provider !== 'vercel-blob' && provider !== 'filesystem') {
    console.warn(`Invalid FILE_STORAGE_PROVIDER: ${provider}. Using vercel-blob.`);
    return 'vercel-blob';
  }

  return provider;
}

/**
 * Upload file using Vercel Blob
 */
async function uploadToVercelBlob(
  filename: string,
  buffer: Buffer,
  mimetype: string
): Promise<FileUploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage');
  }

  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: true,
    });

    return {
      url: blob.url,
      filename: filename,
      size: buffer.length,
      mimetype: mimetype,
      provider: 'vercel-blob',
    };
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    throw new Error('Failed to upload file to Vercel Blob');
  }
}

/**
 * Upload file to local filesystem
 */
async function uploadToFilesystem(
  filename: string,
  buffer: Buffer,
  mimetype: string,
  subfolder: string = 'work-orders'
): Promise<FileUploadResult> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', subfolder);
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`;
    const filepath = path.join(uploadsDir, uniqueFilename);

    // Write file
    await fs.writeFile(filepath, buffer);

    return {
      url: `/uploads/${subfolder}/${uniqueFilename}`,
      filename: sanitizedFilename,
      size: buffer.length,
      mimetype: mimetype,
      provider: 'filesystem',
    };
  } catch (error) {
    console.error('Error uploading to filesystem:', error);
    throw new Error('Failed to upload file to filesystem');
  }
}

/**
 * Upload file using configured storage provider
 */
export async function uploadFile(
  filename: string,
  base64Data: string,
  mimetype: string,
  options?: {
    subfolder?: string;
    provider?: 'vercel-blob' | 'filesystem';
  }
): Promise<FileUploadResult> {
  // Remove base64 prefix and convert to buffer
  const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  // Determine provider
  const provider = options?.provider || getStorageProvider();

  // Upload based on provider
  if (provider === 'vercel-blob') {
    return uploadToVercelBlob(filename, buffer, mimetype);
  } else {
    return uploadToFilesystem(filename, buffer, mimetype, options?.subfolder);
  }
}

/**
 * Delete file from Vercel Blob
 */
async function deleteFromVercelBlob(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage');
  }

  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting from Vercel Blob:', error);
    throw new Error('Failed to delete file from Vercel Blob');
  }
}

/**
 * Delete file from filesystem
 */
async function deleteFromFilesystem(filepath: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const fullPath = path.join(process.cwd(), 'public', filepath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Error deleting from filesystem:', error);
    // Don't throw - file might already be deleted
  }
}

/**
 * Delete file using configured storage provider
 */
export async function deleteFile(
  url: string,
  provider: 'vercel-blob' | 'filesystem'
): Promise<void> {
  if (provider === 'vercel-blob') {
    await deleteFromVercelBlob(url);
  } else {
    await deleteFromFilesystem(url);
  }
}

/**
 * Get file URL for display
 * For Vercel Blob, returns the full URL
 * For filesystem, returns the relative path
 */
export function getFileUrl(
  storedUrl: string,
  provider: 'vercel-blob' | 'filesystem'
): string {
  if (provider === 'vercel-blob') {
    return storedUrl;
  } else {
    // For filesystem, the URL is already a relative path like /uploads/...
    return storedUrl;
  }
}

/**
 * Validate Vercel Blob configuration
 */
export function validateVercelBlobConfig(): {
  configured: boolean;
  error?: string;
} {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      configured: false,
      error: 'BLOB_READ_WRITE_TOKEN is not configured',
    };
  }

  return { configured: true };
}
