"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, FileIcon } from "lucide-react";
import { validateFile, formatFileSize, getFileIcon, normalizeMimeType } from "@/lib/upload";

type FileUploadProps = {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  allowedTypes?: string[];
  accept?: string;
  multiple?: boolean;
  showCamera?: boolean;
  label?: string;
};

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  maxSizeMB = 10,
  allowedTypes,
  accept = "image/*,.heic,.heif,video/*,application/pdf",
  multiple = true,
  showCamera = true,
  label = "Upload Files",
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const newErrors: string[] = [];

    // Convert FileList to array
    Array.from(files).forEach((file) => {
      // Check if we've reached max files
      if (selectedFiles.length + newFiles.length >= maxFiles) {
        newErrors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate file
      const validation = validateFile(file, { maxSizeMB, allowedTypes });
      if (!validation.valid) {
        newErrors.push(`${file.name}: ${validation.error}`);
        return;
      }

      newFiles.push(file);
    });

    if (newFiles.length > 0) {
      const updatedFiles = [...selectedFiles, ...newFiles];
      setSelectedFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setTimeout(() => setErrors([]), 5000);
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const clearAll = () => {
    setSelectedFiles([]);
    onFilesSelected([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{label}</Label>
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Files
          </Button>

          {showCamera && (
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          )}
        </div>

        {/* Hidden file inputs */}
        <Input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFileSelection(e.target.files)}
          className="hidden"
        />

        <Input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelection(e.target.files)}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground mt-2">
          Max {maxFiles} files, {maxSizeMB}MB each. Supported: images, videos, PDFs
        </p>
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((error, index) => (
            <p key={index} className="text-xs text-destructive">
              {error}
            </p>
          ))}
        </div>
      )}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Selected Files ({selectedFiles.length})</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
          </div>

          <div className="border rounded-md divide-y">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
