export function log(
  severity: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  payload?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      severity,
      message,
      ...sanitizeLogPayload(payload),
    }),
  );
}

export function sanitizeLogPayload(
  payload?: Record<string, unknown>,
): Record<string, unknown> {
  if (!payload) {
    return {};
  }

  return sanitizeRecord(payload);
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    let message = `${error.name}: ${error.message}`;
    if (error.cause instanceof Error) {
      message += ` (cause: ${error.cause.name}: ${error.cause.message})`;
    }
    return message;
  }

  return String(error);
}

function sanitizeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      sanitizeValue(key, value),
    ]),
  );
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (isRecord(value)) {
    return sanitizeRecord(value);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSensitiveKey(key: string): boolean {
  return /api[_-]?key|token|secret|password|credential|spreadsheet[_-]?id/i.test(
    key,
  );
}
