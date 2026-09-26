import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// ─── Data Models ────────────────────────────────────────────────────────────

export type AuditStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
export type ChecklistStatus = 'PENDING' | 'VERIFIED' | 'SKIPPED';
export type ChargeStatus = 'PENDING' | 'POSTED' | 'FAILED';
export type NoShowAction = 'CHARGE' | 'WAIVE' | 'WALKED_IN' | 'PENDING';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  status: ChecklistStatus;
  autoCheck?: boolean;
  notes?: string;
}

export interface GuestChargeEntry {
  bookingId: number;
  reservationRef: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  ratePerNight: number;
  taxPercent: number;
  taxAmount: number;
  totalCharge: number;
  status: ChargeStatus;
  isVip?: boolean;
}

export interface NoShowEntry {
  reservationId: number;
  reservationRef: string;
  guestName: string;
  roomType: string;
  checkInDate: string;
  nights: number;
  totalAmount: number;
  noShowFee: number;
  action: NoShowAction;
  phone?: string;
  email?: string;
}

export interface AuditReportCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  generated: boolean;
  generatedAt?: string;
}

export interface AuditLog {
  id: number;
  businessDate: string;
  auditedBy: string;
  startedAt: string;
  completedAt: string;
  inHouseCount: number;
  chargesPosted: number;
  noShowsProcessed: number;
  totalRevenue: number;
  status: 'COMPLETED' | 'FAILED';
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NightAuditService {

  constructor(private readonly http: HttpClient) {
    this.loadMockData();
  }

  // ── State Signals ──────────────────────────────────────────────────────────

  readonly businessDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly auditStatus = signal<AuditStatus>('OPEN');
  readonly auditStartedAt = signal<string | null>(null);
  readonly lastAuditDate = signal<string | null>(null);

  readonly checklistItems = signal<ChecklistItem[]>([
    {
      id: 'pos-shifts',
      title: 'All POS Shifts Closed',
      description: 'Confirm all F&B / POS outlet shifts have been closed and cash counted.',
      icon: 'point_of_sale',
      required: true,
      status: 'PENDING',
      autoCheck: false
    },
    {
      id: 'folio-review',
      title: 'Guest Folios Reviewed',
      description: 'All in-house guest folios checked for outstanding charges or disputes.',
      icon: 'receipt_long',
      required: true,
      status: 'PENDING'
    },
    {
      id: 'cash-count',
      title: 'Front Desk Cash Count',
      description: 'Front desk cash drawer counted and balanced against system records.',
      icon: 'point_of_sale',
      required: true,
      status: 'PENDING'
    },
    {
      id: 'credit-limits',
      title: 'Credit Limit Exceptions Reviewed',
      description: 'All guest accounts exceeding credit limits have been flagged and addressed.',
      icon: 'credit_score',
      required: true,
      status: 'PENDING'
    },
    {
      id: 'hk-status',
      title: 'Housekeeping Status Sync',
      description: 'All room statuses are updated in housekeeping for arriving guests tomorrow.',
      icon: 'cleaning_services',
      required: false,
      status: 'PENDING'
    },
    {
      id: 'maintenance',
      title: 'Maintenance Issues Reviewed',
      description: 'Outstanding maintenance tickets reviewed and handed over to night team.',
      icon: 'build_circle',
      required: false,
      status: 'PENDING'
    }
  ]);

  readonly guestCharges = signal<GuestChargeEntry[]>([]);
  readonly noShows = signal<NoShowEntry[]>([]);
  readonly auditLogs = signal<AuditLog[]>([]);

  readonly reportCards = signal<AuditReportCard[]>([
    { id: 'flash',         title: 'Night Audit Flash Report', description: 'High-level summary of daily revenue, occupancy, ADR, and RevPAR.', icon: 'flash_on',         color: '#7C3AED', generated: false },
    { id: 'occupancy',     title: 'Occupancy & Revenue Summary', description: 'Detailed room occupancy, room nights sold, and revenue breakdown.', icon: 'hotel',           color: '#2563EB', generated: false },
    { id: 'high-balance',  title: 'High Balance Guest Report', description: 'Guests whose outstanding balance exceeds the credit limit threshold.', icon: 'warning_amber',   color: '#D97706', generated: false },
    { id: 'dept-revenue',  title: 'Departmental Revenue Breakdown', description: 'Revenue by department: Rooms, F&B, Laundry, Spa, Misc.', icon: 'pie_chart',       color: '#059669', generated: false },
    { id: 'trial-balance', title: 'Trial Balance', description: 'Complete debit/credit reconciliation for the business day.', icon: 'account_balance', color: '#0891B2', generated: false },
    { id: 'no-show',       title: 'No-Show Report', description: 'All no-show reservations and actions taken during the audit.', icon: 'no_meeting_room', color: '#DC2626', generated: false }
  ]);

  // ── Computed ───────────────────────────────────────────────────────────────

  readonly checklistProgress = computed(() => {
    const items = this.checklistItems();
    const required = items.filter(i => i.required);
    const verified = required.filter(i => i.status === 'VERIFIED' || i.status === 'SKIPPED');
    return {
      total: items.length,
      requiredTotal: required.length,
      requiredVerified: verified.length,
      allRequiredDone: verified.length === required.length,
      percent: required.length ? Math.round((verified.length / required.length) * 100) : 0
    };
  });

  readonly pendingChargesCount = computed(() =>
    this.guestCharges().filter(c => c.status === 'PENDING').length
  );

  readonly postedChargesCount = computed(() =>
    this.guestCharges().filter(c => c.status === 'POSTED').length
  );

  readonly totalChargeAmount = computed(() =>
    this.guestCharges().reduce((sum, c) => sum + c.totalCharge, 0)
  );

  readonly pendingNoShowsCount = computed(() =>
    this.noShows().filter(n => n.action === 'PENDING').length
  );

  readonly allChargesPosted = computed(() =>
    this.guestCharges().length > 0 && this.guestCharges().every(c => c.status !== 'PENDING')
  );

  readonly allNoShowsProcessed = computed(() =>
    this.noShows().every(n => n.action !== 'PENDING')
  );

  readonly canRollDate = computed(() =>
    this.allChargesPosted() && this.allNoShowsProcessed() && this.checklistProgress().allRequiredDone
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  startAudit(): void {
    this.auditStatus.set('IN_PROGRESS');
    this.auditStartedAt.set(new Date().toISOString());
  }

  updateChecklistItem(id: string, status: ChecklistStatus, notes?: string): void {
    this.checklistItems.update(items =>
      items.map(i => i.id === id ? { ...i, status, notes: notes ?? i.notes } : i)
    );
  }

  postCharge(bookingId: number): void {
    this.guestCharges.update(charges =>
      charges.map(c => c.bookingId === bookingId ? { ...c, status: 'POSTED' } : c)
    );
  }

  postAllCharges(): void {
    this.guestCharges.update(charges =>
      charges.map(c => ({ ...c, status: 'POSTED' }))
    );
  }

  processNoShow(reservationId: number, action: NoShowAction): void {
    this.noShows.update(noShows =>
      noShows.map(n => n.reservationId === reservationId ? { ...n, action } : n)
    );
  }

  generateReport(reportId: string): void {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    this.reportCards.update(cards =>
      cards.map(c => c.id === reportId ? { ...c, generated: true, generatedAt: now } : c)
    );
  }

  generateAllReports(): void {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    this.reportCards.update(cards => cards.map(c => ({ ...c, generated: true, generatedAt: now })));
  }

  rollBusinessDate(): void {
    const current = new Date(this.businessDate());
    current.setDate(current.getDate() + 1);
    const newDate = current.toISOString().split('T')[0];
    this.lastAuditDate.set(this.businessDate());
    this.businessDate.set(newDate);
    this.auditStatus.set('COMPLETED');

    // Add to audit log
    const log: AuditLog = {
      id: Date.now(),
      businessDate: this.lastAuditDate()!,
      auditedBy: 'Current User',
      startedAt: this.auditStartedAt() || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      inHouseCount: this.guestCharges().length,
      chargesPosted: this.postedChargesCount(),
      noShowsProcessed: this.noShows().filter(n => n.action !== 'PENDING').length,
      totalRevenue: this.totalChargeAmount(),
      status: 'COMPLETED'
    };
    this.auditLogs.update(logs => [log, ...logs]);

    // Reset for new day
    this.guestCharges.set([]);
    this.noShows.set([]);
    this.checklistItems.update(items => items.map(i => ({ ...i, status: 'PENDING', notes: undefined })));
    this.reportCards.update(cards => cards.map(c => ({ ...c, generated: false, generatedAt: undefined })));
    this.auditStatus.set('OPEN');
    this.auditStartedAt.set(null);
    this.loadMockData();
  }

  // ── Mock Data ──────────────────────────────────────────────────────────────

  private loadMockData(): void {
    this.guestCharges.set([
      {
        bookingId: 1001, reservationRef: 'RES-2026-001', guestName: 'Rajesh Mehta',
        roomNumber: '101', roomType: 'Deluxe King', checkInDate: '2026-09-10',
        checkOutDate: '2026-09-13', nights: 3, ratePerNight: 4500,
        taxPercent: 18, taxAmount: 810, totalCharge: 5310, status: 'PENDING', isVip: true
      },
      {
        bookingId: 1002, reservationRef: 'RES-2026-002', guestName: 'Priya Sharma',
        roomNumber: '204', roomType: 'Standard Double', checkInDate: '2026-09-10',
        checkOutDate: '2026-09-12', nights: 2, ratePerNight: 2800,
        taxPercent: 12, taxAmount: 336, totalCharge: 3136, status: 'PENDING'
      },
      {
        bookingId: 1003, reservationRef: 'RES-2026-003', guestName: 'Arun Patel',
        roomNumber: '305', roomType: 'Suite', checkInDate: '2026-09-09',
        checkOutDate: '2026-09-12', nights: 3, ratePerNight: 8500,
        taxPercent: 18, taxAmount: 1530, totalCharge: 10030, status: 'PENDING', isVip: true
      },
      {
        bookingId: 1004, reservationRef: 'RES-2026-004', guestName: 'Kavya Nair',
        roomNumber: '112', roomType: 'Superior Twin', checkInDate: '2026-09-10',
        checkOutDate: '2026-09-11', nights: 1, ratePerNight: 3200,
        taxPercent: 12, taxAmount: 384, totalCharge: 3584, status: 'PENDING'
      },
    ]);

    this.noShows.set([
      {
        reservationId: 2001, reservationRef: 'RES-2026-NSH-001', guestName: 'Vikram Singh',
        roomType: 'Deluxe King', checkInDate: '2026-09-10', nights: 2,
        totalAmount: 9000, noShowFee: 4500, action: 'PENDING',
        phone: '+91 98765 43210', email: 'vikram@email.com'
      },
      {
        reservationId: 2002, reservationRef: 'RES-2026-NSH-002', guestName: 'Shalini Das',
        roomType: 'Standard Double', checkInDate: '2026-09-10', nights: 1,
        totalAmount: 2800, noShowFee: 2800, action: 'PENDING',
        phone: '+91 91234 56789', email: 'shalini@email.com'
      }
    ]);

    this.auditLogs.set([
      {
        id: 101, businessDate: '2026-09-09', auditedBy: 'Night Manager',
        startedAt: '2026-09-09T23:47:00', completedAt: '2026-09-10T00:12:00',
        inHouseCount: 12, chargesPosted: 12, noShowsProcessed: 1, totalRevenue: 54800, status: 'COMPLETED'
      },
      {
        id: 100, businessDate: '2026-09-08', auditedBy: 'Night Manager',
        startedAt: '2026-09-08T23:52:00', completedAt: '2026-09-09T00:08:00',
        inHouseCount: 9, chargesPosted: 9, noShowsProcessed: 0, totalRevenue: 41200, status: 'COMPLETED'
      },
      {
        id: 99, businessDate: '2026-09-07', auditedBy: 'Asst. Manager',
        startedAt: '2026-09-07T23:44:00', completedAt: '2026-09-08T00:19:00',
        inHouseCount: 14, chargesPosted: 14, noShowsProcessed: 2, totalRevenue: 67500, status: 'COMPLETED'
      }
    ]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
}
