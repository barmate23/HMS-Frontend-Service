import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NightAuditService, ChecklistStatus, NoShowAction } from './night-audit.service';

type AuditTab = 'dashboard' | 'checklist' | 'charges' | 'no-shows' | 'reports';

@Component({
  selector: 'app-night-audit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './night-audit.component.html',
  styleUrls: ['./night-audit.component.css']
})
export class NightAuditComponent implements OnInit {
  readonly na = inject(NightAuditService);
  private readonly router = inject(Router);

  readonly activeTab = signal<AuditTab>('dashboard');
  readonly showRollDateModal = signal(false);
  readonly rollDateConfirmText = signal('');
  readonly chargeSearch = signal('');
  readonly noShowSearch = signal('');

  readonly filteredCharges = computed(() => {
    const search = this.chargeSearch().toLowerCase();
    return this.na.guestCharges().filter(c =>
      !search ||
      c.guestName.toLowerCase().includes(search) ||
      c.roomNumber.includes(search) ||
      c.reservationRef.toLowerCase().includes(search)
    );
  });

  readonly filteredNoShows = computed(() => {
    const search = this.noShowSearch().toLowerCase();
    return this.na.noShows().filter(n =>
      !search ||
      n.guestName.toLowerCase().includes(search) ||
      n.reservationRef.toLowerCase().includes(search)
    );
  });

  readonly allReportsGenerated = computed(() =>
    this.na.reportCards().length > 0 && this.na.reportCards().every(r => r.generated)
  );

  readonly processedNoShowsCount = computed(() =>
    this.na.noShows().filter(n => n.action !== 'PENDING').length
  );

  readonly canConfirmRoll = computed(() => this.rollDateConfirmText() === 'CONFIRM');

  ngOnInit(): void {
    const path = this.router.url.split('/').pop() || 'dashboard';
    const tabMap: Record<string, AuditTab> = {
      dashboard: 'dashboard',
      checklist: 'checklist',
      charges: 'charges',
      'no-shows': 'no-shows',
      reports: 'reports'
    };
    this.activeTab.set(tabMap[path] || 'dashboard');
  }

  selectTab(tab: AuditTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/night-audit/${tab}`]);
  }

  startAudit(): void {
    this.na.startAudit();
    this.selectTab('checklist');
  }

  toggleChecklistItem(id: string, current: string): void {
    const next: ChecklistStatus = current === 'VERIFIED' ? 'PENDING' : 'VERIFIED';
    this.na.updateChecklistItem(id, next);
  }

  proceedToCharges(): void {
    this.selectTab('charges');
  }

  postCharge(bookingId: number): void {
    this.na.postCharge(bookingId);
  }

  postAllCharges(): void {
    this.na.postAllCharges();
  }

  processNoShow(reservationId: number, action: NoShowAction): void {
    this.na.processNoShow(reservationId, action);
  }

  generateReport(id: string): void {
    this.na.generateReport(id);
  }

  generateAllReports(): void {
    this.na.generateAllReports();
  }

  openRollDateModal(): void {
    this.rollDateConfirmText.set('');
    this.showRollDateModal.set(true);
  }

  closeRollDateModal(): void {
    this.showRollDateModal.set(false);
    this.rollDateConfirmText.set('');
  }

  confirmRollDate(): void {
    if (!this.canConfirmRoll()) return;
    this.closeRollDateModal();
    this.na.rollBusinessDate();
    this.selectTab('dashboard');
  }

  getNoShowActionLabel(action: NoShowAction): string {
    const labels: Record<NoShowAction, string> = {
      PENDING: 'Pending',
      CHARGE: 'Fee Charged',
      WAIVE: 'Waived',
      WALKED_IN: 'Walked In'
    };
    return labels[action];
  }

  getStatusBadgeClass(status: string): string {
    const s = status?.toUpperCase();
    if (s === 'POSTED' || s === 'VERIFIED' || s === 'COMPLETED' || s === 'CHARGE') return 'badge-success';
    if (s === 'FAILED') return 'badge-danger';
    if (s === 'SKIPPED' || s === 'WAIVE') return 'badge-warning';
    if (s === 'WALKED_IN') return 'badge-info';
    return 'badge-pending';
  }

  formatDate(d: string): string { return this.na.formatDate(d); }
  formatCurrency(n: number): string { return this.na.formatCurrency(n); }
  formatTime(s: string): string { return this.na.formatTime(s); }
}
