// TODO: Replace with proper auth (NextAuth/Clerk) before production
import { cookies } from 'next/headers';

const COOKIE_NAME = 'sk_session';
const COOKIE_VALUE = 'authenticated';

const ALLOWED_DOMAINS = ['@sunking.com', '@wallacemecha.com'];

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain));
}

export function verifyPassword(password: string): boolean {
  const appPassword = process.env.SUN_KING_APP_PASSWORD || '4411';
  return password === appPassword;
}

export function setAuthCookie(cookieStore: ReturnType<typeof cookies>): void {
  cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(cookieStore: ReturnType<typeof cookies>): void {
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function isAuthenticated(cookieStore: ReturnType<typeof cookies>): boolean {
  const session = cookieStore.get(COOKIE_NAME);
  return session?.value === COOKIE_VALUE;
}
