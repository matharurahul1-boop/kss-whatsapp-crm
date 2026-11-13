// Validates phone numbers in E.164-ish format without the leading plus,
// e.g. 91XXXXXXXXXX (country code + subscriber number, 10-15 digits total).
const PHONE_REGEX = /^[1-9][0-9]{9,14}$/;

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return PHONE_REGEX.test(normalized);
}

const DEFAULT_COUNTRY_CODE = "91"; // India: a bare 10-digit number gets this prefix

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return digits.length === 10 ? DEFAULT_COUNTRY_CODE + digits : digits;
}
