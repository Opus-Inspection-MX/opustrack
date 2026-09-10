import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requireAuth, userHasPermission, assertClienteAccessAsync } =
  vi.hoisted(() => ({
    prismaMock: {
      incident: { findUnique: vi.fn() },
      incidentAttachment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    requireAuth: vi.fn(async () => ({ id: "u1" })),
    userHasPermission: vi.fn((_user: unknown, _permission: string) => false),
    assertClienteAccessAsync: vi.fn(async () => {}),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({ requireAuth }));
vi.mock("@/lib/authz/authz", () => ({ userHasPermission }));
vi.mock("@/lib/auth/filters", () => ({ assertClienteAccessAsync }));
vi.mock("@/lib/storage/file-storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/storage/file-storage")>();
  return {
    ...actual,
    uploadFileFromBuffer: vi.fn(async () => ({
      url: "/uploads/incidents/123-photo.jpg",
      filename: "photo.jpg",
      size: 1024,
      mimetype: "image/jpeg",
      provider: "filesystem",
    })),
    deleteFile: vi.fn(async () => {}),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteIncidentAttachment,
  uploadIncidentAttachment,
} from "./incident-attachments";

/**
 * Evidence photos filed with the incident report (RF-217).
 *
 * The reporter (CLIENT) holds incidents:create but NOT incidents:update, so
 * the gate is an OR — unlike the assignment side which demands update. What
 * does NOT bend is the terminal-state rule: a CERRADO/CANCELADA incident
 * takes no more evidence, and the 10MB/MIME contract is the real shared
 * validator, not a mock.
 */

const OPEN = { clienteId: "c1", status: { name: "ABIERTO" } };
const CLOSED = { clienteId: "c1", status: { name: "CERRADO" } };
const CANCELLED = { clienteId: "c1", status: { name: "CANCELADA" } };

function grant(...permissions: string[]) {
  userHasPermission.mockImplementation((_user: unknown, permission: string) =>
    permissions.includes(permission),
  );
}

function testFile(byteLength: number, name: string, type: string): File {
  // jsdom's File lacks arrayBuffer; the action reads it, so attach it.
  const bytes = new Uint8Array(new ArrayBuffer(byteLength));
  const file = new File([bytes], name, { type });
  (file as unknown as Record<string, unknown>).arrayBuffer = async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return file;
}

function uploadForm(overrides?: {
  incidentId?: string;
  file?: File;
  mimetype?: string;
}) {
  const fd = new FormData();
  fd.append("incidentId", overrides?.incidentId ?? "7");
  fd.append(
    "file",
    overrides?.file ?? testFile(1024, "photo.jpg", "image/jpeg"),
  );
  if (overrides?.mimetype) fd.append("mimetype", overrides.mimetype);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  grant("incidents:create");
  prismaMock.incident.findUnique.mockResolvedValue(OPEN);
  prismaMock.incidentAttachment.create.mockResolvedValue({ id: "att1" });
  prismaMock.incidentAttachment.findUnique.mockResolvedValue({
    id: "att1",
    incidentId: 7,
    filepath: "/uploads/incidents/123-photo.jpg",
    provider: "filesystem",
    incident: { clienteId: "c1" },
  });
  prismaMock.incidentAttachment.update.mockResolvedValue({ id: "att1" });
});

describe("uploadIncidentAttachment · permiso", () => {
  it("acepta a quien crea (CLIENT) aunque no actualice", async () => {
    grant("incidents:create");

    const result = await uploadIncidentAttachment(uploadForm());

    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it("acepta a quien actualiza (ADMIN/FSR) aunque no cree", async () => {
    grant("incidents:update");

    const result = await uploadIncidentAttachment(uploadForm());

    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it("niega a quien no tiene ni create ni update", async () => {
    grant();

    await expect(uploadIncidentAttachment(uploadForm())).rejects.toThrow(
      "Permission denied",
    );
  });
});

describe("uploadIncidentAttachment · reglas", () => {
  it("bloquea la subida en incidente CERRADO con mensaje en español", async () => {
    prismaMock.incident.findUnique.mockResolvedValue(CLOSED);

    const result = await uploadIncidentAttachment(uploadForm());

    expect(result).toEqual({
      success: false,
      error: "La incidencia está cerrada. No se pueden hacer cambios.",
    });
    expect(prismaMock.incidentAttachment.create).not.toHaveBeenCalled();
  });

  it("bloquea la subida en incidente CANCELADA con mensaje en español", async () => {
    prismaMock.incident.findUnique.mockResolvedValue(CANCELLED);

    const result = await uploadIncidentAttachment(uploadForm());

    expect(result).toEqual({
      success: false,
      error: "La incidencia está cancelada. No se pueden hacer cambios.",
    });
  });

  it("rechaza archivos sobre 10MB con el mensaje del validador compartido", async () => {
    const big = testFile(11 * 1024 * 1024, "big.jpg", "image/jpeg");

    await expect(
      uploadIncidentAttachment(uploadForm({ file: big })),
    ).rejects.toThrow(/10MB/);
    expect(prismaMock.incidentAttachment.create).not.toHaveBeenCalled();
  });

  it("rechaza MIME fuera de la allowlist", async () => {
    const exe = testFile(10, "run.exe", "application/x-msdownload");

    await expect(
      uploadIncidentAttachment(uploadForm({ file: exe })),
    ).rejects.toThrow(/no permitido/);
  });

  it("registra el provider devuelto por el storage en la fila", async () => {
    await uploadIncidentAttachment(uploadForm());

    expect(prismaMock.incidentAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: "filesystem" }),
      }),
    );
  });
});

describe("deleteIncidentAttachment", () => {
  it("soft-deletea la fila y borra el blob del provider guardado", async () => {
    const { deleteFile } = await import("@/lib/storage/file-storage");

    const result = await deleteIncidentAttachment("att1");

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(prismaMock.incidentAttachment.update).toHaveBeenCalledWith({
      where: { id: "att1" },
      data: { active: false },
    });
    expect(deleteFile).toHaveBeenCalledWith(
      "/uploads/incidents/123-photo.jpg",
      "filesystem",
    );
  });

  it("bloquea el borrado en incidente CERRADO", async () => {
    prismaMock.incident.findUnique.mockResolvedValue(CLOSED);

    const result = await deleteIncidentAttachment("att1");

    expect(result).toEqual({
      success: false,
      error: "La incidencia está cerrada. No se pueden hacer cambios.",
    });
    expect(prismaMock.incidentAttachment.update).not.toHaveBeenCalled();
  });
});
