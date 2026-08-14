/**
 * The three emails the system sends.
 *
 * Plain text on purpose: these are short operational alerts whose job is to get
 * someone into the app, so the link matters and the layout does not. A template
 * library for three messages would be more moving parts than content.
 */

/** Absolute URL for a path, so the link works from a mail client. */
function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export function incidentCreatedEmail(
  incidentId: number,
  incidentTitle: string | null | undefined,
) {
  const name = incidentTitle ?? `#${incidentId}`;
  return {
    subject: `Nuevo incidente reportado: ${name}`,
    body: [
      `Se reportó un nuevo incidente: ${name}.`,
      "",
      `Ábrelo aquí: ${appUrl(`/admin/incidents/${incidentId}`)}`,
      "",
      "— OpusTrack",
    ].join("\n"),
  };
}

export function incidentClosedEmail(
  incidentId: number,
  incidentTitle: string | null | undefined,
) {
  const name = incidentTitle ?? `#${incidentId}`;
  return {
    subject: `Incidente resuelto: ${name}`,
    body: [
      `El incidente fue cerrado: ${name}.`,
      "",
      `Revísalo aquí: ${appUrl(`/admin/incidents/${incidentId}`)}`,
      "",
      "— OpusTrack",
    ].join("\n"),
  };
}

export function vacationRequestedEmail(
  requesterName: string | null | undefined,
) {
  const who = requesterName ?? "Un colaborador";
  return {
    subject: `Solicitud de vacaciones de ${who}`,
    body: [
      `${who} solicitó vacaciones y espera autorización.`,
      "",
      `Apruébala o recházala aquí: ${appUrl("/admin/vacations")}`,
      "",
      "— OpusTrack",
    ].join("\n"),
  };
}
