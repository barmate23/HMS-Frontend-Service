import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HotelMastersService, Room } from '../masters/hotel-masters.service';
import { HousekeepingService, HKRoom } from '../housekeeping/housekeeping.service';
import { PosMenuItem, PosOrder, PosService } from '../pos/pos.service';

interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
  metadata?: {
    totalRecords?: number;
  };
}

interface DashboardReservation {
  id: string;
  checkInDate: string;
  createdAt: string;
  status: string;
  billingAmount: number;
}

interface MonthMetric {
  key: string;
  label: string;
  revenue: number;
  bookings: number;
  revenueHeight: number;
  bookingHeight: number;
}

interface FloorRoomMetric {
  floor: string;
  total: number;
  available: number;
  occupied: number;
  blocked: number;
}

interface PosItemMetric {
  name: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  price: number;
  qty: number;
  value: number;
  monthVariation: Array<{
    label: string;
    qty: number;
    height: number;
  }>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly masters = inject(HotelMastersService);
  private readonly housekeeping = inject(HousekeepingService);
  readonly pos = inject(PosService);

  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';

  readonly selectedFinancialYear = signal(this.currentFinancialYear());
  readonly reservations = signal<DashboardReservation[]>([]);
  readonly isLoadingRevenue = signal(false);
  readonly revenueError = signal<string | null>(null);
  readonly activeSellingTab = signal<'top' | 'less'>('top');

  readonly financialYears = computed(() => {
    const current = this.currentFinancialYear();
    return Array.from({ length: 5 }, (_, index) => current - index);
  });

  readonly masterRooms = this.masters.rooms;
  readonly masterFloors = this.masters.floors;
  readonly hkRooms = this.housekeeping.rooms;
  readonly posMenuItems = computed(() => {
    const menuItems = this.pos.menuItems();
    return menuItems.length ? menuItems : this.samplePosMenuItems();
  });
  readonly posOrders = computed(() => {
    const orders = this.pos.orders();
    return orders.length ? orders : this.samplePosOrders();
  });

  readonly roomKpis = computed(() => {
    const masterRooms = this.masterRooms();
    const hkRooms = this.hkRooms();
    const total = masterRooms.length || hkRooms.length;
    const occupied = masterRooms.length
      ? masterRooms.filter(room => this.isMasterOccupied(room)).length
      : hkRooms.filter(room => room.isOccupied).length;
    const blocked = masterRooms.length
      ? masterRooms.filter(room => this.isMasterBlocked(room)).length
      : hkRooms.filter(room => this.isHkBlocked(room)).length;
    const available = Math.max(0, total - occupied - blocked);
    const occupancy = total ? Math.round((occupied / total) * 100) : 0;

    return { total, available, occupied, blocked, occupancy };
  });

  readonly floorRoomMetrics = computed<FloorRoomMetric[]>(() => {
    const masterRooms = this.masterRooms();
    if (masterRooms.length) {
      const floorMap = this.masters.floorsMap();
      const grouped = new Map<string, Room[]>();
      masterRooms.forEach(room => {
        const floor = floorMap.get(room.floorId)?.floorNumber || `Floor ${room.floorId || '-'}`;
        grouped.set(floor, [...(grouped.get(floor) ?? []), room]);
      });
      return Array.from(grouped.entries()).map(([floor, rooms]) => {
        const occupied = rooms.filter(room => this.isMasterOccupied(room)).length;
        const blocked = rooms.filter(room => this.isMasterBlocked(room)).length;
        return {
          floor,
          total: rooms.length,
          occupied,
          blocked,
          available: Math.max(0, rooms.length - occupied - blocked)
        };
      }).sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
    }

    const grouped = new Map<string, HKRoom[]>();
    this.hkRooms().forEach(room => grouped.set(room.floor, [...(grouped.get(room.floor) ?? []), room]));
    return Array.from(grouped.entries()).map(([floor, rooms]) => {
      const occupied = rooms.filter(room => room.isOccupied).length;
      const blocked = rooms.filter(room => this.isHkBlocked(room)).length;
      return {
        floor,
        total: rooms.length,
        occupied,
        blocked,
        available: Math.max(0, rooms.length - occupied - blocked)
      };
    }).sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
  });

  readonly monthMetrics = computed<MonthMetric[]>(() => {
    const months = this.financialYearMonths();
    const buckets = months.map(month => ({ ...month, revenue: 0, bookings: 0 }));

    this.reservations().forEach(reservation => {
      const date = this.parseDate(reservation.checkInDate || reservation.createdAt);
      if (!date) return;
      const key = this.monthKey(date);
      const bucket = buckets.find(item => item.key === key);
      if (!bucket) return;
      bucket.bookings += 1;
      bucket.revenue += Math.max(0, reservation.billingAmount);
    });

    const maxRevenue = Math.max(1, ...buckets.map(item => item.revenue));
    const maxBookings = Math.max(1, ...buckets.map(item => item.bookings));
    return buckets.map(item => ({
      ...item,
      revenueHeight: Math.max(8, Math.round((item.revenue / maxRevenue) * 100)),
      bookingHeight: Math.max(8, Math.round((item.bookings / maxBookings) * 100))
    }));
  });

  readonly totalMonthlyRevenue = computed(() => this.monthMetrics().reduce((sum, item) => sum + item.revenue, 0));
  readonly totalBookings = computed(() => this.monthMetrics().reduce((sum, item) => sum + item.bookings, 0));
  readonly averageBookingValue = computed(() => {
    const bookings = this.totalBookings();
    return bookings ? Math.round(this.totalMonthlyRevenue() / bookings) : 0;
  });

  readonly fyPosOrders = computed(() => this.posOrders().filter(order => this.isDateInsideFinancialYear(order.openedAt)));
  readonly posOrderCount = computed(() => this.fyPosOrders().length);
  readonly posOrderValue = computed(() => this.fyPosOrders().reduce((sum, order) => sum + this.orderValue(order), 0));
  readonly averagePosOrderValue = computed(() => {
    const count = this.posOrderCount();
    return count ? Math.round(this.posOrderValue() / count) : 0;
  });

  readonly posItemMetrics = computed<PosItemMetric[]>(() => {
    const months = this.financialYearMonths();
    const emptyMonths = () => months.map(month => ({ ...month, qty: 0 }));
    const menuMap = new Map(this.posMenuItems().map(item => [item.name, item]));
    const grouped = new Map<string, Omit<PosItemMetric, 'monthVariation'> & {
      monthBuckets: Array<{ key: string; label: string; qty: number }>;
    }>();

    this.fyPosOrders().forEach(order => {
      const orderDate = this.parseDate(order.openedAt);
      const orderMonthKey = orderDate ? this.monthKey(orderDate) : '';
      order.lines.forEach(line => {
        const menuItem = menuMap.get(line.name);
        const current = grouped.get(line.name) ?? {
          name: line.name,
          category: menuItem?.category || 'POS',
          subcategory: menuItem?.subcategory || line.course || 'Item',
          imageUrl: menuItem?.imageUrl || this.itemImageUrl(line.name),
          price: Number(menuItem?.price || line.price || 0),
          qty: 0,
          value: 0,
          monthBuckets: emptyMonths()
        };
        current.qty += Number(line.qty || 0);
        current.value += Number(line.qty || 0) * Number(line.price || 0);
        const monthBucket = current.monthBuckets.find(month => month.key === orderMonthKey);
        if (monthBucket) monthBucket.qty += Number(line.qty || 0);
        grouped.set(line.name, current);
      });
    });

    this.posMenuItems().forEach(item => {
      if (!grouped.has(item.name)) {
        grouped.set(item.name, {
          name: item.name,
          category: item.category,
          subcategory: item.subcategory || 'Item',
          imageUrl: item.imageUrl || this.itemImageUrl(item.name),
          price: Number(item.price || 0),
          qty: 0,
          value: 0,
          monthBuckets: emptyMonths()
        });
      }
    });

    return Array.from(grouped.values()).map(({ monthBuckets, ...item }) => {
      const maxQty = Math.max(1, ...monthBuckets.map(month => month.qty));
      return {
        ...item,
        monthVariation: monthBuckets.map(month => ({
          label: month.label.toLowerCase(),
          qty: month.qty,
          height: Math.max(8, Math.round((month.qty / maxQty) * 100))
        }))
      };
    });
  });

  readonly topSellingItems = computed(() => this.posItemMetrics()
    .filter(item => item.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.value - a.value)
    .slice(0, 5));

  readonly lessSellingItems = computed(() => this.posItemMetrics()
    .sort((a, b) => a.qty - b.qty || a.value - b.value || a.name.localeCompare(b.name))
    .slice(0, 5));

  constructor() {
    this.loadFinancialYearReservations();
  }

  onFinancialYearChange(value: string): void {
    this.selectedFinancialYear.set(Number(value));
    this.loadFinancialYearReservations();
  }

  loadFinancialYearReservations(): void {
    const { start, end } = this.financialYearRange();
    this.isLoadingRevenue.set(true);
    this.revenueError.set(null);

    const params = new HttpParams()
      .set('page', '0')
      .set('size', '500')
      .set('fromDate', this.toIsoDate(start))
      .set('toDate', this.toIsoDate(end));

    this.http.get<StandardResponse<any[]>>(`${this.frontOfficeBaseUrl}/frontOffice/getAllReservations`, { params }).subscribe({
      next: response => {
        const reservations = (response.data ?? []).map(item => this.mapReservation(item));
        this.reservations.set(reservations.length ? reservations : this.sampleReservations());
        this.revenueError.set(reservations.length ? null : 'Showing sample booking data.');
        this.isLoadingRevenue.set(false);
      },
      error: error => {
        console.error('[Dashboard] Unable to load reservation revenue', error);
        this.reservations.set(this.sampleReservations());
        this.revenueError.set('Showing sample booking data.');
        this.isLoadingRevenue.set(false);
      }
    });
  }

  formatFinancialYear(year: number): string {
    return `FY ${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  }

  floorOccupancy(metric: FloorRoomMetric): number {
    return metric.total ? Math.round((metric.occupied / metric.total) * 100) : 0;
  }

  private orderValue(order: PosOrder): number {
    return order.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0);
  }

  private isMasterOccupied(room: Room): boolean {
    return String(room.status).toUpperCase() === 'OCCUPIED';
  }

  private isMasterBlocked(room: Room): boolean {
    return ['MAINTENANCE', 'CLEANING'].includes(String(room.status).toUpperCase()) || !room.isActive;
  }

  private isHkBlocked(room: HKRoom): boolean {
    return ['OUT_OF_ORDER', 'UNDER_MAINTENANCE', 'DO_NOT_DISTURB'].includes(room.hkStatus);
  }

  private currentFinancialYear(): number {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  }

  private financialYearRange(): { start: Date; end: Date } {
    const year = this.selectedFinancialYear();
    return {
      start: new Date(year, 3, 1),
      end: new Date(year + 1, 2, 31)
    };
  }

  private financialYearMonths(): Array<{ key: string; label: string }> {
    const year = this.selectedFinancialYear();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, 3 + index, 1);
      return {
        key: this.monthKey(date),
        label: date.toLocaleDateString('en-US', { month: 'short' })
      };
    });
  }

  private isDateInsideFinancialYear(value: string): boolean {
    const date = this.parseDate(value);
    if (!date) return true;
    const { start, end } = this.financialYearRange();
    return date >= start && date <= end;
  }

  private mapReservation(item: any): DashboardReservation {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : {};
    const checkInDate = item.checkInDate || item.arrivalDate || item.checkIn || booking?.checkInDate || '';
    return {
      id: String(item.id ?? item.bookingId ?? item.reservationId ?? ''),
      checkInDate,
      createdAt: item.createdAt || item.bookingDate || checkInDate,
      status: String(item.reservationStatus || item.status || ''),
      billingAmount: Number(item.billingAmount ?? item.totalAmount ?? item.grandTotal ?? item.amount ?? 0)
    };
  }

  private sampleReservations(): DashboardReservation[] {
    const year = this.selectedFinancialYear();
    const monthlySamples = [
      { month: 3, bookings: 8, revenue: 184000 },
      { month: 4, bookings: 14, revenue: 336000 },
      { month: 5, bookings: 10, revenue: 242000 },
      { month: 6, bookings: 17, revenue: 428000 },
      { month: 7, bookings: 12, revenue: 288000 },
      { month: 8, bookings: 19, revenue: 486000 },
      { month: 9, bookings: 15, revenue: 365000 },
      { month: 10, bookings: 21, revenue: 548000 },
      { month: 11, bookings: 16, revenue: 392000 },
      { month: 0, bookings: 23, revenue: 610000 },
      { month: 1, bookings: 18, revenue: 452000 },
      { month: 2, bookings: 20, revenue: 524000 }
    ];

    return monthlySamples.flatMap(sample => {
      const sampleYear = sample.month >= 3 ? year : year + 1;
      const averageAmount = Math.round(sample.revenue / sample.bookings);
      return Array.from({ length: sample.bookings }, (_, index) => ({
        id: `sample-${sampleYear}-${sample.month + 1}-${index + 1}`,
        checkInDate: this.toIsoDate(new Date(sampleYear, sample.month, Math.min(index + 1, 25))),
        createdAt: this.toIsoDate(new Date(sampleYear, sample.month, Math.min(index + 1, 25))),
        status: 'CONFIRMED',
        billingAmount: index === sample.bookings - 1
          ? sample.revenue - averageAmount * (sample.bookings - 1)
          : averageAmount
      }));
    });
  }

  private samplePosMenuItems(): PosMenuItem[] {
    return [
      this.samplePosMenuItem(1, 'Paneer Tikka', 'Food', 'Starter', 420),
      this.samplePosMenuItem(2, 'Butter Chicken', 'Food', 'Main Course', 620),
      this.samplePosMenuItem(3, 'Veg Biryani', 'Food', 'Main Course', 380),
      this.samplePosMenuItem(4, 'Masala Dosa', 'Food', 'Breakfast', 240),
      this.samplePosMenuItem(5, 'Cold Coffee', 'Beverage', 'Beverage', 180),
      this.samplePosMenuItem(6, 'Gulab Jamun', 'Food', 'Dessert', 160),
      this.samplePosMenuItem(7, 'Caesar Salad', 'Food', 'Starter', 310),
      this.samplePosMenuItem(8, 'Lime Soda', 'Beverage', 'Beverage', 120)
    ];
  }

  private samplePosMenuItem(id: number, name: string, category: string, subcategory: string, price: number): PosMenuItem {
    return {
      id,
      outletId: 1,
      name,
      category,
      subcategory,
      price,
      taxPercent: 5,
      variants: [],
      modifiers: [],
      available: true,
      featured: id <= 3,
      stockItem: name,
      imageUrl: this.itemImageUrl(name)
    };
  }

  private itemImageUrl(name: string): string {
    const imageMap: Record<string, string> = {
      'Paneer Tikka': 'paneer-tikka',
      'Butter Chicken': 'butter-chicken',
      'Veg Biryani': 'veg-biryani',
      'Masala Dosa': 'masala-dosa',
      'Cold Coffee': 'cold-coffee',
      'Gulab Jamun': 'gulab-jamun',
      'Caesar Salad': 'caesar-salad',
      'Lime Soda': 'lime-soda'
    };
    const slug = imageMap[name] || 'veg-biryani';
    return `assets/dashboard/pos/${slug}.png`;
  }

  private samplePosOrders(): PosOrder[] {
    const year = this.selectedFinancialYear();
    const orderDates = [
      new Date(year, 3, 12),
      new Date(year, 4, 8),
      new Date(year, 5, 20),
      new Date(year, 7, 5),
      new Date(year, 9, 18),
      new Date(year + 1, 0, 14),
      new Date(year + 1, 1, 22)
    ];

    return [
      this.samplePosOrder(1, 'TABLE', orderDates[0], 'T04', [
        { itemId: 1, name: 'Paneer Tikka', qty: 3, price: 420, course: 'Starter', notes: '' },
        { itemId: 5, name: 'Cold Coffee', qty: 4, price: 180, course: 'Beverage', notes: '' }
      ]),
      this.samplePosOrder(2, 'ROOM', orderDates[1], '', [
        { itemId: 2, name: 'Butter Chicken', qty: 2, price: 620, course: 'Main Course', notes: '' },
        { itemId: 3, name: 'Veg Biryani', qty: 1, price: 380, course: 'Main Course', notes: '' }
      ], '204', 'Priya Nair'),
      this.samplePosOrder(3, 'TABLE', orderDates[2], 'T11', [
        { itemId: 3, name: 'Veg Biryani', qty: 4, price: 380, course: 'Main Course', notes: '' },
        { itemId: 8, name: 'Lime Soda', qty: 5, price: 120, course: 'Beverage', notes: '' }
      ]),
      this.samplePosOrder(4, 'TAKEAWAY', orderDates[3], '', [
        { itemId: 4, name: 'Masala Dosa', qty: 6, price: 240, course: 'Breakfast', notes: '' },
        { itemId: 6, name: 'Gulab Jamun', qty: 2, price: 160, course: 'Dessert', notes: '' }
      ]),
      this.samplePosOrder(5, 'TABLE', orderDates[4], 'T02', [
        { itemId: 2, name: 'Butter Chicken', qty: 3, price: 620, course: 'Main Course', notes: '' },
        { itemId: 7, name: 'Caesar Salad', qty: 1, price: 310, course: 'Starter', notes: '' }
      ]),
      this.samplePosOrder(6, 'ROOM', orderDates[5], '', [
        { itemId: 1, name: 'Paneer Tikka', qty: 2, price: 420, course: 'Starter', notes: '' },
        { itemId: 5, name: 'Cold Coffee', qty: 3, price: 180, course: 'Beverage', notes: '' }
      ], '318', 'Arjun Shah'),
      this.samplePosOrder(7, 'TABLE', orderDates[6], 'T08', [
        { itemId: 3, name: 'Veg Biryani', qty: 2, price: 380, course: 'Main Course', notes: '' },
        { itemId: 6, name: 'Gulab Jamun', qty: 4, price: 160, course: 'Dessert', notes: '' }
      ])
    ];
  }

  private samplePosOrder(
    id: number,
    type: PosOrder['type'],
    openedAt: Date,
    tableNo: string,
    lines: PosOrder['lines'],
    roomNo = '',
    guestName = 'Walk-in Guest'
  ): PosOrder {
    return {
      id,
      outletId: 1,
      orderNo: `SAMPLE-${1000 + id}`,
      type,
      tableNo,
      roomNo,
      guestName,
      server: ['Rajan Mehta', 'Meena Pillai', 'Arjun Menon'][id % 3],
      status: 'BILLED',
      kotNo: `KOT-${500 + id}`,
      openedAt: this.toIsoDate(openedAt),
      notes: 'Sample dashboard order',
      lines
    };
  }

  private parseDate(value: string): Date | null {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value);
    const ddmmyyyy = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(value);
    if (ddmmyyyy) return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
