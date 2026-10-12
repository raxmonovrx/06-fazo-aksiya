import { signInitData, validateInitData } from './init-data.js';

const TOKEN = '123456:ABCDEF_test_token_value_xxxxx';
const now = Date.UTC(2026, 9, 15, 12, 0, 0);
const user = JSON.stringify({ id: 42, first_name: 'Ali', username: 'ali' });

describe('validateInitData', () => {
  it('to\'g\'ri imzo', () => {
    const raw = signInitData({ auth_date: String(now / 1000 - 60), query_id: 'AAH', user }, TOKEN);
    const res = validateInitData(raw, TOKEN, 86400, now);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.user.id).toBe(42);
  });

  it('signature maydoni bilan (yangi klientlar)', () => {
    const raw = signInitData({ auth_date: String(now / 1000 - 60), signature: 'abc', user }, TOKEN);
    expect(validateInitData(raw, TOKEN, 86400, now).ok).toBe(true);
  });

  it('boshqa token bilan imzolangan → BAD_HASH', () => {
    const raw = signInitData({ auth_date: String(now / 1000), user }, '999:other');
    expect(validateInitData(raw, TOKEN, 86400, now)).toEqual({ ok: false, error: 'BAD_HASH' });
  });

  it('o\'zgartirilgan user → BAD_HASH', () => {
    const raw = signInitData({ auth_date: String(now / 1000), user }, TOKEN).replace('42', '43');
    expect(validateInitData(raw, TOKEN, 86400, now)).toEqual({ ok: false, error: 'BAD_HASH' });
  });

  it('24 soatdan eski → EXPIRED', () => {
    const raw = signInitData({ auth_date: String(now / 1000 - 86401), user }, TOKEN);
    expect(validateInitData(raw, TOKEN, 86400, now)).toEqual({ ok: false, error: 'EXPIRED' });
  });

  it('bo\'sh → MISSING; user yo\'q → NO_USER', () => {
    expect(validateInitData('', TOKEN)).toEqual({ ok: false, error: 'MISSING' });
    const raw = signInitData({ auth_date: String(now / 1000) }, TOKEN);
    expect(validateInitData(raw, TOKEN, 86400, now)).toEqual({ ok: false, error: 'NO_USER' });
  });
});
