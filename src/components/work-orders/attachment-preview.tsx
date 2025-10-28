"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Download, ZoomIn } from "lucide-react";
import { formatFileSize, getFileIcon } from "@/lib/upload";
import { getFileUrl } from "@/lib/storage/file-utils";
import Image from "next/image";

interface AttachmentPreviewProps {
  attachment: {
    id: string;
    filename: string;
    filepath: string;
    mimetype: string;
    size: number;
    uploadedAt: Date;
    description?: string | null;
    provider?: string | null;
  };
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

export function AttachmentPreview({ attachment, onDelete, readOnly }: AttachmentPreviewProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const isImage = attachment.mimetype.startsWith("image/");
  const fileUrl = getFileUrl(attachment.filepath, attachment.provider as "vercel-blob" | "filesystem");

  const handleDelete = () => {
    if (onDelete && confirm("Are you sure you want to delete this file?")) {
      onDelete(attachment.id);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 hover:bg-muted/50 rounded-lg p-3 transition-colors">
        {/* Thumbnail or Icon */}
        <div className="flex-shrink-0">
          {isImage ? (
            <button
              onClick={() => setShowLightbox(true)}
              className="relative group cursor-pointer"
            >
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors">
                <Image
                  src={fileUrl}
                  alt={attachment.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 96px"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-4xl">
              {getFileIcon(attachment.mimetype)}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline truncate block"
          >
            {attachment.filename}
          </a>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)} •{" "}
            {new Date(attachment.uploadedAt).toLocaleDateString()}
          </p>
          {attachment.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {attachment.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isImage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLightbox(true)}
              title="Ver tamaño completo"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            asChild
            title="Descargar"
          >
            <a href={fileUrl} download={attachment.filename}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          {!readOnly && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Lightbox Dialog */}
      {isImage && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-0">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="text-base">{attachment.filename}</DialogTitle>
              {attachment.description && (
                <p className="text-sm text-muted-foreground">{attachment.description}</p>
              )}
            </DialogHeader>
            <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center p-4 pt-0">
              <div className="relative max-w-full max-h-full">
                <Image
                  src={fileUrl}
                  alt={attachment.filename}
                  width={1200}
                  height={1200}
                  className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded"
                  priority
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 pt-0 border-t">
              <p className="text-sm text-muted-foreground">
                {formatFileSize(attachment.size)} • {new Date(attachment.uploadedAt).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={fileUrl} download={attachment.filename}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowLightbox(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
