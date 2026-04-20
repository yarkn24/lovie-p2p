import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const response = NextResponse.next();
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          return response;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (!user && request.nextUrl.pathname.startsWith('/requests')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (user && (request.nextUrl.pathname === '/auth/login' || request.nextUrl.pathname === '/auth/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/requests/:path*', '/auth/:path*'],
};
