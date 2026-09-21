import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_HEADER } from '@/lib/sessionCookie';

/**
 * Turns a Firebase ID token into an httpOnly session cookie, and drops it again
 * on sign-out.
 *
 * Deliberately NOT under /api: next.config rewrites /api/:path* straight to
 * FastAPI, so a handler there would never run.
 *
 * The ID token arrives from client JavaScript, which is the only place it
 * exists. It is sent on to FastAPI, which verifies it and mints the session
 * cookie; what comes back is written httpOnly so no script - ours or an
 * injected one - can read it afterwards.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Reject a cross-site caller.
 *
 * SameSite=Lax already stops the cookie riding along on a cross-site form
 * post, but this endpoint *sets* a session, so the attack to care about is the
 * reverse: someone POSTing their own token to sign the victim into an account
 * the attacker controls. Same-origin is the whole requirement - the real app
 * always calls this with fetch() from its own pages.
 */
async function sameOrigin(): Promise<boolean> {
  const head = await headers();
  const origin = head.get('origin');
  if (!origin) return false;
  const host = head.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  if (typeof idToken !== 'string' || idToken.length === 0) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
  }

  let minted: { session?: unknown; expires_in?: unknown };
  try {
    const res = await fetch(`${API}/auth/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Pass the refusal through without the body: it is the API's to explain,
      // and forwarding it verbatim would leak its wording to the page.
      return NextResponse.json({ error: 'Could not start a session' }, { status: res.status });
    }
    minted = await res.json();
  } catch {
    return NextResponse.json({ error: 'Could not reach the server' }, { status: 502 });
  }

  if (typeof minted.session !== 'string') {
    return NextResponse.json({ error: 'Could not start a session' }, { status: 502 });
  }

  const maxAge = typeof minted.expires_in === 'number' ? minted.expires_in : 8 * 60 * 60;

  const store = await cookies();
  store.set(SESSION_COOKIE, minted.session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;

  // Ending it everywhere, not just in this browser, is what someone signing
  // out of a shared machine actually wants. A failure here must not block the
  // cookie being dropped, so the result is deliberately ignored.
  if (session) {
    try {
      await fetch(`${API}/auth/session`, {
        method: 'DELETE',
        headers: { [SESSION_HEADER]: session },
        cache: 'no-store',
      });
    } catch {
      // Unreachable API. The cookie still goes.
    }
  }

  store.delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
