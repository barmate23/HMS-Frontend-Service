import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PosOrder, PosOutlet, PosService } from '../pos.service';

type KdsStatus = 'new' | 'in-progress' | 'overdue' | 'ready';

interface KdsTicket {
  order: PosOrder;
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
  private refreshInterval?: ReturnType<typeof setInterval>;

  readonly selectedOutletId = signal<number | 'ALL'>('ALL');
  readonly markedReadyIds = signal<Set<number>>(new Set());
  readonly expandedIds = signal<Set<number>>(new Set());
  readonly now = signal<Date>(new Date());
  readonly isFullScreen = signal(false);
  readonly demoMode = signal(false);

  readonly outlets = computed<PosOutlet[]>(() => this.pos.outlets());

  readonly tickets = computed<KdsTicket[]>(() => {
    const nowMs = this.now().getTime();
    const readyIds = this.markedReadyIds();
    const outletFilter = this.selectedOutletId();
    const outletMap = new Map(this.pos.outlets().map(o => [o.id, o.name]));

    const tickets: KdsTicket[] = this.pos.orders()
      .filter(order => {
        if (['BILLED', 'CANCELLED', 'SERVED'].includes(order.status)) return false;
        if (readyIds.has(order.id)) return false;
        if (outletFilter !== 'ALL' && order.outletId !== Number(outletFilter)) return false;
        return true;
      })
      .map(order => {
        const openedAt = this.parseOrderTime(order.openedAt);
        const elapsedSeconds = openedAt ? Math.floor((nowMs - openedAt.getTime()) / 1000) : 0;
        const status = this.getStatus(elapsedSeconds, order.status);
        return {
          order,
          outletName: outletMap.get(order.outletId) || 'Unknown Outlet',
          elapsedSeconds,
          elapsedLabel: this.formatElapsed(elapsedSeconds),
          status,
          isFlashing: status === 'overdue'
        };
      })
      .sort((a, b) => b.elapsedSeconds - a.elapsedSeconds);

    // Inject demo ticket when demoMode is on
    if (this.demoMode()) {
      const demoTicket: KdsTicket = {
        order: {
          id: -1,
          outletId: 1,
          orderNo: 'ORD-DEMO',
          kotNo: 'KOT-DEMO',
          type: 'TABLE',
          tableNo: 'TBL-0009',
          roomNo: '',
          guestName: 'Demo Guest',
          server: 'Demo',
          status: 'KOT_SENT',
          openedAt: new Date(nowMs - 7 * 60 * 1000).toISOString(),
          notes: 'Demo order',
          lines: [
            { itemId: 101, name: 'Paneer Tikka',    qty: 2, price: 350, course: 'Starter',  notes: 'Extra spicy' },
            { itemId: 102, name: 'Dal Makhani',     qty: 1, price: 280, course: 'Main',     notes: '' },
            { itemId: 103, name: 'Butter Naan',     qty: 4, price: 60,  course: 'Main',     notes: 'No butter' },
            { itemId: 104, name: 'Chicken Biryani', qty: 1, price: 450, course: 'Main',     notes: '' },
            { itemId: 105, name: 'Mango Lassi',     qty: 2, price: 120, course: 'Beverage', notes: 'Less sugar' },
            { itemId: 106, name: 'Gulab Jamun',     qty: 3, price: 80,  course: 'Dessert',  notes: '' },
          ]
        },
        outletName: 'Grand Palace Hotel (DEMO)',
        elapsedSeconds: 7 * 60 + 23,
        elapsedLabel: '7m 23s',
        status: 'in-progress',
        isFlashing: false
      };
      tickets.unshift(demoTicket);
    }

    return tickets;
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
    this.pos.loadOrders();
    this.timerInterval = setInterval(() => { this.now.set(new Date()); }, 1000);
    this.refreshInterval = setInterval(() => { this.pos.loadOrders(); }, 15000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  selectOutlet(outletId: number | 'ALL'): void { this.selectedOutletId.set(outletId); }

  markReady(ticket: KdsTicket): void {
    this.markedReadyIds.update(set => { const next = new Set(set); next.add(ticket.order.id); return next; });
    this.pos.saveOrder({ ...ticket.order, status: 'SERVED' });
  }

  refreshNow(): void { this.pos.loadOrders(); this.now.set(new Date()); }

  goBack(): void { this.router.navigate(['/pos/dashboard']); }

  toggleDemo(): void { this.demoMode.update(v => !v); }

  isExpanded(orderId: number): boolean {
    return this.expandedIds().has(orderId);
  }

  toggleExpand(orderId: number): void {
    this.expandedIds.update(set => {
      const next = new Set(set);
      if (next.has(orderId)) { next.delete(orderId); } else { next.add(orderId); }
      return next;
    });
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

  private getStatus(elapsedSeconds: number, orderStatus: string): KdsStatus {
    if (orderStatus === 'SERVED' || orderStatus === 'READY') return 'ready';
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

  getOrderTypeBadge(type: string): string {
    const map: Record<string, string> = { 'TABLE': 'Table', 'ROOM': 'Room', 'TAKEAWAY': 'Takeaway' };
    return map[type] || type;
  }

  getOrderTypeIcon(type: string): string {
    const map: Record<string, string> = { 'TABLE': 'table_restaurant', 'ROOM': 'bed', 'TAKEAWAY': 'takeout_dining' };
    return map[type] || 'restaurant';
  }

  trackById(_: number, ticket: KdsTicket): number { return ticket.order.id; }
}
