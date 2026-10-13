"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAssignmentFsrAvailability } from "@/lib/actions/assignment-availability";
import type {
  FsrAvailabilityData,
  FsrAvailabilityRequest,
} from "@/lib/assignments/fsr-availability";

type Snapshot = {
  key: string;
  state: "ready" | "error";
  data?: FsrAvailabilityData;
  error?: string;
};

export function useFsrAvailability(
  request: FsrAvailabilityRequest,
  enabled = true,
) {
  const { incidentId, assignmentId, scheduledDate } = request;
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const generation = useRef(0);
  const key = JSON.stringify([
    incidentId,
    assignmentId,
    scheduledDate,
    revision,
    enabled,
  ]);
  const currentKey = useRef(key);
  currentKey.current = key;

  useEffect(() => {
    const token = ++generation.current;
    let open = true;
    if (enabled && incidentId > 0) {
      getAssignmentFsrAvailability({ incidentId, assignmentId, scheduledDate })
        .then((result) => {
          if (
            !open ||
            token !== generation.current ||
            currentKey.current !== key
          )
            return;
          if (!result.success) {
            setSnapshot({ key, state: "error", error: result.error });
          } else if (result.date !== scheduledDate) {
            setSnapshot({
              key,
              state: "error",
              error: "La disponibilidad cambió. Vuelve a consultar.",
            });
          } else {
            setSnapshot({ key, state: "ready", data: result });
          }
        })
        .catch(() => {
          if (
            open &&
            token === generation.current &&
            currentKey.current === key
          ) {
            setSnapshot({
              key,
              state: "error",
              error: "No se pudo consultar la disponibilidad.",
            });
          }
        });
    }
    return () => {
      open = false;
      ++generation.current;
    };
  }, [key, enabled, incidentId, assignmentId, scheduledDate]);

  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const state =
    !enabled || incidentId <= 0
      ? "idle"
      : snapshot?.key === key
        ? snapshot.state
        : "loading";
  return {
    state,
    fsrs: state === "ready" ? (snapshot?.data?.fsrs ?? []) : [],
    error: state === "error" ? snapshot?.error : undefined,
    retry,
  };
}
