import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authService } from '../application/services/auth-service.ts';
import { SESSION_COOKIE_NAME } from '../presentation/security/cookie-constants.ts';

export default async function RootPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get('__Host-boxinn_session')?.value;

  if (sessionToken) {
    const auth = await authService.validateSession(sessionToken);
    if (auth) {
      if (auth.user.role === 'ADMIN') {
        redirect('/admin');
      }
      redirect('/home');
    }
  }

  redirect('/login');
}
