/**
 * Query-param key shared by the incident-program report download button
 * (`incident-program-client.tsx`, writer) and its API route (`route.ts`,
 * reader).
 *
 * One constant keeps the pair from drifting: a half-rename here silently
 * returns more rows instead of failing, so writer and reader must import
 * this symbol rather than repeating the literal.
 */
export const INCIDENT_PROGRAM_CLIENT_IDS_PARAM = "clientIds" as const;
