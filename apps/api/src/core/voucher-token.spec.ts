import { newVoucherToken, parseVoucherToken } from './voucher-token.js';

describe('voucher token', () => {
  it('22 belgili, noyob, Telegram start alifbosida', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newVoucherToken()));
    expect(set.size).toBe(1000);
    for (const t of set) expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(`v_${[...set][0]}`.length).toBeLessThanOrEqual(64);
  });

  it('turli ko\'rinishdagi havolalardan token ajratadi', () => {
    const t = 'AbCdEfGhIjKlMnOpQrSt_-';
    expect(parseVoucherToken(`v_${t}`)).toBe(t);
    expect(parseVoucherToken(`/start v_${t}`)).toBe(t);
    expect(parseVoucherToken(`https://t.me/FazoClub_bot?start=v_${t}`)).toBe(t);
    expect(parseVoucherToken(`tg://resolve?domain=FazoClub_bot&start=v_${t}`)).toBe(t);
  });

  it('noto\'g\'ri, qisqa yoki begona havolani rad etadi', () => {
    expect(parseVoucherToken('')).toBeNull();
    expect(parseVoucherToken('v_short')).toBeNull();
    expect(parseVoucherToken('https://evil.uz/?start=v_AbCdEfGhIjKlMnOpQrSt_-')).toBeNull();
    expect(parseVoucherToken('https://t.me/FazoClub_bot?start=ref_ABC123')).toBeNull();
    expect(parseVoucherToken('https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930')).toBeNull();
    expect(parseVoucherToken('v_AbCdEfGhIjKlMnOpQrSt_-x')).toBeNull();
  });
});
