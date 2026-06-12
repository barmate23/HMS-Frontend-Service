import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  LaundryCatalogueItem,
  LaundryDashboardActivity,
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

type LinenSection = 'vendors' | 'requests' | 'ledger';
type LinenVendorStatus = 'Active' | 'Inactive';
type DeleteConfirmation =
  | { type: 'catalogue'; id: number; name: string; title: string; message: string; note: string }
  | { type: 'service'; id: number; name: string; title: string; message: string; note: string };
type LinenVendor = {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  gstNumber: string;
  pickupWindow: string;
  paymentTerms: string;
  status: LinenVendorStatus;
};

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
  fromDate = signal('');
  toDate = signal('');
  selectedFloor = signal('');
  selectedOrderId = signal<number>(0);
  selectedLinenDispatchId = signal<number>(0);
  selectedLinenVendorId = signal<number>(0);
  viewingVendorId = signal<number | null>(null);
  editingCatalogueId = signal<number | null>(null);
  selectedCatalogueId = signal<number | null>(null);
  isServiceComposerOpen = signal(false);
  editingServiceName = signal<string | null>(null);
  serviceDraftName = signal('');
  serviceDraftDescription = signal('');
  serviceDraftBase = signal<'washFold' | 'washPress' | 'dryClean' | 'express'>('washPress');
  serviceDraftActive = signal(true);
  serviceBaseOverrides = signal<Record<string, 'washFold' | 'washPress' | 'dryClean' | 'express'>>({});
  serviceStatusOverrides = signal<Record<string, boolean>>({});
  serviceVersion = signal(0);
  deleteConfirmation = signal<DeleteConfirmation | null>(null);
  isOrderSummaryOpen = signal(false);
  isItemDetailsOpen = signal(false);
  linenSection = signal<LinenSection>('requests');
  editingVendorId = signal<number | null>(null);
  catalogueDraft = signal<Partial<LaundryCatalogueItem>>({});
  linenDraft = signal<Partial<LinenDispatch>>({});
  vendorDraft = signal<Partial<LinenVendor>>({});
  linenVendors = signal<LinenVendor[]>([]);

  orderDraft = signal<Partial<LaundryOrder>>({
    serviceType: '',
    serviceTypes: [],
    pickupAt: '',
    expectedDeliveryAt: '',
    billingMode: '',
    notes: '',
    lines: []
  });

  readonly filteredOrders = computed(() => {
    const q = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    const service = this.serviceFilter();
    const from = this.fromDate();
    const to = this.toDate();
    return this.laundry.orders().filter(order => {
      const matchesQuery = !q || order.room.includes(q) || order.guest.toLowerCase().includes(q) || order.orderId.toLowerCase().includes(q);
      const matchesStatus = status === 'ALL' || order.status === status;
      const matchesService = service === 'ALL' || (order.serviceTypes || [order.serviceType]).includes(service);
      const matchesDateRange = this.matchesDateRange(order.createdAt || order.pickupAt || order.expectedDeliveryAt, from, to);
      return matchesQuery && matchesStatus && matchesService && matchesDateRange;
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

  readonly priceMasterStats = computed(() => {
    const items = this.laundry.catalogue();
    const activeItems = items.filter(item => item.active);
    const services = this.priceServices();
    const configuredRates = items.reduce((sum, item) => {
      return sum + services.filter(service => this.priceForService(item, service.name) > 0).length;
    }, 0);
    const expressAverage = items.length
      ? Math.round(items.reduce((sum, item) => sum + Number(item.expressSurcharge || 0), 0) / items.length)
      : 0;

    return {
      items: items.length,
      activeItems: activeItems.length,
      services: services.length,
      configuredRates,
      expressAverage
    };
  });

  readonly serviceCatalog = computed(() => {
    this.serviceVersion();
    return this.laundry.serviceCatalog().map(service => ({
      id: service.id,
      name: service.serviceName,
      icon: this.serviceIcon(service.serviceName),
      base: this.serviceBaseLabel(service.serviceName),
      active: service.active,
      configured: this.serviceHasConfiguredRates(service.serviceName),
      description: service.description || this.serviceDescription(service.serviceName),
      pricingBasis: service.pricingBasis,
      displayOrder: service.displayOrder
    }));
  });

  readonly priceServices = computed(() => {
    return this.serviceCatalog()
      .filter(service => service.active)
      .map(service => ({
        name: service.name,
        icon: service.icon,
        base: service.base,
        enabled: service.configured,
        description: service.description
      }));
  });

  readonly selectedCatalogueItem = computed(() => {
    const selectedId = this.selectedCatalogueId();
    return this.laundry.catalogue().find(item => item.id === selectedId)
      || this.laundry.catalogue()[0]
      || null;
  });

  readonly floors = computed(() => {
    return Array.from(new Set(this.laundry.activeBookings().map(booking => booking.floor)));
  });

  readonly roomsForSelectedFloor = computed(() => {
    return this.laundry.activeBookings().filter(booking => booking.floor === this.selectedFloor());
  });

  private readonly defaultSelectionEffect = effect(() => {
    const floors = this.floors();
    if (!this.selectedFloor() && floors.length) {
      this.selectedFloor.set(floors[0]);
    }

    const rooms = this.roomsForSelectedFloor();
    if (!this.orderDraft().bookingId && rooms.length) {
      this.setDraftBooking(rooms[0].bookingId);
    }

    this.laundry.serviceCatalog();
    if (!(this.orderDraft().serviceTypes || []).length && this.laundry.serviceTypes.length) {
      this.setDraftServiceTypes([this.laundry.serviceTypes[0]]);
    }
    if (!this.orderDraft().billingMode && this.laundry.billingOptions.length) {
      this.orderDraft.update(draft => ({ ...draft, billingMode: this.laundry.billingOptions[0] }));
    }

    const orders = this.laundry.orders();
    if (orders.length && !orders.some(order => order.id === this.selectedOrderId())) {
      this.selectedOrderId.set(orders[0].id);
    }
  }, { allowSignalWrites: true });

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

  readonly selectedVendor = computed(() => this.linenVendors().find(vendor => vendor.id === this.selectedLinenVendorId()) || this.linenVendors()[0]);

  readonly linenLedgerRows = computed(() => {
    return this.laundry.linenDispatches().map(dispatch => ({
      period: dispatch.sentAt.slice(3, 10),
      vendor: dispatch.vendorName,
      batchNo: dispatch.batchNo,
      sentAt: dispatch.sentAt,
      expectedReturnAt: dispatch.expectedReturnAt,
      pieces: this.laundry.linenDispatchQuantity(dispatch),
      exceptions: this.laundry.linenExceptionQuantity(dispatch),
      cost: this.laundry.linenDispatchCost(dispatch),
      status: dispatch.billingRecorded ? 'Recorded' : 'Pending'
    }));
  });

  readonly dashboardStats = computed(() => {
    return this.laundry.dashboardSummary();
  });

  readonly activityFeed = computed(() => {
    return this.laundry.dashboardActivity();
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
    this.selectedFloor.set(firstBooking?.floor || '');
    this.orderDraft.set({
      bookingId: firstBooking?.bookingId,
      serviceTypes: this.laundry.serviceTypes[0] ? [this.laundry.serviceTypes[0]] : [],
      serviceType: this.laundry.serviceTypes[0] || '',
      pickupAt: this.defaultDateTimeLocal(0),
      expectedDeliveryAt: this.defaultDateTimeLocal(24),
      billingMode: this.laundry.billingOptions[0] || '',
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
      vendorName: this.linenVendors().find(vendor => vendor.status === 'Active')?.name || '',
      challanNo: '',
      sentAt: '',
      expectedReturnAt: '',
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
    this.linenSection.set('requests');
    this.switchTab('linen');
  }

  switchLinenSection(section: LinenSection): void {
    this.linenSection.set(section);
  }

  selectLinenVendor(vendorId: number): void {
    this.selectedLinenVendorId.set(vendorId);
  }

  viewVendor(vendor: LinenVendor): void {
    this.selectedLinenVendorId.set(vendor.id);
    this.viewingVendorId.set(vendor.id);
    this.editingVendorId.set(null);
    this.vendorDraft.set({});
  }

  closeVendorView(): void {
    this.viewingVendorId.set(null);
  }

  beginVendorEdit(vendor?: LinenVendor): void {
    this.editingVendorId.set(vendor?.id || 0);
    if (vendor?.id) this.selectedLinenVendorId.set(vendor.id);
    this.viewingVendorId.set(null);
    this.vendorDraft.set(vendor ? { ...vendor } : {
      name: '',
      contactPerson: '',
      phone: '',
      gstNumber: '',
      pickupWindow: '',
      paymentTerms: 'Monthly settlement',
      status: 'Active'
    });
    this.linenSection.set('vendors');
  }

  saveVendor(): void {
    const draft = this.vendorDraft();
    if (!draft.name?.trim()) return;
    if (this.editingVendorId() && this.editingVendorId() !== 0) {
      this.linenVendors.update(vendors => vendors.map(vendor => vendor.id === this.editingVendorId() ? { ...vendor, ...draft } as LinenVendor : vendor));
      this.selectedLinenVendorId.set(this.editingVendorId() || this.selectedLinenVendorId());
    } else {
      const nextId = Math.max(0, ...this.linenVendors().map(vendor => vendor.id)) + 1;
      this.linenVendors.update(vendors => [...vendors, {
        id: nextId,
        name: draft.name || '',
        contactPerson: draft.contactPerson || '',
        phone: draft.phone || '',
        gstNumber: draft.gstNumber || '',
        pickupWindow: draft.pickupWindow || '',
        paymentTerms: draft.paymentTerms || 'Monthly settlement',
        status: (draft.status as LinenVendorStatus) || 'Active'
      }]);
      this.selectedLinenVendorId.set(nextId);
    }
    this.editingVendorId.set(null);
    this.vendorDraft.set({});
    this.viewingVendorId.set(null);
  }

  cancelVendorEdit(): void {
    this.editingVendorId.set(null);
    this.vendorDraft.set({});
  }

  deleteVendor(vendorId: number): void {
    this.linenVendors.update(vendors => vendors.filter(vendor => vendor.id !== vendorId));
    const fallback = this.linenVendors().find(vendor => vendor.id !== vendorId);
    if (this.selectedLinenVendorId() === vendorId && fallback) this.selectedLinenVendorId.set(fallback.id);
    if (this.viewingVendorId() === vendorId) this.viewingVendorId.set(null);
  }

  toggleVendorStatus(vendor: LinenVendor): void {
    const status: LinenVendorStatus = vendor.status === 'Active' ? 'Inactive' : 'Active';
    this.linenVendors.update(vendors => vendors.map(item => item.id === vendor.id ? { ...item, status } : item));
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

  setDraftServiceTypes(serviceTypes: LaundryServiceType[]): void {
    const selected = this.normalizeSelectedServices(serviceTypes);
    this.orderDraft.update(draft => ({
      ...draft,
      serviceTypes: selected,
      serviceType: this.laundry.serviceDisplay(selected),
      lines: (draft.lines || []).map(line => this.repriceLine(line, selected))
    }));
  }

  toggleDraftService(serviceType: LaundryServiceType): void {
    const current = this.normalizeSelectedServices(this.orderDraft().serviceTypes || []);
    const exists = current.some(service => service.toLowerCase() === serviceType.toLowerCase());
    const next = exists ? current.filter(service => service.toLowerCase() !== serviceType.toLowerCase()) : [...current, serviceType];
    this.setDraftServiceTypes(next.length ? next : [serviceType]);
  }

  isDraftServiceSelected(serviceType: LaundryServiceType): boolean {
    return this.normalizeSelectedServices(this.orderDraft().serviceTypes || []).some(service => service.toLowerCase() === serviceType.toLowerCase());
  }

  addOrderLine(): void {
    const serviceTypes = this.normalizeSelectedServices(this.orderDraft().serviceTypes || [this.orderDraft().serviceType || this.laundry.serviceTypes[0] || '']);
    const item = this.laundry.catalogue().find(value => value.active && this.laundry.priceForServices(value, serviceTypes) > 0);
    if (!item) return;
    this.orderDraft.update(draft => ({
      ...draft,
      lines: [...(draft.lines || []), { catalogueId: item.id, itemName: item.itemName, quantity: 1, unitPrice: this.laundry.priceForServices(item, serviceTypes), notes: '' }]
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
    const serviceTypes = this.normalizeSelectedServices(this.orderDraft().serviceTypes || [this.orderDraft().serviceType || this.laundry.serviceTypes[0] || '']);
    this.orderDraft.update(draft => ({
      ...draft,
      lines: (draft.lines || []).map((line, i) => i === index
        ? { ...line, catalogueId: item.id, itemName: item.itemName, unitPrice: this.laundry.priceForServices(item, serviceTypes) }
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

  trackByIndex(index: number): number {
    return index;
  }

  removeLine(index: number): void {
    this.orderDraft.update(draft => ({ ...draft, lines: (draft.lines || []).filter((_, i) => i !== index) }));
  }

  updateDraftDateTime(field: 'pickupAt' | 'expectedDeliveryAt', value: string): void {
    this.orderDraft.update(draft => ({ ...draft, [field]: value }));
  }

  dateTimeInputValue(value?: string): string {
    return this.toDateTimeInput(value);
  }

  dateInputValue(value?: string): string {
    return this.toDateTimeInput(value).slice(0, 10);
  }

  timeInputValue(value?: string): string {
    return this.toDateTimeInput(value).slice(11, 16);
  }

  updateDraftDatePart(field: 'pickupAt' | 'expectedDeliveryAt', date: string): void {
    const current = this.toDateTimeInput(this.orderDraft()[field]);
    const time = current.slice(11, 16) || '12:00';
    this.updateDraftDateTime(field, date ? `${date}T${time}` : '');
  }

  updateDraftTimePart(field: 'pickupAt' | 'expectedDeliveryAt', time: string): void {
    const current = this.toDateTimeInput(this.orderDraft()[field]);
    const date = current.slice(0, 10) || this.defaultDateTimeLocal(0).slice(0, 10);
    this.updateDraftDateTime(field, time ? `${date}T${time}` : '');
  }

  saveDraft(): void {
    const saved = this.laundry.saveOrder({ ...this.orderDraft(), status: 'Pickup Pending' });
    this.selectedOrderId.set(saved.id);
    this.switchTab('orders');
  }

  reviewOrder(): void {
    if (!this.canConfirmOrder()) return;
    this.isOrderSummaryOpen.set(true);
  }

  cancelOrderSummary(): void {
    this.isOrderSummaryOpen.set(false);
  }

  confirmOrderFromSummary(): void {
    const saved = this.laundry.saveOrder({ ...this.orderDraft(), status: 'Pickup Pending' });
    this.isOrderSummaryOpen.set(false);
    this.selectedOrderId.set(saved.id);
    this.switchTab('detail');
  }

  canConfirmOrder(): boolean {
    const draft = this.orderDraft();
    const hasRoom = Boolean(draft.bookingId || draft.room);
    const hasService = Boolean((draft.serviceTypes || []).length || String(draft.serviceType || '').trim());
    const hasBilling = Boolean(String(draft.billingMode || '').trim());
    const hasDates = Boolean(draft.pickupAt && draft.expectedDeliveryAt);
    const hasLines = Boolean((draft.lines || []).some(line => String(line.itemName || '').trim() && Number(line.quantity || 0) > 0 && Number(line.unitPrice || 0) >= 0));
    return hasRoom && hasService && hasBilling && hasDates && hasLines;
  }

  viewOrder(order: LaundryOrder | LaundryDashboardActivity): void {
    const matchingOrder = this.laundry.orders().find(item =>
      item.id === Number(order.id || 0) ||
      item.orderId === order.orderId
    );
    this.selectedOrderId.set(matchingOrder?.id || order.id);
    this.switchTab('detail');
  }

  openItemDetails(order: LaundryOrder): void {
    this.selectedOrderId.set(order.id);
    this.isItemDetailsOpen.set(true);
  }

  closeItemDetails(): void {
    this.isItemDetailsOpen.set(false);
  }

  selectStatusOrder(orderId: number): void {
    this.selectedOrderId.set(Number(orderId));
    this.closeItemDetails();
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
    this.selectedCatalogueId.set(item?.id || null);
    this.catalogueDraft.set(item
      ? { ...item, servicePrices: { ...(item.servicePrices || {}) } }
      : { category: this.defaultLaundryCategory(), itemName: '', washFold: 0, washPress: 0, dryClean: 0, expressSurcharge: 50, servicePrices: {}, active: true }
    );
  }

  saveCatalogueEdit(): void {
    this.laundry.saveCatalogueItem(this.catalogueDraft());
    if (this.catalogueDraft().id) this.selectedCatalogueId.set(Number(this.catalogueDraft().id));
    this.editingCatalogueId.set(null);
    this.catalogueDraft.set({});
  }

  deleteCatalogueItem(item: LaundryCatalogueItem): void {
    this.deleteConfirmation.set({
      type: 'catalogue',
      id: item.id,
      name: item.itemName,
      title: 'Delete Price Item',
      message: `Delete "${item.itemName}" from Price Master?`,
      note: 'This item will be removed from the laundry price matrix and will no longer be available for new laundry orders.'
    });
  }

  cancelCatalogueEdit(): void {
    this.editingCatalogueId.set(null);
    this.catalogueDraft.set({});
  }

  selectCatalogueItem(item: LaundryCatalogueItem): void {
    this.selectedCatalogueId.set(item.id);
  }

  openServiceComposer(service?: string): void {
    const existing = service ? this.serviceCatalog().find(item => item.name === service) : null;
    this.editingServiceName.set(existing?.name || null);
    this.serviceDraftName.set(existing?.name || '');
    this.serviceDraftDescription.set(existing?.description || '');
    this.serviceDraftBase.set(service ? this.serviceBase(service) : 'washPress');
    this.serviceDraftActive.set(existing?.active ?? true);
    this.isServiceComposerOpen.set(true);
  }

  saveServiceDraft(): void {
    const name = this.serviceDraftName().trim();
    if (!name) return;
    const current = this.editingServiceName();
    const newKey = name.toLowerCase();
    if (this.serviceCatalog().some(service => service.name.toLowerCase() === newKey && service.name !== current)) return;
    const existing = current ? this.laundry.serviceCatalog().find(service => service.serviceName === current) : null;
    this.laundry.saveServiceCatalogItem({
      id: existing?.id,
      serviceName: name,
      pricingBasis: this.serviceDraftBase(),
      description: this.serviceDraftDescription().trim(),
      displayOrder: existing?.displayOrder || this.laundry.serviceCatalog().length + 1,
      active: this.serviceDraftActive()
    });
    this.serviceVersion.update(value => value + 1);
    this.isServiceComposerOpen.set(false);
    this.editingServiceName.set(null);
    this.serviceDraftName.set('');
    this.serviceDraftDescription.set('');
  }

  cancelServiceDraft(): void {
    this.isServiceComposerOpen.set(false);
    this.editingServiceName.set(null);
    this.serviceDraftName.set('');
    this.serviceDraftDescription.set('');
  }

  toggleService(service: { id: number }): void {
    this.laundry.toggleServiceCatalogItem(service.id);
    this.serviceVersion.update(value => value + 1);
  }

  deleteService(service: { id: number; name: string }): void {
    this.deleteConfirmation.set({
      type: 'service',
      id: service.id,
      name: service.name,
      title: 'Delete Laundry Service',
      message: `Delete "${service.name}" from Service Catalog?`,
      note: 'This service will no longer appear in Price Master. Existing item rates for this service may no longer be used for new laundry orders.'
    });
  }

  cancelDelete(): void {
    this.deleteConfirmation.set(null);
  }

  confirmDelete(): void {
    const pending = this.deleteConfirmation();
    if (!pending) return;

    if (pending.type === 'catalogue') {
      this.laundry.deleteCatalogueItem(pending.id);
      if (this.editingCatalogueId() === pending.id) this.cancelCatalogueEdit();
    } else {
      this.laundry.deleteServiceCatalogItem(pending.id);
      if (this.editingServiceName() === pending.name) this.cancelServiceDraft();
      this.serviceVersion.update(value => value + 1);
    }

    this.deleteConfirmation.set(null);
  }

  statusClass(status: LaundryStatus | string): string {
    return String(status).toLowerCase().replace(/\s+/g, '-');
  }

  money(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  draftServicePrice(service: string): number {
    const draft = this.catalogueDraft();
    const key = this.normalizeServiceName(service);
    const dynamicPrice = draft.servicePrices?.[key];
    if (dynamicPrice !== undefined) return Number(dynamicPrice || 0);
    return this.priceForService(draft as LaundryCatalogueItem, service);
  }

  setDraftServicePrice(service: string, value: number | string): void {
    const key = this.normalizeServiceName(service);
    const price = Number(value || 0);
    const base = this.serviceBase(service);
    const current = this.catalogueDraft();
    const servicePrices = { ...(current.servicePrices || {}), [key]: price };
    const next: Partial<LaundryCatalogueItem> = { ...current, servicePrices };

    if (base === 'washFold') next.washFold = price;
    if (base === 'washPress') next.washPress = price;
    if (base === 'dryClean') next.dryClean = price;

    this.catalogueDraft.set(next);
  }

  priceForService(item: LaundryCatalogueItem, service: string): number {
    const dynamicPrice = item.servicePrices?.[this.normalizeServiceName(service)];
    if (dynamicPrice !== undefined) return Number(dynamicPrice || 0);
    const base = this.serviceBase(service);
    if (base === 'express') {
      const normal = item.washPress || item.washFold || item.dryClean;
      return Math.round(normal * (1 + Number(item.expressSurcharge || 0) / 100));
    }
    return Number(item[base] || 0);
  }

  serviceIcon(service: string): string {
    const normalized = service.toLowerCase();
    if (normalized.includes('dry')) return 'dry_cleaning';
    if (normalized.includes('fold')) return 'inventory_2';
    if (normalized.includes('press') || normalized.includes('iron')) return 'iron';
    if (normalized.includes('express') || normalized.includes('quick')) return 'bolt';
    return 'local_laundry_service';
  }

  serviceDescription(service: string): string {
    const normalized = service.toLowerCase();
    if (normalized.includes('express')) return 'Priority pickup and room delivery surcharge.';
    if (normalized.includes('dry')) return 'Premium care for delicate garments.';
    if (normalized.includes('fold')) return 'Standard wash, dry and folded packaging.';
    if (normalized.includes('press') || normalized.includes('iron')) return 'Guest-ready press finish for room service.';
    return 'Custom admin configured laundry service.';
  }

  serviceBaseLabel(service: string): string {
    const base = this.serviceBase(service);
    if (base === 'washFold') return 'Wash & Fold rate';
    if (base === 'washPress') return 'Wash & Press rate';
    if (base === 'dryClean') return 'Dry Clean rate';
    return 'Express surcharge';
  }

  serviceHasConfiguredRates(service: string): boolean {
    return this.laundry.catalogue().some(item => item.active && this.priceForService(item, service) > 0);
  }

  currentLineTotal(line: LaundryOrderLine): number {
    return Number(line.quantity || 0) * Number(line.unitPrice || 0);
  }

  formatOrderDateTime(value?: string): string {
    if (!value) return '-';
    const input = this.toDateTimeInput(value);
    if (!input) return value;
    const [date, time] = input.split('T');
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year} ${time}`;
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

  private repriceLine(line: LaundryOrderLine, serviceTypes: LaundryServiceType[]): LaundryOrderLine {
    if (Number(line.catalogueId) === 0) return line;
    const item = this.laundry.catalogueMap().get(Number(line.catalogueId));
    return item ? { ...line, itemName: item.itemName, unitPrice: this.laundry.priceForServices(item, serviceTypes) } : line;
  }

  private normalizeSelectedServices(serviceTypes: LaundryServiceType[]): LaundryServiceType[] {
    return (serviceTypes || [])
      .map(service => String(service || '').trim())
      .filter(Boolean)
      .filter((service, index, list) => list.findIndex(item => item.toLowerCase() === service.toLowerCase()) === index);
  }

  private serviceBase(service: string): 'washFold' | 'washPress' | 'dryClean' | 'express' {
    const normalized = service.toLowerCase();
    const configured = this.laundry.serviceCatalog().find(item => item.serviceName.toLowerCase() === normalized);
    if (configured) return configured.pricingBasis;
    const override = this.serviceBaseOverrides()[normalized];
    if (override) return override;
    if (normalized.includes('express') || normalized.includes('quick')) return 'express';
    if (normalized.includes('fold')) return 'washFold';
    if (normalized.includes('dry')) return 'dryClean';
    return 'washPress';
  }

  private normalizeServiceName(service: string): string {
    return String(service || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private defaultLaundryCategory(): string {
    return this.laundry.categories[0] || 'Laundry Item';
  }

  private defaultDateTimeLocal(hoursFromNow: number): string {
    const date = new Date();
    date.setHours(date.getHours() + hoursFromNow);
    date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    return this.dateToLocalInput(date);
  }

  private dateToLocalInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toDateTimeInput(value?: string): string {
    if (!value) return '';
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}`;
    const display = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (display) return `${display[3]}-${display[2]}-${display[1]}T${display[4]}:${display[5]}`;
    return '';
  }

  private matchesDateRange(value: string | undefined, from: string, to: string): boolean {
    if (!from && !to) return true;
    const input = this.toDateTimeInput(value);
    if (!input) return true;
    const date = input.slice(0, 10);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  private updateTabFromUrl(url: string): void {
    const last = url.split('/').pop()?.split('?')[0] as LaundryTab;
    this.activeTab.set(['dashboard', 'create', 'orders', 'detail', 'catalogue', 'services'].includes(last) ? last : 'dashboard');
    if (this.activeTab() === 'create' && !(this.orderDraft().lines || []).length) this.addOrderLine();
  }

}
