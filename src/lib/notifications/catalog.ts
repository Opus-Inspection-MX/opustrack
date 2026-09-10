import {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPES,
  type NotificationPriority,
  type NotificationType,
} from "./notification-types";

/**
 * The single registry of notification events.
 *
 * Before this file, each event re-declared its own title, message, link and
 * mail flag inside `notify-events.ts` — fourteen copies of the same skeleton
 * that drifted apart (the mail flags especially: only three events mailed,
 * decided by a hardcoded `email?` field). Now every event is one entry here:
 * a Spanish label for the channel matrix, its group, its priority, the
 * default channels (mirrored by the migration seed), and a `render` that
 * builds the in-app copy plus the mail subject/intro from the event context.
 *
 * New event types are plain strings (`Notification.type` is a String, not an
 * enum), so adding one means extending `NOTIFICATION_TYPES` and adding an
 * entry here — never a migration.
 */

export type NotificationGroup =
  | "Incidentes"
  | "Asignaciones"
  | "Vacaciones"
  | "Sistema";

/** Matrix display order. */
export const NOTIFICATION_GROUPS: readonly NotificationGroup[] = [
  "Incidentes",
  "Asignaciones",
  "Vacaciones",
  "Sistema",
];

/** What `render` may interpolate. Every field is optional: events pick. */
export interface EventRenderContext {
  incidentId?: number;
  incidentTitle?: string | null;
  assignmentId?: string;
  vacationId?: string;
  requesterName?: string | null;
  /** Custom copy for broadcasts (system / announcement). */
  title?: string;
  message?: string;
}

export interface EventRender {
  title: string;
  message: string;
  /** Where the notification points. Null for channel-less broadcasts. */
  actionUrl: string | null;
  email: { subject: string; intro: string };
}

export interface EventDef {
  /** Spanish label shown in the channel matrix. */
  label: string;
  group: NotificationGroup;
  priority: NotificationPriority;
  defaultChannels: { inApp: boolean; email: boolean };
  render: (ctx: EventRenderContext) => EventRender;
}

function incidentName(ctx: EventRenderContext): string {
  if (ctx.incidentTitle) return ctx.incidentTitle;
  if (ctx.incidentId !== undefined) return `#${ctx.incidentId}`;
  return "el incidente";
}

function phaseRender(
  phase: string,
  verb: string,
): (ctx: EventRenderContext) => EventRender {
  return (ctx) => {
    const name = incidentName(ctx);
    return {
      title: `Incidente ${phase}`,
      message: `El incidente ${verb}: ${name}`,
      actionUrl:
        ctx.incidentId !== undefined
          ? `/admin/incidents/${ctx.incidentId}`
          : null,
      email: {
        subject: `Incidente ${phase}: ${name}`,
        intro: `El incidente ${verb}: ${name}.`,
      },
    };
  };
}

export const NOTIFICATION_EVENTS: Record<NotificationType, EventDef> = {
  // -- Assignments ---------------------------------------------------------
  [NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED]: {
    label: "Asignación creada",
    group: "Asignaciones",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: "Nueva asignación",
      message: ctx.incidentTitle
        ? `Se te ha asignado la asignación para: ${ctx.incidentTitle}`
        : "Se te ha asignado una nueva asignación",
      actionUrl: ctx.assignmentId
        ? `/fsr/assignments/${ctx.assignmentId}`
        : "/fsr/assignments",
      email: {
        subject: `Nueva asignación${ctx.incidentTitle ? `: ${ctx.incidentTitle}` : ""}`,
        intro: ctx.incidentTitle
          ? `Se te ha asignado la asignación para: ${ctx.incidentTitle}.`
          : "Se te ha asignado una nueva asignación.",
      },
    }),
  },
  [NOTIFICATION_TYPES.ASSIGNMENT_UPDATED]: {
    label: "Asignación actualizada",
    group: "Asignaciones",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: "Asignación actualizada",
      message: ctx.incidentTitle
        ? `Tu asignación ha sido actualizada: ${ctx.incidentTitle}`
        : "Tu asignación ha sido actualizada",
      actionUrl: ctx.assignmentId
        ? `/fsr/assignments/${ctx.assignmentId}`
        : "/fsr/assignments",
      email: {
        subject: `Asignación actualizada${ctx.incidentTitle ? `: ${ctx.incidentTitle}` : ""}`,
        intro: ctx.incidentTitle
          ? `Tu asignación ha sido actualizada: ${ctx.incidentTitle}.`
          : "Tu asignación ha sido actualizada.",
      },
    }),
  },
  [NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED]: {
    label: "Asignación completada",
    group: "Asignaciones",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: "Asignación completada",
      message: ctx.incidentTitle
        ? `La asignación fue completada: ${ctx.incidentTitle}`
        : "La asignación fue completada",
      actionUrl: ctx.assignmentId
        ? `/fsr/assignments/${ctx.assignmentId}`
        : "/fsr/assignments",
      email: {
        subject: `Asignación completada${ctx.incidentTitle ? `: ${ctx.incidentTitle}` : ""}`,
        intro: ctx.incidentTitle
          ? `La asignación fue completada: ${ctx.incidentTitle}.`
          : "La asignación fue completada.",
      },
    }),
  },
  [NOTIFICATION_TYPES.ASSIGNMENT_REOPENED]: {
    label: "Asignación reabierta",
    group: "Asignaciones",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: "Asignación reabierta",
      message: ctx.incidentTitle
        ? `La asignación fue reabierta: ${ctx.incidentTitle}`
        : "La asignación fue reabierta",
      actionUrl: ctx.assignmentId
        ? `/fsr/assignments/${ctx.assignmentId}`
        : "/fsr/assignments",
      email: {
        subject: `Asignación reabierta${ctx.incidentTitle ? `: ${ctx.incidentTitle}` : ""}`,
        intro: ctx.incidentTitle
          ? `La asignación fue reabierta: ${ctx.incidentTitle}.`
          : "La asignación fue reabierta.",
      },
    }),
  },

  // -- Incidents -----------------------------------------------------------
  [NOTIFICATION_TYPES.INCIDENT_CREATED]: {
    label: "Incidente creado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: true },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Nuevo incidente reportado",
        message: `Se reportó un nuevo incidente: ${name}`,
        actionUrl:
          ctx.incidentId !== undefined
            ? `/admin/incidents/${ctx.incidentId}`
            : null,
        email: {
          subject: `Nuevo incidente reportado: ${name}`,
          intro: `Se reportó un nuevo incidente: ${name}.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.INCIDENT_UPDATED]: {
    label: "Incidente actualizado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.LOW,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Incidente actualizado",
        message: `El incidente ha sido actualizado: ${name}`,
        actionUrl: "/fsr/assignments",
        email: {
          subject: `Incidente actualizado: ${name}`,
          intro: `El incidente ha sido actualizado: ${name}.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.INCIDENT_ASSIGNED]: {
    label: "FSR habilitado en incidente",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Asignado a incidente",
        message: `Se te ha asignado al incidente: ${name}`,
        actionUrl: "/fsr/assignments",
        email: {
          subject: `Asignado al incidente: ${name}`,
          intro: `Se te ha asignado al incidente: ${name}.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.INCIDENT_PHASE_ASIGNADO]: {
    label: "Incidente → asignado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: phaseRender("asignado", "fue asignado"),
  },
  [NOTIFICATION_TYPES.INCIDENT_PHASE_VISTO]: {
    label: "Incidente → visto",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.LOW,
    defaultChannels: { inApp: true, email: false },
    render: phaseRender("visto", "fue visto por el técnico"),
  },
  [NOTIFICATION_TYPES.INCIDENT_PHASE_INICIADO]: {
    label: "Incidente → iniciado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: phaseRender("iniciado", "inició su atención en sitio"),
  },
  [NOTIFICATION_TYPES.INCIDENT_PHASE_EN_PROGRESO]: {
    label: "Incidente → en progreso",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: phaseRender("en progreso", "avanzó a en progreso"),
  },
  [NOTIFICATION_TYPES.INCIDENT_CLOSED]: {
    label: "Incidente cerrado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: true },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Incidente cerrado",
        message: `El incidente fue cerrado: ${name}`,
        actionUrl:
          ctx.incidentId !== undefined
            ? `/admin/incidents/${ctx.incidentId}`
            : null,
        email: {
          subject: `Incidente resuelto: ${name}`,
          intro: `El incidente fue cerrado: ${name}.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.INCIDENT_CANCELLED]: {
    label: "Incidente cancelado",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: true },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Incidente cancelado",
        message: `El incidente fue cancelado: ${name}`,
        actionUrl:
          ctx.incidentId !== undefined
            ? `/admin/incidents/${ctx.incidentId}`
            : null,
        email: {
          subject: `Incidente cancelado: ${name}`,
          intro: `El incidente fue cancelado: ${name}.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.INCIDENT_REOPENED]: {
    label: "Incidente reabierto",
    group: "Incidentes",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => {
      const name = incidentName(ctx);
      return {
        title: "Incidente reabierto",
        message: `El incidente fue reabierto: ${name}`,
        actionUrl:
          ctx.incidentId !== undefined
            ? `/admin/incidents/${ctx.incidentId}`
            : null,
        email: {
          subject: `Incidente reabierto: ${name}`,
          intro: `El incidente fue reabierto: ${name}.`,
        },
      };
    },
  },

  // -- Vacations -----------------------------------------------------------
  [NOTIFICATION_TYPES.VACATION_REQUESTED]: {
    label: "Vacación solicitada",
    group: "Vacaciones",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: true },
    render: (ctx) => {
      const who = ctx.requesterName ?? "Un colaborador";
      return {
        title: "Solicitud de vacaciones",
        message: `${who} solicitó vacaciones y espera autorización`,
        actionUrl: "/admin/vacations",
        email: {
          subject: `Solicitud de vacaciones de ${who}`,
          intro: `${who} solicitó vacaciones y espera autorización.`,
        },
      };
    },
  },
  [NOTIFICATION_TYPES.VACATION_APPROVED]: {
    label: "Vacación aprobada",
    group: "Vacaciones",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: true },
    render: () => ({
      title: "Vacaciones aprobadas",
      message: "Tu solicitud de vacaciones fue aprobada",
      actionUrl: "/vacations",
      email: {
        subject: "Vacaciones aprobadas",
        intro: "Tu solicitud de vacaciones fue aprobada.",
      },
    }),
  },
  [NOTIFICATION_TYPES.VACATION_REJECTED]: {
    label: "Vacación rechazada",
    group: "Vacaciones",
    priority: NOTIFICATION_PRIORITY.HIGH,
    defaultChannels: { inApp: true, email: true },
    render: () => ({
      title: "Vacaciones rechazadas",
      message: "Tu solicitud de vacaciones fue rechazada",
      actionUrl: "/vacations",
      email: {
        subject: "Vacaciones rechazadas",
        intro: "Tu solicitud de vacaciones fue rechazada.",
      },
    }),
  },
  [NOTIFICATION_TYPES.VACATION_CANCELLED]: {
    label: "Vacación cancelada",
    group: "Vacaciones",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: "Vacación cancelada",
      message: ctx.requesterName
        ? `${ctx.requesterName} canceló su solicitud de vacaciones`
        : "Una solicitud de vacaciones fue cancelada",
      actionUrl: "/admin/vacations",
      email: {
        subject: "Vacación cancelada",
        intro: ctx.requesterName
          ? `${ctx.requesterName} canceló su solicitud de vacaciones.`
          : "Una solicitud de vacaciones fue cancelada.",
      },
    }),
  },
  [NOTIFICATION_TYPES.VACATION_STARTING_SOON]: {
    label: "Vacación próxima a iniciar",
    group: "Vacaciones",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: () => ({
      title: "Tus vacaciones inician mañana",
      message: "Tu período de vacaciones aprobado inicia mañana",
      actionUrl: "/vacations",
      email: {
        subject: "Tus vacaciones inician mañana",
        intro: "Tu período de vacaciones aprobado inicia mañana.",
      },
    }),
  },

  // -- System --------------------------------------------------------------
  [NOTIFICATION_TYPES.SYSTEM]: {
    label: "Mensaje del sistema",
    group: "Sistema",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: ctx.title ?? "Aviso del sistema",
      message: ctx.message ?? "",
      actionUrl: null,
      email: {
        subject: ctx.title ?? "Aviso del sistema",
        intro: ctx.message ?? "",
      },
    }),
  },
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: {
    label: "Anuncio",
    group: "Sistema",
    priority: NOTIFICATION_PRIORITY.LOW,
    defaultChannels: { inApp: true, email: false },
    render: (ctx) => ({
      title: ctx.title ?? "Anuncio",
      message: ctx.message ?? "",
      actionUrl: null,
      email: {
        subject: ctx.title ?? "Anuncio",
        intro: ctx.message ?? "",
      },
    }),
  },
};

/**
 * Seed rows for `notification_channel_policies`, derived from the catalog so
 * the migration SQL and `seed.example.ts` cannot disagree with the code.
 */
export function defaultChannelPolicies(): Array<{
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}> {
  return (Object.keys(NOTIFICATION_EVENTS) as NotificationType[]).map(
    (type) => ({
      type,
      inApp: NOTIFICATION_EVENTS[type].defaultChannels.inApp,
      email: NOTIFICATION_EVENTS[type].defaultChannels.email,
    }),
  );
}
