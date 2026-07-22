/** Part A design tokens — MOBILE_APP_MASTER_PLAN.md */
export const colors = {
  brand: '#2563EB',
  brandDark: '#1D4ED8',
  brandSoft: '#EFF6FF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  input: 12,
  button: 12,
  card: 16,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  section: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
} as const;

export const touch = {
  minTarget: 48,
  listRow: 56,
} as const;
