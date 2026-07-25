/** P2-BBD-PEEL — blocked until seed_peel* lands. Do not invent columns. */

export const PEEL_PROCESS_CODE = 'PEEL';

/** Exact Acceptance copy from MOBILE_APP_MASTER_PLAN.md D.4.2 */
export const PEEL_BLOCKED_TITLE = 'Peeling not digitized yet.';

export const PEEL_BLOCKED_DESCRIPTION =
  'The peeling log sheet will appear on this phone after it is seeded on the server. Until then, use Bright Bar (BBAR) for the daily production register.';

export function isPeelProcessCode(code: string | undefined | null): boolean {
  return (code ?? '').toUpperCase() === PEEL_PROCESS_CODE;
}
