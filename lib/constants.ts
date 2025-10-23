export const MAX_CHARACTERS = 5000;

export const EXPIRY_CHOICES = {
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60
} as const;

export type ExpiryChoice = keyof typeof EXPIRY_CHOICES;

export const EXPIRY_OPTIONS = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "24 hours" },
  { value: "7d", label: "7 days" }
] satisfies ReadonlyArray<{ value: ExpiryChoice; label: string }>;
