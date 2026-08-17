import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Auth Guard: Enforces BOTH authentication AND active license verification.
 * Blocks access to all protected HMS portal routes if license is pending or expired.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const user = auth.currentUser();
  const status = user?.licenseStatus?.toUpperCase();

  // Strict License Guard: If license is pending activation or expired, enforce activation screen
  if (!status || status === 'PENDING_ACTIVATION' || status === 'EXPIRED') {
    return router.createUrlTree(['/activate-license'], {
      queryParams: { returnUrl: state.url, hotelId: user?.hotelId || 1 }
    });
  }

  return true;
};

/**
 * Guest Guard: Prevents logged in users from visiting /login unless signing in with a different account.
 * Redirects unactivated users to /activate-license and activated users to /dashboard.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const user = auth.currentUser();
  const status = user?.licenseStatus?.toUpperCase();

  if (!status || status === 'PENDING_ACTIVATION' || status === 'EXPIRED') {
    return router.createUrlTree(['/activate-license'], {
      queryParams: { hotelId: user?.hotelId || 1 }
    });
  }

  return router.createUrlTree(['/dashboard']);
};
