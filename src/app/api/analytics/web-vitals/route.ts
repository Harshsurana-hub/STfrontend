import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  console.info('[Analytics Stub]', payload);
  return NextResponse.json({ ok: true, received: payload }, { status: 202 });
}
