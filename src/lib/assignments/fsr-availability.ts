export type FsrAvailabilityRequest = {
  incidentId: number;
  assignmentId?: string;
  scheduledDate: string | null;
};

export type FsrAvailabilityRow = {
  userId: string;
  name: string;
  unavailable: boolean;
  reason: "HOLIDAY" | "APPROVED_ABSENCE" | null;
};

export type FsrAvailabilityData = {
  date: string | null;
  fsrs: FsrAvailabilityRow[];
};
