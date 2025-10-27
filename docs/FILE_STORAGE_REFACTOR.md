# File Storage Refactor - Vercel Blob Integration

## Overview

The file storage system has been refactored to support both **Vercel Blob** (cloud storage) and **filesystem** (local storage) backends. This provides flexibility for different deployment environments while maintaining backward compatibility.

## Changes Made

### 1. New Storage Abstraction Layer
**File**: `src/lib/storage/file-storage.ts`

A new abstraction layer that handles file uploads and deletions for both storage providers:
- `uploadFile()` - Upload files using configured provider
- `deleteFile()` - Delete files from configured provider
- `getFileUrl()` - Get display URL for files
- `getStorageProvider()` - Determine active provider from environment

### 2. Database Schema Update
**File**: `prisma/schema.prisma`

Added `provider` field to `WorkOrderAttachment` model:
```prisma
model WorkOrderAttachment {
  // ...existing fields
  provider    String    @default("vercel-blob") // "vercel-blob" or "filesystem"
  // ...
}
```

**Migration**: `prisma/migrations/20251027022447_add_provider_to_work_order_attachment/`

### 3. Updated Server Actions
**File**: `src/lib/actions/work-orders.ts`

Refactored `uploadWorkOrderAttachment()` and `deleteWorkOrderAttachment()` to use the new storage abstraction:
- Old filesystem code is preserved in the abstraction layer
- Actions now work with both providers transparently
- Provider type is stored with each attachment

### 4. Environment Configuration
**Files**: `.env.example`, `CLAUDE.md`

Added new environment variables:
```bash
FILE_STORAGE_PROVIDER="vercel-blob"  # or "filesystem"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx"  # Required for Vercel Blob
```

### 5. Documentation
- Updated `CLAUDE.md` with file storage section
- Created `.env.example` with all required variables
- Added `src/lib/storage/README.md` with detailed usage guide

## Feature Flag

The system uses an environment-based feature flag to switch between providers:

```bash
# Use Vercel Blob (default)
FILE_STORAGE_PROVIDER="vercel-blob"

# Use filesystem
FILE_STORAGE_PROVIDER="filesystem"
```

**Default**: Vercel Blob (`vercel-blob`)

## Configuration for Vercel Deployment

### Step 1: Get Vercel Blob Token
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Storage → Blob
3. Create a new Blob store (if needed)
4. Copy the `BLOB_READ_WRITE_TOKEN`

### Step 2: Set Environment Variables
In your Vercel project settings:
```bash
FILE_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx
```

### Step 3: Deploy
Deploy your application. All file uploads will now use Vercel Blob.

## Local Development

For local development, you can use either provider:

### Option 1: Use Filesystem (No setup required)
```bash
# .env
FILE_STORAGE_PROVIDER=filesystem
```

### Option 2: Use Vercel Blob (Requires token)
```bash
# .env
FILE_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx
```

## Migration Path

### Existing Deployments with Filesystem Storage

If you already have files in the filesystem:

1. **No action required** - Old files will continue to work
2. Each attachment stores its provider type in the database
3. Old files (filesystem) and new files (Vercel Blob) can coexist
4. Files are deleted using the provider they were uploaded with

### Moving to 100% Vercel Blob

If you want to migrate all files to Vercel Blob:

1. Write a migration script that:
   - Reads all attachments from database
   - For each filesystem attachment:
     - Read file from `public/uploads/`
     - Upload to Vercel Blob
     - Update database with new URL and provider
2. Run migration script
3. Delete old files from `public/uploads/`

## Benefits

### Vercel Blob
- ✅ Cloud-based, scalable storage
- ✅ Automatic CDN distribution
- ✅ No server disk space needed
- ✅ Works with serverless deployments
- ✅ Recommended for production

### Filesystem
- ✅ No external dependencies
- ✅ Free for development
- ✅ Easy to inspect files locally
- ✅ Useful for testing

## Testing

### Test Upload
```typescript
import { uploadFile } from "@/lib/storage/file-storage";

const result = await uploadFile(
  "test.jpg",
  base64Data,
  "image/jpeg",
  { subfolder: "work-orders" }
);

console.log("Uploaded to:", result.url);
console.log("Provider:", result.provider);
```

### Test Delete
```typescript
import { deleteFile } from "@/lib/storage/file-storage";

await deleteFile(url, provider);
```

## Troubleshooting

### Error: "BLOB_READ_WRITE_TOKEN is required"
- Make sure `BLOB_READ_WRITE_TOKEN` is set in your `.env` file
- Or switch to filesystem provider: `FILE_STORAGE_PROVIDER=filesystem`

### Files not appearing after upload
- Check console for upload errors
- Verify `BLOB_READ_WRITE_TOKEN` is valid
- Try switching to filesystem to isolate the issue

### Old files not loading
- Ensure filesystem files are still in `public/uploads/`
- Check that database has correct `provider` value for old files
- Run migration to update existing records if needed

## Package Dependencies

New dependency added:
```json
{
  "@vercel/blob": "latest"
}
```

Installed via:
```bash
npm install @vercel/blob
```

## Backward Compatibility

✅ **Fully backward compatible**
- Existing filesystem uploads continue to work
- No breaking changes to existing code
- Database migration adds field with default value
- Old deployments work without changes

## Summary

This refactor provides a flexible, production-ready file storage solution that:
- Defaults to Vercel Blob for production deployments
- Supports filesystem for local development
- Maintains backward compatibility
- Stores provider type for reliable file deletion
- Provides clear documentation and examples
