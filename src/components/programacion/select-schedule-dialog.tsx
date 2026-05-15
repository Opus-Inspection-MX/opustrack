"use client";

import { Calendar, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Schedule {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  endDate: string | null;
  vics: Array<{
    vicId: string;
    active: boolean;
    vic: { id: string; name: string; code: string };
  }>;
  _count?: {
    incidents: number;
  };
}

interface SelectScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSchedule?: (schedule: Schedule) => void;
}

export function SelectScheduleDialog({
  open,
  onOpenChange,
  onSelectSchedule,
}: SelectScheduleDialogProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null,
  );

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/schedules");
      if (!response.ok) {
        throw new Error("Error al obtener programaciones");
      }
      const result = await response.json();
      setSchedules(result.data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSchedules();
    }
  }, [open, fetchSchedules]);

  const filteredSchedules = schedules.filter((schedule) => {
    const q = searchQuery.toLowerCase();
    if (schedule.title.toLowerCase().includes(q)) return true;
    if (schedule.description?.toLowerCase().includes(q)) return true;
    return schedule.vics.some(
      (sv) =>
        sv.vic.name.toLowerCase().includes(q) ||
        sv.vic.code.toLowerCase().includes(q),
    );
  });

  const handleSelect = () => {
    if (selectedSchedule && onSelectSchedule) {
      onSelectSchedule(selectedSchedule);
      onOpenChange(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Seleccionar Programación"
      description="Selecciona una programación existente para ver o asociar incidentes"
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar programación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Schedules Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando programaciones...
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron programaciones
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>VICs</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Incidentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => (
                  <TableRow
                    key={schedule.id}
                    className={`cursor-pointer ${
                      selectedSchedule?.id === schedule.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedSchedule(schedule)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {selectedSchedule?.id === schedule.id && (
                          <div className="h-4 w-4 rounded-full bg-primary" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{schedule.title}</div>
                        {schedule.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {schedule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {schedule.vics
                          .filter((sv) => sv.active)
                          .map((sv) => (
                            <Badge key={sv.vicId} variant="outline">
                              {sv.vic.code}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              Inicio:
                            </div>
                            <div className="text-sm">
                              {new Date(schedule.scheduledAt).toLocaleString(
                                "es-MX",
                                {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                },
                              )}
                            </div>
                          </div>
                        </div>
                        {schedule.endDate && (
                          <div className="flex items-center gap-2 pl-6">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Fin:
                              </div>
                              <div className="text-sm">
                                {new Date(schedule.endDate).toLocaleString(
                                  "es-MX",
                                  {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {schedule._count?.incidents || 0} incidente(s)
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleSelect} disabled={!selectedSchedule}>
            Seleccionar
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
