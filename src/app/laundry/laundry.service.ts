import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

export type LaundryTab = 'dashboard' | 'create' | 'orders' | 'detail' | 'linen' | 'catalogue' | 'services';
export type LaundryServiceType = string;
export type LaundryStatus = 'Pickup Pending' | 'Processing' | 'Ready for Delivery' | 'Delivered' | 'Overdue' | 'Cancelled';
export type BillingMode = string;
export type LinenDispatchStatus = 'Draft' | 'Ready for Pickup' | 'Sent to Vendor' | 'Partially Returned' | 'Returned' | 'Exception';

export interface ActiveBooking {
  bookingId: number;
  floor: string;
  room: string;
  guest: string;
  plan: string;
  folioId: string;
}

export interface LaundryCatalogueItem {
  id: number;
  category: string;
  itemName: string;
  washFold: number;
  washPress: number;
  dryClean: number;
  expressSurcharge: number;
  servicePrices: Record<string, number>;
  active: boolean;
}

export interface LaundryServiceCatalogItem {
  id: number;
  serviceName: string;
  pricingBasis: 'washFold' | 'washPress' | 'dryClean' | 'express';
  description: string;
  displayOrder: number;
  active: boolean;
}

export interface LaundryOrderLine {
  catalogueId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

export interface LaundryOrder {
  id: number;
  orderId: string;
  bookingId: number;
  room: string;
  guest: string;
  plan: string;
  serviceType: LaundryServiceType;
  serviceTypes: LaundryServiceType[];
  pickupAt: string;
  expectedDeliveryAt: string;
  deliveredAt?: string;
  billingMode: BillingMode;
  postedToFolio: boolean;
  status: LaundryStatus;
  notes: string;
  createdAt: string;
  lines: LaundryOrderLine[];
}

export interface LaundryDashboardSummary {
  pendingPickup: number;
  inProcess: number;
  ready: number;
  revenue: number;
  overdue: number;
  completedToday: number;
}

export interface LaundryDashboardActivity {
  id: number;
  orderId: string;
  room: string;
  guest: string;
  status: LaundryStatus;
  itemCount: number;
  amount: number;
  createdAt: string;
}

export interface LaundryDashboardData {
  summary: LaundryDashboardSummary;
  activityFeed: LaundryDashboardActivity[];
}

export interface LinenItemMaster {
  id: number;
  itemName: string;
  category: 'Bed Linen' | 'Bath Linen' | 'F&B Linen' | 'Uniform' | 'Other';
  defaultVendorRate: number;
  replacementCost: number;
  active: boolean;
}

export interface LinenDispatchLine {
  id: number;
  itemId: number;
  itemName: string;
  source: string;
  quantity: number;
  returnedQty: number;
  damagedQty: number;
  missingQty: number;
  vendorRate: number;
  scanCodes: string[];
  notes: string;
}

export interface LinenDispatch {
  id: number;
  batchNo: string;
  vendorName: string;
  challanNo: string;
  sentAt: string;
  expectedReturnAt: string;
  returnedAt?: string;
  vehicleNo: string;
  handledBy: string;
  status: LinenDispatchStatus;
  billingRecorded: boolean;
  lines: LinenDispatchLine[];
}

export interface FolioPosting {
  id: number;
  orderId: string;
  folioId: string;
  room: string;
  guest: string;
  amount: number;
  postedAt: string;
}

interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface ApiLaundryPriceMaster {
  id?: number;
  category?: string;
  itemName?: string;
  washFoldPrice?: number;
  washPressPrice?: number;
  dryCleanPrice?: number;
  expressSurchargePercentage?: number;
  servicePrices?: Record<string, number>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiLaundryServiceCatalog {
  id?: number;
  serviceName?: string;
  pricingBasis?: string;
  description?: string;
  displayOrder?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiLaundryOrderItem {
  id?: number;
  priceMasterId?: number;
  itemName?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  notes?: string;
}

interface ApiLaundryOrder {
  id?: number;
  orderId?: string;
  roomId?: number;
  roomNumber?: string;
  floorNumber?: string;
  guestName?: string;
  serviceType?: string;
  serviceTypes?: string[];
  billingOption?: string;
  pickupDatetime?: string;
  expectedDelivery?: string;
  specialInstructions?: string;
  status?: string;
  totalAmount?: number;
  items?: ApiLaundryOrderItem[];
  createdAt?: string;
  updatedAt?: string;
}

interface ApiLaundryDashboardActivity {
  id?: number;
  orderId?: string;
  room?: string;
  roomNumber?: string;
  guest?: string;
  guestName?: string;
  status?: string;
  itemCount?: number;
  amount?: number;
  totalAmount?: number;
  createdAt?: string;
}

interface ApiLaundryDashboardData {
  pendingPickup?: number;
  inProcess?: number;
  ready?: number;
  readyForDelivery?: number;
  revenue?: number;
  todaysRevenue?: number;
  todayRevenue?: number;
  overdue?: number;
  overdueOrders?: number;
  completedToday?: number;
  summary?: Partial<LaundryDashboardSummary> & {
    readyForDelivery?: number;
    todaysRevenue?: number;
    todayRevenue?: number;
    overdueOrders?: number;
  };
  activityFeed?: ApiLaundryDashboardActivity[];
  recentOrders?: ApiLaundryDashboardActivity[];
  liveActivity?: ApiLaundryDashboardActivity[];
}

interface ApiCommonMaster {
  id?: number;
  category?: string;
  code?: string;
  value?: string;
  description?: string;
  isActive?: boolean;
  is_active?: boolean;
}

interface ApiFloor {
  id: number;
  floorNumber: string;
  isActive?: boolean;
}

interface ApiRoom {
  id: number;
  roomNumber: string;
  floorId: number;
  roomTypeId?: number;
  status?: string;
  isActive?: boolean;
}

interface ApiRoomType {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class LaundryService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = '/api/hmsService/v1/laundry';
  private readonly hmsBase = '/api/hmsService/v1';
  private readonly masterBase = '/api/masterService/v1';

  serviceTypes: LaundryServiceType[] = [];
  billingOptions: BillingMode[] = [];
  categories: string[] = ['Top Wear', 'Bottom Wear', 'Ethnic', 'Outerwear', 'Linen', 'Accessories'];
  readonly statuses: LaundryStatus[] = ['Pickup Pending', 'Processing', 'Ready for Delivery', 'Delivered', 'Overdue', 'Cancelled'];
  readonly linenStatuses: LinenDispatchStatus[] = ['Draft', 'Ready for Pickup', 'Sent to Vendor', 'Partially Returned', 'Returned', 'Exception'];
  readonly linenVendors: string[] = [];
  readonly serviceCatalog = signal<LaundryServiceCatalogItem[]>([]);
  readonly activeBookings = signal<ActiveBooking[]>([]);
  readonly catalogue = signal<LaundryCatalogueItem[]>([]);
  readonly orders = signal<LaundryOrder[]>([]);
  readonly dashboardData = signal<LaundryDashboardData | null>(null);
  readonly folioPostings = signal<FolioPosting[]>([]);
  readonly linenItems = signal<LinenItemMaster[]>([]);
  readonly linenDispatches = signal<LinenDispatch[]>([]);

  readonly catalogueMap = computed(() => new Map(this.catalogue().map(item => [item.id, item])));
  readonly linenItemMap = computed(() => new Map(this.linenItems().map(item => [item.id, item])));

  constructor() {
    this.loadDropdownMasters();
    this.loadHotelRooms();
    this.loadPriceMasters();
    this.loadOrders();
    this.loadDashboardData();
  }

  loadDropdownMasters(): void {
    forkJoin({
      serviceCatalog: this.http.get<ApiLaundryServiceCatalog[] | StandardResponse<ApiLaundryServiceCatalog[]>>(`${this.apiBase}/getAllServiceCatalog`),
      laundryItems: this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBase}/common/getCommonMaster/LAUNDRY_ITEM`),
      billingOptions: this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBase}/common/getCommonMaster/LAUNDRY_BILLING_OPTION`)
    }).subscribe({
      next: response => {
        const services = this.listData(response.serviceCatalog).map(service => this.mapServiceCatalog(service));
        this.serviceCatalog.set(services);
        this.serviceTypes = services.filter(service => service.active).map(service => service.serviceName);
        const categories = this.commonMasterValues(response.laundryItems);
        if (categories.length) this.categories = categories;
        this.billingOptions = this.commonMasterValues(response.billingOptions);
        this.refreshOrderLinePrices();
      },
      error: error => console.error('[Laundry] Failed to load laundry dropdown masters', error)
    });
  }

  loadHotelRooms(): void {
    forkJoin({
      floors: this.http.get<StandardResponse<ApiFloor[]>>(`${this.masterBase}/floors/getAllFloors`),
      rooms: this.http.get<StandardResponse<ApiRoom[]>>(`${this.masterBase}/rooms/getAllRooms`),
      roomTypes: this.http.get<StandardResponse<ApiRoomType[]>>(`${this.masterBase}/roomTypes/getAllRoomTypes`)
    }).subscribe({
      next: ({ floors, rooms, roomTypes }) => {
        const activeFloors = (floors.data || []).filter(floor => floor.isActive !== false);
        const floorById = new Map(activeFloors.map(floor => [floor.id, floor.floorNumber]));
        const roomTypeById = new Map((roomTypes.data || []).map(type => [type.id, type.name]));
        const mappedRooms = (rooms.data || [])
          .filter(room => room.isActive !== false)
          .map(room => ({
            bookingId: room.id,
            floor: floorById.get(room.floorId) || '',
            room: room.roomNumber,
            guest: '',
            plan: roomTypeById.get(room.roomTypeId || 0) || room.status || '',
            folioId: ''
          }))
          .filter(room => room.floor && room.room);
        this.activeBookings.set(mappedRooms);
      },
      error: error => console.error('[Laundry] Failed to load hotel floors and rooms', error)
    });
  }

  loadPriceMasters(): void {
    this.http.get<ApiLaundryPriceMaster[] | StandardResponse<ApiLaundryPriceMaster[]>>(`${this.apiBase}/getAllPriceMasters`).subscribe({
      next: response => {
        const items = this.listData(response).map(item => this.mapPriceMaster(item));
        if (items.length) this.catalogue.set(items);
        this.refreshOrderLinePrices();
      },
      error: error => console.error('[Laundry] Failed to load price masters', error)
    });
  }

  loadOrders(): void {
    this.http.get<ApiLaundryOrder[] | StandardResponse<ApiLaundryOrder[]>>(`${this.apiBase}/getAllOrders`).subscribe({
      next: response => {
        const orders = this.listData(response).map(order => this.mapOrder(order));
        if (orders.length) this.orders.set(orders);
        if (!this.dashboardData()) this.dashboardData.set(this.buildLocalDashboardData());
      },
      error: error => console.error('[Laundry] Failed to load orders', error)
    });
  }

  loadDashboardData(): void {
    this.http.get<StandardResponse<ApiLaundryDashboardData>>(`${this.apiBase}/dashboard/getLaundryDashboardData`).subscribe({
      next: response => this.dashboardData.set(this.mapDashboardData(response?.data || null)),
      error: error => {
        console.error('[Laundry] Failed to load dashboard data', error);
        this.dashboardData.set(this.buildLocalDashboardData());
      }
    });
  }

  dashboardSummary(): LaundryDashboardSummary {
    return this.dashboardData()?.summary || this.buildLocalDashboardData().summary;
  }

  dashboardActivity(): LaundryDashboardActivity[] {
    return this.dashboardData()?.activityFeed || this.buildLocalDashboardData().activityFeed;
  }

  orderAmount(order: Pick<LaundryOrder, 'lines'>): number {
    return order.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  }

  orderItemCount(order: Pick<LaundryOrder, 'lines'>): number {
    return order.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }

  linenDispatchCost(dispatch: Pick<LinenDispatch, 'lines'>): number {
    return dispatch.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.vendorRate || 0), 0);
  }

  linenDispatchQuantity(dispatch: Pick<LinenDispatch, 'lines'>): number {
    return dispatch.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }

  linenReturnedQuantity(dispatch: Pick<LinenDispatch, 'lines'>): number {
    return dispatch.lines.reduce((sum, line) => sum + Number(line.returnedQty || 0), 0);
  }

  linenExceptionQuantity(dispatch: Pick<LinenDispatch, 'lines'>): number {
    return dispatch.lines.reduce((sum, line) => sum + Number(line.damagedQty || 0) + Number(line.missingQty || 0), 0);
  }

  linenScanCount(dispatch: Pick<LinenDispatch, 'lines'>): number {
    return dispatch.lines.reduce((sum, line) => sum + line.scanCodes.length, 0);
  }

  priceFor(item: LaundryCatalogueItem, serviceType: LaundryServiceType): number {
    const normalizedService = String(serviceType || '').toLowerCase();
    const dynamicPrice = item.servicePrices?.[this.normalizeServiceName(serviceType)];
    const configuredBasis = this.serviceCatalog().find(service => this.normalizeServiceName(service.serviceName) === this.normalizeServiceName(serviceType))?.pricingBasis;
    const base = configuredBasis === 'washFold' || normalizedService.includes('fold')
      ? item.washFold
      : configuredBasis === 'washPress' || normalizedService.includes('press') || normalizedService.includes('iron')
        ? item.washPress
        : configuredBasis === 'express' || normalizedService.includes('express')
          ? Math.round((item.washPress || item.washFold || item.dryClean) * (1 + item.expressSurcharge / 100))
          : item.dryClean;
    if (dynamicPrice !== undefined) return Number(dynamicPrice || 0) || Number(base || 0);
    if (!normalizedService.includes('express')) return base;
    const expressBase = item.washPress || item.washFold || item.dryClean;
    return Math.round(expressBase * (1 + item.expressSurcharge / 100));
  }

  priceForServices(item: LaundryCatalogueItem, serviceTypes: LaundryServiceType[]): number {
    return this.normalizedServiceSelection(serviceTypes).reduce((sum, service) => sum + this.priceFor(item, service), 0);
  }

  saveCatalogueItem(input: Partial<LaundryCatalogueItem>): void {
    const nextId = Math.max(0, ...this.catalogue().map(item => item.id)) + 1;
    const item: LaundryCatalogueItem = {
      id: input.id ?? nextId,
      category: input.category || 'Top Wear',
      itemName: input.itemName || 'New Item',
      washFold: Number(input.washFold || 0),
      washPress: Number(input.washPress || 0),
      dryClean: Number(input.dryClean || 0),
      expressSurcharge: Number(input.expressSurcharge ?? 50),
      servicePrices: input.servicePrices || {},
      active: input.active ?? true
    };
    this.catalogue.update(items => input.id ? items.map(existing => existing.id === item.id ? item : existing) : [item, ...items]);
    const request$ = input.id
      ? this.http.put<ApiLaundryPriceMaster | StandardResponse<ApiLaundryPriceMaster>>(`${this.apiBase}/updatePriceMaster/${input.id}`, this.toPriceMasterPayload(item))
      : this.http.post<ApiLaundryPriceMaster | StandardResponse<ApiLaundryPriceMaster>>(`${this.apiBase}/createPriceMaster`, this.toPriceMasterPayload(item));
    request$.subscribe({
      next: response => this.upsertCatalogueItem(this.mapPriceMaster(this.itemData(response) || this.toPriceMasterPayload(item))),
      error: error => console.error('[Laundry] Failed to save price master', error)
    });
  }

  toggleCatalogueItem(id: number): void {
    const existing = this.catalogue().find(item => item.id === id);
    if (!existing) return;
    const updated = { ...existing, active: !existing.active };
    this.upsertCatalogueItem(updated);
    this.http.put<ApiLaundryPriceMaster | StandardResponse<ApiLaundryPriceMaster>>(`${this.apiBase}/updatePriceMaster/${id}`, this.toPriceMasterPayload(updated)).subscribe({
      next: response => this.upsertCatalogueItem(this.mapPriceMaster(this.itemData(response) || this.toPriceMasterPayload(updated))),
      error: error => console.error('[Laundry] Failed to update price master status', error)
    });
  }

  saveOrder(input: Partial<LaundryOrder>): LaundryOrder {
    const booking = this.activeBookings().find(item => item.bookingId === Number(input.bookingId)) || this.emptyBooking(input);
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const selectedServices = this.normalizedServiceSelection(input.serviceTypes || (input.serviceType ? this.splitServiceDisplay(input.serviceType) : [this.serviceTypes[0] || '']));
    const order: LaundryOrder = {
      id: input.id ?? nextId,
      orderId: input.orderId || `LND-${1000 + nextId}`,
      bookingId: Number(input.bookingId || booking.bookingId),
      room: input.room || booking.room,
      guest: input.guest || booking.guest,
      plan: input.plan || booking.plan,
      serviceTypes: selectedServices,
      serviceType: this.serviceDisplay(selectedServices),
      pickupAt: input.pickupAt || '',
      expectedDeliveryAt: input.expectedDeliveryAt || '',
      deliveredAt: input.deliveredAt || '',
      billingMode: input.billingMode || 'Room Account',
      postedToFolio: input.postedToFolio ?? false,
      status: input.status || 'Pickup Pending',
      notes: input.notes || '',
      createdAt: input.createdAt || '',
      lines: input.lines?.length ? input.lines.map(line => this.patchOrderLinePrice(line, selectedServices)) : []
    };
    this.orders.update(items => input.id ? items.map(existing => existing.id === order.id ? order : existing) : [order, ...items]);
    this.dashboardData.set(this.buildLocalDashboardData());
    const request$ = input.id
      ? this.http.put<ApiLaundryOrder | StandardResponse<ApiLaundryOrder>>(`${this.apiBase}/updateOrder/${input.id}`, this.toOrderPayload(order))
      : this.http.post<ApiLaundryOrder | StandardResponse<ApiLaundryOrder>>(`${this.apiBase}/createOrder`, this.toOrderPayload(order));
    request$.subscribe({
      next: response => {
        this.upsertOrder(this.mapOrder(this.itemData(response) || this.toOrderPayload(order)));
        this.loadDashboardData();
      },
      error: error => console.error('[Laundry] Failed to save order', error)
    });
    if (order.billingMode === 'Room Account') this.postOrderToFolio(order.id);
    return order;
  }

  updateOrderStatus(id: number, status: LaundryStatus): void {
    this.orders.update(items => items.map(order => order.id === id
      ? { ...order, status, deliveredAt: status === 'Delivered' ? this.nowDisplayDateTime() : order.deliveredAt }
      : order
    ));
    this.dashboardData.set(this.buildLocalDashboardData());
    const params = new HttpParams().set('status', status);
    this.http.patch<ApiLaundryOrder | StandardResponse<ApiLaundryOrder>>(`${this.apiBase}/updateOrderStatus/${id}`, null, { params }).subscribe({
      next: response => {
        this.upsertOrder(this.mapOrder(this.itemData(response) || this.toOrderPayload(this.orders().find(order => order.id === id)!)));
        this.loadDashboardData();
      },
      error: error => console.error('[Laundry] Failed to update order status', error)
    });
  }

  cancelOrder(id: number): void {
    this.updateOrderStatus(id, 'Cancelled');
  }

  deleteOrder(id: number): void {
    this.orders.update(items => items.filter(order => order.id !== id));
    this.dashboardData.set(this.buildLocalDashboardData());
    this.http.delete<void | StandardResponse<void>>(`${this.apiBase}/deleteOrder/${id}`).subscribe({
      next: () => this.loadDashboardData(),
      error: error => console.error('[Laundry] Failed to delete order', error)
    });
  }

  deleteCatalogueItem(id: number): void {
    this.catalogue.update(items => items.filter(item => item.id !== id));
    this.http.delete<void | StandardResponse<void>>(`${this.apiBase}/deletePriceMaster/${id}`).subscribe({
      error: error => console.error('[Laundry] Failed to delete price master', error)
    });
  }

  saveServiceCatalogItem(input: Partial<LaundryServiceCatalogItem>): void {
    const nextId = Math.max(0, ...this.serviceCatalog().map(item => item.id)) + 1;
    const item: LaundryServiceCatalogItem = {
      id: input.id ?? nextId,
      serviceName: input.serviceName || 'New Service',
      pricingBasis: input.pricingBasis || 'washPress',
      description: input.description || '',
      displayOrder: Number(input.displayOrder || this.serviceCatalog().length + 1),
      active: input.active ?? true
    };
    if (input.id) this.upsertServiceCatalogItem(item);
    const request$ = input.id
      ? this.http.put<ApiLaundryServiceCatalog | StandardResponse<ApiLaundryServiceCatalog>>(`${this.apiBase}/updateServiceCatalog/${input.id}`, this.toServiceCatalogPayload(item))
      : this.http.post<ApiLaundryServiceCatalog | StandardResponse<ApiLaundryServiceCatalog>>(`${this.apiBase}/createServiceCatalog`, this.toServiceCatalogPayload(item));
    request$.subscribe({
      next: response => this.upsertServiceCatalogItem(this.mapServiceCatalog(this.itemData(response) || this.toServiceCatalogPayload(item))),
      error: error => console.error('[Laundry] Failed to save service catalog', error)
    });
  }

  toggleServiceCatalogItem(id: number): void {
    const existing = this.serviceCatalog().find(item => item.id === id);
    if (!existing) return;
    this.saveServiceCatalogItem({ ...existing, active: !existing.active });
  }

  deleteServiceCatalogItem(id: number): void {
    this.serviceCatalog.update(items => items.filter(item => item.id !== id));
    this.syncServiceTypes();
    this.http.delete<void | StandardResponse<void>>(`${this.apiBase}/deleteServiceCatalog/${id}`).subscribe({
      error: error => console.error('[Laundry] Failed to delete service catalog', error)
    });
  }

  postOrderToFolio(id: number): void {
    const order = this.orders().find(item => item.id === id);
    if (!order || order.postedToFolio || order.billingMode !== 'Room Account') return;
    const booking = this.activeBookings().find(item => item.bookingId === order.bookingId);
    const posting: FolioPosting = {
      id: Math.max(0, ...this.folioPostings().map(item => item.id)) + 1,
      orderId: order.orderId,
      folioId: booking?.folioId || `FOL-${order.room}`,
      room: order.room,
      guest: order.guest,
      amount: this.orderAmount(order),
      postedAt: this.nowDisplayDateTime()
    };
    this.folioPostings.update(items => [posting, ...items]);
    this.orders.update(items => items.map(item => item.id === id ? { ...item, postedToFolio: true } : item));
  }

  saveLinenDispatch(input: Partial<LinenDispatch>): LinenDispatch {
    const nextId = Math.max(0, ...this.linenDispatches().map(item => item.id)) + 1;
    const dispatch: LinenDispatch = {
      id: input.id ?? nextId,
      batchNo: input.batchNo || `LIN-OUT-${1000 + nextId}`,
      vendorName: input.vendorName || '',
      challanNo: input.challanNo || `CH-${3100 + nextId}`,
      sentAt: input.sentAt || '',
      expectedReturnAt: input.expectedReturnAt || '',
      returnedAt: input.returnedAt || '',
      vehicleNo: input.vehicleNo || '',
      handledBy: input.handledBy || 'Laundry Supervisor',
      status: input.status || 'Ready for Pickup',
      billingRecorded: input.billingRecorded ?? false,
      lines: (input.lines || []).map((line, index) => ({
        id: line.id || index + 1,
        itemId: Number(line.itemId || 0),
        itemName: line.itemName || this.linenItemMap().get(Number(line.itemId || 0))?.itemName || 'Linen Item',
        source: line.source || 'Linen Room',
        quantity: Math.max(1, Number(line.quantity || 1)),
        returnedQty: Math.max(0, Number(line.returnedQty || 0)),
        damagedQty: Math.max(0, Number(line.damagedQty || 0)),
        missingQty: Math.max(0, Number(line.missingQty || 0)),
        vendorRate: Math.max(0, Number(line.vendorRate || 0)),
        scanCodes: line.scanCodes || [],
        notes: line.notes || ''
      }))
    };
    this.linenDispatches.update(items => input.id ? items.map(item => item.id === dispatch.id ? dispatch : item) : [dispatch, ...items]);
    return dispatch;
  }

  updateLinenDispatchStatus(id: number, status: LinenDispatchStatus): void {
    this.linenDispatches.update(items => items.map(dispatch => dispatch.id === id
      ? { ...dispatch, status, returnedAt: status === 'Returned' || status === 'Partially Returned' ? dispatch.returnedAt || this.nowDisplayDateTime() : dispatch.returnedAt }
      : dispatch
    ));
  }

  recordLinenBilling(id: number): void {
    this.linenDispatches.update(items => items.map(dispatch => dispatch.id === id ? { ...dispatch, billingRecorded: true } : dispatch));
  }

  private upsertCatalogueItem(item: LaundryCatalogueItem): void {
    this.catalogue.update(items => items.some(existing => existing.id === item.id)
      ? items.map(existing => existing.id === item.id ? item : existing)
      : [item, ...items]
    );
  }

  private upsertServiceCatalogItem(item: LaundryServiceCatalogItem): void {
    this.serviceCatalog.update(items => {
      const next = items.some(existing => existing.id === item.id)
        ? items.map(existing => existing.id === item.id ? item : existing)
        : [...items, item];
      return next.sort((a, b) => a.displayOrder - b.displayOrder || a.serviceName.localeCompare(b.serviceName));
    });
    this.syncServiceTypes();
  }

  private upsertOrder(order: LaundryOrder): void {
    this.orders.update(items => items.some(existing => existing.id === order.id)
      ? items.map(existing => existing.id === order.id ? order : existing)
      : [order, ...items]
    );
  }

  private mapDashboardData(data: ApiLaundryDashboardData | null): LaundryDashboardData {
    if (!data) return this.buildLocalDashboardData();
    const summary = data.summary || {};
    const activity = data.activityFeed || data.recentOrders || data.liveActivity || [];
    return {
      summary: {
        pendingPickup: Number(summary.pendingPickup ?? data.pendingPickup ?? 0),
        inProcess: Number(summary.inProcess ?? data.inProcess ?? 0),
        ready: Number(summary.ready ?? summary.readyForDelivery ?? data.ready ?? data.readyForDelivery ?? 0),
        revenue: Number(summary.revenue ?? summary.todaysRevenue ?? summary.todayRevenue ?? data.revenue ?? data.todaysRevenue ?? data.todayRevenue ?? 0),
        overdue: Number(summary.overdue ?? summary.overdueOrders ?? data.overdue ?? data.overdueOrders ?? 0),
        completedToday: Number(summary.completedToday ?? data.completedToday ?? 0)
      },
      activityFeed: activity.map(item => this.mapDashboardActivity(item)).filter(item => item.orderId).slice(0, 10)
    };
  }

  private mapDashboardActivity(item: ApiLaundryDashboardActivity): LaundryDashboardActivity {
    const matchingOrder = this.orders().find(order =>
      order.id === Number(item.id || 0) ||
      order.orderId === String(item.orderId || '')
    );
    return {
      id: Number(item.id || matchingOrder?.id || 0),
      orderId: item.orderId || matchingOrder?.orderId || '',
      room: item.room || item.roomNumber || matchingOrder?.room || '',
      guest: item.guest || item.guestName || matchingOrder?.guest || '',
      status: this.asLaundryStatus(item.status || matchingOrder?.status),
      itemCount: Number(item.itemCount ?? (matchingOrder ? this.orderItemCount(matchingOrder) : 0)),
      amount: Number(item.amount ?? item.totalAmount ?? (matchingOrder ? this.orderAmount(matchingOrder) : 0)),
      createdAt: this.displayDateTime(item.createdAt) || matchingOrder?.createdAt || ''
    };
  }

  private buildLocalDashboardData(): LaundryDashboardData {
    const orders = this.orders();
    return {
      summary: {
        pendingPickup: orders.filter(order => order.status === 'Pickup Pending').length,
        inProcess: orders.filter(order => order.status === 'Processing').length,
        ready: orders.filter(order => order.status === 'Ready for Delivery').length,
        revenue: orders.filter(order => this.isToday(order.createdAt)).reduce((sum, order) => sum + this.orderAmount(order), 0),
        overdue: orders.filter(order => order.status === 'Overdue').length,
        completedToday: orders.filter(order => order.status === 'Delivered' && this.isToday(order.createdAt)).length
      },
      activityFeed: [...orders]
        .sort((a, b) => b.id - a.id)
        .slice(0, 10)
        .map(order => ({
          id: order.id,
          orderId: order.orderId,
          room: order.room,
          guest: order.guest,
          status: order.status,
          itemCount: this.orderItemCount(order),
          amount: this.orderAmount(order),
          createdAt: order.createdAt
        }))
    };
  }

  private isToday(value?: string): boolean {
    if (!value) return false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (value.startsWith(today)) return true;
    const match = value.match(/^(\d{2})-(\d{2})-(\d{4})/);
    return Boolean(match && `${match[3]}-${match[2]}-${match[1]}` === today);
  }

  private mapPriceMaster(item: ApiLaundryPriceMaster): LaundryCatalogueItem {
    return {
      id: Number(item.id || 0),
      category: item.category || 'Top Wear',
      itemName: item.itemName || 'Laundry Item',
      washFold: Number(item.washFoldPrice || 0),
      washPress: Number(item.washPressPrice || 0),
      dryClean: Number(item.dryCleanPrice || 0),
      expressSurcharge: Number(item.expressSurchargePercentage ?? 50),
      servicePrices: this.normalizeServicePrices(item.servicePrices || {}),
      active: String(item.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    };
  }

  private toPriceMasterPayload(item: LaundryCatalogueItem): ApiLaundryPriceMaster {
    return {
      id: item.id > 0 ? item.id : undefined,
      category: item.category,
      itemName: item.itemName,
      washFoldPrice: Number(item.washFold || 0),
      washPressPrice: Number(item.washPress || 0),
      dryCleanPrice: Number(item.dryClean || 0),
      expressSurchargePercentage: Number(item.expressSurcharge || 0),
      servicePrices: this.buildServicePrices(item),
      status: item.active ? 'ACTIVE' : 'INACTIVE'
    };
  }

  private mapServiceCatalog(item: ApiLaundryServiceCatalog): LaundryServiceCatalogItem {
    return {
      id: Number(item.id || 0),
      serviceName: item.serviceName || 'Laundry Service',
      pricingBasis: this.asPricingBasis(item.pricingBasis),
      description: item.description || '',
      displayOrder: Number(item.displayOrder || 0),
      active: String(item.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    };
  }

  private toServiceCatalogPayload(item: LaundryServiceCatalogItem): ApiLaundryServiceCatalog {
    return {
      id: item.id > 0 ? item.id : undefined,
      serviceName: item.serviceName,
      pricingBasis: item.pricingBasis,
      description: item.description,
      displayOrder: Number(item.displayOrder || 0),
      status: item.active ? 'ACTIVE' : 'INACTIVE'
    };
  }

  private mapOrder(order: ApiLaundryOrder): LaundryOrder {
    const booking = this.bookingForOrder(order);
    const id = Number(order.id || 0);
    return {
      id,
      orderId: order.orderId || `LND-${1000 + id}`,
      bookingId: Number(order.roomId || booking.bookingId),
      room: order.roomNumber || booking.room,
      guest: order.guestName || booking.guest,
      plan: booking.plan,
      serviceTypes: this.normalizedServiceSelection(order.serviceTypes || this.splitServiceDisplay(order.serviceType)),
      serviceType: this.serviceDisplay(order.serviceTypes || this.splitServiceDisplay(order.serviceType)),
      pickupAt: this.displayDateTime(order.pickupDatetime),
      expectedDeliveryAt: this.displayDateTime(order.expectedDelivery),
      billingMode: this.asBillingMode(order.billingOption),
      postedToFolio: false,
      status: this.asLaundryStatus(order.status),
      notes: order.specialInstructions || '',
      createdAt: this.displayDateTime(order.createdAt) || '',
      lines: (order.items || []).map(item => this.mapOrderLine(item, order.serviceType))
    };
  }

  private mapOrderLine(item: ApiLaundryOrderItem, serviceType?: string): LaundryOrderLine {
    const catalogueItem = this.catalogue().find(value => value.id === Number(item.priceMasterId));
    const services = this.normalizedServiceSelection(this.splitServiceDisplay(serviceType));
    const patchedPrice = Number(item.unitPrice || 0) || (catalogueItem && services.length ? this.priceForServices(catalogueItem, services) : 0);
    return {
      catalogueId: Number(item.priceMasterId || catalogueItem?.id || 0),
      itemName: item.itemName || catalogueItem?.itemName || 'Laundry Item',
      quantity: Math.max(1, Number(item.quantity || 1)),
      unitPrice: Number(patchedPrice || 0),
      notes: item.notes || ''
    };
  }

  private patchOrderLinePrice(line: LaundryOrderLine, serviceTypes: string[]): LaundryOrderLine {
    const catalogueItem = this.catalogueMap().get(Number(line.catalogueId));
    const selectedServices = this.normalizedServiceSelection(serviceTypes);
    const resolvedPrice = Number(line.unitPrice || 0) || (catalogueItem ? this.priceForServices(catalogueItem, selectedServices) : 0);
    return {
      ...line,
      itemName: line.itemName || catalogueItem?.itemName || '',
      quantity: Math.max(1, Number(line.quantity || 1)),
      unitPrice: Number(resolvedPrice || 0)
    };
  }

  private refreshOrderLinePrices(): void {
    if (!this.orders().length || !this.catalogue().length) return;
    this.orders.update(orders => orders.map(order => ({
      ...order,
      lines: order.lines.map(line => this.patchOrderLinePrice(line, order.serviceTypes || this.splitServiceDisplay(order.serviceType)))
    })));
  }

  private toOrderPayload(order: LaundryOrder): ApiLaundryOrder {
    return {
      id: order.id > 0 ? order.id : undefined,
      orderId: order.orderId,
      roomId: Number(order.bookingId || 0) || undefined,
      roomNumber: order.room,
      floorNumber: this.activeBookings().find(booking => booking.bookingId === order.bookingId)?.floor,
      guestName: order.guest,
      serviceType: order.serviceType,
      serviceTypes: order.serviceTypes,
      billingOption: order.billingMode,
      pickupDatetime: this.apiDateTime(order.pickupAt),
      expectedDelivery: this.apiDateTime(order.expectedDeliveryAt),
      specialInstructions: order.notes,
      status: order.status,
      totalAmount: this.orderAmount(order),
      items: order.lines.map(line => ({
        priceMasterId: Number(line.catalogueId) > 0 ? Number(line.catalogueId) : undefined,
        itemName: line.itemName,
        category: this.catalogueMap().get(Number(line.catalogueId))?.category || '',
        quantity: Math.max(1, Number(line.quantity || 1)),
        unitPrice: Number(line.unitPrice || 0),
        total: Number(line.quantity || 0) * Number(line.unitPrice || 0),
        notes: line.notes || ''
      }))
    };
  }

  private bookingForOrder(order: ApiLaundryOrder): ActiveBooking {
    return this.activeBookings().find(booking =>
      booking.bookingId === Number(order.roomId) ||
      booking.room === String(order.roomNumber || '')
    ) || this.activeBookings()[0] || {
      bookingId: Number(order.roomId || 0),
      floor: order.floorNumber || 'Floor 1',
      room: order.roomNumber || '',
      guest: order.guestName || '',
      plan: 'Room Account',
      folioId: ''
    };
  }

  private emptyBooking(input?: Partial<LaundryOrder>): ActiveBooking {
    return {
      bookingId: Number(input?.bookingId || 0),
      floor: '',
      room: input?.room || '',
      guest: input?.guest || '',
      plan: input?.plan || '',
      folioId: ''
    };
  }

  private asServiceType(value?: string): LaundryServiceType {
    return this.serviceTypes.find(item => item.toLowerCase() === String(value || '').toLowerCase()) || String(value || this.serviceTypes[0] || '');
  }

  private asBillingMode(value?: string): BillingMode {
    return this.billingOptions.find(item => item.toLowerCase() === String(value || '').toLowerCase()) || String(value || this.billingOptions[0] || '');
  }

  private asLaundryStatus(value?: string): LaundryStatus {
    const normalized = String(value || '').replace(/_/g, ' ').toLowerCase();
    return this.statuses.find(status => status.toLowerCase() === normalized) || 'Pickup Pending';
  }

  private asPricingBasis(value?: string): LaundryServiceCatalogItem['pricingBasis'] {
    const normalized = String(value || '').trim();
    return ['washFold', 'washPress', 'dryClean', 'express'].includes(normalized)
      ? normalized as LaundryServiceCatalogItem['pricingBasis']
      : 'washPress';
  }

  private buildServicePrices(item: LaundryCatalogueItem): Record<string, number> {
    const prices: Record<string, number> = { ...this.normalizeServicePrices(item.servicePrices || {}) };
    for (const service of this.serviceCatalog()) {
      if (!service.active) continue;
      const key = this.normalizeServiceName(service.serviceName);
      if (!key) continue;
      if (prices[key] !== undefined) continue;
      if (service.pricingBasis === 'washFold') prices[key] = Number(item.washFold || 0);
      if (service.pricingBasis === 'washPress') prices[key] = Number(item.washPress || 0);
      if (service.pricingBasis === 'dryClean') prices[key] = Number(item.dryClean || 0);
      if (service.pricingBasis === 'express') {
        const base = item.washPress || item.washFold || item.dryClean || 0;
        prices[key] = Math.round(base * (1 + Number(item.expressSurcharge || 0) / 100));
      }
    }
    return prices;
  }

  private normalizeServicePrices(servicePrices: Record<string, number>): Record<string, number> {
    return Object.entries(servicePrices).reduce<Record<string, number>>((acc, [serviceName, price]) => {
      const key = this.normalizeServiceName(serviceName);
      if (key) acc[key] = Number(price || 0);
      return acc;
    }, {});
  }

  private normalizeServiceName(serviceName: string): string {
    return String(serviceName || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  serviceDisplay(serviceTypes: string[]): string {
    return this.normalizedServiceSelection(serviceTypes).join(', ');
  }

  private normalizedServiceSelection(serviceTypes: string[]): string[] {
    return (serviceTypes || [])
      .map(service => String(service || '').trim())
      .filter(Boolean)
      .filter((service, index, list) => list.findIndex(item => item.toLowerCase() === service.toLowerCase()) === index);
  }

  private splitServiceDisplay(serviceType?: string): string[] {
    return String(serviceType || '')
      .split(',')
      .map(service => service.trim())
      .filter(Boolean);
  }

  private syncServiceTypes(): void {
    this.serviceTypes = this.serviceCatalog()
      .filter(service => service.active)
      .map(service => service.serviceName);
  }

  private apiDateTime(value?: string): string | undefined {
    if (!value) return undefined;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
    const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!match) return value;
    return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00`;
  }

  private displayDateTime(value?: string): string {
    if (!value) return '';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return value;
    return `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}`;
  }

  private nowDisplayDateTime(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  private listData<T>(response: T[] | StandardResponse<T[]> | null): T[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    return response.data || [];
  }

  private itemData<T>(response: T | StandardResponse<T> | null): T | null {
    if (!response) return null;
    if (typeof response === 'object' && 'success' in response) return response.data || null;
    return response;
  }

  private commonMasterValues(response: ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]> | null): string[] {
    return this.listData(response)
      .filter(item => item.isActive ?? item.is_active ?? true)
      .map(item => String(item.value || item.code || '').trim())
      .filter(Boolean);
  }
}
