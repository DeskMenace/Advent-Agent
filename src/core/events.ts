/** In-process event bus for SSE and internal listeners. Payloads are spoiler-free by construction (PublicDoor). */
import { EventEmitter } from 'node:events';
import type { SseEvent } from '../shared/api.js';

export class CalendarEvents extends EventEmitter {
  emitSse(event: SseEvent): void {
    this.emit('sse', event);
  }
  onSse(listener: (event: SseEvent) => void): () => void {
    this.on('sse', listener);
    return () => this.off('sse', listener);
  }
}
