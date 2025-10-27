/**
 * File upload utility for handling file uploads
 * Supports both file input and camera capture on mobile devices
 */

export type UploadedFile = {
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
};

/**
 * Normalize MIME type based on file extension
 * Useful for files where browsers report incorrect MIME types (e.g., HEIC on iOS)
 */
export function normalizeMimeType(file: File): string {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  // Map of extensions to MIME types
  const extensionToMime: Record<string, string> = {
    'heic': 'image/heic',
    'heif': 'image/heif',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
  };

  // If file.type is empty or generic, use extension-based MIME type
  if (!file.type || file.type === 'application/octet-stream') {
    return extensionToMime[fileExtension || ''] || file.type;
  }

  // Otherwise return the file's reported MIME type
  return file.type;
}

/**
 * Convert File to Base64 for server action upload
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, options?: {
  maxSizeMB?: number;
  allowedTypes?: string[];
}): { valid: boolean; error?: string } {
  const maxSizeMB = options?.maxSizeMB || 10;
  const allowedTypes = options?.allowedTypes || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
  ];

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  // Some browsers (especially on iOS) may not report correct MIME types for HEIC
  // So we also check file extension as a fallback
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const heicExtensions = ['heic', 'heif'];

  const isValidType = allowedTypes.includes(file.type);
  const isHeicFile = heicExtensions.includes(fileExtension || '');

  if (!isValidType && !isHeicFile) {
    return {
      valid: false,
      error: `File type ${file.type || 'unknown'} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on mimetype
 */
export function getFileIcon(mimetype: string): string {
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype.startsWith('video/')) return '🎥';
  if (mimetype === 'application/pdf') return '📄';
  return '📎';
}
