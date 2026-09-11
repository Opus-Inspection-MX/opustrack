import { Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { Card, CardContent } from "@/components/ui/card";

export interface DetailAttachment {
  id: string;
}

interface AttachmentsSectionProps<T extends DetailAttachment> {
  attachments: T[];
  renderPreview: (attachment: T) => ReactNode;
}

/** Evidence files of one assignment. */
export function AttachmentsSection<T extends DetailAttachment>({
  attachments,
  renderPreview,
}: AttachmentsSectionProps<T>) {
  return (
    <SectionCard
      title={`Archivos Adjuntos (${attachments.length})`}
      description="Fotos, videos y documentos adjuntos a esta orden"
    >
      {attachments.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="Sin archivos adjuntos"
          description="Sin archivos adjuntos. Los archivos se suben al agregar actividades."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {attachments.map((attachment) => (
            <Card key={attachment.id}>
              <CardContent className="p-0">
                {renderPreview(attachment)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
