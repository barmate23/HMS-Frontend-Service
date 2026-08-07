import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

let refreshRequest$: Observable<boolean> | null = null;

/** Returns true if the response body signals an expired/invalid token (HTTP 200 with error payload). */
function isUnauthorizedBody(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  if (body.success === false) {
    const code    = String(body.error?.code      || '').toUpperCase();
    const msg     = String(body.message          || body.error?.message || '').toLowerCase();
    const details = String(body.error?.details   || '').toLowerCase();
    return (
      code    === 'AUTH_UNAUTHORIZED'                  ||
      msg.includes('unauthorized')                     ||
      details.includes('invalid or expired token')
    );
  }
  return false;
}

/** Returns true for any HTTP-level or body-level unauthorized signal. */
function isUnauthorizedError(error: any): boolean {
  if (error?.status === 401 || error?.status === 403) return true;
  return isUnauthorizedBody(error?.error);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const apiPath           = apiUrlPath(req.url);
  const isApiRequest      = apiPath.startsWith('/api/');
  const isPublicAuthPath  = [
    '/api/hmsUserService/v1/auth/login',
    '/api/hmsUserService/v1/auth/refresh',
    '/api/hmsUserService/v1/auth/change-password',
    '/api/hmsUserService/v1/auth/forgot-password',
    '/api/hmsUserService/v1/auth/verify-reset-code',
    '/api/hmsUserService/v1/auth/reset-password'
  ].some(path => apiPath === path);

  if (isPublicAuthPath || !isApiRequest) {
    return next(req);
  }

  const token = auth.accessToken;
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `${auth.tokenType} ${token}` } })
    : req;

  const redirectToLogin = () => {
    auth.clearSession();
    router.navigate(['/login']);
  };

  return next(authorizedReq).pipe(
    // Intercept HTTP-200 responses that carry an unauthorized error in the body
    map((event: HttpEvent<any>) => {
      if (event instanceof HttpResponse && isUnauthorizedBody(event.body)) {
        redirectToLogin();
        throw new Error('Session expired. Redirecting to login.');
      }
      return event;
    }),

    catchError(error => {
      if (!isUnauthorizedError(error)) {
        // Not auth-related — let the error propagate normally
        return throwError(() => error);
      }

      // No refresh token available → go straight to login
      if (!auth.refreshToken) {
        redirectToLogin();
        return throwError(() => error);
      }

      // Attempt a token refresh (deduplicated across concurrent requests)
      if (!refreshRequest$) {
        refreshRequest$ = auth.refreshSession().pipe(
          finalize(() => refreshRequest$ = null),
          shareReplay({ bufferSize: 1, refCount: false })
        );
      }

      return refreshRequest$.pipe(
        switchMap(refreshed => {
          if (!refreshed) {
            redirectToLogin();
            return throwError(() => error);
          }
          // Retry with the fresh token
          return next(req.clone({
            setHeaders: { Authorization: `${auth.tokenType} ${auth.accessToken}` }
          }));
        }),
        catchError(refreshErr => {
          redirectToLogin();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};

function apiUrlPath(url: string): string {
  if (url.startsWith('/')) return url.split('?')[0];
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}
