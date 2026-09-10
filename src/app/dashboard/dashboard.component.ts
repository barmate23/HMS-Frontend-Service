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
  readonly activeRevenueChartView = signal<'area' | 'bar'>('area');
  readonly hoveredMonthIndex = signal<number | null>(null);

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

  readonly donutChartData = computed(() => {
    const kpis = this.roomKpis();
    const total = kpis.total || 0;
    const circumference = 2 * Math.PI * 40; // ~251.327

    if (!total) {
      return {
        total: 0,
        available: 0,
        occupied: 0,
        blocked: 0,
        occupancy: 0,
        availablePct: 0,
        occupiedPct: 0,
        blockedPct: 0,
        circumference,
        occupiedDash: `0 ${circumference}`,
        availableDash: `0 ${circumference}`,
        blockedDash: `0 ${circumference}`,
        occupiedOffset: 0,
        availableOffset: 0,
        blockedOffset: 0
      };
    }

    const occupiedPct = Math.round((kpis.occupied / total) * 100);
    const availablePct = Math.round((kpis.available / total) * 100);
    const blockedPct = Math.max(0, 100 - occupiedPct - availablePct);

    const occupiedLen = (kpis.occupied / total) * circumference;
    const availableLen = (kpis.available / total) * circumference;
    const blockedLen = (kpis.blocked / total) * circumference;

    return {
      total,
      available: kpis.available,
      occupied: kpis.occupied,
      blocked: kpis.blocked,
      occupancy: kpis.occupancy,
      availablePct,
      occupiedPct,
      blockedPct,
      circumference,
      occupiedDash: `${occupiedLen.toFixed(2)} ${(circumference - occupiedLen).toFixed(2)}`,
      availableDash: `${availableLen.toFixed(2)} ${(circumference - availableLen).toFixed(2)}`,
      blockedDash: `${blockedLen.toFixed(2)} ${(circumference - blockedLen).toFixed(2)}`,
      occupiedOffset: 0,
      availableOffset: -occupiedLen,
      blockedOffset: -(occupiedLen + availableLen)
    };
  });

  readonly revenueTrendChart = computed(() => {
    const months = this.monthMetrics();
    const width = 720;
    const height = 130;
    const padding = { top: 12, right: 20, bottom: 20, left: 48 };
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;

    const rawMaxRevenue = Math.max(1000, ...months.map(m => m.revenue));
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMaxRevenue)));
    const maxRevenue = Math.ceil(rawMaxRevenue / magnitude) * magnitude;
    const maxBookings = Math.max(1, ...months.map(m => m.bookings));

    const yTicks = [0, 0.5, 1].map(ratio => {
      const val = maxRevenue * ratio;
      const y = padding.top + usableHeight - ratio * usableHeight;
      let label = '0';
      if (val >= 10000000) label = (val / 10000000).toFixed(1) + 'Cr';
      else if (val >= 100000) label = (val / 100000).toFixed(1) + 'L';
      else if (val >= 1000) label = (val / 1000).toFixed(0) + 'k';
      else if (val > 0) label = String(Math.round(val));
      return { y, value: val, label: '₹' + label };
    });

    const points = months.map((m, i) => {
      const x = padding.left + (i / Math.max(1, months.length - 1)) * usableWidth;
      const revRatio = Math.min(1, Math.max(0, m.revenue / maxRevenue));
      const bookRatio = Math.min(1, Math.max(0, m.bookings / maxBookings));
      const yRev = padding.top + usableHeight - revRatio * usableHeight;
      const yBook = padding.top + usableHeight - bookRatio * usableHeight;
      return {
        index: i,
        month: m.label,
        revenue: m.revenue,
        bookings: m.bookings,
        x,
        yRev,
        yBook
      };
    });

    const buildSmoothPath = (pts: Array<{ x: number; y: number }>) => {
      if (!pts.length) return '';
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i === 0 ? 0 : i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    };

    const revCoords = points.map(p => ({ x: p.x, y: p.yRev }));
    const bookCoords = points.map(p => ({ x: p.x, y: p.yBook }));

    const revLine = buildSmoothPath(revCoords);
    const bookLine = buildSmoothPath(bookCoords);
    const bottomY = padding.top + usableHeight;
    const revArea = revCoords.length ? `${revLine} L ${revCoords[revCoords.length - 1].x.toFixed(1)} ${bottomY} L ${revCoords[0].x.toFixed(1)} ${bottomY} Z` : '';

    return {
      width,
      height,
      padding,
      bottomY,
      maxRevenue,
      maxBookings,
      yTicks,
      points,
      revLine,
      bookLine,
      revArea
    };
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

  onImgError(event: Event, itemName?: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.getFallbackFoodImage(itemName);
    }
  }

  private getValidImageUrl(name?: string, url?: string | null): string {
    if (!url || typeof url !== 'string' || url === 'string' || url.trim() === '') {
      return this.getFallbackFoodImage(name);
    }
    const cleanUrl = url.trim();
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('assets/') || cleanUrl.startsWith('data:')) {
      return cleanUrl;
    }
    return this.getFallbackFoodImage(name);
  }

  private getFallbackFoodImage(name?: string): string {
    const lower = (name || '').toLowerCase();
    if (lower.includes('roti') || lower.includes('naan') || lower.includes('bread') || lower.includes('tandoor')) {
      return 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=150&auto=format&fit=crop&q=80';
    }
    if (lower.includes('paneer') || lower.includes('tikka') || lower.includes('kabab')) {
      return 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=150&auto=format&fit=crop&q=80';
    }
    if (lower.includes('biryani') || lower.includes('rice') || lower.includes('pulao')) {
      return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=150&auto=format&fit=crop&q=80';
    }
    if (lower.includes('coffee') || lower.includes('tea') || lower.includes('latte')) {
      return 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=150&auto=format&fit=crop&q=80';
    }
    if (lower.includes('burger') || lower.includes('sandwich')) {
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=80';
    }
    if (lower.includes('pizza')) {
      return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&auto=format&fit=crop&q=80';
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
      imageUrl: this.getValidImageUrl(item.itemName, item.imageUrl),
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
