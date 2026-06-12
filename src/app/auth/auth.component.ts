import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';

type AuthStep = 'login' | 'first-login' | 'forgot' | 'verify' | 'reset' | 'success';

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
  step = signal<AuthStep>('login');
  isSubmitting = signal(false);
  showPassword = signal(false);
  showNewPassword = signal(false);
  message = signal('');
  recoveryCode = signal('');

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
      case 'verify': return 'Use the 6 digit code sent to your registered email address.';
      case 'reset': return 'Choose a strong password before returning to your HMS Cloud workspace.';
      case 'success': return 'Your password has been reset successfully. You can sign in again now.';
      default: return 'Sign in to manage rooms, staff, reservations and hotel operations.';
    }
  });

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    readonly auth: AuthService
  ) {}

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
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl).finally(done);
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
        this.loginForm.update(login => ({
          ...login,
          username: form.identifier,
          password: '',
          remember: true
        }));
        this.firstLoginForm.set({ identifier: '', temporaryPassword: '', newPassword: '', confirmPassword: '' });
        this.message.set('Password updated. Sign in with your new password.');
        this.step.set('login');
        done();
      });
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
