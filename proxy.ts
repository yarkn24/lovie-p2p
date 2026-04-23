import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { unauthorized } from '@/lib/errors';

// H9: whitelist auth paths; protect every other page by default.
const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/callback', '/auth/confirm', '/auth/confirmed', '/auth/complete-profile'];
const PUBLIC_API_PATHS = ['/api/auth/check-email', '/api/auth/user', '/api/auth/logout'];

function isPublic(pathname: string): boolean {
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (/^\/requests\/[^/]+\/share$/.test(pathname)) return true;
  // Request detail pages — anonymous users see a public preview with sign-in/up CTAs.
  if (/^\/requests\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/payment-requests\/[^/]+\/preview$/.test(pathname)) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // API routes return 401 JSON; pages redirect to login
    if (pathname.startsWith('/api/')) return unauthorized();
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If user is authenticated but has no profile row, kick them out. A deleted
  // user must not be able to view protected pages just because their JWT is
  // still valid. `/auth/*` paths are whitelisted so the user can log in/out.
  if (user && !isPublic(pathname)) {
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      if (pathname.startsWith('/api/')) return unauthorized();
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('error', 'Account+no+longer+exists');
      return NextResponse.redirect(loginUrl);
    }
  }

  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
