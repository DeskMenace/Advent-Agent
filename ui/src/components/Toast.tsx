import { useEffect, useState } from 'preact/hooks';
import { onToast } from '../lib/ui.js';

export function Toast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => onToast(setMessage), []);
  return (
    <div class={`toast${message ? ' show' : ''}`} aria-hidden={!message}>
      {message}
    </div>
  );
}
