import { Injectable, computed, signal } from '@angular/core';

export type LaundryTab = 'dashboard' | 'create' | 'orders' | 'detail' | 'catalogue' | 'reports';
export type LaundryServiceType = 'Wash & Fold' | 'Wash & Press' | 'Dry Clean' | 'Express';
export type LaundryStatus = 'Pickup Pending' | 'Processing' | 'Ready for Delivery' | 'Delivered' | 'Overdue' | 'Cancelled';
export type BillingMode = 'Room Account' | 'Direct Payment';

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

export interface FolioPosting {
  id: number;
  orderId: string;
  folioId: string;
  room: string;
  guest: string;
  amount: number;
  postedAt: string;
}

@Injectable({ providedIn: 'root' })
export class LaundryService {
  readonly serviceTypes: LaundryServiceType[] = ['Wash & Fold', 'Wash & Press', 'Dry Clean', 'Express'];
  readonly statuses: LaundryStatus[] = ['Pickup Pending', 'Processing', 'Ready for Delivery', 'Delivered', 'Overdue', 'Cancelled'];
  readonly categories = ['Top Wear', 'Bottom Wear', 'Ethnic', 'Outerwear', 'Linen', 'Accessories'];

  readonly activeBookings = signal<ActiveBooking[]>([
    { bookingId: 101, floor: 'Floor 1', room: '102', guest: 'Rajan Mehta', plan: 'Deluxe CP', folioId: 'FOL-102-26' },
    { bookingId: 102, floor: 'Floor 1', room: '108', guest: 'Mark Wilson', plan: 'Executive MAP', folioId: 'FOL-108-26' },
    { bookingId: 103, floor: 'Floor 2', room: '203', guest: 'Jane Smith', plan: 'Suite AP', folioId: 'FOL-203-26' },
    { bookingId: 104, floor: 'Floor 3', room: '304', guest: 'Ananya Rao', plan: 'Premium CP', folioId: 'FOL-304-26' },
    { bookingId: 105, floor: 'Floor 4', room: '410', guest: 'Vikram Sethi', plan: 'Business EP', folioId: 'FOL-410-26' }
  ]);

  readonly catalogue = signal<LaundryCatalogueItem[]>([
    { id: 1, category: 'Top Wear', itemName: 'Shirt', washFold: 70, washPress: 95, dryClean: 160, expressSurcharge: 50, active: true },
    { id: 2, category: 'Top Wear', itemName: 'T-Shirt', washFold: 55, washPress: 75, dryClean: 130, expressSurcharge: 50, active: true },
    { id: 3, category: 'Bottom Wear', itemName: 'Trouser', washFold: 80, washPress: 110, dryClean: 175, expressSurcharge: 50, active: true },
    { id: 4, category: 'Ethnic', itemName: 'Kurta', washFold: 90, washPress: 125, dryClean: 220, expressSurcharge: 50, active: true },
    { id: 5, category: 'Outerwear', itemName: 'Blazer', washFold: 0, washPress: 0, dryClean: 420, expressSurcharge: 50, active: true },
    { id: 6, category: 'Linen', itemName: 'Bedsheet', washFold: 120, washPress: 160, dryClean: 0, expressSurcharge: 50, active: true },
    { id: 7, category: 'Linen', itemName: 'Towel', washFold: 45, washPress: 60, dryClean: 0, expressSurcharge: 50, active: true },
    { id: 8, category: 'Accessories', itemName: 'Scarf', washFold: 60, washPress: 85, dryClean: 140, expressSurcharge: 50, active: true }
  ]);

  readonly orders = signal<LaundryOrder[]>([
    {
      id: 1,
      orderId: 'LND-1001',
      bookingId: 101,
      room: '102',
      guest: 'Rajan Mehta',
      plan: 'Deluxe CP',
      serviceType: 'Wash & Press',
      pickupAt: '31-05-2026 09:30',
      expectedDeliveryAt: '31-05-2026 18:00',
      billingMode: 'Room Account',
      postedToFolio: true,
      status: 'Processing',
      notes: 'Press collars sharp. Guest has meeting by evening.',
      createdAt: '31-05-2026 09:05',
      lines: [
        { catalogueId: 1, itemName: 'Shirt', quantity: 3, unitPrice: 95, notes: 'Light starch' },
        { catalogueId: 3, itemName: 'Trouser', quantity: 2, unitPrice: 110, notes: '' }
      ]
    },
    {
      id: 2,
      orderId: 'LND-1002',
      bookingId: 103,
      room: '203',
      guest: 'Jane Smith',
      plan: 'Suite AP',
      serviceType: 'Dry Clean',
      pickupAt: '31-05-2026 10:15',
      expectedDeliveryAt: '01-06-2026 11:00',
      billingMode: 'Direct Payment',
      postedToFolio: false,
      status: 'Pickup Pending',
      notes: 'Handle blazer separately.',
      createdAt: '31-05-2026 10:10',
      lines: [
        { catalogueId: 5, itemName: 'Blazer', quantity: 1, unitPrice: 420, notes: 'Remove lint' },
        { catalogueId: 8, itemName: 'Scarf', quantity: 2, unitPrice: 140, notes: 'Delicate fabric' }
      ]
    },
    {
      id: 3,
      orderId: 'LND-1003',
      bookingId: 102,
      room: '108',
      guest: 'Mark Wilson',
      plan: 'Executive MAP',
      serviceType: 'Express',
      pickupAt: '30-05-2026 16:00',
      expectedDeliveryAt: '30-05-2026 22:00',
      deliveredAt: '30-05-2026 21:20',
      billingMode: 'Room Account',
      postedToFolio: true,
      status: 'Delivered',
      notes: 'Express business laundry.',
      createdAt: '30-05-2026 15:45',
      lines: [
        { catalogueId: 1, itemName: 'Shirt', quantity: 2, unitPrice: 105, notes: '' },
        { catalogueId: 3, itemName: 'Trouser', quantity: 1, unitPrice: 120, notes: '' }
      ]
    },
    {
      id: 4,
      orderId: 'LND-1004',
      bookingId: 104,
      room: '304',
      guest: 'Ananya Rao',
      plan: 'Premium CP',
      serviceType: 'Wash & Fold',
      pickupAt: '30-05-2026 08:00',
      expectedDeliveryAt: '30-05-2026 19:00',
      billingMode: 'Room Account',
      postedToFolio: false,
      status: 'Overdue',
      notes: 'Call guest before delivery.',
      createdAt: '30-05-2026 07:45',
      lines: [
        { catalogueId: 2, itemName: 'T-Shirt', quantity: 4, unitPrice: 55, notes: '' },
        { catalogueId: 7, itemName: 'Towel', quantity: 2, unitPrice: 45, notes: 'Hotel linen replacement' }
      ]
    },
    {
      id: 5,
      orderId: 'LND-1005',
      bookingId: 105,
      room: '410',
      guest: 'Vikram Sethi',
      plan: 'Business EP',
      serviceType: 'Wash & Fold',
      pickupAt: '31-05-2026 07:30',
      expectedDeliveryAt: '31-05-2026 16:00',
      deliveredAt: '31-05-2026 15:25',
      billingMode: 'Direct Payment',
      postedToFolio: false,
      status: 'Delivered',
      notes: '',
      createdAt: '31-05-2026 07:20',
      lines: [
        { catalogueId: 6, itemName: 'Bedsheet', quantity: 2, unitPrice: 120, notes: '' },
        { catalogueId: 7, itemName: 'Towel', quantity: 3, unitPrice: 45, notes: '' }
      ]
    }
  ]);

  readonly folioPostings = signal<FolioPosting[]>([
    { id: 1, orderId: 'LND-1001', folioId: 'FOL-102-26', room: '102', guest: 'Rajan Mehta', amount: 505, postedAt: '31-05-2026 09:06' },
    { id: 2, orderId: 'LND-1003', folioId: 'FOL-108-26', room: '108', guest: 'Mark Wilson', amount: 330, postedAt: '30-05-2026 15:46' }
  ]);

  readonly catalogueMap = computed(() => new Map(this.catalogue().map(item => [item.id, item])));

  orderAmount(order: Pick<LaundryOrder, 'lines'>): number {
    return order.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  }

  orderItemCount(order: Pick<LaundryOrder, 'lines'>): number {
    return order.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }

  priceFor(item: LaundryCatalogueItem, serviceType: LaundryServiceType): number {
    const base = serviceType === 'Wash & Fold'
      ? item.washFold
      : serviceType === 'Wash & Press'
        ? item.washPress
        : item.dryClean;
    if (serviceType !== 'Express') return base;
    const expressBase = item.washPress || item.washFold || item.dryClean;
    return Math.round(expressBase * (1 + item.expressSurcharge / 100));
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
      active: input.active ?? true
    };
    this.catalogue.update(items => input.id ? items.map(existing => existing.id === item.id ? item : existing) : [item, ...items]);
  }

  toggleCatalogueItem(id: number): void {
    this.catalogue.update(items => items.map(item => item.id === id ? { ...item, active: !item.active } : item));
  }

  saveOrder(input: Partial<LaundryOrder>): LaundryOrder {
    const booking = this.activeBookings().find(item => item.bookingId === Number(input.bookingId)) || this.activeBookings()[0];
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: LaundryOrder = {
      id: input.id ?? nextId,
      orderId: input.orderId || `LND-${1000 + nextId}`,
      bookingId: Number(input.bookingId || booking.bookingId),
      room: input.room || booking.room,
      guest: input.guest || booking.guest,
      plan: input.plan || booking.plan,
      serviceType: input.serviceType || 'Wash & Fold',
      pickupAt: input.pickupAt || '31-05-2026 12:00',
      expectedDeliveryAt: input.expectedDeliveryAt || '01-06-2026 12:00',
      deliveredAt: input.deliveredAt || '',
      billingMode: input.billingMode || 'Room Account',
      postedToFolio: input.postedToFolio ?? false,
      status: input.status || 'Pickup Pending',
      notes: input.notes || '',
      createdAt: input.createdAt || '31-05-2026 11:55',
      lines: input.lines?.length ? input.lines.map(line => ({ ...line, quantity: Math.max(1, Number(line.quantity || 1)), unitPrice: Number(line.unitPrice || 0) })) : []
    };
    this.orders.update(items => input.id ? items.map(existing => existing.id === order.id ? order : existing) : [order, ...items]);
    if (order.billingMode === 'Room Account') this.postOrderToFolio(order.id);
    return order;
  }

  updateOrderStatus(id: number, status: LaundryStatus): void {
    this.orders.update(items => items.map(order => order.id === id
      ? { ...order, status, deliveredAt: status === 'Delivered' ? '31-05-2026 18:10' : order.deliveredAt }
      : order
    ));
  }

  cancelOrder(id: number): void {
    this.updateOrderStatus(id, 'Cancelled');
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
      postedAt: '31-05-2026 12:05'
    };
    this.folioPostings.update(items => [posting, ...items]);
    this.orders.update(items => items.map(item => item.id === id ? { ...item, postedToFolio: true } : item));
  }
}
