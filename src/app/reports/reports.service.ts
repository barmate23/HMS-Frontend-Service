import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ExecutiveDashboardSummary {
  frontOfficeOccupancy: {
    occupiedRooms: number;
    totalRooms: number;
    occupancyPercentage: number;
    vacantClean: number;
    vacantCleanPct: number;
    vacantDirty: number;
    vacantDirtyPct: number;
    oooBlocked: number;
    oooBlockedPct: number;
  };
  posRevenueMix: {
    totalSalesToday: number;
    totalOrdersToday: number;
    outlets: { name: string; amount: number; percentage: number; color: string }[];
  };
  operationsPulse: {
    hkVacantCleanText: string;
    hkVacantCleanSubtext: string;
    laundryRevenueText: string;
    laundryRevenueSubtext: string;
    storeValuationText: string;
    storeValuationSubtext: string;
    activePosText: string;
    activePosSubtext: string;
  };
}

export interface ReportItem {
  id: string;
  title: string;
  category: 'front_office' | 'pos' | 'housekeeping' | 'laundry' | 'purchase_inventory';
  categoryLabel: string;
  description: string;
  icon: string;
  gradientBg: string;
  iconColor: string;
  liveMetric: string;
  liveMetricSubtext: string;
  sparklineData: number[];
  isNew?: boolean;
  isFavourite?: boolean;
}

export interface KpiMetric {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
  subtext?: string;
  gradient?: string;
}

export interface ReportTableColumn {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'number' | 'date' | 'badge' | 'percentage';
  sortable?: boolean;
}

export interface AnalyticalReportData {
  reportId: string;
  title: string;
  category: string;
  subtitle: string;
  kpis: KpiMetric[];
  chartData?: {
    labels: string[];
    datasets: { label: string; data: number[]; color: string; colors?: string[] }[];
  };
  categoryMix?: { category: string; sales: number; qty: number; pct: number; color: string }[];
  columns: ReportTableColumn[];
  rows: any[];
  summaryRow?: Record<string, any>;
  abbreviationGuide?: { term: string; fullForm: string; description: string }[];
}

export interface OutletOption {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private favouritesSignal = signal<string[]>(this.loadFavourites());

  // Essential Hotel Admin Reports Suite across 5 core departments
  reportsList = signal<ReportItem[]>([
    // --- 1. FRONT OFFICE REPORTS ---
    {
      id: 'fo-occupancy-summary',
      title: 'Daily Occupancy & RevPAR Summary',
      category: 'front_office',
      categoryLabel: 'Front Office',
      description: 'Real-time room occupancy %, ADR, RevPAR, vacant clean/dirty count, and yield matrix by room type.',
      icon: 'donut_small',
      gradientBg: 'linear-gradient(135deg, #0F3D3E 0%, #1A5C5E 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '86.4% Occupied',
      liveMetricSubtext: '108 of 125 Rooms (RevPAR ₹3,076)',
      sparklineData: [65, 72, 78, 85, 88, 94, 86.4],
      isNew: true
    },
    {
      id: 'fo-cashier-settlement',
      title: 'Front Desk Cashier Settlement Audit',
      category: 'front_office',
      categoryLabel: 'Front Office',
      description: 'Shift-wise cashier collections by Cash, Credit Card, UPI, and Folio settlements.',
      icon: 'point_of_sale',
      gradientBg: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹3,84,500 Total',
      liveMetricSubtext: 'Card: ₹2.0L | Cash: ₹1.07L',
      sparklineData: [28, 31, 34, 36, 39, 37, 38.45]
    },
    {
      id: 'fo-guest-manifest',
      title: 'Arrivals, Departures & In-House Ledger',
      category: 'front_office',
      categoryLabel: 'Front Office',
      description: 'Expected arrivals today, VIP manifests, pending checkout folios, and active guest roster.',
      icon: 'flight_land',
      gradientBg: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '142 Guests In-House',
      liveMetricSubtext: '24 Arrivals | 19 Departures',
      sparklineData: [110, 120, 132, 138, 145, 148, 142]
    },

    // --- 2. POS & DINING REPORTS ---
    {
      id: 'pos-outlet-revenue',
      title: 'POS Outlet Revenue Breakdown',
      category: 'pos',
      categoryLabel: 'POS & Dining',
      description: 'Net sales and order volume split across Restaurant, Bar, Room Service, and Cafe outlets.',
      icon: 'restaurant',
      gradientBg: 'linear-gradient(135deg, #C08261 0%, #E29578 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹1,45,800 Sales',
      liveMetricSubtext: '8 Outlets Active Today',
      sparklineData: [95, 110, 125, 130, 140, 150, 145.8],
      isNew: true
    },
    {
      id: 'pos-payment-method-settlement',
      title: 'POS Payment Method Settlement',
      category: 'pos',
      categoryLabel: 'POS & Dining',
      description: 'Breakdown of Cash, Card, UPI, Room Posting, and Voided order settlement amounts.',
      icon: 'payments',
      gradientBg: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '148 Orders Settled',
      liveMetricSubtext: 'Card ₹92k | UPI ₹38k | Cash ₹15k',
      sparklineData: [110, 120, 130, 145, 152, 148, 148]
    },
    {
      id: 'pos-fast-moving-items',
      title: 'Fast-Moving Menu Items & Sales Matrix',
      category: 'pos',
      categoryLabel: 'POS & Dining',
      description: 'Top-selling dishes & drinks, portion volume, category contribution, and item popularity.',
      icon: 'auto_graph',
      gradientBg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      iconColor: '#FFFFFF',
      liveMetric: 'Paneer Tikka #1',
      liveMetricSubtext: '142 Portions (₹45,440 Sales)',
      sparklineData: [80, 95, 110, 125, 130, 145, 142]
    },

    // --- 3. HOUSEKEEPING REPORTS ---
    {
      id: 'hk-room-status-audit',
      title: 'Room Cleanliness & Maintenance Audit',
      category: 'housekeeping',
      categoryLabel: 'Housekeeping',
      description: 'Real-time room cleanliness states (Clean, Dirty, Inspected, Out-of-Order, Blocked).',
      icon: 'cleaning_services',
      gradientBg: 'linear-gradient(135deg, #2A9D8F 0%, #38B000 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '10 Vacant Clean',
      liveMetricSubtext: '3 Dirty | 4 OOO Maintenance',
      sparklineData: [15, 12, 8, 14, 9, 11, 10]
    },
    {
      id: 'hk-amenity-linen',
      title: 'Linen & Room Amenity Consumption',
      category: 'housekeeping',
      categoryLabel: 'Housekeeping',
      description: 'Daily room amenity consumption, guest bath toiletries, attendant turnaround times.',
      icon: 'hotel',
      gradientBg: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '320 Towels Issued',
      liveMetricSubtext: '98% Inventory In Stock',
      sparklineData: [280, 290, 310, 300, 315, 325, 320]
    },

    // --- 4. LAUNDRY REPORTS ---
    {
      id: 'laundry-guest-ledger',
      title: 'Guest Laundry Billing Ledger',
      category: 'laundry',
      categoryLabel: 'Laundry',
      description: 'Room-wise guest laundry service charges, dry cleaning revenue, and delivery status.',
      icon: 'local_laundry_service',
      gradientBg: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹18,400 Billed',
      liveMetricSubtext: '28 Orders Delivered Today',
      sparklineData: [12, 15, 18, 22, 25, 27, 28]
    },

    // --- 5. PURCHASE & INVENTORY REPORTS ---
    {
      id: 'inv-stock-valuation',
      title: 'Stock Valuation & Low Stock Alerts',
      category: 'purchase_inventory',
      categoryLabel: 'Purchase & Inventory',
      description: 'Current store inventory valuation, category closing stock, and automated low-stock warnings.',
      icon: 'inventory_2',
      gradientBg: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹12,45,000 Value',
      liveMetricSubtext: '6 Low-Stock Reorder Alerts',
      sparklineData: [14, 13, 11, 9, 8, 7, 6],
      isNew: true
    },
    {
      id: 'inv-vendor-po-log',
      title: 'Purchase Orders & Vendor Receiving Log',
      category: 'purchase_inventory',
      categoryLabel: 'Purchase & Inventory',
      description: 'Active purchase orders (POs), Goods Received Notes (GRN), invoice approvals, and supplier costs.',
      icon: 'local_shipping',
      gradientBg: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '8 Active POs',
      liveMetricSubtext: '₹2.1L Pending Delivery',
      sparklineData: [5, 6, 8, 7, 9, 8, 8]
    }
  ]);

  // Favourites Signals & Helpers
  favouriteReportIds = computed(() => this.favouritesSignal());

  favouriteReports = computed(() => {
    const ids = new Set(this.favouritesSignal());
    return this.reportsList().filter(r => ids.has(r.id));
  });

  private loadFavourites(): string[] {
    const saved = localStorage.getItem('hms_favourite_admin_reports');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      'fo-occupancy-summary',
      'fo-cashier-settlement',
      'pos-outlet-revenue',
      'hk-room-status-audit',
      'laundry-guest-ledger',
      'inv-stock-valuation'
    ];
  }

  toggleFavourite(reportId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const current = [...this.favouritesSignal()];
    const index = current.indexOf(reportId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(reportId);
    }
    this.favouritesSignal.set(current);
    localStorage.setItem('hms_favourite_admin_reports', JSON.stringify(current));
  }

  isFavourite(reportId: string): boolean {
    return this.favouritesSignal().includes(reportId);
  }

  getReportById(reportId: string): ReportItem | undefined {
    return this.reportsList().find(r => r.id === reportId);
  }

  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api/reportService/v1/frontoffice';

  fetchOutlets(): Observable<OutletOption[]> {
    return this.http.get<any>('/api/hmsService/v1/pos/outlets/getAllOutlets').pipe(
      map(res => {
        const items = Array.isArray(res) ? res : (res?.data || res?.content || []);
        const list: OutletOption[] = [];
        const seenNames = new Set<string>();

        items.forEach((i: any) => {
          if (i && (i.id || i.outletId || i.outletName || i.name)) {
            const name = (i.outletName || i.name || `Outlet #${i.id}`).trim();
            if (!seenNames.has(name.toLowerCase())) {
              seenNames.add(name.toLowerCase());
              list.push({
                id: String(i.id || i.outletId || name),
                name: name
              });
            }
          }
        });

        return [{ id: 'all', name: 'All Outlets & Property' }, ...list];
      }),
      catchError(() => {
        return of([{ id: 'all', name: 'All Outlets & Property' }]);
      })
    );
  }

  /**
   * Fetch top executive dashboard summary (Front Office, POS, Operations Pulse)
   */
  fetchExecutiveDashboardSummary(date?: string): Observable<ExecutiveDashboardSummary> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);

    return this.http.get<any>(`${this.apiBaseUrl}/executive-dashboard`, { params }).pipe(
      map(res => (res && res.success && res.data) ? (res.data as ExecutiveDashboardSummary) : this.getDefaultExecutiveDashboardSummary()),
      catchError(() => of(this.getDefaultExecutiveDashboardSummary()))
    );
  }

  getDefaultExecutiveDashboardSummary(): ExecutiveDashboardSummary {
    return {
      frontOfficeOccupancy: {
        occupiedRooms: 0,
        totalRooms: 0,
        occupancyPercentage: 0,
        vacantClean: 0,
        vacantCleanPct: 0,
        vacantDirty: 0,
        vacantDirtyPct: 0,
        oooBlocked: 0,
        oooBlockedPct: 0
      },
      posRevenueMix: {
        totalSalesToday: 0,
        totalOrdersToday: 0,
        outlets: []
      },
      operationsPulse: {
        hkVacantCleanText: '0 Vacant Clean',
        hkVacantCleanSubtext: '0 Dirty | 0 OOO Blocked',
        laundryRevenueText: '₹0 Laundry',
        laundryRevenueSubtext: '0 Guest Orders Billed',
        storeValuationText: '₹0 Store Val',
        storeValuationSubtext: '0 Low-Stock Alerts',
        activePosText: '0 Active POs',
        activePosSubtext: '₹0 Pending Delivery'
      }
    };
  }

  /**
   * Fetch live report data from backend HMS_Report_Service via API Gateway.
   * Returns empty report data if backend service returns no data or encounters an error.
   */
  fetchAnalyticalReportData(reportId: string, startDate?: string, endDate?: string, outletId?: string): Observable<AnalyticalReportData> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (outletId && outletId !== 'all') params = params.set('outletId', outletId);

    return this.http.get<any>(`${this.apiBaseUrl}/report-data/${reportId}`, { params }).pipe(
      map(res => {
        if (res && res.success && res.data) {
          const data = res.data as AnalyticalReportData;
          if (reportId === 'hk-room-status-audit') {
            if (data.columns) {
              data.columns = data.columns.filter(c => c.key !== 'floor');
            }
            if (data.rows) {
              const activeRows = data.rows.filter(r =>
                (r['tasks'] && r['tasks'] !== 'None') ||
                (r['maintenance'] && r['maintenance'] !== 'No Issues') ||
                (r['lostFound'] && r['lostFound'] !== 'None') ||
                (r['attendant'] && r['attendant'] !== 'Unassigned')
              );
              data.rows = activeRows;
            }
          }
          return data;
        }
        return this.getEmptyReportData(reportId);
      }),
      catchError(() => {
        return of(this.getEmptyReportData(reportId));
      })
    );
  }

  getEmptyReportData(reportId: string): AnalyticalReportData {
    const item = this.getReportById(reportId);
    return {
      reportId,
      title: item?.title || 'Analytical Report',
      category: item?.categoryLabel || 'Reports',
      subtitle: item?.description || 'Real-time database report ledger',
      kpis: [
        { label: 'Total Hotel Capacity', value: '0 Rooms', icon: 'domain', subtext: 'Database Inventory' },
        { label: 'Occupied Rooms', value: '0 Rooms', icon: 'king_bed', subtext: '0% Occupancy' },
        { label: 'Vacant Clean', value: '0 Rooms', icon: 'check_circle', subtext: 'No Clean Rooms' },
        { label: 'Out-of-Order (OOO)', value: '0 Rooms', icon: 'construction', subtext: 'No Maintenance Entries' }
      ],
      chartData: {
        labels: ['Occupied Clean', 'Occupied Dirty', 'Vacant Clean', 'Vacant Dirty', 'OOO Maintenance'],
        datasets: [
          { label: 'Room Count', data: [0, 0, 0, 0, 0], color: '#2A9D8F' }
        ]
      },
      categoryMix: [
        { category: 'Occupied Clean', sales: 0, qty: 0, pct: 0, color: '#0F3D3E' },
        { category: 'Vacant Clean', sales: 0, qty: 0, pct: 0, color: '#10B981' },
        { category: 'Occupied Dirty', sales: 0, qty: 0, pct: 0, color: '#F59E0B' },
        { category: 'Vacant Dirty', sales: 0, qty: 0, pct: 0, color: '#EF4444' },
        { category: 'OOO Maintenance', sales: 0, qty: 0, pct: 0, color: '#6B7280' }
      ],
      columns: [
        { key: 'roomNumber', label: 'Room No.', sortable: true },
        { key: 'roomType', label: 'Room Type', sortable: true },
        { key: 'hkStatus', label: 'Cleanliness Status', type: 'badge', sortable: true },
        { key: 'attendant', label: 'Assigned Housekeeper', sortable: true },
        { key: 'tasks', label: 'Assigned Tasks' },
        { key: 'maintenance', label: 'Maintenance Requests' },
        { key: 'lostFound', label: 'Lost & Found Log' }
      ],
      rows: [],
      summaryRow: { roomNumber: 'TOTAL', roomType: '0 Active Rooms', hkStatus: '0 Occupied', attendant: 'No Assignments', tasks: '0 Tasks', maintenance: '0 Issues', lostFound: '0 Items' }
    };
  }

  getAnalyticalReportData(reportId: string): AnalyticalReportData {
    return this.getEmptyReportData(reportId);
  }
}
