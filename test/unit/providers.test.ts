import { describe, expect, it } from 'vitest';
import { ProviderRefused, runProvider, getProviderAdapter } from '../../src/providers/index.js';
import type { Provider } from '../../src/shared/config.js';

const base: Provider = { id: 'img', kind: 'image', adapter: 'openai-compatible-image', label: 'Images', enabled: true, paidUse: true, capPerGift: { amount: 1, currency: 'USD' }, capSeason: { amount: 5, currency: 'USD' }, hasKey: true };
const spend = { spentSeason: 0, spentGift: 0 };

describe('provider gate (D9)', () => {
  it('refuses when disabled, paid use off, no cap, over caps, unknown adapter', async () => {
    await expect(runProvider(undefined, 'generateImage', {}, spend, 0.04)).rejects.toMatchObject({ code: 'no_provider' });
    await expect(runProvider({ ...base, enabled: false }, 'generateImage', {}, spend, 0.04)).rejects.toMatchObject({ code: 'disabled' });
    await expect(runProvider({ ...base, paidUse: false }, 'generateImage', {}, spend, 0.04)).rejects.toMatchObject({ code: 'paid_use_off' });
    await expect(runProvider({ ...base, capPerGift: undefined }, 'generateImage', {}, spend, 0.04)).rejects.toMatchObject({ code: 'no_cap' });
    await expect(runProvider(base, 'generateImage', {}, { spentSeason: 0, spentGift: 0.99 }, 0.04)).rejects.toMatchObject({ code: 'cap_gift' });
    await expect(runProvider(base, 'generateImage', {}, { spentSeason: 4.99, spentGift: 0 }, 0.04)).rejects.toMatchObject({ code: 'cap_season' });
    await expect(runProvider({ ...base, adapter: 'nope' }, 'generateImage', {}, spend, 0.04)).rejects.toMatchObject({ code: 'no_adapter' });
    await expect(runProvider(base, 'generateAudio', {}, spend, 0.04)).rejects.toMatchObject({ code: 'unsupported' });
    // Without a keychain entry the call stops before any network request.
    await expect(runProvider(base, 'generateImage', {}, spend, 0.04)).rejects.toBeInstanceOf(ProviderRefused);
  });
  it('ships the reference OpenAI-compatible image adapter', () => {
    const a = getProviderAdapter('openai-compatible-image');
    expect(a?.kind).toBe('image');
    expect(typeof a?.generateImage).toBe('function');
    expect(a?.dataSent).toMatch(/prompt/);
  });
});
