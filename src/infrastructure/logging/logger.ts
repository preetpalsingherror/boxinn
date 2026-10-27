type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'rawtoken',
  'rawinvitetoken',
  'rawverifytoken',
  'rawresettoken',
  'sessiontoken',
  'sessiontokenhash',
  'tokenhash',
  'cookie',
  'authorization',
  'set-cookie',
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = redact(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO' as LogLevel,
        message,
        ...(meta ? { meta: redact(meta) } : {}),
      })
    );
  },

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN' as LogLevel,
        message,
        ...(meta ? { meta: redact(meta) } : {}),
      })
    );
  },

  error(message: string, err?: unknown, meta?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR' as LogLevel,
        message,
        error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
        ...(meta ? { meta: redact(meta) } : {}),
      })
    );
  },
};
