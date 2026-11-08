// kit/maker/storage.js — local-only storage wrapper with in-memory fallback (gifts run on an opaque origin; localStorage may throw).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createStorage } from './storage.js';
//   const store = createStorage('door-7');               // namespace; keys become "door-7:<key>"
//   store.set('habits', { mon: true });                  // JSON-serialised; never throws
//   store.get('habits', {})  → { mon: true }             // default when missing or unparsable
//   store.remove('habits'); store.clear(); store.keys()  → ['habits']
//   store.persistent  → false when running in memory only (tell the recipient: "resets when you close this page")
//   store.exportJSON() → string of everything in the namespace; store.importJSON(str) merges
//   store.subscribe((key, value) => …)                   // called on set/remove in this tab
//   // Why: sandboxed gift iframes have an opaque origin; accessing window.localStorage can throw a SecurityError.
//   // Everything stays on the device. Nothing is sent anywhere.

export function createStorage(namespace = 'gift', { backend } = {}) {
  const prefix = namespace + ':'; const mem = new Map(); const subs = new Set(); let ls = backend === undefined ? detect() : backend;
  function detect() { try { const s = globalThis.localStorage; if (!s) return null; const k = '__kit_probe__'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; } }
  const api = {
    get persistent() { return !!ls; },
    get(key, fallback = null) { try { const raw = ls ? ls.getItem(prefix + key) : mem.get(prefix + key); if (raw == null) return fallback; return JSON.parse(raw); } catch { return fallback; } },
    set(key, value) { let raw; try { raw = JSON.stringify(value); } catch { return false; } try { if (ls) ls.setItem(prefix + key, raw); else mem.set(prefix + key, raw); } catch { ls = null; mem.set(prefix + key, raw); } for (const fn of subs) fn(key, value); return true; },
    remove(key) { try { if (ls) ls.removeItem(prefix + key); } catch {} mem.delete(prefix + key); for (const fn of subs) fn(key, undefined); },
    keys() { const out = new Set(); try { if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(prefix)) out.add(k.slice(prefix.length)); } } catch {} for (const k of mem.keys()) if (k.startsWith(prefix)) out.add(k.slice(prefix.length)); return [...out]; },
    clear() { for (const k of api.keys()) api.remove(k); },
    exportJSON() { const o = {}; for (const k of api.keys()) o[k] = api.get(k); return JSON.stringify(o, null, 2); },
    importJSON(str) { try { const o = JSON.parse(str); if (!o || typeof o !== 'object') return 0; let n = 0; for (const [k, v] of Object.entries(o)) { api.set(k, v); n++; } return n; } catch { return 0; } },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
}
