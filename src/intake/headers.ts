/** Response headers for anything served from the gift origin (ARCHITECTURE §8). */
import { APP_PORT } from '../core/paths.js';

export function giftOriginHeaders(frameAncestor = `http://127.0.0.1:${APP_PORT}`, consentedOrigins: string[] = []): Record<string, string> {
  const extra = consentedOrigins.length ? ' ' + consentedOrigins.join(' ') : '';
  const csp = [
    `default-src 'self' data: blob:${extra}`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:${extra}`,
    `style-src 'self' 'unsafe-inline' data: blob:${extra}`,
    `img-src 'self' data: blob:${extra}`,
    `media-src 'self' data: blob:${extra}`,
    `font-src 'self' data: blob:${extra}`,
    `connect-src ${consentedOrigins.length ? consentedOrigins.join(' ') : "'none'"}`,
    `frame-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `form-action 'none'`,
    `base-uri 'self'`,
    `frame-ancestors ${frameAncestor}`,
  ].join('; ');
  return {
    'content-security-policy': csp,
    'cross-origin-resource-policy': 'same-site',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'private, max-age=0, must-revalidate',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}
