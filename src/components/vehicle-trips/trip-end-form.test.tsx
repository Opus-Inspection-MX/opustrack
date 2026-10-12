import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { endVehicleTrip, push, error, success, photo } = vi.hoisted(() => ({
  endVehicleTrip: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  photo: new File(["odometer evidence"], "end.jpg", { type: "image/jpeg" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "fsr-1" } } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: { error, success } }));
vi.mock("@/lib/actions/vehicle-trips", () => ({
  endVehicleTrip,
  startVehicleTrip: vi.fn(),
}));
vi.mock("@/lib/actions/assignments", () => ({
  startAssignmentWork: vi.fn(),
  closeAssignment: vi.fn(),
}));
vi.mock("@/components/offline/pending-drafts", () => ({
  PendingDrafts: () => null,
}));
vi.mock("@/components/ui/file-upload", () => ({
  FileUpload: ({
    onFilesSelected,
  }: {
    onFilesSelected: (files: File[]) => void;
  }) => (
    <button type="button" onClick={() => onFilesSelected([photo])}>
      Attach odometer photo
    </button>
  ),
}));
vi.mock("./gps-location-capture", () => ({
  GPSLocationCapture: ({
    onLocationCapture,
  }: {
    onLocationCapture: (location: {
      latitude: number;
      longitude: number;
      address: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onLocationCapture({
          latitude: 19.43,
          longitude: -99.13,
          address: "Inspection center",
        })
      }
    >
      Capture GPS
    </button>
  ),
}));

import {
  loadEntries,
  removeEntry,
  takeStagedPhoto,
} from "@/lib/offline/outbox";
import { TripEndForm } from "./trip-end-form";

const captureTime = "2026-10-12T23:59:59.000Z";
const trip = {
  id: "trip-1",
  vehicle: { make: "Ford", model: "Transit", licensePlate: "ABC-123" },
  startOdometer: 1200,
  startedAt: "2026-10-12T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(captureTime));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  endVehicleTrip.mockResolvedValue({ success: true });
});
afterEach(() => {
  act(() => {
    for (const entry of loadEntries()) removeEntry(entry.key);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fillForm(attachPhoto = true) {
  render(<TripEndForm trip={trip} />);
  fireEvent.change(screen.getByLabelText(/Odómetro Final/), {
    target: { value: "1250" },
  });
  fireEvent.change(screen.getByLabelText("Notas (Opcional)"), {
    target: { value: "Returned to center" },
  });
  if (attachPhoto)
    fireEvent.click(
      screen.getByRole("button", { name: "Attach odometer photo" }),
    );
  return screen.getByRole("button", { name: "Finalizar Viaje" });
}

describe("TripEndForm evidence and delivery", () => {
  it("unlocks a fresh end capture after its queued draft is discarded", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const submit = fillForm();
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    const oldKey = loadEntries()[0].key;
    act(() => {
      removeEntry(oldKey);
    });
    await waitFor(() => expect(submit).toBeEnabled());
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    fireEvent.click(submit);
    await waitFor(() => expect(endVehicleTrip).toHaveBeenCalledTimes(1));
    expect(
      (endVehicleTrip.mock.calls[0][0] as FormData).get("idempotencyKey"),
    ).not.toBe(oldKey);
  });
  it("queues the exact first-send identity and evidence after a response lost across midnight", async () => {
    endVehicleTrip.mockImplementation(async () => {
      window.dispatchEvent(new StorageEvent("storage"));
      vi.setSystemTime(new Date("2026-10-13T00:01:00.000Z"));
      throw new Error("Response lost");
    });
    const submit = fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Capture GPS" }));
    fireEvent.click(submit);
    await waitFor(() => expect(loadEntries()).toHaveLength(1));
    expect(endVehicleTrip).toHaveBeenCalledTimes(1);
    const sent = endVehicleTrip.mock.calls[0][0] as FormData;
    expect(sent.get("idempotencyKey")).toEqual(expect.any(String));
    expect(sent.get("idempotencyKey")).not.toBe("");
    expect(sent.get("capturedAt")).toBe(captureTime);
    const [entry] = loadEntries();
    expect(entry).toMatchObject({
      key: sent.get("idempotencyKey"),
      capturedAt: sent.get("capturedAt"),
      kind: "endVehicleTrip",
      userId: "fsr-1",
      fields: {
        tripId: "trip-1",
        endOdometer: "1250",
        notes: "Returned to center",
        photoMimetype: "image/jpeg",
        endLatitude: "19.43",
        endLongitude: "-99.13",
        endAddress: "Inspection center",
      },
    });
    for (const [key, value] of Object.entries(entry.fields))
      expect(sent.get(key)).toBe(value);
    expect(sent.get("photo")).toBe(photo);
    expect(takeStagedPhoto(entry.key)).toBe(photo);
    expect(push).not.toHaveBeenCalled();
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(endVehicleTrip).toHaveBeenCalledTimes(1);
    expect(loadEntries()).toHaveLength(1);
  });

  it("queues offline evidence without a server call or GPS", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const submit = fillForm();
    fireEvent.click(submit);
    expect(endVehicleTrip).not.toHaveBeenCalled();
    expect(loadEntries()).toHaveLength(1);
    const [entry] = loadEntries();
    expect(entry).toMatchObject({
      capturedAt: captureTime,
      userId: "fsr-1",
      fields: { tripId: "trip-1", endOdometer: "1250" },
    });
    expect(entry.fields).not.toHaveProperty("endLatitude");
    expect(entry.fields).not.toHaveProperty("endLongitude");
    expect(takeStagedPhoto(entry.key)).toBe(photo);
    expect(submit).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not queue business-rule failures and starts a fresh identity on correction", async () => {
    endVehicleTrip.mockResolvedValueOnce({
      success: false,
      error: "El viaje ya no está en curso.",
    });
    const submit = fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("El viaje ya no está en curso."),
    );
    expect(loadEntries()).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(submit).toBeEnabled();
    const first = endVehicleTrip.mock.calls[0][0] as FormData;
    vi.setSystemTime(new Date("2026-10-13T00:02:00.000Z"));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fsr/vehicle-trips"),
    );
    const retry = endVehicleTrip.mock.calls[1][0] as FormData;
    expect(retry.get("idempotencyKey")).not.toBe(first.get("idempotencyKey"));
    expect(retry.get("capturedAt")).toBe("2026-10-13T00:02:00.000Z");
  });

  it("blocks missing photo evidence before calling or queuing", () => {
    const submit = fillForm(false);
    fireEvent.click(submit);
    expect(
      screen.getByText("Por favor toma una foto del odómetro"),
    ).toBeInTheDocument();
    expect(endVehicleTrip).not.toHaveBeenCalled();
    expect(loadEntries()).toEqual([]);
  });

  it("blocks duplicate sends while the first response is pending", async () => {
    let resolve!: (result: { success: true }) => void;
    endVehicleTrip.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const submit = fillForm();
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(endVehicleTrip).toHaveBeenCalledTimes(1);
    expect(loadEntries()).toEqual([]);
    resolve({ success: true });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fsr/vehicle-trips"),
    );
  });
});
