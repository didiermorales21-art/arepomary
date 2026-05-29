// Phone validation helpers — Colombian mobile numbers
// Must be exactly 10 digits and start with "3".

export const PHONE_PATTERN = "^3[0-9]{9}$";
export const PHONE_REGEX = /^3[0-9]{9}$/;

export function sanitizePhoneInput(value: string): string {
  // Keep only digits and cap at 10 chars
  return value.replace(/\D+/g, "").slice(0, 10);
}

export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  return PHONE_REGEX.test(value);
}

export const PHONE_INPUT_PROPS = {
  inputMode: "numeric" as const,
  pattern: PHONE_PATTERN,
  maxLength: 10,
  placeholder: "3XXXXXXXXX",
  title: "Debe tener 10 dígitos y comenzar con 3",
};
