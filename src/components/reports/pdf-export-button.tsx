"use client";

import { Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PDFExportButtonProps {
  reportTitle: string;
  reportId: string;
  disabled?: boolean;
}

export function PDFExportButton({
  reportTitle: _reportTitle,
  reportId: _reportId,
  disabled,
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // For now, trigger print which allows saving as PDF
      // A more sophisticated approach would generate a proper PDF server-side
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  if (disabled) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Download className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          Guardar como PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
