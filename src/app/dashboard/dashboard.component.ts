import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

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

interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface DashboardSummaryDto {
  totalRooms?: number;
  availableRooms?: number;
  occupiedRooms?: number;
  fyBookingRevenue?: number;
  posOrders?: number;
}

interface MonthlyStatDto {
  month?: string;
  revenue?: number;
  bookings?: number;
  soldQty?: number;
}

interface RevenueAndBookingsDto {
  monthlyPerformance?: MonthlyStatDto[];
  totalRevenue?: number;
  totalBookings?: number;
  abv?: number;
}

interface FloorStatDto {
  floorName?: string;
  total?: number;
  available?: number;
  occupied?: number;
  blocked?: number;
}

interface PosItemStatDto {
  itemName?: string;
  category?: string;
  soldQty?: number;
  rate?: number;
  avgRate?: number;
  monthlyTrend?: MonthlyStatDto[];
  totalValue?: number;
  imageUrl?: string | null;
}

interface PosPerformanceDto {
  orderValue?: number;
  avgOrder?: number;
  menuItemsCount?: number;
  topSellingItems?: PosItemStatDto[];
  lessSellingItems?: PosItemStatDto[];
}

interface DashboardDataDto {
  summary?: DashboardSummaryDto;
  revenueAndBookings?: RevenueAndBookingsDto;
  floorWiseRooms?: FloorStatDto[];
  overallOccupancy?: number;
  posPerformance?: PosPerformanceDto;
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
  private readonly dashboardUrl = '/api/hmsService/v1/dashboard/getDashboardData';

  readonly selectedFinancialYear = signal(this.currentFinancialYear());
  readonly dashboardData = signal<DashboardDataDto | null>(null);
  readonly isLoadingRevenue = signal(false);
  readonly revenueError = signal<string | null>(null);
  readonly activeSellingTab = signal<'top' | 'less'>('top');

  readonly financialYears = computed(() => {
    const current = this.currentFinancialYear();
    return Array.from({ length: 5 }, (_, index) => current - index);
  });

  readonly roomKpis = computed(() => {
    const summary = this.dashboardData()?.summary;
    if (summary) {
      const total = Number(summary.totalRooms || 0);
      const available = Number(summary.availableRooms || 0);
      const occupied = Number(summary.occupiedRooms || 0);
      const floorBlocked = (this.dashboardData()?.floorWiseRooms || []).reduce((sum, floor) => sum + Number(floor.blocked || 0), 0);
      const blocked = Math.max(0, total - available - occupied, floorBlocked);
      const occupancy = Math.round(Number(this.dashboardData()?.overallOccupancy ?? (total ? occupied / total * 100 : 0)));

      return { total, available, occupied, blocked, occupancy };
    }

    return { total: 0, available: 0, occupied: 0, blocked: 0, occupancy: 0 };
  });

  readonly floorRoomMetrics = computed<FloorRoomMetric[]>(() => {
    const floors = this.dashboardData()?.floorWiseRooms || [];
    if (floors.length) {
      return floors.map(floor => ({
        floor: floor.floorName || 'Floor',
        total: Number(floor.total || 0),
        available: Number(floor.available || 0),
        occupied: Number(floor.occupied || 0),
        blocked: Number(floor.blocked || 0)
      })).sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }));
    }

    return [];
  });

  readonly monthMetrics = computed<MonthMetric[]>(() => {
    const months = this.financialYearMonths();
    const apiMonths = this.dashboardData()?.revenueAndBookings?.monthlyPerformance || [];

    if (apiMonths.length) {
      const byLabel = new Map(apiMonths.map(item => [String(item.month || '').toLowerCase(), item]));
      const buckets = months.map(month => {
        const apiMonth = byLabel.get(month.label.toLowerCase());
        return {
          ...month,
          revenue: Number(apiMonth?.revenue || 0),
          bookings: Number(apiMonth?.bookings || 0)
        };
      });
      return this.withMonthHeights(buckets);
    }

    return this.withMonthHeights(months.map(month => ({ ...month, revenue: 0, bookings: 0 })));
  });

  readonly totalMonthlyRevenue = computed(() => Number(this.dashboardData()?.revenueAndBookings?.totalRevenue ?? this.dashboardData()?.summary?.fyBookingRevenue ?? 0));
  readonly totalBookings = computed(() => Number(this.dashboardData()?.revenueAndBookings?.totalBookings ?? 0));
  readonly averageBookingValue = computed(() => {
    const apiAbv = this.dashboardData()?.revenueAndBookings?.abv;
    if (apiAbv !== undefined) return Math.round(Number(apiAbv || 0));
    const bookings = this.totalBookings();
    return bookings ? Math.round(this.totalMonthlyRevenue() / bookings) : 0;
  });

  readonly posOrderCount = computed(() => Number(this.dashboardData()?.summary?.posOrders ?? 0));
  readonly posOrderValue = computed(() => Number(this.dashboardData()?.posPerformance?.orderValue ?? 0));
  readonly averagePosOrderValue = computed(() => {
    const apiAvgOrder = this.dashboardData()?.posPerformance?.avgOrder;
    if (apiAvgOrder !== undefined) return Math.round(Number(apiAvgOrder || 0));
    const count = this.posOrderCount();
    return count ? Math.round(this.posOrderValue() / count) : 0;
  });
  readonly posMenuItemCount = computed(() => Number(this.dashboardData()?.posPerformance?.menuItemsCount ?? 0));

  readonly posItemMetrics = computed<PosItemMetric[]>(() => {
    return [];
  });

  readonly topSellingItems = computed(() => {
    const apiItems = this.dashboardData()?.posPerformance?.topSellingItems || [];
    if (apiItems.length) return apiItems.map(item => this.mapPosItemStat(item));
    return this.posItemMetrics()
      .filter(item => item.qty > 0)
      .sort((a, b) => b.qty - a.qty || b.value - a.value)
      .slice(0, 5);
  });

  readonly lessSellingItems = computed(() => {
    const apiItems = this.dashboardData()?.posPerformance?.lessSellingItems || [];
    if (apiItems.length) return apiItems.map(item => this.mapPosItemStat(item));
    return this.posItemMetrics()
      .sort((a, b) => a.qty - b.qty || a.value - b.value || a.name.localeCompare(b.name))
      .slice(0, 5);
  });

  constructor() {
    this.loadFinancialYearReservations();
  }

  onFinancialYearChange(value: string): void {
    this.selectedFinancialYear.set(Number(value));
    this.loadFinancialYearReservations();
  }

  loadFinancialYearReservations(): void {
    this.isLoadingRevenue.set(true);
    this.http.get<StandardResponse<DashboardDataDto>>(this.dashboardUrl).subscribe({
      next: response => {
        if (response?.success && response.data) {
          this.dashboardData.set(response.data);
          this.revenueError.set(null);
        } else {
          this.clearDashboardData(response?.message || 'Dashboard data is not available.');
        }
        this.isLoadingRevenue.set(false);
      },
      error: error => {
        this.clearDashboardData(error?.error?.message || error?.message || 'Unable to load dashboard data.');
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

  private clearDashboardData(message: string): void {
    this.dashboardData.set(null);
    this.revenueError.set(message);
  }

  private withMonthHeights(buckets: Array<{ key: string; label: string; revenue: number; bookings: number }>): MonthMetric[] {
    const maxRevenue = Math.max(1, ...buckets.map(item => item.revenue));
    const maxBookings = Math.max(1, ...buckets.map(item => item.bookings));
    return buckets.map(item => ({
      ...item,
      revenueHeight: Math.max(8, Math.round((item.revenue / maxRevenue) * 100)),
      bookingHeight: Math.max(8, Math.round((item.bookings / maxBookings) * 100))
    }));
  }

  private mapPosItemStat(item: PosItemStatDto): PosItemMetric {
    const qty = Number(item.soldQty || 0);
    const value = Number(item.totalValue || 0);
    const price = Number(item.rate ?? item.avgRate ?? (qty ? value / qty : 0));
    const monthVariation = this.monthVariationFromTrend(item.monthlyTrend || []);

    return {
      name: item.itemName || 'Menu Item',
      category: item.category || 'POS',
      subcategory: 'Item',
      imageUrl: item.imageUrl || '',
      price,
      qty,
      value,
      monthVariation
    };
  }

  private monthVariationFromTrend(trend: MonthlyStatDto[]): PosItemMetric['monthVariation'] {
    const months = this.financialYearMonths();
    if (!trend.length) {
      return months.map(month => ({ label: month.label.toLowerCase(), qty: 0, height: 8 }));
    }

    const byLabel = new Map(trend.map(item => [String(item.month || '').toLowerCase(), item]));
    const rows = months.map(month => ({
      label: month.label.toLowerCase(),
      qty: Number(byLabel.get(month.label.toLowerCase())?.soldQty || 0),
      height: 8
    }));
    const maxQty = Math.max(1, ...rows.map(month => month.qty));
    return rows.map(month => ({ ...month, height: Math.max(8, Math.round(month.qty / maxQty * 100)) }));
  }

  private currentFinancialYear(): number {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
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

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

}
