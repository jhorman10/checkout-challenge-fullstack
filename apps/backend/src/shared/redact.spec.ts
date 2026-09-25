import { describe, expect, it } from 'vitest';
import { maskCard } from './redact.js';

describe('maskCard', () => {
  it('masks all digits except the last 4', () => {
    const masked = maskCard('4111111111111111');

    expect(masked).toBe('************1111');
    expect(masked).not.toContain('411111111111');
  });

  it('strips spaces before masking', () => {
    const masked = maskCard('4111 1111 1111 1111');

    expect(masked).toBe('************1111');
  });

  it('strips dashes before masking', () => {
    const masked = maskCard('4111-1111-1111-1111');

    expect(masked).toBe('************1111');
  });

  it('handles 16-digit Visa cards', () => {
    const masked = maskCard('4532015112830366');

    expect(masked).toBe('************0366');
  });

  it('handles 16-digit Mastercard numbers', () => {
    const masked = maskCard('5555555555554444');

    expect(masked).toBe('************4444');
  });

  it('handles 19-digit cards', () => {
    const masked = maskCard('4111111111111111222');

    // 19 digits, last 4 are '1222'
    expect(masked).toBe('***************1222');
    expect(masked.length).toBe(19);
  });

  it('masks short strings of 4 or fewer digits', () => {
    expect(maskCard('1234')).toBe('****');
    expect(maskCard('123')).toBe('***');
    expect(maskCard('12')).toBe('**');
    expect(maskCard('1')).toBe('*');
  });

  it('returns empty string for empty or non-digit input', () => {
    expect(maskCard('')).toBe('');
    expect(maskCard('abcd')).toBe('');
    expect(maskCard('   ')).toBe('');
  });

  it('never exposes more than 4 trailing digits', () => {
    const masked = maskCard('4111111111111111');

    // The full PAN should not appear in the output
    expect(masked).not.toMatch(/4111111111111111/);
    expect(masked).not.toMatch(/1111111111111111/);
  });
});
