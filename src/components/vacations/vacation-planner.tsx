"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
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
import { isVacationPeriodUsable } from "@/lib/utils/vacation-cycle-window";

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
  /** Admin-only: lets the panel capture a missing hire date in place. */
  canCaptureHireDate?: boolean;
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
  canCaptureHireDate = false,
}: VacationPlannerProps) {
  const [data, setData] = useState(initialData);
  const [targetUserId, setTargetUserId] = useState(initialData.user.id);
  const [year, setYear] = useState(initialData.year);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const refreshSequence = useRef(0);

  // Explicit selection defaults to the grant closest to expiry.
  useEffect(() => {
    if (loading || data.user.id !== targetUserId) return;
    if (
      data.periods.some(
        (period) =>
          period.id === selectedPeriodId && isVacationPeriodUsable(period),
      )
    )
      return;
    const usable = [...data.periods]
      .sort(
        (a, b) =>
          new Date(a.graceEnd).getTime() - new Date(b.graceEnd).getTime(),
      )
      .find((period) => isVacationPeriodUsable(period));
    setSelectedPeriodId(usable?.id ?? null);
  }, [data.periods, data.user.id, targetUserId, loading, selectedPeriodId]);

  const refresh = async (nextUserId = targetUserId, nextYear = year) => {
    setLoading(true);
    const sequence = ++refreshSequence.current;
    try {
      const result = await getVacationBalanceData(nextUserId, nextYear);
      if (sequence !== refreshSequence.current) return;
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
    } catch (error) {
      if (sequence === refreshSequence.current)
        toast.error((error as Error).message);
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedPeriodId(null);
    setReason("");
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
    if (
      loading ||
      data.user.id !== targetUserId ||
      data.year !== year ||
      !selectedPeriod ||
      !isVacationPeriodUsable(selectedPeriod)
    )
      return false;
    const result = await createVacation({
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      userId: targetUserId,
      reason: reason.trim() || null,
      // Charge the period the user picked, so the panel and the result agree.
      periodId: selectedPeriodId ?? undefined,
    });

    if (isFailure(result)) {
      toast.error(result.error);
      return false;
    }

    toast.success("Solicitud de vacaciones enviada a autorización");
    await refresh();
    return true;
  };

  return (
    <div className="space-y-4">
      {fsrs && fsrs.length > 0 && (
        <div className="w-full sm:max-w-md">
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
            userId={data.user.id}
            canCaptureHireDate={canCaptureHireDate}
          />
        </div>

        <div className="lg:col-span-2">
          {canManage && (
            <div className="mb-4 space-y-2">
              <Label htmlFor="planner-reason">
                Motivo (obligatorio para fechas retroactivas)
              </Label>
              <Textarea
                id="planner-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
              />
            </div>
          )}
          <VacationYearCalendar
            year={data.year}
            vacations={data.vacations}
            holidayDates={data.holidayDates}
            selectedPeriod={selectedPeriod}
            onRequestRange={handleRequestRange}
            onYearChange={handleYearChange}
            readOnly={
              !data.hasHireDate ||
              loading ||
              data.user.id !== targetUserId ||
              data.year !== year
            }
            allowRetroactive={canManage}
          />
        </div>
      </div>
    </div>
  );
}
