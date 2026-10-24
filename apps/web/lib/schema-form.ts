export interface Field {
  name: string;
  type: 'integer' | 'number' | 'string' | 'text' | 'boolean' | 'enum';
  required: boolean;
  options?: string[];
}

type PropSchema = { type?: string; enum?: unknown[]; maxLength?: number };

/** Form fields for a tool's JSON Schema (as returned by POST /api/episodes). */
export function fieldsFor(schema: Record<string, unknown>): Field[] {
  const props = (schema.properties ?? {}) as Record<string, PropSchema>;
  const required = new Set((schema.required as string[] | undefined) ?? []);
  return Object.entries(props).map(([name, p]) => {
    const type: Field['type'] = p.enum
      ? 'enum'
      : p.type === 'integer' || p.type === 'number' || p.type === 'boolean'
        ? p.type
        : (p.maxLength ?? 0) > 500
          ? 'text'
          : 'string';
    return { name, type, required: required.has(name), ...(p.enum ? { options: p.enum.map(String) } : {}) };
  });
}

/** Tool arguments from form values: empty optional fields are left out; numbers are converted. */
export function argsFrom(fields: Field[], values: Record<string, string | boolean>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'boolean') {
      if (v === true) out[f.name] = true;
      continue;
    }
    if (v === undefined || v === '' || typeof v === 'boolean') continue;
    out[f.name] = f.type === 'integer' || f.type === 'number' ? Number(v) : v;
  }
  return out;
}

/** A readable message for a failed API call (status 0 = network failure). */
export function describeApiError(status: number, body: unknown): string {
  const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : null;
  if (status === 0) return 'Could not reach the server. Check that it is running and try again.';
  if (status === 404) return 'This episode has expired or does not exist. Start a new one.';
  if (status === 429) return 'Too many requests for now. Wait a minute and try again.';
  if (status === 503) return 'The environment’s database is unavailable right now. Try again shortly.';
  if (status === 400 && message) return message;
  return 'Something went wrong. Try again.';
}
