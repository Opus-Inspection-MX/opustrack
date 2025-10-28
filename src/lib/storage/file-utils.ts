/**
 * Client-safe file storage utilities
 * These functions can be used in both client and server components
 */

/**
 * Get file URL for display
 * For Vercel Blob, returns the full URL
 * For filesystem, returns the relative path
 */
export function getFileUrl(
  storedUrl: string,
  provider?: 'vercel-blob' | 'filesystem' | string | null
): string {
  if (!provider || provider === 'vercel-blob') {
    return storedUrl;
  } else {
    // For filesystem, the URL is already a relative path like /uploads/...
    return storedUrl;
  }
}
