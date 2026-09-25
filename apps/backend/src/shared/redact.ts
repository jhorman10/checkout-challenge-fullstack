/**
 * Sensitive-data redaction utilities.
 *
 * Ensures that card numbers (and similar PII) are never fully logged. Only the
 * last 4 digits are ever preserved; all preceding digits are replaced.
 */

/** Default number of trailing digits to preserve. */
const VISIBLE_TAIL = 4;

/**
 * Masks a card number, returning only the last 4 digits.
 *
 * Non-digit characters (spaces, dashes, etc.) are stripped before masking so
 * that `4111 1111 1111 1111` and `4111111111111111` produce the same mask.
 *
 * @example
 *   maskCard('4111111111111111')   // '************1111'
 *   maskCard('4111 1111 1111 1111') // '************1111'
 *   maskCard('123')                  // '***'
 *   maskCard('')                     // ''
 */
export function maskCard(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');

  if (cleaned.length === 0) {
    return '';
  }

  if (cleaned.length <= VISIBLE_TAIL) {
    return '*'.repeat(cleaned.length);
  }

  const tail = cleaned.slice(-VISIBLE_TAIL);
  const masked = '*'.repeat(cleaned.length - VISIBLE_TAIL);

  return `${masked}${tail}`;
}
