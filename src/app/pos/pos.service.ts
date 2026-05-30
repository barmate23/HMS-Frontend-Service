import { Injectable, computed, signal } from '@angular/core';

export type PosTab = 'outlets' | 'dining' | 'orders' | 'billing' | 'menu';
export type OutletType = 'Restaurant' | 'Bar' | 'Cafe' | 'Spa' | 'Gift Shop' | 'Room Service' | 'Mini Bar';
export type OutletStatus = 'ACTIVE' | 'INACTIVE';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLED';
export type OrderType = 'TABLE' | 'TAKEAWAY' | 'ROOM';
export type OrderStatus = 'OPEN' | 'KOT_SENT' | 'HELD' | 'BILLED' | 'CANCELLED';
export type BillStatus = 'OPEN' | 'PAID' | 'PARTIAL' | 'VOID';
export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Room Charge' | 'City Ledger' | 'Voucher';
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface PosOutlet {
  id: number;
  name: string;
  type: OutletType;
  location: string;
  timing: string;
  taxProfile: string;
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

@Injectable({ providedIn: 'root' })
export class PosService {
  readonly outletTypes: OutletType[] = ['Restaurant', 'Bar', 'Cafe', 'Spa', 'Gift Shop', 'Room Service', 'Mini Bar'];
  readonly tableStatuses: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED'];
  readonly orderStatuses: OrderStatus[] = ['OPEN', 'KOT_SENT', 'HELD', 'BILLED', 'CANCELLED'];
  readonly paymentModes: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Room Charge', 'City Ledger', 'Voucher'];
  readonly users = ['Rajan Mehta', 'Meena Pillai', 'Arjun Menon', 'Deepa Thomas', 'Outlet Manager'];

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
    { id: 3, outletId: 1, number: 'T03', section: 'Patio', status: 'RESERVED', covers: 4, server: 'Rajan Mehta' },
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

  saveOutlet(input: Partial<PosOutlet>): void {
    const nextId = Math.max(0, ...this.outlets().map(item => item.id)) + 1;
    const outlet: PosOutlet = {
      id: input.id ?? nextId,
      name: input.name || 'New Outlet',
      type: input.type || 'Restaurant',
      location: input.location || '',
      timing: input.timing || '09:00 AM - 09:00 PM',
      taxProfile: input.taxProfile || 'GST 5%',
      active: input.active ?? true,
      manager: input.manager || 'Outlet Manager'
    };
    this.outlets.update(items => input.id ? items.map(item => item.id === input.id ? outlet : item) : [outlet, ...items]);
    this.addAudit(input.id ? 'Outlet updated' : 'Outlet created', 'Outlets', outlet.name);
  }

  deleteOutlet(id: number): void {
    const outlet = this.outletMap().get(id);
    this.outlets.update(items => items.filter(item => item.id !== id));
    if (outlet) this.addAudit('Outlet deleted', 'Outlets', outlet.name);
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
    this.menuItems.update(items => input.id ? items.map(existing => existing.id === input.id ? item : existing) : [item, ...items]);
    this.addAudit(input.id ? 'Menu item updated' : 'Menu item created', 'Menu', item.name);
  }

  deleteMenuItem(id: number): void {
    const item = this.menuItems().find(value => value.id === id);
    this.menuItems.update(items => items.filter(value => value.id !== id));
    if (item) this.addAudit('Menu item deleted', 'Menu', item.name);
  }

  saveOrder(input: Partial<PosOrder>): void {
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: PosOrder = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      orderNo: input.orderNo || `ORD-${1000 + nextId}`,
      type: input.type || 'TABLE',
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
      mergedWith: input.mergedWith || ''
    };
    this.tables.update(items => input.id ? items.map(item => item.id === input.id ? table : item) : [table, ...items]);
    this.addAudit(input.id ? 'Dining table updated' : 'Dining table created', 'Table Dining', table.number);
  }

  deleteTable(id: number): void {
    const table = this.tables().find(item => item.id === id);
    this.tables.update(items => items.filter(item => item.id !== id));
    if (table) this.addAudit('Dining table deleted', 'Table Dining', table.number);
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
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      status: 'OPEN',
      openedAt: 'Just now',
      notes: `${table.covers || 2} covers at ${outlet?.name || 'Outlet'}.`,
      lines: orderLines
    };
    this.orders.update(items => [order, ...items]);
    this.tables.update(items => items.map(item => item.id === table.id ? { ...item, status: 'OCCUPIED', covers: item.covers || 2, server: order.server } : item));
    this.addAudit('Started table order', 'Table Dining', `${table.number} / ${order.orderNo}`);
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
      return { ...table, status: 'AVAILABLE', covers: 0, server: 'Unassigned', mergedWith: '' };
    }));

    this.addAudit('Reset paid table layout', 'Table Dining', released.length ? released.join(', ') : 'No paid tables');
  }

  saveBill(input: Partial<PosBill>): void {
    const nextId = Math.max(0, ...this.bills().map(item => item.id)) + 1;
    const bill: PosBill = {
      id: input.id ?? nextId,
      orderId: Number(input.orderId || this.orders()[0]?.id || 1),
      billNo: input.billNo || `BILL-${7000 + nextId}`,
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
}
