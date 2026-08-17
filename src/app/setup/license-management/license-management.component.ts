import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  ActivateLicenseRequest,
  ClientOnboardingRequest,
  ClientOnboardingResponse,
  LicenseService,
  LicenseStatusResponse,
  RenewLicenseRequest
} from '../license.service';

@Component({
  selector: 'app-license-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './license-management.component.html',
  styleUrls: ['./license-management.component.css']
})
export class LicenseManagementComponent implements OnInit {
  private readonly licenseService = inject(LicenseService);

  // State Signals
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly activeTab = signal<'STATUS' | 'ONBOARDING' | 'RENEWAL'>('STATUS');
  readonly currentLicense = signal<LicenseStatusResponse | null>(null);

  // Modals
  readonly isActivateModalOpen = signal(false);
  readonly isRenewModalOpen = signal(false);
  readonly isOnboardModalOpen = signal(false);

  // Activate Form
  activationKey = '';

  // Renew Form
  renewHotelId = 1;
  renewMonths = 12;
  renewTier = 'PROFESSIONAL';
  renewRooms = 50;

  // Onboarding Form
  onboardData: ClientOnboardingRequest = {
    hotelName: '',
    email: '',
    phone: '',
    address: '127 Grand Avenue',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    zipCode: '10001',
    totalRooms: 50,
    tier: 'PROFESSIONAL',
    validityMonths: 12,
    portalUrl: 'https://hms.cloud.app',
    adminFullName: '',
    adminUsername: '',
    adminEmail: '',
    adminPhone: ''
  };

  // Last Onboarding Result
  readonly lastOnboardResult = signal<ClientOnboardingResponse | null>(null);

  ngOnInit(): void {
    this.loadLicenseStatus(1); // Default hotel ID 1
  }

  loadLicenseStatus(hotelId: number = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.licenseService.getLicenseStatus(hotelId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.currentLicense.set(res.data);
        } else {
          // Provide default demo status if backend service isn't active
          this.currentLicense.set({
            hotelId: 1,
            hotelName: 'Grand Horizon Resort & Spa',
            clientEmail: 'admin@grandhorizon.com',
            licenseKey: 'HMS-LIC-A8F2-99C1-4B2E',
            status: 'ACTIVE',
            isActive: true,
            tier: 'PROFESSIONAL',
            maxRooms: 120,
            maxUsers: 25,
            enabledModules: ['RESERVATIONS', 'ARRIVALS_DEPARTURES', 'GUEST_PROFILES', 'HOUSEKEEPING', 'BILLING', 'LAUNDRY', 'POS', 'REPORTS'],
            issuedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
            activatedAt: new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 335 * 24 * 3600 * 1000).toISOString(),
            daysRemaining: 335,
            message: 'Active Enterprise Subscription'
          });
        }
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  openActivateModal(): void {
    this.activationKey = '';
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isActivateModalOpen.set(true);
  }

  closeActivateModal(): void {
    this.isActivateModalOpen.set(false);
  }

  onActivateLicense(): void {
    if (!this.activationKey.trim()) {
      this.errorMessage.set('Please enter a valid License Key.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const req: ActivateLicenseRequest = {
      hotelId: this.currentLicense()?.hotelId || 1,
      licenseKey: this.activationKey.trim()
    };

    this.licenseService.activateLicense(req).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success && res.data) {
          this.currentLicense.set(res.data);
          this.successMessage.set(res.message || 'License activated successfully!');
          this.closeActivateModal();
        } else {
          this.errorMessage.set(res.message || 'Failed to activate license key.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Error activating license key.');
      }
    });
  }

  openRenewModal(): void {
    if (this.currentLicense()) {
      this.renewHotelId = this.currentLicense()!.hotelId;
      this.renewTier = this.currentLicense()!.tier;
      this.renewRooms = this.currentLicense()!.maxRooms;
    }
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isRenewModalOpen.set(true);
  }

  closeRenewModal(): void {
    this.isRenewModalOpen.set(false);
  }

  onRenewLicense(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const req: RenewLicenseRequest = {
      hotelId: this.renewHotelId,
      validityMonths: this.renewMonths,
      newTier: this.renewTier,
      newMaxRooms: this.renewRooms
    };

    this.licenseService.renewLicense(req).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success && res.data) {
          this.currentLicense.set(res.data);
          this.successMessage.set(res.message || 'Subscription renewed successfully!');
          this.closeRenewModal();
        } else {
          this.errorMessage.set(res.message || 'Failed to renew license.');
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Error renewing license.');
      }
    });
  }

  openOnboardModal(): void {
    this.lastOnboardResult.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isOnboardModalOpen.set(true);
  }

  closeOnboardModal(): void {
    this.isOnboardModalOpen.set(false);
  }

  onOnboardClient(): void {
    if (!this.onboardData.hotelName || !this.onboardData.email || !this.onboardData.adminUsername) {
      this.errorMessage.set('Please fill out all required fields marked with *');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.licenseService.onboardClient(this.onboardData).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success && res.data) {
          this.lastOnboardResult.set(res.data);
          this.successMessage.set('Client hotel onboarded successfully! License & credentials sent via email.');
        } else {
          this.errorMessage.set(res.message || 'Failed to onboard client.');
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Error submitting onboarding request.');
      }
    });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
    this.successMessage.set('Copied to clipboard!');
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  getStatusClass(status?: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'badge-active';
      case 'PENDING_ACTIVATION': return 'badge-warning';
      case 'EXPIRED': return 'badge-expired';
      case 'REVOKED': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }
}
