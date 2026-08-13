"use client";

import { useEffect, useState, useTransition } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { VacationBalancePanel } from "@/components/vacations/vacation-balance-panel";
import {
  type CalendarVacation,
  VacationYearCalendar,
} from "@/components/vacations/vacation-year-calendar";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import type { VacationPeriodSummary } from "@/lib/actions/vacations";
import {
  createVacation,
  getVacationBalanceData,
} from "@/lib/actions/vacations";

interface FsrOption {
  id: string;
  name: string;
  email: string;
}

interface VacationPlannerProps {
  initialData: {
    user: { id: string; name: string };
    hasHireDate: boolean;
    periods: VacationPeriodSummary[];
    vacations: CalendarVacation[];
    holidayDates: string[];
    year: number;
  };
  /** Admin-only: lets the panel switch between users. */
  fsrs?: FsrOption[];
  canManage?: boolean;
}

/**
 * The two-panel vacation view: balances on the left, the year on the right.
 *
 * Shared by the admin and FSR routes — the admin gets a user picker and the
 * day-allotment editor, the FSR sees only their own data. Same component either
 * way, mirroring how VacationForm is shared via a flag.
 */
export function VacationPlanner({
  initialData,
  fsrs,
  canManage = false,
}: VacationPlannerProps) {
  const [data, setData] = useState(initialData);
  const [targetUserId, setTargetUserId] = useState(initialData.user.id);
  const [year, setYear] = useState(initialData.year);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Default to the newest period that can still be requested against, since
  // that is what someone planning time off almost always wants.
  useEffect(() => {
    if (selectedPeriodId) return;
    const usable = [...data.periods]
      .reverse()
      .find((period) => !period.isExpired && period.remainingDays > 0);
    if (usable) setSelectedPeriodId(usable.id);
  }, [data.periods, selectedPeriodId]);

  const refresh = async (nextUserId = targetUserId, nextYear = year) => {
    setLoading(true);
    try {
      const result = await getVacationBalanceData(nextUserId, nextYear);
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      setData({
        user: result.user,
        hasHireDate: result.hasHireDate,
        periods: result.periods,
        vacations: result.vacations as CalendarVacation[],
        holidayDates: result.holidayDates,
        year: result.year,
      });
      // The chosen period may not exist for the new user.
      if (nextUserId !== targetUserId) setSelectedPeriodId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setTargetUserId(userId);
    startTransition(() => {
      void refresh(userId, year);
    });
  };

  const handleYearChange = (nextYear: number) => {
    setYear(nextYear);
    startTransition(() => {
      void refresh(targetUserId, nextYear);
    });
  };

  const selectedPeriod =
    data.periods.find((period) => period.id === selectedPeriodId) ?? null;

  const handleRequestRange = async (startDate: string, endDate: string) => {
    const result = await createVacation({
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      // Only send a userId when acting on someone else's behalf.
      userId: targetUserId !== initialData.user.id ? targetUserId : undefined,
      // Charge the period the user picked, so the panel and the result agree.
      periodId: selectedPeriodId ?? undefined,
    });

    if (isFailure(result)) {
      toast.error(result.error);
      return;
    }

    toast.success("Solicitud de vacaciones enviada a autorización");
    await refresh();
  };

  return (
    <div className="space-y-4">
      {fsrs && fsrs.length > 0 && (
        <div className="max-w-md">
          <SearchableSelect
            options={fsrs.map((fsr) => ({
              value: fsr.id,
              label: fsr.name,
            }))}
            value={targetUserId}
            onValueChange={handleUserChange}
            placeholder="Seleccionar usuario"
            searchPlaceholder="Buscar por nombre..."
            emptyMessage="No se encontraron usuarios."
          />
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-6 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}
      >
        <div className="lg:col-span-1">
          <VacationBalancePanel
            periods={data.periods}
            selectedPeriodId={selectedPeriodId}
            onSelectPeriod={setSelectedPeriodId}
            canManage={canManage}
            hasHireDate={data.hasHireDate}
            onChanged={() => void refresh()}
          />
        </div>

        <div className="lg:col-span-2">
          <VacationYearCalendar
            year={data.year}
            vacations={data.vacations}
            holidayDates={data.holidayDates}
            selectedPeriod={selectedPeriod}
            onRequestRange={handleRequestRange}
            onYearChange={handleYearChange}
            readOnly={!data.hasHireDate}
          />
        </div>
      </div>
    </div>
  );
}
