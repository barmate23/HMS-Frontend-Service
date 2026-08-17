import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LicenseService, LicenseStatusResponse } from '../../setup/license.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-license-activation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './license-activation.component.html',
  styleUrl: './license-activation.component.css'
})
export class LicenseActivationComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly licenseService = inject(LicenseService);
  private readonly auth = inject(AuthService);

  @ViewChildren('segInput') segInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // 3 segments of license key (4 chars each e.g. 8LYN LNTE 1VB1 -> 12 digits total)
  seg1 = signal('');
  seg2 = signal('');
  seg3 = signal('');

  prefix = signal('HMS-LIC');

  isSubmitting = signal(false);
  isSuccess = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  redirectCountdown = signal(3);

  pendingHotelId = signal<number>(1);
  licenseDetails = signal<LicenseStatusResponse | null>(null);

  // Full key calculated e.g. HMS-LIC-8LYN-LNTE-1VB1
  readonly fullKey = computed(() => {
    const s1 = this.seg1().trim().toUpperCase();
    const s2 = this.seg2().trim().toUpperCase();
    const s3 = this.seg3().trim().toUpperCase();

    if (!s1 && !s2 && !s3) return '';
    return `${this.prefix()}-${s1}${s2 ? '-' + s2 : ''}${s3 ? '-' + s3 : ''}`;
  });

  // Check if all 3 segments are 4 chars long (12 digits)
  readonly isValidFormat = computed(() => {
    return (
      this.seg1().trim().length === 4 &&
      this.seg2().trim().length === 4 &&
      this.seg3().trim().length === 4
    );
  });

  readonly totalFilledChars = computed(() => {
    return (this.seg1().length + this.seg2().length + this.seg3().length);
  });

  readonly progressPercentage = computed(() => {
    return Math.min(100, Math.round((this.totalFilledChars() / 12) * 100));
  });

  constructor() {
    const queryHotelId = this.route.snapshot.queryParamMap.get('hotelId');
    if (queryHotelId) {
      this.pendingHotelId.set(parseInt(queryHotelId, 10) || 1);
    }
  }

  onSegmentInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (val.length > 4) {
      val = val.substring(0, 4);
    }

    this.setSegmentVal(index, val);

    // Auto focus next input
    if (val.length === 4 && index < 2) {
      const inputsArray = this.segInputs.toArray();
      if (inputsArray[index + 1]) {
        inputsArray[index + 1].nativeElement.focus();
      }
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      const inputsArray = this.segInputs.toArray();
      if (inputsArray[index - 1]) {
        inputsArray[index - 1].nativeElement.focus();
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    this.parseAndFillKey(pastedText);
  }

  parseAndFillKey(raw: string): void {
    // Strip HMS-LIC or non-alphanumeric
    let clean = raw.trim().toUpperCase();
    if (clean.startsWith('HMS-LIC-')) {
      clean = clean.replace('HMS-LIC-', '');
    } else if (clean.startsWith('HMS-')) {
      clean = clean.replace('HMS-', '');
    }

    clean = clean.replace(/[^A-Z0-9]/g, '');

    const chunks = [];
    for (let i = 0; i < clean.length && i < 12; i += 4) {
      chunks.push(clean.substring(i, i + 4));
    }

    this.seg1.set(chunks[0] || '');
    this.seg2.set(chunks[1] || '');
    this.seg3.set(chunks[2] || '');

    // Focus on last filled input
    setTimeout(() => {
      const inputsArray = this.segInputs.toArray();
      if (chunks.length > 0 && inputsArray[Math.min(chunks.length - 1, 2)]) {
        inputsArray[Math.min(chunks.length - 1, 2)].nativeElement.focus();
      }
    }, 50);
  }

  clearKey(): void {
    this.seg1.set('');
    this.seg2.set('');
    this.seg3.set('');
    this.errorMessage.set('');
    if (this.segInputs && this.segInputs.first) {
      this.segInputs.first.nativeElement.focus();
    }
  }

  submitActivation(): void {
    const key = this.fullKey();
    if (!key || !this.isValidFormat()) {
      this.errorMessage.set('Please fill all 3 blocks of your License Key.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.licenseService.activateLicense({
      hotelId: this.pendingHotelId(),
      licenseKey: key
    }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if (res.success && res.data) {
          if (!res.data.isActive) {
            this.errorMessage.set(res.message || 'License key has expired. Please provide a valid subscription key.');
            return;
          }

          this.licenseDetails.set(res.data);
          this.isSuccess.set(true);
          this.successMessage.set('HMS Enterprise Portal Activated Successfully!');

          // Update active license status in current session
          this.auth.updateSessionLicenseStatus('ACTIVE');

          // Start redirect countdown
          this.startCountdown();
        } else {
          this.errorMessage.set(res.message || 'Invalid or expired License Key. Check your credentials and try again.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Failed to connect to HMS license server. Please verify your connection.');
      }
    });
  }

  private startCountdown(): void {
    const interval = setInterval(() => {
      this.redirectCountdown.update(c => {
        if (c <= 1) {
          clearInterval(interval);
          const hotelId = this.licenseDetails()?.hotelId || this.pendingHotelId() || 1;
          this.router.navigate(['/masters/hotels'], {
            queryParams: { firstTimeOnboard: 'true', editHotelId: hotelId }
          });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  goToLogin(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private setSegmentVal(index: number, val: string): void {
    switch (index) {
      case 0: this.seg1.set(val); break;
      case 1: this.seg2.set(val); break;
      case 2: this.seg3.set(val); break;
    }
  }
}
