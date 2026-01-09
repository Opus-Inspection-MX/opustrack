import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LineForm } from "@/components/lines/line-form";
import { Button } from "@/components/ui/button";

export default function NewLinePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/lines">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Línea</h1>
          <p className="text-muted-foreground">
            Crea una nueva línea de inspección
          </p>
        </div>
      </div>

      <LineForm mode="create" />
    </div>
  );
}
