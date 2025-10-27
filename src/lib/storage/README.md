# File Storage Module

This module provides an abstraction layer for file storage, supporting both Vercel Blob (cloud) and local filesystem storage.

## Configuration

Set the storage provider in your `.env` file:

```bash
# Use Vercel Blob (default, recommended for production)
FILE_STORAGE_PROVIDER="vercel-blob"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxx"

# OR use filesystem (useful for local development)
FILE_STORAGE_PROVIDER="filesystem"
```

## Usage

### Uploading Files

```typescript
import { uploadFile } from "@/lib/storage/file-storage";

const result = await uploadFile(
  "photo.jpg",           // filename
  base64Data,            // base64 encoded file data
  "image/jpeg",          // mimetype
  { subfolder: "work-orders" }  // optional: only used for filesystem storage
);

console.log(result);
// {
//   url: "https://..." or "/uploads/work-orders/...",
//   filename: "photo.jpg",
//   size: 12345,
//   mimetype: "image/jpeg",
//   provider: "vercel-blob" or "filesystem"
// }
```

### Deleting Files

```typescript
import { deleteFile } from "@/lib/storage/file-storage";

await deleteFile(
  "https://...",         // URL from database
  "vercel-blob"          // provider from database
);
```

### Getting File URLs

```typescript
import { getFileUrl } from "@/lib/storage/file-storage";

const displayUrl = getFileUrl(
  storedUrl,             // URL from database
  provider               // provider from database
);
```

## How It Works

### Vercel Blob Storage

- Files are uploaded to Vercel's cloud storage
- Each file gets a unique URL like `https://xxxxxx.public.blob.vercel-storage.com/...`
- Files are automatically distributed via CDN
- Requires `BLOB_READ_WRITE_TOKEN` environment variable
- Recommended for production deployments

### Filesystem Storage

- Files are stored in `public/uploads/{subfolder}/` directory
- Each file gets a timestamped unique filename
- Files are served directly from the Next.js public directory
- No additional configuration required
- Useful for local development and testing

## Database Integration

The `WorkOrderAttachment` model stores the provider type:

```prisma
model WorkOrderAttachment {
  id          String   @id @default(cuid())
  workOrderId String
  filename    String
  filepath    String   // Full URL for vercel-blob, relative path for filesystem
  mimetype    String
  size        Int
  provider    String   @default("vercel-blob") // "vercel-blob" or "filesystem"
  // ...
}
```

This ensures that files can be correctly deleted even if you change providers later.

## Migration from Filesystem to Vercel Blob

If you have existing files in the filesystem and want to migrate to Vercel Blob:

1. Keep `FILE_STORAGE_PROVIDER="filesystem"` until migration is complete
2. All new uploads will use Vercel Blob
3. Old files will still be accessible via filesystem
4. (Optional) Write a migration script to upload existing files to Vercel Blob

## Error Handling

The module handles errors gracefully:
- Upload failures throw descriptive errors
- Delete failures are logged but don't throw (files might already be deleted)
- Missing environment variables are caught early with helpful error messages

## Validation

Before uploading, validate files using the existing upload utilities:

```typescript
import { validateFile } from "@/lib/upload";

const validation = validateFile(file, {
  maxSizeMB: 10,
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
});

if (!validation.valid) {
  console.error(validation.error);
}
```
