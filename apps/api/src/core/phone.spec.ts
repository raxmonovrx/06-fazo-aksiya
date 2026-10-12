import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['+998901234567', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['+998 90 123-45-67', '+998901234567'],
    ['(90) 123 45 67', '+998901234567'],
    ['8 90 1234567', '+998901234567'],
    ['+79161234567', null],
    ['12345', null],
    ['', null],
    [null, null],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});
