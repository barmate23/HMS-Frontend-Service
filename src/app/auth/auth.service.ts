import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  initials: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  requiresPasswordChange?: boolean;
  identifier?: string;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  resetCode?: string;
}

interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message?: string;
    details?: string;
  };
}

interface ApiAuthUser {
  id: number;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  roleCode?: string;
}

interface ApiAuthResponse {
  tokenType?: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
  refreshExpiresAt?: string;
  user: ApiAuthUser;
  firstLogin?: boolean;
  mustChangePassword?: boolean;
  passwordChangeRequired?: boolean;
  requiresPasswordChange?: boolean;
  temporaryPassword?: boolean;
}

interface PasswordResetInitResponse {
  email?: string;
  expiresAt?: string;
  resetCode?: string;
  deliveryMode?: string;
}

interface PasswordChangeResponse {
  email?: string;
  username?: string;
}

interface StoredAuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt?: number;
  refreshExpiresAt?: string;
}

const SESSION_KEY = 'hms-auth-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authBaseUrl = '/api/hmsUserService/v1/auth';
  private readonly currentSessionState = signal<StoredAuthSession | null>(this.readSession());

  readonly currentUser = computed(() => this.currentSessionState()?.user || null);
  readonly isAuthenticated = computed(() => !!this.currentSessionState()?.accessToken);

  get accessToken(): string {
    return this.currentSessionState()?.accessToken || '';
  }

  get tokenType(): string {
    return this.currentSessionState()?.tokenType || 'Bearer';
  }

  get refreshToken(): string {
    return this.currentSessionState()?.refreshToken || '';
  }

  login(identifier: string, password: string, remember: boolean): Observable<LoginResult> {
    const normalizedIdentifier = identifier.trim();
    return this.http.post<StandardResponse<ApiAuthResponse>>(`${this.authBaseUrl}/login`, {
      identifier: normalizedIdentifier,
      password,
      rememberMe: remember
    }).pipe(
      tap(response => {
        if (response.success && response.data && !this.requiresPasswordChange(response.data)) {
          this.storeSession(response.data, remember);
        }
      }),
      map(response => ({
        success: !!response.success && !!response.data,
        message: response.success ? '' : this.responseMessage(response, 'Unable to sign in.'),
        requiresPasswordChange: this.requiresPasswordChange(response.data),
        identifier: normalizedIdentifier
      })),
      catchError(error => of({
        success: false,
        message: this.errorMessage(error, 'Invalid username or password.'),
        requiresPasswordChange: this.errorRequiresPasswordChange(error),
        identifier: normalizedIdentifier
      }))
    );
  }

  refreshSession(): Observable<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) return of(false);

    return this.http.post<StandardResponse<ApiAuthResponse>>(`${this.authBaseUrl}/refresh`, { refreshToken }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.storeSession(response.data, this.isRememberedSession());
        }
      }),
      map(response => !!response.success && !!response.data),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  logout(): void {
    const token = this.accessToken;
    const tokenType = this.tokenType;
    this.clearSession();
    if (!token) return;

    this.http.post<StandardResponse<void>>(`${this.authBaseUrl}/logout`, {}, {
      headers: {
        Authorization: `${tokenType} ${token}`
      }
    }).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  forgotPassword(email: string): Observable<RecoveryResult> {
    return this.http.post<StandardResponse<PasswordResetInitResponse>>(`${this.authBaseUrl}/forgot-password`, {
      email: email.trim()
    }).pipe(
      map(response => ({
        success: !!response.success,
        message: response.message || 'Password reset code generated.',
        resetCode: response.data?.resetCode
      })),
      catchError(error => of({
        success: false,
        message: this.errorMessage(error, 'Unable to generate password reset code.')
      }))
    );
  }

  verifyResetCode(email: string, resetCode: string): Observable<LoginResult> {
    return this.http.post<StandardResponse<void>>(`${this.authBaseUrl}/verify-reset-code`, {
      email: email.trim(),
      resetCode: resetCode.trim()
    }).pipe(
      map(response => ({
        success: !!response.success,
        message: response.message || 'Reset code verified successfully.'
      })),
      catchError(error => of({
        success: false,
        message: this.errorMessage(error, 'Reset code is invalid or expired.')
      }))
    );
  }

  resetPassword(email: string, resetCode: string, newPassword: string): Observable<LoginResult> {
    return this.http.post<StandardResponse<void>>(`${this.authBaseUrl}/reset-password`, {
      email: email.trim(),
      resetCode: resetCode.trim(),
      newPassword
    }).pipe(
      map(response => ({
        success: !!response.success,
        message: response.message || 'Password reset successful.'
      })),
      catchError(error => of({
        success: false,
        message: this.errorMessage(error, 'Unable to reset password.')
      }))
    );
  }

  changeFirstLoginPassword(identifier: string, currentPassword: string, newPassword: string): Observable<LoginResult> {
    return this.http.post<StandardResponse<PasswordChangeResponse>>(`${this.authBaseUrl}/change-password`, {
      identifier: identifier.trim(),
      currentPassword,
      temporaryPassword: currentPassword,
      newPassword,
      confirmPassword: newPassword
    }).pipe(
      map(response => ({
        success: !!response.success,
        message: response.message || 'Password updated successfully.'
      })),
      catchError(error => of({
        success: false,
        message: this.errorMessage(error, 'Unable to update password.')
      }))
    );
  }

  private storeSession(auth: ApiAuthResponse, remember: boolean): void {
    const session: StoredAuthSession = {
      user: this.mapUser(auth.user),
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      tokenType: auth.tokenType || 'Bearer',
      expiresAt: auth.expiresInSeconds ? Date.now() + auth.expiresInSeconds * 1000 : undefined,
      refreshExpiresAt: auth.refreshExpiresAt
    };

    this.currentSessionState.set(session);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    if (remember) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this.currentSessionState.set(null);
  }

  private readSession(): StoredAuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredAuthSession;
      return parsed?.accessToken && parsed?.user?.email ? parsed : null;
    } catch {
      return null;
    }
  }

  private isRememberedSession(): boolean {
    return !!localStorage.getItem(SESSION_KEY);
  }

  private mapUser(user: ApiAuthUser): AuthUser {
    const fullName = user.fullName || user.username || user.email || 'HMS User';
    return {
      id: Number(user.id),
      fullName,
      email: user.email || '',
      role: user.role || user.roleCode || 'Hotel Staff',
      initials: this.initials(fullName)
    };
  }

  private requiresPasswordChange(auth?: ApiAuthResponse): boolean {
    return !!(auth?.firstLogin || auth?.mustChangePassword || auth?.passwordChangeRequired || auth?.requiresPasswordChange || auth?.temporaryPassword);
  }

  private errorRequiresPasswordChange(error: any): boolean {
    const code = `${error?.error?.error?.code || error?.error?.code || ''}`.toUpperCase();
    const message = this.errorMessage(error, '').toLowerCase();
    return code.includes('FIRST_LOGIN') ||
      code.includes('PASSWORD_CHANGE') ||
      message.includes('first login') ||
      message.includes('change password') ||
      message.includes('temporary password') ||
      message.includes('default password');
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HM';
  }

  private responseMessage<T>(response: StandardResponse<T>, fallback: string): string {
    return response.message || response.error?.message || response.error?.details || fallback;
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.message || error?.error?.error?.message || error?.error?.error?.details || error?.message || fallback;
  }
}
