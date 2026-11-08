/**
 * Auth for the app origin (ARCHITECTURE §3, §6, §9):
 * - one-time login tokens → HttpOnly SameSite=Strict session cookie signed with session.key
 * - Bearer api.token for CLI / MCP / HTTP submissions
 * - Host and Origin checks on every request
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'aa_session';
const SESSION_DAYS = 400;

export class Auth {
  private loginTokens = new Map<string, number>();

  constructor(private readonly sessionKey: string, private readonly apiToken: string, private readonly appPort: number) {}

  allowedHosts(): Set<string> {
    return new Set([`127.0.0.1:${this.appPort}`, `localhost:${this.appPort}`, `[::1]:${this.appPort}`]);
  }

  allowedOrigins(): Set<string> {
    return new Set([`http://127.0.0.1:${this.appPort}`, `http://localhost:${this.appPort}`, `http://[::1]:${this.appPort}`]);
  }

  hostOk(host: string | undefined): boolean {
    return Boolean(host) && this.allowedHosts().has(host!.toLowerCase());
  }

  /** No Origin header (same-origin GET, curl) is fine; a present Origin must be ours. */
  originOk(origin: string | undefined): boolean {
    if (!origin || origin === 'null') return origin !== 'null';
    return this.allowedOrigins().has(origin.toLowerCase());
  }

  issueLoginToken(): string {
    this.sweep();
    const t = randomBytes(24).toString('base64url');
    this.loginTokens.set(t, Date.now() + 2 * 60_000);
    return t;
  }

  consumeLoginToken(t: string | undefined): boolean {
    this.sweep();
    if (!t) return false;
    const exp = this.loginTokens.get(t);
    if (!exp) return false;
    this.loginTokens.delete(t);
    return exp > Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [t, exp] of this.loginTokens) if (exp <= now) this.loginTokens.delete(t);
  }

  makeSessionCookieValue(): string {
    const exp = Date.now() + SESSION_DAYS * 86_400_000;
    const payload = `${exp}`;
    return `${payload}.${this.sign(payload)}`;
  }

  sessionCookieHeader(): string {
    return `${SESSION_COOKIE}=${this.makeSessionCookieValue()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86_400}`;
  }

  verifySessionCookie(cookieHeader: string | undefined): boolean {
    if (!cookieHeader) return false;
    const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (!match) return false;
    const value = match.slice(SESSION_COOKIE.length + 1);
    const dot = value.lastIndexOf('.');
    if (dot <= 0) return false;
    const payload = value.slice(0, dot);
    const sig = value.slice(dot + 1);
    if (!safeEqual(sig, this.sign(payload))) return false;
    return Number(payload) > Date.now();
  }

  verifyBearer(authorization: string | undefined): boolean {
    if (!authorization) return false;
    const m = authorization.match(/^Bearer\s+(.+)$/i);
    return Boolean(m && safeEqual(m[1]!.trim(), this.apiToken));
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.sessionKey).update(payload).digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
