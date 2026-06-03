import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  LaundryCatalogueItem,
  LinenDispatch,
  LinenDispatchLine,
  LinenDispatchStatus,
  LaundryOrder,
  LaundryOrderLine,
  LaundryService,
  LaundryServiceType,
  LaundryStatus,
  LaundryTab
} from './laundry.service';

@Component({
  selector: 'app-laundry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './laundry.component.html',
  styleUrls: ['./laundry.component.css']
})
export class LaundryComponent implements OnInit, OnDestroy {
  readonly laundry = inject(LaundryService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  activeTab = signal<LaundryTab>('dashboard');
  search = signal('');
  statusFilter = signal<'ALL' | LaundryStatus>('ALL');
  serviceFilter = signal<'ALL' | LaundryServiceType>('ALL');
  categoryFilter = signal('ALL');
  fromDate = signal('2026-05-01');
  toDate = signal('2026-05-31');
  selectedFloor = signal('Floor 1');
  selectedOrderId = signal<number>(1);
  selectedLinenDispatchId = signal<number>(1);
  editingCatalogueId = signal<number | null>(null);
  catalogueDraft = signal<Partial<LaundryCatalogueItem>>({});
  linenDraft = signal<Partial<LinenDispatch>>({});

  orderDraft = signal<Partial<LaundryOrder>>({
    bookingId: 101,
    serviceType: 'Wash & Fold',
    pickupAt: '31-05-2026 12:00',
    expectedDeliveryAt: '01-06-2026 12:00',
    billingMode: 'Room Account',
    notes: '',
    lines: []
  });

  readonly filteredOrders = computed(() => {
    const q = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    const service = this.serviceFilter();
    return this.laundry.orders().filter(order => {
      const matchesQuery = !q || order.room.includes(q) || order.guest.toLowerCase().includes(q) || order.orderId.toLowerCase().includes(q);
      const matchesStatus = status === 'ALL' || order.status === status;
      const matchesService = service === 'ALL' || order.serviceType === service;
      return matchesQuery && matchesStatus && matchesService;
    });
  });

  readonly filteredCatalogue = computed(() => {
    const q = this.search().toLowerCase().trim();
    const category = this.categoryFilter();
    return this.laundry.catalogue().filter(item => {
      const matchesCategory = category === 'ALL' || item.category === category;
      const matchesQuery = !q || item.itemName.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  });

  readonly floors = computed(() => {
    return Array.from(new Set(this.laundry.activeBookings().map(booking => booking.floor)));
  });

  readonly roomsForSelectedFloor = computed(() => {
    return this.laundry.activeBookings().filter(booking => booking.floor === this.selectedFloor());
  });

  readonly selectedOrder = computed(() => {
    return this.laundry.orders().find(order => order.id === this.selectedOrderId()) || this.laundry.orders()[0];
  });

  readonly selectedLinenDispatch = computed(() => {
    return this.laundry.linenDispatches().find(dispatch => dispatch.id === this.selectedLinenDispatchId()) || this.laundry.linenDispatches()[0];
  });

  readonly linenStats = computed(() => {
    const dispatches = this.laundry.linenDispatches();
    return {
      openBatches: dispatches.filter(dispatch => dispatch.status !== 'Returned').length,
      outPieces: dispatches.reduce((sum, dispatch) => sum + this.laundry.linenDispatchQuantity(dispatch), 0),
      returnedPieces: dispatches.reduce((sum, dispatch) => sum + this.laundry.linenReturnedQuantity(dispatch), 0),
      exceptions: dispatches.reduce((sum, dispatch) => sum + this.laundry.linenExceptionQuantity(dispatch), 0),
      scannedPieces: dispatches.reduce((sum, dispatch) => sum + this.laundry.linenScanCount(dispatch), 0),
      vendorCost: dispatches.reduce((sum, dispatch) => sum + this.laundry.linenDispatchCost(dispatch), 0)
    };
  });

  readonly dashboardStats = computed(() => {
    const orders = this.laundry.orders();
    return {
      pendingPickup: orders.filter(order => order.status === 'Pickup Pending').length,
      inProcess: orders.filter(order => order.status === 'Processing').length,
      ready: orders.filter(order => order.status === 'Ready for Delivery').length,
      revenue: orders.filter(order => order.createdAt.startsWith('31-05-2026')).reduce((sum, order) => sum + this.laundry.orderAmount(order), 0),
      overdue: orders.filter(order => order.status === 'Overdue').length,
      completedToday: orders.filter(order => order.status === 'Delivered' && (order.deliveredAt || '').startsWith('31-05-2026')).length
    };
  });

  readonly activityFeed = computed(() => {
    return [...this.laundry.orders()]
      .sort((a, b) => b.id - a.id)
      .slice(0, 10)
      .map(order => ({
        ...order,
        itemCount: this.laundry.orderItemCount(order),
        amount: this.laundry.orderAmount(order)
      }));
  });

  readonly reportStats = computed(() => {
    const orders = this.reportOrders();
    const revenue = orders.reduce((sum, order) => sum + this.laundry.orderAmount(order), 0);
    const delivered = orders.filter(order => order.status === 'Delivered');
    return {
      revenue,
      totalOrders: orders.length,
      averageTat: delivered.length ? '8.4 hrs' : '0 hrs'
    };
  });

  readonly serviceRevenue = computed(() => {
    const orders = this.reportOrders();
    const totals = this.laundry.serviceTypes.map(service => {
      const revenue = orders.filter(order => order.serviceType === service).reduce((sum, order) => sum + this.laundry.orderAmount(order), 0);
      return { service, revenue };
    });
    const max = Math.max(1, ...totals.map(item => item.revenue));
    const total = Math.max(1, totals.reduce((sum, item) => sum + item.revenue, 0));
    return totals.map(item => ({ ...item, width: `${Math.max(8, Math.round(item.revenue / max * 100))}%`, share: Math.round(item.revenue / total * 100) }));
  });

  readonly topRooms = computed(() => {
    const grouped = new Map<string, { room: string; guest: string; orders: number; revenue: number; tat: string }>();
    for (const order of this.reportOrders()) {
      const current = grouped.get(order.room) || { room: order.room, guest: order.guest, orders: 0, revenue: 0, tat: '8.2 hrs' };
      current.orders += 1;
      current.revenue += this.laundry.orderAmount(order);
      grouped.set(order.room, current);
    }
    return [...grouped.values()].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  });

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.syncBookingToDraft();
    this.routerSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  switchTab(tab: LaundryTab): void {
    this.router.navigate([`/laundry/${tab}`]);
  }

  newOrder(): void {
    const firstBooking = this.laundry.activeBookings()[0];
    this.selectedFloor.set(firstBooking?.floor || 'Floor 1');
    this.orderDraft.set({
      bookingId: firstBooking?.bookingId,
      serviceType: 'Wash & Fold',
      pickupAt: '31-05-2026 12:00',
      expectedDeliveryAt: '01-06-2026 12:00',
      billingMode: 'Room Account',
      notes: '',
      lines: []
    });
    this.syncBookingToDraft();
    this.addOrderLine();
    this.switchTab('create');
  }

  newLinenDispatch(): void {
    const firstItem = this.laundry.linenItems().find(item => item.active);
    this.linenDraft.set({
      vendorName: this.laundry.linenVendors[0],
      challanNo: 'CH-NEW',
      sentAt: '31-05-2026 12:30',
      expectedReturnAt: '01-06-2026 09:00',
      vehicleNo: '',
      handledBy: 'Laundry Supervisor',
      status: 'Ready for Pickup',
      billingRecorded: false,
      lines: firstItem ? [{
        id: 1,
        itemId: firstItem.id,
        itemName: firstItem.itemName,
        source: 'Room 102',
        quantity: 1,
        returnedQty: 0,
        damagedQty: 0,
        missingQty: 0,
        vendorRate: firstItem.defaultVendorRate,
        scanCodes: [],
        notes: ''
      }] : []
    });
    this.switchTab('linen');
  }

  syncBookingToDraft(): void {
    const booking = this.laundry.activeBookings().find(item => item.bookingId === Number(this.orderDraft().bookingId)) || this.laundry.activeBookings()[0];
    if (!booking) return;
    this.selectedFloor.set(booking.floor);
    this.orderDraft.update(draft => ({ ...draft, bookingId: booking.bookingId, room: booking.room, guest: booking.guest, plan: booking.plan }));
  }

  setDraftFloor(floor: string): void {
    this.selectedFloor.set(floor);
    const firstRoom = this.roomsForSelectedFloor()[0];
    if (firstRoom) this.setDraftBooking(firstRoom.bookingId);
  }

  setDraftBooking(bookingId: number): void {
    this.orderDraft.update(draft => ({ ...draft, bookingId: Number(bookingId) }));
    this.syncBookingToDraft();
  }

  setDraftServiceType(serviceType: LaundryServiceType): void {
    this.orderDraft.update(draft => ({
      ...draft,
      serviceType,
      lines: (draft.lines || []).map(line => this.repriceLine(line, serviceType))
    }));
  }

  addOrderLine(): void {
    const serviceType = this.orderDraft().serviceType || 'Wash & Fold';
    const item = this.laundry.catalogue().find(value => value.active && this.laundry.priceFor(value, serviceType) > 0);
    if (!item) return;
    this.orderDraft.update(draft => ({
      ...draft,
      lines: [...(draft.lines || []), { catalogueId: item.id, itemName: item.itemName, quantity: 1, unitPrice: this.laundry.priceFor(item, serviceType), notes: '' }]
    }));
  }

  updateLineItem(index: number, catalogueId: number): void {
    if (Number(catalogueId) === 0) {
      this.orderDraft.update(draft => ({
        ...draft,
        lines: (draft.lines || []).map((line, i) => i === index
          ? { ...line, catalogueId: 0, itemName: '', unitPrice: 0 }
          : line
        )
      }));
      return;
    }

    const item = this.laundry.catalogueMap().get(Number(catalogueId));
    if (!item) return;
    const serviceType = this.orderDraft().serviceType || 'Wash & Fold';
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index
        ? { ...line, catalogueId: item.id, itemName: item.itemName, unitPrice: this.laundry.priceFor(item, serviceType) }
        : line
      )
    }));
  }

  updateLineCustomName(index: number, itemName: string): void {
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, itemName } : line)
    }));
  }

  updateLineUnitPrice(index: number, unitPrice: number): void {
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, unitPrice: Math.max(0, Number(unitPrice) || 0) } : line)
    }));
  }

  updateLineQty(index: number, quantity: number): void {
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, quantity: Math.max(1, Number(quantity) || 1) } : line)
    }));
  }

  updateLineNotes(index: number, notes: string): void {
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, notes } : line)
    }));
  }

  removeLine(index: number): void {
    this.orderDraft.update(draft => ({ ...draft, lines: (draft.lines || []).filter((_, i) => i !== index) }));
  }

  saveDraft(): void {
    const saved = this.laundry.saveOrder({ ...this.orderDraft(), status: 'Pickup Pending' });
    this.selectedOrderId.set(saved.id);
    this.switchTab('orders');
  }

  confirmOrder(): void {
    const saved = this.laundry.saveOrder({ ...this.orderDraft(), status: 'Pickup Pending' });
    this.selectedOrderId.set(saved.id);
    this.switchTab('detail');
  }

  viewOrder(order: LaundryOrder): void {
    this.selectedOrderId.set(order.id);
    this.switchTab('detail');
  }

  selectStatusOrder(orderId: number): void {
    this.selectedOrderId.set(Number(orderId));
  }

  editOrder(order: LaundryOrder): void {
    const booking = this.laundry.activeBookings().find(item => item.bookingId === order.bookingId);
    if (booking) this.selectedFloor.set(booking.floor);
    this.orderDraft.set({ ...order, lines: order.lines.map(line => ({ ...line })) });
    this.switchTab('create');
  }

  nextStatus(order: LaundryOrder): LaundryStatus | null {
    if (order.status === 'Pickup Pending') return 'Processing';
    if (order.status === 'Processing') return 'Ready for Delivery';
    if (order.status === 'Ready for Delivery') return 'Delivered';
    if (order.status === 'Overdue') return 'Ready for Delivery';
    return null;
  }

  nextActionLabel(order: LaundryOrder): string {
    const next = this.nextStatus(order);
    if (next === 'Processing') return 'Mark Picked Up';
    if (next === 'Ready for Delivery') return 'Mark Ready';
    if (next === 'Delivered') return 'Mark Delivered';
    return 'No Action';
  }

  applyNextStatus(order: LaundryOrder): void {
    const next = this.nextStatus(order);
    if (!next) return;
    this.laundry.updateOrderStatus(order.id, next);
    if (next === 'Delivered') this.laundry.postOrderToFolio(order.id);
  }

  editLinenDispatch(dispatch: LinenDispatch): void {
    this.selectedLinenDispatchId.set(dispatch.id);
    this.linenDraft.set({ ...dispatch, lines: dispatch.lines.map(line => ({ ...line, scanCodes: [...line.scanCodes] })) });
    this.switchTab('linen');
  }

  addLinenLine(): void {
    const item = this.laundry.linenItems().find(value => value.active);
    if (!item) return;
    this.linenDraft.update(draft => ({
      ...draft,
      lines: [...(draft.lines || []), {
        id: (draft.lines || []).length + 1,
        itemId: item.id,
        itemName: item.itemName,
        source: 'Linen Room',
        quantity: 1,
        returnedQty: 0,
        damagedQty: 0,
        missingQty: 0,
        vendorRate: item.defaultVendorRate,
        scanCodes: [],
        notes: ''
      }]
    }));
  }

  updateLinenLineItem(index: number, itemId: number): void {
    const item = this.laundry.linenItemMap().get(Number(itemId));
    if (!item) return;
    this.linenDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, itemId: item.id, itemName: item.itemName, vendorRate: item.defaultVendorRate } : line)
    }));
  }

  updateLinenLineField(index: number, field: keyof LinenDispatchLine, value: string | number): void {
    this.linenDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => {
        if (i !== index) return line;
        if (['quantity', 'returnedQty', 'damagedQty', 'missingQty', 'vendorRate'].includes(field)) {
          return { ...line, [field]: Math.max(0, Number(value) || 0) };
        }
        return { ...line, [field]: String(value) };
      })
    }));
  }

  updateLinenScanCodes(index: number, value: string): void {
    const scanCodes = value.split(',').map(code => code.trim()).filter(Boolean);
    this.linenDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index ? { ...line, scanCodes } : line)
    }));
  }

  removeLinenLine(index: number): void {
    this.linenDraft.update(draft => ({ ...draft, lines: (draft.lines || []).filter((_, i) => i !== index) }));
  }

  saveLinenDispatch(): void {
    const saved = this.laundry.saveLinenDispatch(this.linenDraft());
    this.selectedLinenDispatchId.set(saved.id);
    this.linenDraft.set({});
  }

  cancelLinenEdit(): void {
    this.linenDraft.set({});
  }

  updateLinenStatus(dispatch: LinenDispatch, status: LinenDispatchStatus): void {
    this.laundry.updateLinenDispatchStatus(dispatch.id, status);
    this.selectedLinenDispatchId.set(dispatch.id);
  }

  beginCatalogueEdit(item?: LaundryCatalogueItem): void {
    this.editingCatalogueId.set(item?.id || 0);
    this.catalogueDraft.set(item ? { ...item } : { category: 'Top Wear', itemName: '', washFold: 0, washPress: 0, dryClean: 0, expressSurcharge: 50, active: true });
  }

  saveCatalogueEdit(): void {
    this.laundry.saveCatalogueItem(this.catalogueDraft());
    this.editingCatalogueId.set(null);
    this.catalogueDraft.set({});
  }

  cancelCatalogueEdit(): void {
    this.editingCatalogueId.set(null);
    this.catalogueDraft.set({});
  }

  statusClass(status: LaundryStatus | string): string {
    return String(status).toLowerCase().replace(/\s+/g, '-');
  }

  money(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  currentLineTotal(line: LaundryOrderLine): number {
    return Number(line.quantity || 0) * Number(line.unitPrice || 0);
  }

  draftTotal(): number {
    return this.laundry.orderAmount({ lines: this.orderDraft().lines || [] });
  }

  linenDraftTotal(): number {
    return this.laundry.linenDispatchCost({ lines: this.linenDraft().lines || [] });
  }

  linenLineTotal(line: LinenDispatchLine): number {
    return Number(line.quantity || 0) * Number(line.vendorRate || 0);
  }

  linenReturnBalance(line: LinenDispatchLine): number {
    return Math.max(0, Number(line.quantity || 0) - Number(line.returnedQty || 0) - Number(line.damagedQty || 0) - Number(line.missingQty || 0));
  }

  stepState(order: LaundryOrder, step: string): 'done' | 'current' | 'pending' {
    const steps = ['Requested', 'Picked Up', 'In Laundry', 'Ready for Delivery', 'Delivered'];
    const statusIndex = order.status === 'Pickup Pending'
      ? 0
      : order.status === 'Processing'
        ? 2
        : order.status === 'Ready for Delivery'
          ? 3
          : order.status === 'Delivered'
            ? 4
            : order.status === 'Overdue'
              ? 2
              : 0;
    const index = steps.indexOf(step);
    if (index < statusIndex) return 'done';
    if (index === statusIndex) return 'current';
    return 'pending';
  }

  private repriceLine(line: LaundryOrderLine, serviceType: LaundryServiceType): LaundryOrderLine {
    if (Number(line.catalogueId) === 0) return line;
    const item = this.laundry.catalogueMap().get(Number(line.catalogueId));
    return item ? { ...line, itemName: item.itemName, unitPrice: this.laundry.priceFor(item, serviceType) } : line;
  }

  private updateTabFromUrl(url: string): void {
    const last = url.split('/').pop()?.split('?')[0] as LaundryTab;
    this.activeTab.set(['dashboard', 'create', 'orders', 'detail', 'linen', 'catalogue', 'reports'].includes(last) ? last : 'dashboard');
    if (this.activeTab() === 'create' && !(this.orderDraft().lines || []).length) this.addOrderLine();
  }

  private reportOrders(): LaundryOrder[] {
    const service = this.serviceFilter();
    return this.laundry.orders().filter(order => service === 'ALL' || order.serviceType === service);
  }
}
