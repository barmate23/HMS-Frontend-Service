import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { KitchenDisplayOrder, PosOutlet, PosService } from '../pos.service';

type KdsStatus = 'new' | 'in-progress' | 'overdue' | 'ready';

interface KdsTicket {
  order: KitchenDisplayOrder;
  outletName: string;
  elapsedSeconds: number;
  elapsedLabel: string;
  status: KdsStatus;
  isFlashing: boolean;
}

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kds.component.html',
  styleUrls: ['./kds.component.css']
})
export class KdsComponent implements OnInit, OnDestroy {
  private readonly pos = inject(PosService);
  private readonly router = inject(Router);

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly activeTab = signal<'open' | 'closed'>('open');
  readonly selectedOutletId = signal<number | 'ALL'>('ALL');
  readonly kitchenOrders = signal<KitchenDisplayOrder[]>([]);
  readonly statusOptions = signal<any[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly now = signal<Date>(new Date());
  readonly isFullScreen = signal(false);

  readonly outlets = computed<PosOutlet[]>(() => this.pos.outlets());

  readonly tickets = computed<KdsTicket[]>(() => {
    const nowMs = this.now().getTime();
    const outletMap = new Map(this.pos.outlets().map(o => [o.id, o.name]));

    return this.kitchenOrders().map(order => {
      const openedAt = this.parseOrderTime(order.createdAt);
      const elapsedSeconds = openedAt ? Math.max(0, Math.floor((nowMs - openedAt.getTime()) / 1000)) : 0;
      const status = this.getStatus(elapsedSeconds, order.kotStatus);

      return {
        order,
        outletName: order.outletName || outletMap.get(order.outletId) || 'Main Kitchen Outlet',
        elapsedSeconds,
        elapsedLabel: this.formatElapsed(elapsedSeconds),
        status,
        isFlashing: status === 'overdue' && this.activeTab() === 'open'
      };
    }).sort((a, b) => b.elapsedSeconds - a.elapsedSeconds);
  });

  readonly totalOpen = computed(() => this.tickets().length);
  readonly overdueCount = computed(() => this.tickets().filter(t => t.status === 'overdue').length);
  readonly avgWaitSeconds = computed(() => {
    const t = this.tickets();
    if (!t.length) return 0;
    return Math.floor(t.reduce((sum, item) => sum + item.elapsedSeconds, 0) / t.length);
  });
  readonly avgWaitLabel = computed(() => this.formatElapsed(this.avgWaitSeconds()));

  ngOnInit(): void {
    this.pos.loadOutlets();
    this.loadKitchenOrders();
    this.pos.getKitchenOrderStatuses().subscribe(statuses => {
      this.statusOptions.set(statuses || []);
    });
    this.timerInterval = setInterval(() => { this.now.set(new Date()); }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  loadKitchenOrders(): void {
    this.isLoading.set(true);
    const isClosed = this.activeTab() === 'closed';
    const outletId = this.selectedOutletId();

    this.pos.getKitchenOrders(isClosed, outletId).subscribe({
      next: (orders) => {
        this.kitchenOrders.set(orders || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  setTab(tab: 'open' | 'closed'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.loadKitchenOrders();
  }

  selectOutlet(outletId: number | 'ALL'): void {
    this.selectedOutletId.set(outletId);
    this.loadKitchenOrders();
  }

  markReady(ticket: KdsTicket, statusId: number): void {
    this.pos.patchOrderStatus(ticket.order.id, statusId).subscribe({
      next: () => {
        this.loadKitchenOrders();
      },
      error: (err) => {
        console.error('Failed to update order status:', err);
        this.loadKitchenOrders();
      }
    });
  }

  /** Returns 'new' when kotStatus is KOT Sent, 'inprogress' when Inprogress, else 'other' */
  getKotAction(ticket: KdsTicket): 'new' | 'inprogress' | 'other' {
    const s = (ticket.order.kotStatus || '').toLowerCase().trim();
    if (s === 'kot sent') return 'new';
    if (s === 'inprogress' || s === 'in progress' || s === 'in-progress') return 'inprogress';
    return 'other';
  }

  /** Find status id by matching value name (case-insensitive) from statusOptions */
  private findStatusId(name: string): number {
    const opts = this.statusOptions();
    const match = opts.find(o =>
      (o.value || o.name || o.code || '').toLowerCase().includes(name.toLowerCase())
    );
    return match ? Number(match.id) : 0;
  }

  markInprogress(ticket: KdsTicket): void {
    const statusId = this.findStatusId('inprogress') || this.findStatusId('in progress') || this.findStatusId('progress');
    if (!statusId) { console.warn('Inprogress status not found in options'); return; }
    this.markReady(ticket, statusId);
  }

  markKotReady(ticket: KdsTicket): void {
    const statusId = this.findStatusId('mark ready') || this.findStatusId('ready');
    if (!statusId) { console.warn('Mark Ready status not found in options'); return; }
    this.markReady(ticket, statusId);
  }

  onStatusSelect(ticket: KdsTicket, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const statusId = Number(target.value);
    if (statusId) {
      this.markReady(ticket, statusId);
    }
  }

  refreshNow(): void {
    this.loadKitchenOrders();
    this.now.set(new Date());
  }

  goBack(): void {
    this.router.navigate(['/pos/dashboard']);
  }

  toggleFullScreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => this.isFullScreen.set(true));
    } else {
      document.exitFullscreen().then(() => this.isFullScreen.set(false));
    }
  }

  private parseOrderTime(openedAt: string | undefined): Date | null {
    if (!openedAt || openedAt === 'Just now') return new Date();
    const parsed = new Date(openedAt);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private getStatus(elapsedSeconds: number, kotStatus: string): KdsStatus {
    const s = (kotStatus || '').toLowerCase().trim();
    if (s === 'kot ready' || s === 'closed' || s === 'served') return 'ready';
    if (s === 'inprogress' || s === 'in progress' || s === 'in-progress') return 'in-progress';
    if (s === 'kot sent' || s === 'new') return 'new';
    // Fallback to time-based for unknown statuses
    if (elapsedSeconds > 15 * 60) return 'overdue';
    if (elapsedSeconds > 5 * 60) return 'in-progress';
    return 'new';
  }

  formatElapsed(seconds: number): string {
    if (seconds < 60) return seconds + 's';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return mins + 'm ' + secs + 's';
    return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }

  getStatusLabel(status: KdsStatus): string {
    const map: Record<KdsStatus, string> = { 'new': 'New', 'in-progress': 'In Progress', 'overdue': 'OVERDUE', 'ready': 'Ready' };
    return map[status];
  }

  getOrderTypeBadge(type: string | undefined | null): string {
    if (!type) return 'Table';
    const map: Record<string, string> = { 'TABLE': 'Table', 'DINE_IN': 'Table', 'ROOM': 'Room', 'ROOM_SERVICE': 'Room', 'TAKEAWAY': 'Takeaway' };
    return map[type.toUpperCase()] || type;
  }

  getOrderTypeIcon(type: string | undefined | null): string {
    if (!type) return 'table_restaurant';
    const map: Record<string, string> = { 'TABLE': 'table_restaurant', 'DINE_IN': 'table_restaurant', 'ROOM': 'bed', 'ROOM_SERVICE': 'bed', 'TAKEAWAY': 'takeout_dining' };
    return map[type.toUpperCase()] || 'restaurant';
  }

  trackById(_: number, ticket: KdsTicket): number {
    return ticket.order.id;
  }
}
