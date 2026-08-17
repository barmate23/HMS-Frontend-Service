import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
}

export interface ClientOnboardingRequest {
  hotelName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  totalRooms: number;
  tier?: string;
  validityMonths?: number;
  portalUrl?: string;
  adminFullName: string;
  adminUsername: string;
  adminEmail?: string;
  adminPhone?: string;
  customAdminPassword?: string;
}

export interface ClientOnboardingResponse {
  hotelId: number;
  hotelName: string;
  hotelEmail: string;
  adminUserId: number;
  adminFullName: string;
  adminUsername: string;
  adminEmail: string;
  temporaryPassword?: string;
  licenseKey: string;
  licenseStatus: string;
  tier: string;
  maxRooms: number;
  maxUsers: number;
  enabledModules: string;
  issuedAt: string;
  expiresAt: string;
  portalUrl: string;
  emailSent: boolean;
  message?: string;
}

export interface ActivateLicenseRequest {
  hotelId?: number;
  licenseKey: string;
}

export interface RenewLicenseRequest {
  hotelId: number;
  validityMonths?: number;
  newTier?: string;
  newMaxRooms?: number;
  newMaxUsers?: number;
}

export interface LicenseStatusResponse {
  hotelId: number;
  hotelName: string;
  clientEmail: string;
  licenseKey: string;
  status: string;
  isActive: boolean;
  tier: string;
  maxRooms: number;
  maxUsers: number;
  enabledModules: string[];
  issuedAt: string;
  activatedAt?: string;
  expiresAt: string;
  daysRemaining: number;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/hmsUserService/v1/licenses';

  onboardClient(request: ClientOnboardingRequest): Observable<StandardResponse<ClientOnboardingResponse>> {
    return this.http.post<StandardResponse<ClientOnboardingResponse>>(`${this.baseUrl}/onboard-client`, request).pipe(
      catchError(error => of({
        success: false,
        message: this.extractError(error, 'Failed to onboard client hotel.')
      }))
    );
  }

  activateLicense(request: ActivateLicenseRequest): Observable<StandardResponse<LicenseStatusResponse>> {
    return this.http.post<StandardResponse<LicenseStatusResponse>>(`${this.baseUrl}/activate`, request).pipe(
      catchError(error => of({
        success: false,
        message: this.extractError(error, 'License activation failed.')
      }))
    );
  }

  renewLicense(request: RenewLicenseRequest): Observable<StandardResponse<LicenseStatusResponse>> {
    return this.http.post<StandardResponse<LicenseStatusResponse>>(`${this.baseUrl}/renew`, request).pipe(
      catchError(error => of({
        success: false,
        message: this.extractError(error, 'Subscription renewal failed.')
      }))
    );
  }

  getLicenseStatus(hotelId: number): Observable<StandardResponse<LicenseStatusResponse>> {
    return this.http.get<StandardResponse<LicenseStatusResponse>>(`${this.baseUrl}/status/${hotelId}`).pipe(
      catchError(error => of({
        success: false,
        message: this.extractError(error, 'Unable to fetch license status.')
      }))
    );
  }

  validateLicenseKey(key: string): Observable<StandardResponse<LicenseStatusResponse>> {
    return this.http.get<StandardResponse<LicenseStatusResponse>>(`${this.baseUrl}/validate`, {
      params: { key: key.trim() }
    }).pipe(
      catchError(error => of({
        success: false,
        message: this.extractError(error, 'License key validation failed.')
      }))
    );
  }

  private extractError(error: any, fallback: string): string {
    return error?.error?.message || error?.error?.error?.message || error?.error?.error?.details || error?.message || fallback;
  }
}
