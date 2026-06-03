import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { UserManagementService } from '../user-management/user-management.service';

export type PosTab = 'outlets' | 'dining' | 'orders' | 'billing' | 'menu';
export type OutletType = string;
export type OutletStatus = 'ACTIVE' | 'INACTIVE';
export type TableStatus = string;
export type OrderType = 'TABLE' | 'TAKEAWAY' | 'ROOM';
export type OrderStatus = string;
export type BillStatus = string;
export type PaymentMode = string;
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface PosOutlet {
  id: number;
  name: string;
  typeId?: number;
  type: OutletType;
  location: string;
  timing: string;
  taxProfile: string;
  managerId?: number;
  active: boolean;
  manager: string;
}

export interface PosMenuItem {
  id: number;
  outletId: number;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  taxPercent: number;
  variants: string[];
  modifiers: string[];
  available: boolean;
  featured: boolean;
  happyHourPrice?: number;
  happyHourWindow?: string;
  stockItem: string;
  imageUrl: string;
}

export interface PosTable {
  id: number;
  outletId: number;
  number: string;
  section: string;
  status: TableStatus;
  covers: number;
  server: string;
  guestName?: string;
  bookingTime?: string;
  mergedWith?: string;
}

export interface PosOrderLine {
  itemId: number;
  name: string;
  qty: number;
  price: number;
  course: string;
  notes: string;
}

export interface PosOrder {
  id: number;
  outletId: number;
  orderNo: string;
  type: OrderType;
  floorId?: number | null;
  roomId?: number | null;
  tableNo?: string;
  roomNo?: string;
  guestName?: string;
  server: string;
  status: OrderStatus;
  kotNo?: string;
  openedAt: string;
  notes: string;
  lines: PosOrderLine[];
}

export interface PosBill {
  id: number;
  orderId: number;
  billNo: string;
  orderType?: OrderType;
  tableNo?: string;
  floorId?: number | null;
  roomId?: number | null;
  guestName?: string;
  roomNo?: string;
  subtotal: number;
  discount: number;
  tax: number;
  compReason?: string;
  paid: number;
  status: BillStatus;
  paymentModes: PaymentMode[];
  postedToFolio: boolean;
}

export interface PosShift {
  id: number;
  outletId: number;
  name: string;
  cashier: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  roomCharges: number;
  discounts: number;
  voids: number;
  comps: number;
  status: ShiftStatus;
}

export interface PosAuditLog {
  id: number;
  at: string;
  user: string;
  action: string;
  module: string;
  reference: string;
}

interface ApiOutlet {
  id: number;
  name?: string;
  typeId?: number;
  typeValue?: string;
  location?: string;
  timing?: string;
  taxProfile?: string;
  managerId?: number;
  managerName?: string;
  isActive?: boolean;
}

interface ApiDiningTable {
  id: number;
  outletId?: number;
  outletName?: string;
  tableNumber?: string;
  section?: string;
  status?: TableStatus;
  covers?: number;
  serverId?: number;
  serverName?: string;
  linkedTableId?: number;
  linkedTableNumber?: string;
}

interface ApiMenuItem {
  id: number;
  outletId?: number;
  outletName?: string;
  itemName?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
  price?: number;
  taxPercent?: number;
  variants?: string;
  modifiers?: string;
  happyHourPrice?: number;
  happyHourWindow?: string;
  linkedStockItem?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
}

interface StandardResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
}

interface ApiCommonMaster {
  id?: number;
  category?: string;
  code?: string;
  value?: string;
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);
  private readonly userManagement = inject(UserManagementService);
  private readonly posBaseUrl = '/api/hmsService/v1/pos';
  private readonly hmsBaseUrl = '/api/hmsService/v1';
  private readonly defaultOutletTypes: OutletType[] = ['Restaurant', 'Bar', 'Cafe', 'Spa', 'Gift Shop', 'Room Service', 'Mini Bar'];
  private readonly defaultShiftSchedules: string[] = ['09:00 AM - 09:00 PM', '07:00 AM - 11:00 PM', '05:00 PM - 01:00 AM', '24 Hours'];
  private readonly defaultTableStatuses: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED', 'MOPPING', 'DIRTY'];
  private readonly defaultTableSections: string[] = ['Indoor', 'Patio', 'Lounge', 'Bar Counter'];
  private readonly defaultOrderStatuses: OrderStatus[] = ['OPEN', 'KOT_SENT', 'HELD', 'BILLED', 'CANCELLED'];
  private readonly defaultBillStatuses: BillStatus[] = ['OPEN', 'PARTIAL', 'PAID', 'VOID'];
  private readonly defaultPaymentModes: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Room Charge', 'City Ledger', 'Voucher'];
  private readonly defaultVoidReasons: string[] = ['Void marked by supervisor', 'Guest complaint', 'Wrong item billed', 'Manager approval'];
  private readonly defaultUsers = ['Rajan Mehta', 'Meena Pillai', 'Arjun Menon', 'Deepa Thomas', 'Outlet Manager'];

  readonly outletTypes = signal<OutletType[]>(this.defaultOutletTypes);
  readonly outletTypeMasters = signal<ApiCommonMaster[]>([]);
  readonly shiftSchedules = signal<string[]>(this.defaultShiftSchedules);
  readonly tableStatuses = signal<TableStatus[]>(this.defaultTableStatuses);
  readonly tableSections = signal<string[]>(this.defaultTableSections);
  readonly orderStatuses = signal<OrderStatus[]>(this.defaultOrderStatuses);
  readonly billStatuses = signal<BillStatus[]>(this.defaultBillStatuses);
  readonly paymentModes = signal<PaymentMode[]>(this.defaultPaymentModes);
  readonly voidReasons = signal<string[]>(this.defaultVoidReasons);
  readonly users = computed(() => {
    const names = this.userManagement.users()
      .filter(user => user.status === 'ACTIVE')
      .map(user => user.fullName)
      .filter(Boolean);
    return names.length ? names : this.defaultUsers;
  });

  readonly outlets = signal<PosOutlet[]>([
    { id: 1, name: 'Azure Restaurant', type: 'Restaurant', location: 'Lobby Level', timing: '07:00 AM - 11:00 PM', taxProfile: 'GST 5% Food', active: true, manager: 'Outlet Manager' },
    { id: 2, name: 'Skyline Bar', type: 'Bar', location: 'Rooftop', timing: '05:00 PM - 01:00 AM', taxProfile: 'GST 18% Beverage', active: true, manager: 'Rajan Mehta' },
    { id: 3, name: 'In-Room Dining', type: 'Room Service', location: 'Service Pantry', timing: '24 Hours', taxProfile: 'GST Mixed', active: true, manager: 'Meena Pillai' },
    { id: 4, name: 'Spa Retail', type: 'Spa', location: 'Wellness Floor', timing: '09:00 AM - 09:00 PM', taxProfile: 'GST 18% Services', active: false, manager: 'Deepa Thomas' }
  ]);

  readonly menuItems = signal<PosMenuItem[]>([
    { id: 1, outletId: 1, name: 'Paneer Tikka', category: 'Food', subcategory: 'Starter', price: 420, taxPercent: 5, variants: ['Half', 'Full'], modifiers: ['Extra chutney', 'No onion'], available: true, featured: true, happyHourPrice: 360, happyHourWindow: '04:00 PM - 06:00 PM', stockItem: 'Paneer Block', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=240&q=80' },
    { id: 2, outletId: 1, name: 'Dal Makhani', category: 'Food', subcategory: 'Main Course', price: 380, taxPercent: 5, variants: ['Regular', 'Large'], modifiers: ['Less spice', 'Extra butter'], available: true, featured: false, stockItem: 'Black Lentil', imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=240&q=80' },
    { id: 3, outletId: 2, name: 'Classic Mojito', category: 'Beverage', subcategory: 'Cocktail', price: 650, taxPercent: 18, variants: ['Classic', 'Virgin'], modifiers: ['Less ice', 'Extra mint'], available: true, featured: true, happyHourPrice: 499, happyHourWindow: '05:00 PM - 07:00 PM', stockItem: 'Mint Syrup', imageUrl: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=240&q=80' },
    { id: 4, outletId: 3, name: 'Club Sandwich', category: 'Food', subcategory: 'Room Service', price: 520, taxPercent: 5, variants: ['Veg', 'Chicken'], modifiers: ['No mayo', 'Extra fries'], available: true, featured: true, stockItem: 'Bread Loaf', imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=240&q=80' },
    { id: 5, outletId: 4, name: 'Aroma Oil', category: 'Retail', subcategory: 'Spa Product', price: 900, taxPercent: 18, variants: ['Lavender', 'Jasmine'], modifiers: [], available: false, featured: false, stockItem: 'Aroma Oil Bottle', imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=240&q=80' }
  ]);

  readonly tables = signal<PosTable[]>([
    { id: 1, outletId: 1, number: 'T01', section: 'Indoor', status: 'OCCUPIED', covers: 3, server: 'Arjun Menon' },
    { id: 2, outletId: 1, number: 'T02', section: 'Indoor', status: 'AVAILABLE', covers: 0, server: 'Unassigned' },
    { id: 3, outletId: 1, number: 'T03', section: 'Patio', status: 'RESERVED', covers: 4, server: 'Rajan Mehta', guestName: 'Rajan Mehta', bookingTime: 'Today, 08:00 PM' },
    { id: 4, outletId: 2, number: 'B01', section: 'Bar Counter', status: 'BILLED', covers: 2, server: 'Deepa Thomas' },
    { id: 5, outletId: 2, number: 'B02', section: 'Lounge', status: 'AVAILABLE', covers: 0, server: 'Unassigned' }
  ]);

  readonly orders = signal<PosOrder[]>([
    {
      id: 1,
      outletId: 1,
      orderNo: 'ORD-1001',
      type: 'TABLE',
      tableNo: 'T01',
      server: 'Arjun Menon',
      status: 'KOT_SENT',
      kotNo: 'KOT-501',
      openedAt: 'Today, 01:15 PM',
      notes: 'Starter first, less spice.',
      lines: [
        { itemId: 1, name: 'Paneer Tikka', qty: 2, price: 420, course: 'Starter', notes: 'No onion' },
        { itemId: 2, name: 'Dal Makhani', qty: 1, price: 380, course: 'Main', notes: 'Extra butter' }
      ]
    },
    {
      id: 2,
      outletId: 3,
      orderNo: 'ORD-1002',
      type: 'ROOM',
      roomNo: '102',
      guestName: 'Rajan Mehta',
      server: 'Meena Pillai',
      status: 'OPEN',
      openedAt: 'Today, 02:05 PM',
      notes: 'Post to room after guest confirmation.',
      lines: [
        { itemId: 4, name: 'Club Sandwich', qty: 2, price: 520, course: 'Main', notes: 'Extra fries' }
      ]
    }
  ]);

  readonly bills = signal<PosBill[]>([
    { id: 1, orderId: 1, billNo: 'BILL-7001', subtotal: 1220, discount: 100, tax: 56, paid: 1176, status: 'PAID', paymentModes: ['Card'], postedToFolio: false },
    { id: 2, orderId: 2, billNo: 'BILL-7002', guestName: 'Rajan Mehta', roomNo: '102', subtotal: 1040, discount: 0, tax: 52, paid: 0, status: 'OPEN', paymentModes: ['Room Charge'], postedToFolio: false }
  ]);

  readonly shifts = signal<PosShift[]>([
    { id: 1, outletId: 1, name: 'Lunch Shift', cashier: 'Rajan Mehta', openedAt: 'Today, 11:00 AM', openingCash: 5000, cashSales: 4200, cardSales: 11800, upiSales: 3200, roomCharges: 2800, discounts: 700, voids: 1, comps: 0, status: 'OPEN' },
    { id: 2, outletId: 2, name: 'Bar Evening', cashier: 'Deepa Thomas', openedAt: 'Yesterday, 05:00 PM', closedAt: 'Today, 01:15 AM', openingCash: 8000, cashSales: 9200, cardSales: 26800, upiSales: 5400, roomCharges: 11200, discounts: 1200, voids: 2, comps: 1, status: 'CLOSED' }
  ]);

  readonly auditLogs = signal<PosAuditLog[]>([
    { id: 1, at: 'Today, 02:16 PM', user: 'Outlet Manager', action: 'Discount approved', module: 'Billing', reference: 'BILL-7001' },
    { id: 2, at: 'Today, 02:10 PM', user: 'Meena Pillai', action: 'Room charge validated', module: 'Room Posting', reference: 'Room 102' },
    { id: 3, at: 'Today, 01:22 PM', user: 'Arjun Menon', action: 'KOT sent to hot kitchen', module: 'KOT', reference: 'KOT-501' }
  ]);

  readonly outletMap = computed(() => new Map(this.outlets().map(outlet => [outlet.id, outlet])));

  constructor() {
    this.loadPosMasters();
  }

  loadPosMasters(): void {
    this.loadOutletTypes();
    this.loadShiftSchedules();
    this.loadTableStatuses();
    this.loadTableSections();
    this.loadOrderStatuses();
    this.loadBillStatuses();
    this.loadPaymentModes();
    this.loadVoidReasons();
    this.loadOutlets();
    this.loadTables();
    this.loadMenuItems();
  }

  loadOutletTypes(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/OUTLET_TYPE`).subscribe({
      next: response => {
        const outletTypes = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        this.outletTypeMasters.set(this.commonMastersData(response));
        if (outletTypes.length) this.outletTypes.set(outletTypes);
      },
      error: error => this.addAudit('Unable to load outlet types from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadShiftSchedules(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/SHIFT_SCHEDULE`).subscribe({
      next: response => {
        const shiftSchedules = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (shiftSchedules.length) this.shiftSchedules.set(shiftSchedules);
      },
      error: error => this.addAudit('Unable to load shift schedules from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTableStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/TABLE_STATUS`).subscribe({
      next: response => {
        const tableStatuses = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (tableStatuses.length) this.tableStatuses.set(tableStatuses);
      },
      error: error => this.addAudit('Unable to load table statuses from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTableSections(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/TABLE_SECTION`).subscribe({
      next: response => {
        const tableSections = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (tableSections.length) this.tableSections.set(tableSections);
      },
      error: error => this.addAudit('Unable to load table sections from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadOrderStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/ORDER_STATUS`).subscribe({
      next: response => {
        const orderStatuses = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (orderStatuses.length) this.orderStatuses.set(orderStatuses);
      },
      error: error => this.addAudit('Unable to load order statuses from API', 'Orders', error?.error?.message || error?.message || 'API error')
    });
  }

  loadBillStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/BILL_STATUS`).subscribe({
      next: response => {
        const billStatuses = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (billStatuses.length) this.billStatuses.set(billStatuses);
      },
      error: error => this.addAudit('Unable to load bill statuses from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  loadPaymentModes(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/PAYMENT_MODE`).subscribe({
      next: response => {
        const paymentModes = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (paymentModes.length) this.paymentModes.set(paymentModes);
      },
      error: error => this.addAudit('Unable to load payment modes from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  loadVoidReasons(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/VOID_REASON`).subscribe({
      next: response => {
        const voidReasons = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (voidReasons.length) this.voidReasons.set(voidReasons);
      },
      error: error => this.addAudit('Unable to load void reasons from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  loadOutlets(): void {
    this.http.get<ApiOutlet[]>(`${this.posBaseUrl}/outlets/getAllOutlets`).subscribe({
      next: response => this.outlets.set((response || []).map(item => this.mapOutlet(item))),
      error: error => this.addAudit('Unable to load outlets from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTables(outletId?: number): void {
    const url = outletId
      ? `${this.posBaseUrl}/tables/getAllTables?outletId=${outletId}`
      : `${this.posBaseUrl}/tables/getAllTables`;
    this.http.get<ApiDiningTable[]>(url).subscribe({
      next: response => this.tables.set((response || []).map(item => this.mapTable(item))),
      error: error => this.addAudit('Unable to load dining tables from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadMenuItems(outletId?: number): void {
    const url = outletId
      ? `${this.posBaseUrl}/menu/getAllMenu?outletId=${outletId}`
      : `${this.posBaseUrl}/menu/getAllMenu`;
    this.http.get<ApiMenuItem[]>(url).subscribe({
      next: response => this.menuItems.set((response || []).map(item => this.mapMenuItem(item))),
      error: error => this.addAudit('Unable to load menu from API', 'Menu', error?.error?.message || error?.message || 'API error')
    });
  }

  saveOutlet(input: Partial<PosOutlet>): void {
    const nextId = Math.max(0, ...this.outlets().map(item => item.id)) + 1;
    const outlet: PosOutlet = {
      id: input.id ?? nextId,
      name: input.name || 'New Outlet',
      typeId: input.typeId,
      type: input.type || 'Restaurant',
      location: input.location || '',
      timing: input.timing || '09:00 AM - 09:00 PM',
      taxProfile: input.taxProfile || 'GST 5%',
      managerId: input.managerId,
      active: input.active ?? true,
      manager: input.manager || 'Outlet Manager'
    };
    const request$ = input.id
      ? this.http.put<ApiOutlet>(`${this.posBaseUrl}/outlets/updateOutlet/${input.id}`, this.toApiOutlet(outlet))
      : this.http.post<ApiOutlet>(`${this.posBaseUrl}/outlets/createOutlet`, this.toApiOutlet(outlet));

    request$.subscribe({
      next: response => {
        const saved = this.mapOutlet(response);
        this.outlets.update(items => input.id ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]);
        this.addAudit(input.id ? 'Outlet updated' : 'Outlet created', 'Outlets', saved.name);
      },
      error: error => this.addAudit(input.id ? 'Outlet update failed' : 'Outlet create failed', 'Outlets', error?.error?.message || error?.message || outlet.name)
    });
  }

  deleteOutlet(id: number): void {
    const outlet = this.outletMap().get(id);
    this.http.delete<void>(`${this.posBaseUrl}/outlets/deleteOutlet/${id}`).subscribe({
      next: () => {
        this.outlets.update(items => items.filter(item => item.id !== id));
        if (outlet) this.addAudit('Outlet deleted', 'Outlets', outlet.name);
      },
      error: error => this.addAudit('Outlet delete failed', 'Outlets', error?.error?.message || error?.message || `Outlet #${id}`)
    });
  }

  saveMenuItem(input: Partial<PosMenuItem>): void {
    const nextId = Math.max(0, ...this.menuItems().map(item => item.id)) + 1;
    const item: PosMenuItem = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      name: input.name || 'New Item',
      category: input.category || 'Food',
      subcategory: input.subcategory || '',
      price: Number(input.price || 0),
      taxPercent: Number(input.taxPercent ?? 5),
      variants: input.variants || [],
      modifiers: input.modifiers || [],
      available: input.available ?? true,
      featured: input.featured ?? false,
      happyHourPrice: input.happyHourPrice ? Number(input.happyHourPrice) : undefined,
      happyHourWindow: input.happyHourWindow || '',
      stockItem: input.stockItem || '',
      imageUrl: input.imageUrl || ''
    };
    const request$ = input.id
      ? this.http.put<ApiMenuItem>(`${this.posBaseUrl}/menu/updateMenu/${input.id}`, this.toApiMenuItem(item))
      : this.http.post<ApiMenuItem>(`${this.posBaseUrl}/menu/createMenu`, this.toApiMenuItem(item));

    request$.subscribe({
      next: response => {
        const saved = this.mapMenuItem(response);
        this.menuItems.update(items => input.id ? items.map(existing => existing.id === saved.id ? saved : existing) : [saved, ...items]);
        this.addAudit(input.id ? 'Menu item updated' : 'Menu item created', 'Menu', saved.name);
      },
      error: error => this.addAudit(input.id ? 'Menu item update failed' : 'Menu item create failed', 'Menu', error?.error?.message || error?.message || item.name)
    });
  }

  deleteMenuItem(id: number): void {
    const item = this.menuItems().find(value => value.id === id);
    this.http.delete<void>(`${this.posBaseUrl}/menu/deleteMenu/${id}`).subscribe({
      next: () => {
        this.menuItems.update(items => items.filter(value => value.id !== id));
        if (item) this.addAudit('Menu item deleted', 'Menu', item.name);
      },
      error: error => this.addAudit('Menu item delete failed', 'Menu', error?.error?.message || error?.message || `Menu #${id}`)
    });
  }

  saveOrder(input: Partial<PosOrder>): void {
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: PosOrder = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      orderNo: input.orderNo || `ORD-${1000 + nextId}`,
      type: input.type || 'TABLE',
      floorId: input.floorId || null,
      roomId: input.roomId || null,
      tableNo: input.tableNo || '',
      roomNo: input.roomNo || '',
      guestName: input.guestName || '',
      server: input.server || 'Unassigned',
      status: input.status || 'OPEN',
      kotNo: input.kotNo || '',
      openedAt: input.openedAt || 'Just now',
      notes: input.notes || '',
      lines: input.lines?.length ? input.lines : []
    };
    this.orders.update(items => input.id ? items.map(existing => existing.id === input.id ? order : existing) : [order, ...items]);
    this.addAudit(input.id ? 'Order updated' : 'Order created', 'Orders', order.orderNo);
  }

  updateOrderStatus(id: number, status: OrderStatus): void {
    this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: status === 'KOT_SENT' ? item.kotNo || `KOT-${500 + id}` : item.kotNo } : item));
    this.addAudit(`Order marked ${status}`, 'Orders', `ORD-${1000 + id}`);
  }

  saveTable(input: PosTable): void {
    const nextId = Math.max(0, ...this.tables().map(item => item.id)) + 1;
    const table: PosTable = {
      id: input.id || nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      number: input.number || `T${String(nextId).padStart(2, '0')}`,
      section: input.section || 'Indoor',
      status: input.status || 'AVAILABLE',
      covers: Number(input.covers || 0),
      server: input.server || 'Unassigned',
      guestName: input.guestName || '',
      bookingTime: input.bookingTime || '',
      mergedWith: input.mergedWith || ''
    };
    const request$ = input.id
      ? this.http.put<ApiDiningTable>(`${this.posBaseUrl}/tables/updateTable/${input.id}`, this.toApiTable(table))
      : this.http.post<ApiDiningTable>(`${this.posBaseUrl}/tables/createTable`, this.toApiTable(table));

    request$.subscribe({
      next: response => {
        const saved = this.mapTable(response);
        this.tables.update(items => input.id ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]);
        this.addAudit(input.id ? 'Dining table updated' : 'Dining table created', 'Table Dining', saved.number);
      },
      error: error => this.addAudit(input.id ? 'Dining table update failed' : 'Dining table create failed', 'Table Dining', error?.error?.message || error?.message || table.number)
    });
  }

  deleteTable(id: number): void {
    const table = this.tables().find(item => item.id === id);
    this.http.delete<void>(`${this.posBaseUrl}/tables/deleteTable/${id}`).subscribe({
      next: () => {
        this.tables.update(items => items.filter(item => item.id !== id));
        if (table) this.addAudit('Dining table deleted', 'Table Dining', table.number);
      },
      error: error => this.addAudit('Dining table delete failed', 'Table Dining', error?.error?.message || error?.message || `Table #${id}`)
    });
  }

  startTableOrder(table: PosTable, lines: PosOrderLine[] = []): void {
    const outlet = this.outletMap().get(table.outletId);
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const orderLines = lines.length ? lines : [
      { itemId: 1, name: 'Paneer Tikka', qty: 1, price: 420, course: 'Starter', notes: 'Fresh order from table dining' }
    ];
    const order: PosOrder = {
      id: nextId,
      outletId: table.outletId,
      orderNo: `ORD-${1000 + nextId}`,
      type: 'TABLE',
      tableNo: table.number,
      guestName: table.guestName || '',
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      status: 'OPEN',
      openedAt: 'Just now',
      notes: `${table.covers || 2} covers at ${outlet?.name || 'Outlet'}.`,
      lines: orderLines
    };
    this.orders.update(items => [order, ...items]);
    this.tables.update(items => items.map(item => item.id === table.id ? { ...item, status: 'OCCUPIED', covers: table.covers || item.covers || 2, server: order.server } : item));
    this.addAudit('Started table order', 'Table Dining', `${table.number} / ${order.orderNo}`);
  }

  startRoomOrder(input: { outletId: number; roomNo: string; guestName: string; server: string; notes?: string }, lines: PosOrderLine[] = []): void {
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: PosOrder = {
      id: nextId,
      outletId: input.outletId,
      orderNo: `ORD-${1000 + nextId}`,
      type: 'ROOM',
      roomNo: input.roomNo,
      guestName: input.guestName,
      server: input.server || 'Meena Pillai',
      status: 'OPEN',
      openedAt: 'Just now',
      notes: input.notes || 'Room service order created from table dining.',
      lines
    };
    this.orders.update(items => [order, ...items]);
    this.addAudit('Started room service order', 'Room Service', `Room ${input.roomNo} / ${order.orderNo}`);
  }

  bookTable(table: PosTable, input: { guestName: string; covers: number; server: string; bookingTime: string }): void {
    this.tables.update(items => items.map(item => item.id === table.id ? {
      ...item,
      status: 'RESERVED',
      covers: Number(input.covers || item.covers || 2),
      server: input.server || item.server || 'Unassigned',
      guestName: input.guestName || item.guestName || '',
      bookingTime: input.bookingTime || item.bookingTime || 'Today'
    } : item));
    this.addAudit('Table booked for dine-in', 'Table Dining', `${table.number} / ${input.guestName || 'Guest'}`);
  }

  mergeTables(primary: PosTable, secondary: PosTable): void {
    this.tables.update(items => items.map(item => {
      if (item.id === primary.id) return { ...item, status: 'OCCUPIED', covers: primary.covers + Math.max(secondary.covers, 2), mergedWith: secondary.number };
      if (item.id === secondary.id) return { ...item, status: 'OCCUPIED', covers: 0, server: primary.server, mergedWith: primary.number };
      return item;
    }));
    this.addAudit('Merged tables', 'Table Dining', `${primary.number} + ${secondary.number}`);
  }

  resetPaidTables(outletId?: number): void {
    const paidOrderIds = new Set(this.bills().filter(bill => bill.status === 'PAID').map(bill => bill.orderId));
    const paidTableNumbers = new Set(
      this.orders()
        .filter(order => paidOrderIds.has(order.id) && order.type === 'TABLE' && (!outletId || order.outletId === outletId) && order.tableNo)
        .map(order => order.tableNo as string)
    );
    const released: string[] = [];

    this.tables.update(items => items.map(table => {
      const linkedToPaid = !!table.mergedWith && paidTableNumbers.has(table.mergedWith);
      const isPaidTable = paidTableNumbers.has(table.number);
      const isBilledInOutlet = table.status === 'BILLED' && (!outletId || table.outletId === outletId);
      if (!isPaidTable && !linkedToPaid && !isBilledInOutlet) return table;

      released.push(table.number);
      return { ...table, status: 'AVAILABLE', covers: 0, server: 'Unassigned', guestName: '', bookingTime: '', mergedWith: '' };
    }));

    this.addAudit('Reset paid table layout', 'Table Dining', released.length ? released.join(', ') : 'No paid tables');
  }

  saveBill(input: Partial<PosBill>): void {
    const nextId = Math.max(0, ...this.bills().map(item => item.id)) + 1;
    const bill: PosBill = {
      id: input.id ?? nextId,
      orderId: Number(input.orderId || this.orders()[0]?.id || 1),
      billNo: input.billNo || `BILL-${7000 + nextId}`,
      orderType: input.orderType,
      tableNo: input.tableNo || '',
      floorId: input.floorId || null,
      roomId: input.roomId || null,
      guestName: input.guestName || '',
      roomNo: input.roomNo || '',
      subtotal: Number(input.subtotal || 0),
      discount: Number(input.discount || 0),
      tax: Number(input.tax || 0),
      compReason: input.compReason || '',
      paid: Number(input.paid || 0),
      status: input.status || 'OPEN',
      paymentModes: input.paymentModes?.length ? input.paymentModes : ['Cash'],
      postedToFolio: !!input.postedToFolio
    };
    this.bills.update(items => input.id ? items.map(existing => existing.id === input.id ? bill : existing) : [bill, ...items]);
    this.addAudit(input.id ? 'Bill updated' : 'Bill generated', 'Billing', bill.billNo);
  }

  postBillToRoom(id: number): void {
    this.bills.update(items => items.map(item => item.id === id ? { ...item, postedToFolio: true, status: item.status === 'OPEN' ? 'PARTIAL' : item.status } : item));
    this.addAudit('Posted POS charge to room folio', 'Room Posting', `Bill #${id}`);
  }

  saveShift(input: Partial<PosShift>): void {
    const nextId = Math.max(0, ...this.shifts().map(item => item.id)) + 1;
    const shift: PosShift = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      name: input.name || 'New Shift',
      cashier: input.cashier || 'Rajan Mehta',
      openedAt: input.openedAt || 'Just now',
      closedAt: input.closedAt || '',
      openingCash: Number(input.openingCash || 0),
      cashSales: Number(input.cashSales || 0),
      cardSales: Number(input.cardSales || 0),
      upiSales: Number(input.upiSales || 0),
      roomCharges: Number(input.roomCharges || 0),
      discounts: Number(input.discounts || 0),
      voids: Number(input.voids || 0),
      comps: Number(input.comps || 0),
      status: input.status || 'OPEN'
    };
    this.shifts.update(items => input.id ? items.map(existing => existing.id === input.id ? shift : existing) : [shift, ...items]);
    this.addAudit(input.id ? 'Shift updated' : 'Shift opened', 'Shifts', shift.name);
  }

  private addAudit(action: string, module: string, reference: string): void {
    const nextId = Math.max(0, ...this.auditLogs().map(item => item.id)) + 1;
    this.auditLogs.update(logs => [{ id: nextId, at: 'Just now', user: 'Outlet Manager', action, module, reference }, ...logs]);
  }

  private mapOutlet(item: ApiOutlet): PosOutlet {
    return {
      id: Number(item.id),
      name: item.name || 'Outlet',
      typeId: item.typeId ? Number(item.typeId) : undefined,
      type: this.asOutletType(item.typeValue),
      location: item.location || '',
      timing: item.timing || '',
      taxProfile: item.taxProfile || '',
      managerId: item.managerId ? Number(item.managerId) : undefined,
      active: item.isActive !== false,
      manager: item.managerName || ''
    };
  }

  private toApiOutlet(item: PosOutlet): ApiOutlet {
    const typeMaster = this.outletTypeMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === item.type.toLowerCase())
    );
    const manager = this.userManagement.users().find(user => user.fullName.toLowerCase() === item.manager.toLowerCase());

    return {
      id: item.id,
      name: item.name,
      typeId: typeMaster?.id ? Number(typeMaster.id) : item.typeId,
      typeValue: item.type,
      location: item.location,
      timing: item.timing,
      taxProfile: item.taxProfile,
      managerId: manager?.id || item.managerId,
      managerName: item.manager,
      isActive: item.active
    };
  }

  private mapTable(item: ApiDiningTable): PosTable {
    return {
      id: Number(item.id),
      outletId: Number(item.outletId || this.outlets()[0]?.id || 1),
      number: item.tableNumber || `T${item.id}`,
      section: item.section || '',
      status: this.asTableStatus(item.status),
      covers: Number(item.covers || 0),
      server: item.serverName || 'Unassigned',
      mergedWith: item.linkedTableNumber || ''
    };
  }

  private toApiTable(item: PosTable): ApiDiningTable {
    return {
      id: item.id,
      outletId: item.outletId,
      tableNumber: item.number,
      section: item.section,
      status: item.status === 'BILLED' ? 'OCCUPIED' : item.status,
      covers: item.covers,
      serverName: item.server,
      linkedTableNumber: item.mergedWith || undefined
    };
  }

  private mapMenuItem(item: ApiMenuItem): PosMenuItem {
    return {
      id: Number(item.id),
      outletId: Number(item.outletId || this.outlets()[0]?.id || 1),
      name: item.itemName || 'Menu Item',
      category: item.category || 'Food',
      subcategory: item.subcategory || '',
      price: Number(item.price || 0),
      taxPercent: Number(item.taxPercent ?? 0),
      variants: this.toTokens(item.variants),
      modifiers: this.toTokens(item.modifiers),
      available: item.isAvailable !== false,
      featured: !!item.isFeatured,
      happyHourPrice: item.happyHourPrice ? Number(item.happyHourPrice) : undefined,
      happyHourWindow: item.happyHourWindow || '',
      stockItem: item.linkedStockItem || '',
      imageUrl: item.imageUrl || ''
    };
  }

  private toApiMenuItem(item: PosMenuItem): ApiMenuItem {
    return {
      id: item.id,
      outletId: item.outletId,
      itemName: item.name,
      category: item.category,
      subcategory: item.subcategory,
      imageUrl: item.imageUrl,
      price: item.price,
      taxPercent: item.taxPercent,
      variants: item.variants.join(', '),
      modifiers: item.modifiers.join(', '),
      happyHourPrice: item.happyHourPrice,
      happyHourWindow: item.happyHourWindow,
      linkedStockItem: item.stockItem,
      isAvailable: item.available,
      isFeatured: item.featured
    };
  }

  private asOutletType(value?: string): OutletType {
    return this.outletTypes().find(type => type.toLowerCase() === String(value || '').toLowerCase()) || value || this.outletTypes()[0] || 'Restaurant';
  }

  private asTableStatus(value?: string): TableStatus {
    const normalized = String(value || 'AVAILABLE').toUpperCase();
    return this.tableStatuses().find(status => status.toUpperCase() === normalized) || value || this.tableStatuses()[0] || 'AVAILABLE';
  }

  private toTokens(value?: string): string[] {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  private commonMastersData(response: ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]> | null): ApiCommonMaster[] {
    if (!response) return [];
    return Array.isArray(response) ? response : response.success ? response.data || [] : [];
  }
}
