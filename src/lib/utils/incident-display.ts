/**
 * How an incident's reporter reads on screen.
 *
 * A center's account is shared by everyone who works there, so the account name
 * alone ("IZ13") answers *where* a report came from but not *who* filed it.
 * When the person typed their name, both are shown — that name is who an admin
 * or FSR calls back.
 */
export function formatReporter(
  accountName: string | null | undefined,
  reporterName: string | null | undefined,
): string {
  const account = accountName?.trim();
  const person = reporterName?.trim();

  if (account && person) return `${account} — ${person}`;
  if (person) return person;
  if (account) return account;
  return "Desconocido";
}
