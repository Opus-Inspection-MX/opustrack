import { describe, expect, it } from "vitest";
import {
  defaultChannelPolicies,
  NOTIFICATION_EVENTS,
  NOTIFICATION_GROUPS,
} from "./catalog";
import {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "./notification-types";

/**
 * The catalog is the contract the matrix screen, the dispatch and the
 * migration seed all read. If an event is missing here it cannot be
 * configured, rendered or seeded — so coverage is pinned exhaustively.
 */

const EMAIL_BY_DEFAULT = new Set<NotificationType>([
  NOTIFICATION_TYPES.INCIDENT_CREATED,
  NOTIFICATION_TYPES.INCIDENT_CLOSED,
  NOTIFICATION_TYPES.INCIDENT_CANCELLED,
  NOTIFICATION_TYPES.VACATION_REQUESTED,
  NOTIFICATION_TYPES.VACATION_APPROVED,
  NOTIFICATION_TYPES.VACATION_REJECTED,
]);

describe("catálogo de eventos", () => {
  it("cubre cada tipo de notificación conocido", () => {
    const types = Object.values(NOTIFICATION_TYPES);
    for (const type of types) {
      expect(
        NOTIFICATION_EVENTS[type],
        `sin entrada de catálogo: ${type}`,
      ).toBeDefined();
    }
    expect(Object.keys(NOTIFICATION_EVENTS)).toHaveLength(types.length);
  });

  it("cada entrada trae etiqueta en español, grupo y prioridad válidos", () => {
    for (const [type, def] of Object.entries(NOTIFICATION_EVENTS)) {
      expect(def.label.trim().length, type).toBeGreaterThan(0);
      expect(NOTIFICATION_GROUPS, type).toContain(def.group);
      expect(Object.values(NOTIFICATION_PRIORITY) as number[], type).toContain(
        def.priority,
      );
    }
  });

  it("el correo solo va por defecto donde importa (6 eventos)", () => {
    for (const [type, def] of Object.entries(NOTIFICATION_EVENTS)) {
      const expected = EMAIL_BY_DEFAULT.has(type as NotificationType);
      expect(def.defaultChannels.email, type).toBe(expected);
      // In-app is always on by default: an event with both switches off is
      // disabled, and that decision belongs to the admin, not to the seed.
      expect(def.defaultChannels.inApp, type).toBe(true);
    }
  });

  it("cada render produce título, mensaje, asunto e intro no vacíos", () => {
    const ctx = {
      incidentId: 7,
      incidentTitle: "Bomba fuera de servicio",
      assignmentId: "a1",
      vacationId: "v1",
      requesterName: "Ana Pérez",
      title: "Titulo libre",
      message: "Mensaje libre",
    };
    for (const [type, def] of Object.entries(NOTIFICATION_EVENTS)) {
      const rendered = def.render(ctx);
      expect(rendered.title.trim().length, `${type}.title`).toBeGreaterThan(0);
      expect(rendered.message.trim().length, `${type}.message`).toBeGreaterThan(
        0,
      );
      expect(
        rendered.email.subject.trim().length,
        `${type}.email.subject`,
      ).toBeGreaterThan(0);
      expect(
        rendered.email.intro.trim().length,
        `${type}.email.intro`,
      ).toBeGreaterThan(0);
    }
  });

  it("conserva el copy que ya conocen los operadores", () => {
    expect(
      NOTIFICATION_EVENTS[NOTIFICATION_TYPES.INCIDENT_CREATED].render({
        incidentId: 7,
        incidentTitle: "Bomba",
      }),
    ).toMatchObject({
      title: "Nuevo incidente reportado",
      actionUrl: "/notifications/go/incident/7",
      email: { subject: "Nuevo incidente reportado: Bomba" },
    });
    expect(
      NOTIFICATION_EVENTS[NOTIFICATION_TYPES.INCIDENT_CLOSED].render({
        incidentId: 7,
        incidentTitle: "Bomba",
      }).email.subject,
    ).toContain("resuelto");
    expect(
      NOTIFICATION_EVENTS[NOTIFICATION_TYPES.VACATION_REQUESTED].render({
        requesterName: "Ana Pérez",
      }).email.subject,
    ).toContain("Ana Pérez");
  });

  it("defaultChannelPolicies expone un renglón por evento para el seed", () => {
    const rows = defaultChannelPolicies();
    expect(rows).toHaveLength(Object.values(NOTIFICATION_TYPES).length);
    const created = rows.find(
      (r) => r.type === NOTIFICATION_TYPES.INCIDENT_CREATED,
    );
    expect(created).toMatchObject({
      type: "incident_created",
      inApp: true,
      email: true,
    });
  });
});
