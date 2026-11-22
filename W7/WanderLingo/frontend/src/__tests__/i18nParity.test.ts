import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { vi } from '../i18n/vi';

describe('EN / VI Localization Key Parity', () => {
  it('has identical translation keys and non-empty strings in both English and Vietnamese', () => {
    const enKeys = Object.keys(en).sort();
    const viKeys = Object.keys(vi).sort();
    expect(viKeys).toEqual(enKeys);

    for (const key of enKeys) {
      const k = key as keyof typeof en;
      expect(en[k].trim().length).toBeGreaterThan(0);
      expect(vi[k].trim().length).toBeGreaterThan(0);
    }
  });
});
