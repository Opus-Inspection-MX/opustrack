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
 * Useful for files where browsers report incorrect MIME types
 * Supports common formats from iOS (HEIC/HEIF) and Android (various formats)
 */
export function normalizeMimeType(file: File): string {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  // Map of extensions to MIME types - includes common Android and iOS formats
  const extensionToMime: Record<string, string> = {
    // iOS formats
    heic: "image/heic",
    heif: "image/heif",

    // Common image formats (all phones)
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    svg: "image/svg+xml",

    // Android/Samsung specific formats
    jpe: "image/jpeg",
    jfif: "image/jpeg",

    // Video formats
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    "3gp": "video/3gpp",
    mkv: "video/x-matroska",

    // Documents
    pdf: "application/pdf",
  };

  // If file.type is empty or generic, use extension-based MIME type
  if (!file.type || file.type === "application/octet-stream") {
    return extensionToMime[fileExtension || ""] || "application/octet-stream";
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
export function validateFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  },
): { valid: boolean; error?: string } {
  const maxSizeMB = options?.maxSizeMB || 10;
  const allowedTypes = options?.allowedTypes || [
    // Image formats
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
    "image/heic",
    "image/heif",

    // Video formats
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/3gpp",
    "video/x-matroska",

    // Documents
    "application/pdf",
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
  // Some browsers may not report correct MIME types, so we also check file extension
  const fileExtension = file.name.split(".").pop()?.toLowerCase();
  const commonImageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "tiff",
    "tif",
    "heic",
    "heif",
    "jpe",
    "jfif",
    "svg",
  ];
  const commonVideoExtensions = ["mp4", "mov", "webm", "avi", "3gp", "mkv"];
  const commonDocExtensions = ["pdf"];

  const allCommonExtensions = [
    ...commonImageExtensions,
    ...commonVideoExtensions,
    ...commonDocExtensions,
  ];

  const isValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allCommonExtensions.includes(fileExtension || "");

  // Accept if either MIME type is valid OR file extension is valid
  if (!isValidType && !hasValidExtension) {
    return {
      valid: false,
      error: `File type ${file.type || fileExtension || "unknown"} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Get file icon based on mimetype
 */
export function getFileIcon(mimetype: string): string {
  if (mimetype.startsWith("image/")) return "🖼️";
  if (mimetype.startsWith("video/")) return "🎥";
  if (mimetype === "application/pdf") return "📄";
  return "📎";
}
