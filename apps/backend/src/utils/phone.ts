// Validates phone numbers in E.164-ish format without the leading plus,
// e.g. 91XXXXXXXXXX (country code + subscriber number, 10-15 digits total).
const PHONE_REGEX = /^[1-9][0-9]{9,14}$/;

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return PHONE_REGEX.test(normalized);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "").replace(/^0+/, "");
}
