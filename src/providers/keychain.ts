/**
 * Provider keys live in the OS keychain only (D9, GIFT_WORKSHOP §5). @napi-rs/keyring is optional:
 * when it cannot be loaded, keys are not stored anywhere and the UI explains why. Never plaintext.
 */
const SERVICE = 'advent-agent';

type KeyringModule = { Entry: new (service: string, account: string) => { setPassword(p: string): void; getPassword(): string | null; deletePassword(): boolean } };

let mod: KeyringModule | null | undefined;

async function loadKeyring(): Promise<KeyringModule | null> {
  if (mod !== undefined) return mod;
  try {
    mod = (await import('@napi-rs/keyring')) as unknown as KeyringModule;
  } catch {
    mod = null;
  }
  return mod;
}

export async function keychainAvailable(): Promise<boolean> {
  return (await loadKeyring()) !== null;
}

export async function setProviderKey(providerId: string, key: string): Promise<{ ok: boolean; message: string }> {
  const k = await loadKeyring();
  if (!k) return { ok: false, message: 'The OS keychain module is not available on this installation, so the key was not stored anywhere. Keys are never written to disk in plain text.' };
  try {
    new k.Entry(SERVICE, providerId).setPassword(key);
    return { ok: true, message: 'Stored in your OS keychain.' };
  } catch (e) {
    return { ok: false, message: `The keychain refused: ${(e as Error).message}` };
  }
}

export async function getProviderKey(providerId: string): Promise<string | undefined> {
  const k = await loadKeyring();
  if (!k) return undefined;
  try {
    return new k.Entry(SERVICE, providerId).getPassword() ?? undefined;
  } catch {
    return undefined;
  }
}

export async function deleteProviderKey(providerId: string): Promise<{ ok: boolean; message: string }> {
  const k = await loadKeyring();
  if (!k) return { ok: true, message: 'No keychain available; nothing was stored.' };
  try {
    new k.Entry(SERVICE, providerId).deletePassword();
    return { ok: true, message: 'Removed from your keychain.' };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** All stored key values for the secret scanner (so a key can never end up inside a gift). */
export async function allProviderKeyValues(providerIds: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of providerIds) {
    const v = await getProviderKey(id);
    if (v) out.push(v);
  }
  return out;
}
