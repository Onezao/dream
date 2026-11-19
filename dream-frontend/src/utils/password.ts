/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

export interface PasswordStrengthResult {
  valid: boolean;
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return {
    valid: minLength && hasUppercase && hasLowercase && hasDigit && hasSpecial,
    minLength,
    hasUppercase,
    hasLowercase,
    hasDigit,
    hasSpecial,
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isSafeInternalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return trimmed;
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  if (local.length <= 2) {
    return `${local[0]}***${domain}`;
  }
  return `${local.slice(0, 2)}***${domain}`;
}
