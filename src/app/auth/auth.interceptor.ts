import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

let refreshRequest$: Observable<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken;
  const apiPath = apiUrlPath(req.url);
  const isApiRequest = apiPath.startsWith('/api/');
  const isPublicAuthRequest = [
    '/api/hmsUserService/v1/auth/login',
    '/api/hmsUserService/v1/auth/refresh',
    '/api/hmsUserService/v1/auth/change-password',
    '/api/hmsUserService/v1/auth/forgot-password',
    '/api/hmsUserService/v1/auth/verify-reset-code',
    '/api/hmsUserService/v1/auth/reset-password'
  ].some(path => apiPath === path);

  if (isPublicAuthRequest || !token || !isApiRequest) {
    return next(req);
  }

  const authorizedRequest = req.clone({
    setHeaders: {
      Authorization: `${auth.tokenType} ${token}`
    }
  });

  return next(authorizedRequest).pipe(
    catchError(error => {
      if (error?.status !== 401 || !auth.refreshToken) {
        return throwError(() => error);
      }

      if (!refreshRequest$) {
        refreshRequest$ = auth.refreshSession().pipe(
          finalize(() => refreshRequest$ = null),
          shareReplay({ bufferSize: 1, refCount: false })
        );
      }

      return refreshRequest$.pipe(
        switchMap(refreshed => {
          if (!refreshed) {
            router.navigate(['/login']);
            return throwError(() => error);
          }

          return next(req.clone({
            setHeaders: {
              Authorization: `${auth.tokenType} ${auth.accessToken}`
            }
          }));
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
