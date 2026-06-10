import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;
  const isPublicAuthRequest = req.url.includes('/auth/login')
    || req.url.includes('/auth/refresh')
    || req.url.includes('/auth/forgot-password')
    || req.url.includes('/auth/reset-password');

  if (isPublicAuthRequest || !token || !req.url.startsWith('/api')) {
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

      return auth.refreshSession().pipe(
        switchMap(refreshed => {
          if (!refreshed) {
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
