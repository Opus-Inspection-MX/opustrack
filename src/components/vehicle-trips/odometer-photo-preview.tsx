import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { getFileUrl } from "@/lib/storage/file-storage";

interface OdometerPhotoPreviewProps {
  photoUrl: string;
  provider: "vercel-blob" | "filesystem";
  label: string;
  odometer: number;
}

export function OdometerPhotoPreview({
  photoUrl,
  provider,
  label,
  odometer,
}: OdometerPhotoPreviewProps) {
  const displayUrl = getFileUrl(photoUrl, provider);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {label}
          </div>
          <div className="text-xl sm:text-2xl font-bold">{odometer} km</div>
        </div>
        <div className="relative aspect-video w-full max-h-[300px] sm:max-h-none overflow-hidden rounded-lg border">
          <Image
            src={displayUrl}
            alt={`${label} odometer reading`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      </CardContent>
    </Card>
  );
}
