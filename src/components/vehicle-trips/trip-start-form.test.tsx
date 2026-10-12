import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startVehicleTrip, getAvailableVehicles, push, error, success, photo } =
  vi.hoisted(() => ({
    startVehicleTrip: vi.fn(),
    getAvailableVehicles: vi.fn(),
    push: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    photo: new File(["odometer evidence"], "start.jpg", { type: "image/jpeg" }),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "fsr-1" } } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: { error, success } }));
vi.mock("@/lib/actions/vehicle-trips", () => ({
  startVehicleTrip,
  endVehicleTrip: vi.fn(),
  getAvailableVehicles,
  getMyAssignmentsForTrips: vi.fn(async () => []),
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
import { TripStartForm } from "./trip-start-form";

const captureTime = "2026-10-12T23:59:59.000Z";
const scrollIntoView = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no scrolling layout; keep the real Select keyboard interaction.
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(captureTime));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  getAvailableVehicles.mockResolvedValue([
    {
      id: "vehicle-1",
      make: "Ford",
      model: "Transit",
      licensePlate: "ABC-123",
    },
  ]);
  startVehicleTrip.mockResolvedValue({ success: true });
});

afterEach(() => {
  act(() => {
    for (const entry of loadEntries()) removeEntry(entry.key);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollIntoView)
    Object.defineProperty(Element.prototype, "scrollIntoView", scrollIntoView);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

async function fillForm({ attachPhoto = true, canManage = false } = {}) {
  render(<TripStartForm canManage={canManage} />);
  const vehicle = await screen.findByRole("combobox", { name: /Vehículo/ });
  fireEvent.keyDown(vehicle, { key: " ", code: "Space" });
  fireEvent.click(
    await screen.findByRole("option", { name: "Ford Transit - ABC-123" }),
  );
  fireEvent.change(screen.getByLabelText(/Odómetro Inicial/), {
    target: { value: "1200" },
  });
  fireEvent.change(screen.getByLabelText("Notas (Opcional)"), {
    target: { value: "Inspection visit" },
  });
  if (attachPhoto)
    fireEvent.click(
      screen.getByRole("button", { name: "Attach odometer photo" }),
    );
  return screen.getByRole("button", { name: "Iniciar Viaje" });
}

describe("TripStartForm evidence and delivery", () => {
  it("unlocks a fresh capture after the operator discards its queued draft", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const submit = await fillForm();
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    const oldKey = loadEntries()[0].key;
    act(() => {
      removeEntry(oldKey);
    });
    await waitFor(() => expect(submit).toBeEnabled());
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    fireEvent.click(submit);
    await waitFor(() => expect(startVehicleTrip).toHaveBeenCalledTimes(1));
    expect(
      (startVehicleTrip.mock.calls[0][0] as FormData).get("idempotencyKey"),
    ).not.toBe(oldKey);
  });
  it("queues the exact first-send identity and evidence when the response is lost across midnight", async () => {
    startVehicleTrip.mockImplementation(async () => {
      window.dispatchEvent(new StorageEvent("storage"));
      vi.setSystemTime(new Date("2026-10-13T00:01:00.000Z"));
      throw new Error("Response lost");
    });
    const submit = await fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Capture GPS" }));
    fireEvent.click(submit);
    await waitFor(() => expect(loadEntries()).toHaveLength(1));
    expect(startVehicleTrip).toHaveBeenCalledTimes(1);
    const sent = startVehicleTrip.mock.calls[0][0] as FormData;
    expect(sent.get("idempotencyKey")).toEqual(expect.any(String));
    expect(sent.get("idempotencyKey")).not.toBe("");
    expect(sent.get("capturedAt")).toBe(captureTime);
    const [entry] = loadEntries();
    expect(loadEntries()).toHaveLength(1);
    expect(entry).toMatchObject({
      key: sent.get("idempotencyKey"),
      capturedAt: sent.get("capturedAt"),
      kind: "startVehicleTrip",
      userId: "fsr-1",
      fields: {
        vehicleId: "vehicle-1",
        startOdometer: "1200",
        notes: "Inspection visit",
        photoMimetype: "image/jpeg",
        startLatitude: "19.43",
        startLongitude: "-99.13",
        startAddress: "Inspection center",
      },
    });
    for (const [key, value] of Object.entries(entry.fields))
      expect(sent.get(key)).toBe(value);
    expect(sent.get("photo")).toBe(photo);
    expect(takeStagedPhoto(entry.key)).toBe(photo);
    expect(push).not.toHaveBeenCalled();
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(startVehicleTrip).toHaveBeenCalledTimes(1);
    expect(loadEntries()).toHaveLength(1);
  });

  it("saves an offline capture without calling the server or requiring GPS", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const submit = await fillForm();
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(startVehicleTrip).not.toHaveBeenCalled();
    expect(loadEntries()).toHaveLength(1);
    const [entry] = loadEntries();
    expect(entry).toMatchObject({
      capturedAt: captureTime,
      userId: "fsr-1",
      fields: { vehicleId: "vehicle-1", startOdometer: "1200" },
    });
    expect(entry.fields).not.toHaveProperty("startLatitude");
    expect(entry.fields).not.toHaveProperty("startLongitude");
    expect(takeStagedPhoto(entry.key)).toBe(photo);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows business-rule failures without queuing and allows a corrected submission", async () => {
    startVehicleTrip.mockResolvedValueOnce({
      success: false,
      error: "El vehículo ya está en uso.",
    });
    const submit = await fillForm();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("El vehículo ya está en uso."),
    );
    expect(loadEntries()).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(submit).toBeEnabled();
    const first = startVehicleTrip.mock.calls[0][0] as FormData;
    vi.setSystemTime(new Date("2026-10-13T00:02:00.000Z"));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fsr/vehicle-trips"),
    );
    const retry = startVehicleTrip.mock.calls[1][0] as FormData;
    expect(retry.get("idempotencyKey")).not.toBe(first.get("idempotencyKey"));
    expect(retry.get("capturedAt")).toBe("2026-10-13T00:02:00.000Z");
  });

  it("blocks missing photo evidence before calling or queuing", async () => {
    const submit = await fillForm({ attachPhoto: false });
    expect(
      screen.queryByLabelText("Motivo de excepción operacional"),
    ).not.toBeInTheDocument();
    expect(getAvailableVehicles).toHaveBeenCalledWith({
      includeOperationalExceptions: false,
    });
    fireEvent.click(submit);
    expect(
      screen.getByText("Por favor toma una foto del odómetro"),
    ).toBeInTheDocument();
    expect(startVehicleTrip).not.toHaveBeenCalled();
    expect(loadEntries()).toEqual([]);
  });

  it("blocks duplicate sends while the first response is pending", async () => {
    let resolve!: (result: { success: true }) => void;
    startVehicleTrip.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const submit = await fillForm();
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(startVehicleTrip).toHaveBeenCalledTimes(1);
    expect(loadEntries()).toEqual([]);
    resolve({ success: true });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fsr/vehicle-trips"),
    );
  });

  it("requests exception vehicles and sends the manager's operational reason", async () => {
    const submit = await fillForm({ canManage: true });
    fireEvent.change(screen.getByLabelText("Motivo de excepción operacional"), {
      target: { value: "Authorized holiday response" },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/fsr/vehicle-trips"),
    );
    expect(getAvailableVehicles).toHaveBeenCalledWith({
      includeOperationalExceptions: true,
    });
    expect(
      (startVehicleTrip.mock.calls[0][0] as FormData).get(
        "startExceptionReason",
      ),
    ).toBe("Authorized holiday response");
    expect(loadEntries()).toEqual([]);
  });
});
