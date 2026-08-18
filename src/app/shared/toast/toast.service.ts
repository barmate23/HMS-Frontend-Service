import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

/** Converts raw backend/HTTP errors into clean, human-readable user messages. */
export function formatApiErrorMessage(err: any, fallbackMessage: string = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallbackMessage;

  // 1. If err is a string
  if (typeof err === 'string') {
    if (!err.includes('Http failure response')) {
      return err;
    }
  }

  // 2. Extract backend custom error message if present in payload
  const payload = err.error || err;

  if (payload) {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (parsed.error?.message) return parsed.error.message;
        if (parsed.message) return parsed.message;
      } catch {
        if (!payload.includes('Http failure response') && !payload.includes('<!DOCTYPE html>')) {
          return payload;
        }
      }
    } else {
      if (payload.error?.message) return payload.error.message;
      if (payload.error?.details) return payload.error.details;
      if (payload.message && !payload.message.includes('Http failure response')) return payload.message;
      if (payload.details) return payload.details;
    }
  }

  // 3. Status code specific human-readable error messages
  const errStr = String(err?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  const status = err.status || payload?.status;

  if (status === 503 || errStr.includes('503') || errStr.includes('service unavailable')) {
    return 'The service under maintenance, Please try again later';
  }
  if (status === 0) {
    return 'Unable to connect to HMS Server. Please check your network connection.';
  }
  if (status === 500) {
    return 'Server encountered an internal error (500). Please try again later.';
  }
  if (status === 502) {
    return 'Bad Gateway (502). Server is restarting or unreachable.';
  }
  if (status === 504) {
    return 'Gateway Timeout (504). Server took too long to respond.';
  }
  if (status === 401) {
    return 'Invalid username or password. Please verify your login credentials.';
  }
  if (status === 403) {
    return 'Access denied (403). You do not have permission for this action.';
  }
  if (status === 404) {
    return 'Requested service or resource was not found (404).';
  }

  // 4. Fallback check for err.message if non-technical
  if (err.message && typeof err.message === 'string' && !err.message.includes('Http failure response')) {
    return err.message;
  }

  return fallbackMessage;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(message: string, type: ToastType = 'info', title?: string, duration: number = 4500): number {
    const id = this.nextId++;
    const toastTitle = title || this.getDefaultTitle(type);
    const newToast: ToastMessage = { id, type, title: toastTitle, message, duration };

    this.toasts.update(list => [...list, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(message: string, title: string = 'Success', duration: number = 4000): void {
    this.show(message, 'success', title, duration);
  }

  error(errOrMsg: any, title: string = 'Error Occurred', duration: number = 5000): void {
    const message = formatApiErrorMessage(errOrMsg);
    this.show(message, 'error', title, duration);
  }

  warning(message: string, title: string = 'Attention Required', duration: number = 4500): void {
    this.show(message, 'warning', title, duration);
  }

  info(message: string, title: string = 'Notice', duration: number = 4000): void {
    this.show(message, 'info', title, duration);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }

  private getDefaultTitle(type: ToastType): string {
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error Occurred';
      case 'warning': return 'Attention';
      case 'info': default: return 'Notice';
    }
  }

  private extractErrorMessage(err: any): string {
    return formatApiErrorMessage(err);
  }
}
