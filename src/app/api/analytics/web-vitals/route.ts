import { NextResponse } from 'next/server';
import { z } from 'zod';

export const CORE_WEB_VITALS = ['CLS', 'FID', 'INP', 'LCP'] as const;

export const webVitalSchema = z.object({
  name: z.enum(CORE_WEB_VITALS),
  value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  path: z.string().optional(),
  timestamp: z.number().finite().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const result = webVitalSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
  }

  console.info('[Analytics Stub]', result.data);
  return NextResponse.json({ ok: true, received: result.data }, { status: 202 });
}
