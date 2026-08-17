import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LicenseService, LicenseStatusResponse } from '../setup/license.service';

type AuthStep = 'login' | 'first-login' | 'activate-license' | 'forgot' | 'verify' | 'reset' | 'success';

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

interface RecoveryForm {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

interface FirstLoginForm {
  identifier: string;
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
})
export class AuthComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly licenseService = inject(LicenseService);

  step = signal<AuthStep>('login');
  isSubmitting = signal(false);
  showPassword = signal(false);
  showNewPassword = signal(false);
  message = signal('');
  recoveryCode = signal('');

  // License Activation State
  activationKeyInput = signal('');
  pendingHotelId = signal<number>(1);
  licenseStatusInfo = signal<LicenseStatusResponse | null>(null);

  loginForm = signal<LoginForm>({
    username: '',
    password: '',
    remember: true,
  });

  recoveryForm = signal<RecoveryForm>({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  firstLoginForm = signal<FirstLoginForm>({
    identifier: '',
    temporaryPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  readonly stepTitle = computed(() => {
    switch (this.step()) {
      case 'forgot': return 'Recover Access';
      case 'first-login': return 'Set Your Password';
      case 'activate-license': return 'Activate HMS Portal';
      case 'verify': return 'Verify Code';
      case 'reset': return 'Create New Password';
      case 'success': return 'Password Updated';
      default: return 'Welcome Back';
    }
  });

  readonly stepSubtitle = computed(() => {
    switch (this.step()) {
      case 'forgot': return 'Enter your registered email and we will send a verification code.';
      case 'first-login': return 'This is your first sign-in. Replace the temporary password before entering HMS Cloud.';
      case 'activate-license': return 'Input the License Key emailed to your property to activate this HMS Cloud instance.';
      case 'verify': return 'Use the 6 digit code sent to your registered email address.';
      case 'reset': return 'Choose a strong password before returning to your HMS Cloud workspace.';
      case 'success': return 'Your password has been reset successfully. You can sign in again now.';
      default: return 'Sign in to manage rooms, staff, reservations and hotel operations.';
    }
  });

  updateLogin(field: keyof LoginForm, value: string | boolean): void {
    this.loginForm.update(form => ({ ...form, [field]: value }));
  }

  updateRecovery(field: keyof RecoveryForm, value: string): void {
    this.recoveryForm.update(form => ({ ...form, [field]: value }));
  }

  updateFirstLogin(field: keyof FirstLoginForm, value: string): void {
    this.firstLoginForm.update(form => ({ ...form, [field]: value }));
  }

  submitLogin(): void {
    const form = this.loginForm();
    if (!form.username.trim() || !form.password.trim()) {
      this.message.set('Enter username and password to continue.');
      return;
    }

    this.runAction(done => {
      this.auth.login(form.username, form.password, form.remember).subscribe(result => {
        if (result.requiresPasswordChange) {
          this.firstLoginForm.set({
            identifier: result.identifier || form.username,
            temporaryPassword: form.password,
            newPassword: '',
            confirmPassword: ''
          });
          this.message.set(result.message || 'Set a custom password to activate this account.');
          this.step.set('first-login');
          done();
          return;
        }
        if (!result.success) {
          this.message.set(result.message);
          done();
          return;
        }

        // Validate License Activation & Expiration Status for the logged in user's hotelId
        const userHotelId = result.hotelId || this.auth.currentUser()?.hotelId || 1;
        this.verifyLicenseAndProceed(userHotelId, done, result.licenseStatus);
      });
    });
  }

  submitFirstLoginPassword(): void {
    const form = this.firstLoginForm();
    if (!form.identifier.trim() || !form.temporaryPassword.trim()) {
      this.message.set('Temporary login details are missing. Return to sign in and try again.');
      return;
    }
    if (!this.validPassword(form.newPassword)) {
      this.message.set('Password must be at least 8 characters and include letters and numbers.');
      return;
    }
    if (form.newPassword === form.temporaryPassword) {
      this.message.set('Choose a new password different from the temporary password.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      this.message.set('New password and confirmation must match.');
      return;
    }

    this.runAction(done => {
      this.auth.changeFirstLoginPassword(form.identifier, form.temporaryPassword, form.newPassword).subscribe(result => {
        if (!result.success) {
          this.message.set(result.message);
          done();
          return;
        }
        // Auto sign in after setting password and verify license key
        this.auth.login(form.identifier, form.newPassword, true).subscribe(loginRes => {
          if (loginRes.success) {
            const userHotelId = loginRes.hotelId || this.auth.currentUser()?.hotelId || 1;
            this.verifyLicenseAndProceed(userHotelId, done, loginRes.licenseStatus);
          } else {
            this.message.set('Password updated successfully. Please sign in with your new password.');
            this.step.set('login');
            done();
          }
        });
      });
    });
  }

  submitLicenseKeyActivation(): void {
    const key = this.activationKeyInput().trim();
    if (!key) {
      this.message.set('Please enter a valid License Key.');
      return;
    }

    this.runAction(done => {
      this.licenseService.activateLicense({
        hotelId: this.pendingHotelId(),
        licenseKey: key
      }).subscribe(res => {
        if (res.success && res.data) {
          if (!res.data.isActive) {
            this.message.set(res.message || 'License key has expired. Please renew your subscription key.');
            done();
            return;
          }

          this.message.set('HMS Portal activated successfully!');
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigateByUrl(returnUrl).finally(done);
        } else {
          this.message.set(res.message || 'License key is invalid or has expired.');
          done();
        }
      });
    });
  }

  private verifyLicenseAndProceed(hotelId: number, done: () => void, directStatus?: string): void {
    if (directStatus && 'ACTIVE'.equalsIgnoreCase(directStatus)) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
      this.router.navigateByUrl(returnUrl).finally(done);
      return;
    }

    this.licenseService.getLicenseStatus(hotelId).subscribe({
      next: (statusRes) => {
        if (statusRes.success && statusRes.data) {
          const lic = statusRes.data;
          this.licenseStatusInfo.set(lic);
          this.pendingHotelId.set(lic.hotelId || hotelId);

          // Check if License requires activation or is expired
          if (!lic.isActive || 'PENDING_ACTIVATION'.equalsIgnoreCase(lic.status) || 'EXPIRED'.equalsIgnoreCase(lic.status)) {
            const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
            this.router.navigate(['/activate-license'], { queryParams: { returnUrl, hotelId: lic.hotelId || hotelId } }).finally(done);
            return;
          }
        }

        // Active license -> navigate to dashboard
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl).finally(done);
      },
      error: () => {
        // Fallback navigate to dashboard if backend status call fails
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl).finally(done);
      }
    });
  }

  submitForgot(): void {
    const email = this.recoveryForm().email.trim().toLowerCase();
    if (!this.validEmail(email)) {
      this.message.set('Enter a valid registered email address.');
      return;
    }
    this.runAction(done => {
      this.auth.forgotPassword(email).subscribe(result => {
        if (!result.success) {
          this.message.set(result.message);
          done();
          return;
        }
        this.recoveryCode.set('');
        this.message.set(result.message || 'Verification code sent to your registered email address.');
        this.step.set('verify');
        done();
      });
    });
  }

  submitOtp(): void {
    const form = this.recoveryForm();
    const email = form.email.trim().toLowerCase();
    const otp = form.otp.trim();
    if (!this.validEmail(email)) {
      this.message.set('Enter a valid registered email address.');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      this.message.set('Enter the 6 digit verification code.');
      return;
    }
    this.runAction(done => {
      this.auth.verifyResetCode(email, otp).subscribe(result => {
        if (!result.success) {
          this.message.set(result.message);
          done();
          return;
        }
        this.message.set('');
        this.step.set('reset');
        done();
      });
    });
  }

  submitReset(): void {
    const form = this.recoveryForm();
    if (form.newPassword.length < 8) {
      this.message.set('Password must be at least 8 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      this.message.set('New password and confirmation must match.');
      return;
    }

    this.runAction(done => {
      this.auth.resetPassword(form.email, form.otp, form.newPassword).subscribe(result => {
        if (!result.success) {
          this.message.set(result.message);
          done();
          return;
        }
        this.loginForm.update(login => ({
          ...login,
          username: form.email,
          password: '',
          remember: true
        }));
        this.message.set('');
        this.step.set('success');
        done();
      });
    });
  }

  goToLogin(): void {
    this.message.set('');
    this.step.set('login');
  }

  goToForgot(): void {
    this.message.set('');
    this.step.set('forgot');
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  toggleNewPassword(): void {
    this.showNewPassword.update(value => !value);
  }

  private runAction(done: (complete: () => void) => void): void {
    this.isSubmitting.set(true);
    this.message.set('');
    done(() => {
      this.isSubmitting.set(false);
    });
  }

  private validEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private validPassword(value: string): boolean {
    return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
  }
}

// Helper extension method
declare global {
  interface String {
    equalsIgnoreCase(other: string | null | undefined): boolean;
  }
}
if (!String.prototype.equalsIgnoreCase) {
  String.prototype.equalsIgnoreCase = function (other: string | null | undefined): boolean {
    return !!other && this.toLowerCase() === other.toLowerCase();
  };
}
