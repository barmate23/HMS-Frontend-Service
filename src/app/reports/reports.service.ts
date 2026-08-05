import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
    {
      id: 'laundry-wash-log',
      title: 'In-House Linen Wash & Turnaround Log',
      category: 'laundry',
      categoryLabel: 'Laundry',
      description: 'Hotel bedsheets, towels, tablecloths wash cycle counts, vendor dispatch, and damage log.',
      icon: 'dry_cleaning',
      gradientBg: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '450 kg Processed',
      liveMetricSubtext: 'Turnaround: 3.5 Hours',
      sparklineData: [380, 400, 420, 430, 460, 440, 450]
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
   * Fetch live report data from backend HMS_Report_Service via API Gateway.
   * Falls back to offline mock dataset if backend service is unreachable.
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
              data.rows = activeRows.length > 0 ? activeRows : data.rows.slice(0, 1);
            }
          }
          return data;
        }
        return this.filterFallbackByDate(this.getAnalyticalReportData(reportId), startDate, endDate);
      }),
      catchError(() => {
        return of(this.filterFallbackByDate(this.getAnalyticalReportData(reportId), startDate, endDate));
      })
    );
  }

  private filterFallbackByDate(data: AnalyticalReportData, startDate?: string, endDate?: string): AnalyticalReportData {
    if (!startDate || !endDate || !data.rows || data.rows.length === 0) {
      return data;
    }
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Only keep rows that fall within [startDate, endDate]
    const matchedRows = data.rows.filter(r => {
      const rawDate = r['deliveryTime'] || r['date'] || r['reportedAt'];
      if (!rawDate || rawDate === '-') return false;
      const d = new Date(rawDate);
      return !isNaN(d.getTime()) && d >= start && d <= end;
    });

    if (matchedRows.length === 0) {
      const isRevenueReport = data.kpis.some(k => k.label.toLowerCase().includes('revenue'));
      return {
        ...data,
        kpis: data.kpis.map(k => {
          if (k.label.toLowerCase().includes('revenue')) return { ...k, value: '₹0' };
          if (k.label.toLowerCase().includes('order')) return { ...k, value: '0 Orders' };
          if (k.label.toLowerCase().includes('pcs') || k.label.toLowerCase().includes('volume')) return { ...k, value: '0 Pcs' };
          return k;
        }),
        rows: [],
        summaryRow: {
          ...data.summaryRow,
          orderNo: 'TOTAL',
          roomGuest: '0 Orders Processed',
          totalAmount: 0
        }
      };
    }

    return {
      ...data,
      rows: matchedRows
    };
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

  // Analytical Dataset Generator for Viewer (Fallback)
  getAnalyticalReportData(reportId: string): AnalyticalReportData {
    const item: ReportItem = this.getReportById(reportId) || {
      id: reportId,
      title: 'Executive Admin Report',
      category: 'front_office',
      categoryLabel: 'Hotel Admin',
      description: 'Performance & Operations Statement.',
      icon: 'assessment',
      gradientBg: 'linear-gradient(135deg, #0F3D3E 0%, #1A5C5E 100%)',
      iconColor: '#FFFFFF',
      liveMetric: 'Active Status',
      liveMetricSubtext: 'Hotel Operations',
      sparklineData: [10, 20, 30, 40, 50]
    };

    switch (reportId) {
      case 'fo-occupancy-summary':
        return {
          reportId,
          title: 'Daily Occupancy & RevPAR Summary',
          category: 'Front Office',
          subtitle: 'Real-time room occupancy, vacant clean/dirty status, OOO count, and RevPAR yield matrix.',
          kpis: [
            { label: 'Total Active Capacity', value: '125 Rooms', icon: 'domain', subtext: 'Hotel Room Inventory' },
            { label: 'Occupied Rooms', value: '108 Rooms', change: '+8 Rooms', changeType: 'positive', icon: 'king_bed', subtext: 'Occupancy Rate: 86.4%' },
            { label: 'Average Daily Rate (ADR)', value: '₹3,560', change: '+4.2%', changeType: 'positive', icon: 'trending_up', subtext: 'RevPAR: ₹3,076' },
            { label: 'Vacant Rooms', value: '13 Ready', icon: 'meeting_room', subtext: '10 Clean | 3 Dirty' }
          ],
          chartData: {
            labels: ['Deluxe Queen', 'Executive King', 'Superior Twin', 'Luxury Suite', 'Penthouse'],
            datasets: [
              { label: 'Occupied Rooms', data: [41, 31, 20, 10, 6], color: '#0F3D3E' },
              { label: 'Total Capacity', data: [45, 35, 25, 12, 8], color: '#C08261' }
            ]
          },
          columns: [
            { key: 'roomCategory', label: 'Room Category', sortable: true },
            { key: 'totalRooms', label: 'Total Capacity', sortable: true },
            { key: 'occupied', label: 'Occupied', sortable: true },
            { key: 'vacantClean', label: 'Vacant Clean' },
            { key: 'vacantDirty', label: 'Vacant Dirty' },
            { key: 'ooo', label: 'OOO Blocked' },
            { key: 'occPercent', label: 'Occupancy %', type: 'percentage', sortable: true },
            { key: 'adr', label: 'ADR (₹)', type: 'currency', sortable: true },
            { key: 'revpar', label: 'RevPAR (₹)', type: 'currency', sortable: true },
            { key: 'totalRevenue', label: 'Total Revenue (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { roomCategory: 'Deluxe Queen Room', totalRooms: 45, occupied: 41, vacantClean: 2, vacantDirty: 1, ooo: 1, occPercent: 91.1, adr: 3200, revpar: 2915, totalRevenue: 131200 },
            { roomCategory: 'Executive King Room', totalRooms: 35, occupied: 31, vacantClean: 3, vacantDirty: 1, ooo: 0, occPercent: 88.6, adr: 4100, revpar: 3632, totalRevenue: 127100 },
            { roomCategory: 'Superior Twin Room', totalRooms: 25, occupied: 20, vacantClean: 3, vacantDirty: 1, ooo: 1, occPercent: 80.0, adr: 2900, revpar: 2320, totalRevenue: 58000 },
            { roomCategory: 'Luxury Ocean Suite', totalRooms: 12, occupied: 10, vacantClean: 1, vacantDirty: 0, ooo: 1, occPercent: 83.3, adr: 7500, revpar: 6247, totalRevenue: 75000 },
            { roomCategory: 'Presidential Penthouse', totalRooms: 8, occupied: 6, vacantClean: 1, vacantDirty: 0, ooo: 1, occPercent: 75.0, adr: 14500, revpar: 10875, totalRevenue: 87000 }
          ],
          summaryRow: { roomCategory: 'OVERALL HOTEL YIELD', totalRooms: 125, occupied: 108, vacantClean: 10, vacantDirty: 3, ooo: 4, occPercent: 86.4, adr: 3560, revpar: 3076, totalRevenue: 478300 }
        };

      case 'fo-cashier-settlement':
        return {
          reportId,
          title: 'Front Desk Cashier Settlement Audit',
          category: 'Front Office',
          subtitle: 'Shift collections audit by Cash, Credit Card, UPI, and Folio settlements.',
          kpis: [
            { label: 'Total Collections Today', value: '₹3,84,500', change: '+14.2%', changeType: 'positive', icon: 'payments', subtext: 'All Payment Modes (148 Txns)' },
            { label: 'Credit & Debit Cards', value: '₹2,00,000', icon: 'credit_card', subtext: '52.0% Share • Terminal #1 & #2' },
            { label: 'Cash Drawer Collections', value: '₹1,07,600', icon: 'payments', subtext: '28.0% Share • Safe Drop Verified' },
            { label: 'Digital & City Ledger', value: '₹76,900', icon: 'qr_code_scanner', subtext: 'UPI: ₹57.67K | Folio: ₹19.23K' }
          ],
          chartData: {
            labels: ['Credit Card', 'Cash', 'UPI App', 'City Ledger', 'Bank Transfer'],
            datasets: [
              { label: 'Collection Amount (₹)', data: [200000, 107600, 57675, 12000, 7225], color: '#0F3D3E' }
            ]
          },
          columns: [
            { key: 'receiptNo', label: 'Receipt No.', sortable: true },
            { key: 'time', label: 'Time & Shift', type: 'date' },
            { key: 'guestRoom', label: 'Guest Name / Folio' },
            { key: 'payMode', label: 'Payment Mode', type: 'badge' },
            { key: 'refNo', label: 'Txn Ref / Terminal' },
            { key: 'cashier', label: 'Front Desk Cashier' },
            { key: 'auditStatus', label: 'Audit Status', type: 'badge' },
            { key: 'amount', label: 'Amount (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { receiptNo: 'RCP-801', time: '09:15 AM (Morning)', guestRoom: 'Rajesh Sharma (Room 302)', payMode: 'CREDIT CARD', refNo: 'TERM-01 / #8821', cashier: 'Sunil Kumar', auditStatus: 'CLEARED', amount: 45000 },
            { receiptNo: 'RCP-802', time: '10:30 AM (Morning)', guestRoom: 'Infosys Corp (Room 405)', payMode: 'CITY LEDGER', refNo: 'FOLIO-POST #405', cashier: 'Sunil Kumar', auditStatus: 'POSTED TO FOLIO', amount: 88000 },
            { receiptNo: 'RCP-803', time: '11:45 AM (Morning)', guestRoom: 'Sarah Jenkins (Room 214)', payMode: 'UPI App', refNo: 'UPI-TXN-99812', cashier: 'Sunil Kumar', auditStatus: 'CLEARED', amount: 15000 },
            { receiptNo: 'RCP-804', time: '01:20 PM (Evening)', guestRoom: 'Amitav Ghosh (Room 108)', payMode: 'CASH', refNo: 'DRAWER-DROP #04', cashier: 'Priya Sharma', auditStatus: 'CLEARED', amount: 28500 },
            { receiptNo: 'RCP-805', time: '03:10 PM (Evening)', guestRoom: 'David Miller (Room 218)', payMode: 'CREDIT CARD', refNo: 'TERM-02 / #9910', cashier: 'Priya Sharma', auditStatus: 'CLEARED', amount: 34000 },
            { receiptNo: 'RCP-806', time: '05:45 PM (Evening)', guestRoom: 'Vikram Malhotra (Room 501)', payMode: 'UPI App', refNo: 'UPI-TXN-10442', cashier: 'Priya Sharma', auditStatus: 'CLEARED', amount: 42675 },
            { receiptNo: 'RCP-807', time: '09:30 PM (Night)', guestRoom: 'Anita Roy (Room 112)', payMode: 'CASH', refNo: 'DRAWER-DROP #08', cashier: 'Rohan Verma', auditStatus: 'PENDING AUDIT', amount: 79100 }
          ],
          summaryRow: { receiptNo: 'TOTAL', guestRoom: 'Shift Collections Total', refNo: '7 Transactions', cashier: '3 Cashiers', auditStatus: '100% RECONCILED', amount: 332275 }
        };

      case 'fo-guest-manifest':
        return {
          reportId,
          title: 'Arrivals, Departures & In-House Ledger',
          category: 'Front Office',
          subtitle: 'Expected arrivals today, VIP manifests, pending checkout folios, and active guest roster.',
          kpis: [
            { label: 'Guests Currently In-House', value: '142 Guests', icon: 'people', subtext: '108 Occupied Rooms (1.3/Room)' },
            { label: 'Expected Arrivals Today', value: '24 Arrivals', change: '+4 VIPs', changeType: 'positive', icon: 'flight_land', subtext: '18 Checked-In | 6 Expected ETA' },
            { label: 'Expected Departures Today', value: '19 Departures', icon: 'flight_takeoff', subtext: '14 Checked-Out | 5 Pending Folio' },
            { label: 'VIP Guest Manifest', value: '5 VIP Guests', icon: 'star', subtext: '3 Suites | Airport Pickups Scheduled' }
          ],
          chartData: {
            labels: ['08:00 AM', '11:00 AM', '02:00 PM', '05:00 PM', '08:00 PM', '11:00 PM'],
            datasets: [
              { label: 'Arrivals', data: [3, 8, 7, 4, 2, 0], color: '#6D28D9' },
              { label: 'Departures', data: [5, 9, 3, 2, 0, 0], color: '#2A9D8F' }
            ]
          },
          columns: [
            { key: 'resRef', label: 'Res. Ref & Room', sortable: true },
            { key: 'guestName', label: 'Guest Name & VIP Tag', sortable: true },
            { key: 'manifestCat', label: 'Manifest Status', type: 'badge' },
            { key: 'dates', label: 'Stay Duration' },
            { key: 'roomCategory', label: 'Room Category' },
            { key: 'folioBalance', label: 'Folio Balance (₹)', type: 'currency', sortable: true },
            { key: 'guestStatus', label: 'Guest Status', type: 'badge' }
          ],
          rows: [
            { resRef: 'RES-9012 (Room 302)', guestName: 'Rajesh Sharma ⭐ VIP', manifestCat: 'IN-HOUSE', dates: '29 Jul - 02 Aug 2026', roomCategory: 'Deluxe Queen Room', folioBalance: 0, guestStatus: 'CHECKED IN' },
            { resRef: 'RES-9015 (Room 405)', guestName: 'Infosys Corp Group', manifestCat: 'ARRIVING TODAY', dates: '31 Jul - 05 Aug 2026', roomCategory: 'Executive King Room', folioBalance: 88000, guestStatus: 'EXPECTED ARRIVAL' },
            { resRef: 'RES-8998 (Room 214)', guestName: 'Sarah Jenkins', manifestCat: 'DEPARTING TODAY', dates: '28 Jul - 31 Jul 2026', roomCategory: 'Superior Twin Room', folioBalance: 0, guestStatus: 'CHECKED OUT' },
            { resRef: 'RES-9022 (Room 108)', guestName: 'Amitav Ghosh', manifestCat: 'IN-HOUSE', dates: '30 Jul - 03 Aug 2026', roomCategory: 'Deluxe Queen Room', folioBalance: 12500, guestStatus: 'CHECKED IN' },
            { resRef: 'RES-9030 (Room 501)', guestName: 'Dr. Vikram Malhotra ⭐ VIP', manifestCat: 'VIP ARRIVAL', dates: '31 Jul - 04 Aug 2026', roomCategory: 'Presidential Penthouse', folioBalance: 145000, guestStatus: 'VIP CHECKED IN' },
            { resRef: 'RES-9004 (Room 218)', guestName: 'David Miller', manifestCat: 'DEPARTING TODAY', dates: '27 Jul - 31 Jul 2026', roomCategory: 'Luxury Ocean Suite', folioBalance: 4500, guestStatus: 'CHECKOUT PENDING' }
          ],
          summaryRow: { resRef: 'TOTAL MANIFEST', guestName: '6 Key Manifest Records', dates: 'Active Audit Window', folioBalance: 250000, guestStatus: 'ROSTER AUDITED' }
        };

      case 'pos-outlet-revenue':
        return {
          reportId,
          title: 'POS Outlet Revenue & Sales Breakdown',
          category: 'POS & Dining',
          subtitle: 'Net sales volume, KOT counts, and guest spending split across hotel F&B outlets.',
          kpis: [
            { label: 'Total POS Sales Today', value: '₹1,45,800', change: '+18.5%', changeType: 'positive', icon: 'restaurant', subtext: 'Food & Beverage Revenue' },
            { label: 'Total Orders (KOTs)', value: '148 Orders', icon: 'receipt_long', subtext: 'Avg Ticket: ₹985' },
            { label: 'Main Restaurant', value: '₹78,400', icon: 'dinner_dining', subtext: '53.8% Revenue Share' },
            { label: 'Bar & Lounge', value: '₹42,200', icon: 'local_bar', subtext: '28.9% Revenue Share' }
          ],
          chartData: {
            labels: ['Grand Palace Restaurant', 'Sky Lounge Bar', 'Poolside Cafe', 'Room Service', 'Pastry Shop'],
            datasets: [
              { label: 'Sales Revenue (₹)', data: [78400, 42200, 12800, 8400, 4000], color: '#C08261' }
            ]
          },
          columns: [
            { key: 'outletName', label: 'Outlet Name', sortable: true },
            { key: 'outletType', label: 'Outlet Type', type: 'badge' },
            { key: 'orders', label: 'Orders Count', sortable: true },
            { key: 'avgTicket', label: 'Avg Ticket (₹)', type: 'currency' },
            { key: 'revenue', label: 'Total Revenue (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { outletName: 'Grand Palace Restaurant', outletType: 'RESTAURANT', orders: 72, avgTicket: 1088, revenue: 78400 },
            { outletName: 'Sky Lounge & Rooftop Bar', outletType: 'BAR', orders: 38, avgTicket: 1110, revenue: 42200 },
            { outletName: 'Poolside Grill & Cafe', outletType: 'CAFE', orders: 22, avgTicket: 581, revenue: 12800 },
            { outletName: '24x7 Room Service', outletType: 'ROOM SERVICE', orders: 11, avgTicket: 763, revenue: 8400 },
            { outletName: 'Pastry & Coffee Shop', outletType: 'BAKERY', orders: 5, avgTicket: 800, revenue: 4000 }
          ],
          summaryRow: { outletName: 'TOTAL F&B REVENUE', orders: 148, avgTicket: 985, revenue: 145800 }
        };

      case 'pos-payment-method-settlement':
      case 'pos-payment-split':
        return {
          reportId,
          title: 'POS Payment Method Settlement',
          category: 'POS & Dining',
          subtitle: 'Breakdown of Cash, Card, UPI, Room Posting, and Voided order settlement amounts.',
          kpis: [
            { label: 'Total POS Collections', value: '₹1,45,800', icon: 'payments', subtext: '148 Orders Settled' },
            { label: 'Cash Collections', value: '₹15,000', icon: 'point_of_sale', subtext: 'Cash Drawer' },
            { label: 'UPI / QR Payments', value: '₹38,000', icon: 'qr_code_2', subtext: 'Digital Direct' },
            { label: 'Card & Folio Postings', value: '₹92,800', icon: 'credit_card', subtext: 'Terminal & Room Folio' }
          ],
          columns: [
            { key: 'orderNo', label: 'Order #', sortable: true },
            { key: 'outlet', label: 'Outlet', sortable: true },
            { key: 'guestName', label: 'Guest / Table', sortable: true },
            { key: 'time', label: 'Date & Time', type: 'date' },
            { key: 'paymentMode', label: 'Payment Mode', type: 'badge' },
            { key: 'amount', label: 'Amount (₹)', type: 'currency', sortable: true },
            { key: 'status', label: 'Audit Status', type: 'badge' }
          ],
          rows: [
            { orderNo: 'ORD-101', outlet: 'Grand Palace Restaurant', guestName: 'Table 4 • Walk-in', time: '2026-08-04 12:15:00', paymentMode: 'UPI App', amount: 3200, status: 'SETTLED' },
            { orderNo: 'ORD-102', outlet: 'Sky Lounge & Bar', guestName: 'Table 12 • Room 304', time: '2026-08-04 12:45:00', paymentMode: 'ROOM POSTING', amount: 5400, status: 'SETTLED' },
            { orderNo: 'ORD-103', outlet: 'Poolside Cafe', guestName: 'Table 2 • Walk-in', time: '2026-08-04 13:10:00', paymentMode: 'CASH', amount: 1800, status: 'SETTLED' }
          ],
          summaryRow: { orderNo: 'TOTAL', guestName: '3 Orders Reconciled', amount: 10400 }
        };

      case 'pos-fast-moving-items':
      case 'pos-top-items':
        return {
          reportId,
          title: 'Fast-Moving Menu Items & Sales Matrix',
          category: 'POS & Dining',
          subtitle: 'Top-selling dishes & drinks, portion volume, category contribution, and item popularity.',
          kpis: [
            { label: 'Top Item (Volume)', value: 'Paneer Tikka', icon: 'star', subtext: '142 Portions Sold' },
            { label: 'Total Item Revenue', value: '₹1,45,800', icon: 'payments', subtext: 'All Categories' },
            { label: 'Food vs Beverage', value: '68% / 32%', icon: 'pie_chart', subtext: 'Sales Ratio' },
            { label: 'Avg Item Price', value: '₹320', icon: 'price_check', subtext: 'Menu Average' }
          ],
          chartData: {
            labels: ['Paneer Tikka', 'Dal Makhani', 'Chicken Biryani', 'Mojito Cocktail', 'Cold Coffee'],
            datasets: [
              { label: 'Quantity Sold', data: [142, 118, 96, 74, 62], color: '#D97706' }
            ]
          },
          columns: [
            { key: 'rank', label: '# Rank', sortable: true },
            { key: 'itemName', label: 'Item Name', sortable: true },
            { key: 'category', label: 'Category', type: 'badge' },
            { key: 'unitPrice', label: 'Unit Price (₹)', type: 'currency' },
            { key: 'qtySold', label: 'Qty Sold', sortable: true },
            { key: 'totalSales', label: 'Total Sales (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { rank: 1, itemName: 'Paneer Tikka Special', category: 'STARTERS', unitPrice: 320, qtySold: 142, totalSales: 45440 },
            { rank: 2, itemName: 'Dal Makhani & Naan Combo', category: 'MAIN COURSE', unitPrice: 280, qtySold: 118, totalSales: 33040 },
            { rank: 3, itemName: 'Hyderabadi Chicken Biryani', category: 'MAIN COURSE', unitPrice: 380, qtySold: 96, totalSales: 36480 },
            { rank: 4, itemName: 'Mint Mojito Cocktail', category: 'BEVERAGE', unitPrice: 250, qtySold: 74, totalSales: 18500 },
            { rank: 5, itemName: 'Iced Cold Coffee with Ice Cream', category: 'BEVERAGE', unitPrice: 200, qtySold: 62, totalSales: 12340 }
          ],
          summaryRow: { rank: '#', itemName: 'TOP 5 ITEMS TOTAL', qtySold: 492, totalSales: 145800 }
        };

      case 'hk-room-status-audit':
        return {
          reportId,
          title: 'Housekeeping Operations & Active Activity Audit',
          category: 'Housekeeping',
          subtitle: 'Active room task assignments, assigned housekeepers, maintenance repair requests, and lost & found item logs.',
          kpis: [
            { label: 'Active Tasks Logged', value: '2 Tasks', icon: 'assignment', subtext: 'Stayover & Checkout Clean' },
            { label: 'Assigned Housekeepers', value: '1 Staff On-Duty', icon: 'badge', subtext: 'Arshad Pappu' },
            { label: 'Maintenance Issues', value: '2 Requests', icon: 'construction', subtext: 'AC & Fan Repairs' },
            { label: 'Lost & Found Items', value: '2 Items Logged', icon: 'find_in_page', subtext: 'Watch & Gold Chain' }
          ],
          chartData: {
            labels: ['Stayover Clean', 'Checkout Clean', 'AC Repair (HVAC)', 'Fan Repair (HVAC)', 'Lost Watch', 'Lost Gold Chain'],
            datasets: [
              { label: 'Active Logs', data: [1, 1, 1, 1, 1, 1], color: '#0F3D3E' }
            ]
          },
          categoryMix: [
            { category: 'Cleaning Tasks', sales: 2, qty: 2, pct: 34, color: '#10B981' },
            { category: 'Maintenance Repairs', sales: 2, qty: 2, pct: 33, color: '#F59E0B' },
            { category: 'Lost & Found Logs', sales: 2, qty: 2, pct: 33, color: '#0284C7' }
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
          rows: [
            {
              roomNumber: '101',
              roomType: 'semi Luxury',
              hkStatus: 'Occupied Clean',
              attendant: 'Arshad Pappu',
              tasks: 'Stayover clean, Checkout clean',
              maintenance: 'AC (Completed), Fan (Open)',
              lostFound: 'watch [CLAIMED], Gold chain [STORED]'
            }
          ],
          summaryRow: {
            roomNumber: 'ACTIVE SUMMARY',
            roomType: '1 Active Room Recorded',
            hkStatus: 'Occupied Clean',
            attendant: 'Arshad Pappu',
            tasks: '2 Active Tasks',
            maintenance: '2 Issues (1 Open, 1 Completed)',
            lostFound: '2 Registered Items'
          },
          abbreviationGuide: [
            { term: 'STAYOVER CLEAN', fullForm: 'Daily Guest Room Cleaning', description: 'Occupied room linen refresh and bathroom restocking' },
            { term: 'CHECKOUT CLEAN', fullForm: 'Departure Room Turnaround', description: 'Deep departure cleaning and sanitization post checkout' },
            { term: 'CLAIMED', fullForm: 'Returned to Guest', description: 'Lost & found item handed over to verified guest' },
            { term: 'STORED', fullForm: 'Secured in Locker', description: 'Item stored safely in designated housekeeping locker' }
          ]
        };

      case 'hk-amenity-linen':
        return {
          reportId,
          title: 'Linen & Room Amenity Consumption Audit',
          category: 'Housekeeping',
          subtitle: 'Daily room amenity consumption, bath linens issued, attendant turnaround times, and stock level alerts.',
          kpis: [
            { label: 'Towels & Linens Issued', value: '320 Pcs', icon: 'hotel', subtext: 'Daily Issue Volume' },
            { label: 'Toiletries Kits Used', value: '185 Kits', icon: 'clean_hands', subtext: 'Guest Replenishments' },
            { label: 'Linen Turnaround Time', value: '2.8 Hours', icon: 'timer', subtext: 'Wash & Laundry Cycle' },
            { label: 'Amenity Stock Health', value: '98.5%', change: 'Healthy', changeType: 'positive', icon: 'inventory', subtext: 'In Stock Level' }
          ],
          chartData: {
            labels: ['Bath Towels', 'Hand Towels', 'Bed Sheets', 'Shampoo 50ml', 'Dental Kits', 'Bathrobes'],
            datasets: [
              { label: 'Issued Today (Pcs)', data: [140, 95, 85, 185, 120, 45], color: '#0284C7' }
            ]
          },
          categoryMix: [
            { category: 'Bath Linens', sales: 235, qty: 235, pct: 40, color: '#0284C7' },
            { category: 'Bed Linens', sales: 145, qty: 145, pct: 25, color: '#38BDF8' },
            { category: 'Bath Toiletries', sales: 305, qty: 305, pct: 25, color: '#0EA5E9' },
            { category: 'Guest Refreshments', sales: 120, qty: 120, pct: 10, color: '#7DD3FC' }
          ],
          columns: [
            { key: 'itemCode', label: 'Item SKU Code', sortable: true },
            { key: 'itemName', label: 'Amenity / Linen Item Name', sortable: true },
            { key: 'category', label: 'Category', type: 'badge' },
            { key: 'openingStock', label: 'Opening Stock', sortable: true },
            { key: 'issuedQty', label: 'Issued Qty', sortable: true },
            { key: 'returnedQty', label: 'Damaged / Returned' },
            { key: 'closingStock', label: 'Closing Stock', sortable: true },
            { key: 'stockStatus', label: 'Stock Status', type: 'badge' }
          ],
          rows: [
            { itemCode: 'HK-LIN-001', itemName: 'Luxury Bath Towel (White 600GSM)', category: 'BATH LINEN', openingStock: 450, issuedQty: 140, returnedQty: 2, closingStock: 308, stockStatus: 'IN STOCK' },
            { itemCode: 'HK-LIN-002', itemName: 'Hand Towels Premium Cotton', category: 'BATH LINEN', openingStock: 320, issuedQty: 95, returnedQty: 0, closingStock: 225, stockStatus: 'IN STOCK' },
            { itemCode: 'HK-BED-010', itemName: 'King Size Fitted Bed Sheet 300TC', category: 'BED LINEN', openingStock: 200, issuedQty: 85, returnedQty: 1, closingStock: 114, stockStatus: 'IN STOCK' },
            { itemCode: 'HK-BATH-005', itemName: 'Herbal Shampoo Bottle (50ml)', category: 'TOILETRY', openingStock: 600, issuedQty: 185, returnedQty: 0, closingStock: 415, stockStatus: 'IN STOCK' },
            { itemCode: 'HK-BATH-008', itemName: 'Eco Dental Hygiene Kit', category: 'TOILETRY', openingStock: 150, issuedQty: 120, returnedQty: 0, closingStock: 30, stockStatus: 'REORDER LOW' },
            { itemCode: 'HK-LIN-004', itemName: 'Plush Velvet Bathrobe (L/XL)', category: 'BATH LINEN', openingStock: 90, issuedQty: 45, returnedQty: 0, closingStock: 45, stockStatus: 'IN STOCK' }
          ],
          summaryRow: { itemCode: 'TOTAL', itemName: 'TOTAL AMENITIES & LINEN AUDIT', openingStock: 1810, issuedQty: 670, returnedQty: 3, closingStock: 1137 },
          abbreviationGuide: [
            { term: 'BATH LINEN', fullForm: 'Bath Towels, Hand Towels, Bath Mats', description: 'Heavy cotton terry towels washed daily' },
            { term: 'BED LINEN', fullForm: 'Sheets, Duvets, Pillowcases', description: 'High thread count bed items' },
            { term: 'TOILETRY', fullForm: 'Soaps, Shampoos, Dental Kits, Comb Kits', description: 'Single-use sealed guest bathroom amenities' },
            { term: 'REORDER LOW', fullForm: 'Below Minimum Reorder Threshold', description: 'Automated notification sent to Purchase Dept' }
          ]
        };

      case 'laundry-guest-ledger':
        return {
          reportId,
          title: 'Guest Laundry Billing & Orders Ledger',
          category: 'Laundry',
          subtitle: 'Room-wise guest laundry service charges, service category breakdown, and delivery audit.',
          kpis: [
            { label: 'Total Laundry Revenue', value: '₹9,275', icon: 'local_laundry_service', subtext: 'Guest Orders Billing' },
            { label: 'Completed Orders', value: '6 Orders', icon: 'task_alt', subtext: '100% Delivered' },
            { label: 'Active Service Categories', value: '4 Categories', icon: 'category', subtext: 'Wash, Press, Dry Clean, Express' },
            { label: 'Price Master Catalog', value: '3 Items / 12 Rates', icon: 'sell', subtext: 'Configured Rate Matrix' }
          ],
          chartData: {
            labels: ['Wash & Fold', 'Wash & Press', 'Dry Clean', 'Express Surcharge'],
            datasets: [
              { label: 'Service Volume', data: [6, 6, 3, 3], color: '#7C3AED', colors: ['#38BDF8', '#10B981', '#7C3AED', '#F59E0B'] }
            ]
          },
          categoryMix: [
            { category: 'Dry Clean', sales: 4173, qty: 3, pct: 45, color: '#7C3AED' },
            { category: 'Wash & Press', sales: 2782, qty: 6, pct: 30, color: '#10B981' },
            { category: 'Wash & Fold', sales: 1391, qty: 6, pct: 15, color: '#38BDF8' },
            { category: 'Express Surcharge', sales: 929, qty: 3, pct: 10, color: '#F59E0B' }
          ],
          columns: [
            { key: 'orderNo', label: 'Order ID', sortable: true },
            { key: 'roomGuest', label: 'Room & Guest Details' },
            { key: 'services', label: 'Service Types', type: 'badge' },
            { key: 'totalAmount', label: 'Total Amount (₹)', type: 'currency', sortable: true },
            { key: 'deliveryTime', label: 'Expected Delivery' },
            { key: 'status', label: 'Status', type: 'badge' }
          ],
          rows: [
            { orderNo: 'LND-1001', roomGuest: 'Room 101 • semi Luxury', itemCount: 6, services: 'Wash & Fold, Wash & Press, Dry Clean', totalAmount: 1420.25, deliveryTime: '2026-07-29 14:00', status: 'DELIVERED' },
            { orderNo: 'LND-1002', roomGuest: 'Room 101 • semi Luxury', itemCount: 10, services: 'Wash & Fold, Wash & Press', totalAmount: 974.68, deliveryTime: '2026-07-29 12:30', status: 'DELIVERED' },
            { orderNo: 'LND-1003', roomGuest: 'Room 101 • semi Luxury', itemCount: 1, services: 'Wash & Fold, Wash & Press', totalAmount: 97.47, deliveryTime: '2026-07-30 12:00', status: 'DELIVERED' },
            { orderNo: 'LND-1004', roomGuest: 'Room 101 • semi Luxury', itemCount: 1, services: 'Wash & Fold, Wash & Press', totalAmount: 97.47, deliveryTime: '2026-07-30 12:00', status: 'DELIVERED' },
            { orderNo: 'LND-1005', roomGuest: 'Room 102 • Delux', itemCount: 10, services: 'Wash & Fold, Wash & Press, Dry Clean', totalAmount: 2367.08, deliveryTime: '2026-07-31 00:30', status: 'DELIVERED' },
            { orderNo: 'LND-1006', roomGuest: 'Room 102 • Delux', itemCount: 20, services: 'Wash & Fold, Wash & Press, Dry Clean', totalAmount: 5987.32, deliveryTime: '2026-08-02 12:00', status: 'DELIVERED' }
          ],
          summaryRow: { orderNo: 'TOTAL', roomGuest: '6 Orders Processed', itemCount: 48, services: 'LAUNDRY BILLING', totalAmount: 10944.27, deliveryTime: '-', status: 'AUDITED' },
          abbreviationGuide: [
            { term: 'DELIVERED', fullForm: 'Order Delivered', description: 'Garment wash, press, or dry cleaning completed & returned to room' },
            { term: 'WASH & PRESS', fullForm: 'Wash & Press Service', description: 'Machine wash with steam press finish' },
            { term: 'DRY CLEAN', fullForm: 'Dry Cleaning Service', description: 'Solvent dry cleaning care for delicate garments' },
            { term: 'ROOM ACCOUNT', fullForm: 'Folio Posting', description: 'Laundry charges posted directly to guest room folio' }
          ]
        };

      case 'inv-stock-valuation':
        return {
          reportId,
          title: 'Stock Valuation & Low Stock Alerts Summary',
          category: 'Purchase & Inventory',
          subtitle: 'Current store inventory closing stock valuation, category distribution, and low stock warnings.',
          kpis: [
            { label: 'Total Store Stock Value', value: '₹12,45,000', icon: 'inventory_2', subtext: 'Current Valuation' },
            { label: 'Total Stock Items', value: '420 SKUs', icon: 'category', subtext: 'Active Inventory' },
            { label: 'Low-Stock Alerts', value: '6 Alerts', change: 'Reorder Now', changeType: 'negative', icon: 'warning', subtext: 'Below Safety Stock' },
            { label: 'Monthly Consumption', value: '₹4,20,000', icon: 'trending_up', subtext: 'Store Burn Rate' }
          ],
          chartData: {
            labels: ['Food Ingredients', 'Beverages & Spirits', 'Guest Toiletries', 'Cleaning Supplies', 'Linen Inventory'],
            datasets: [
              { label: 'Stock Valuation (₹)', data: [450000, 320000, 180000, 145000, 150000], color: '#DC2626' }
            ]
          },
          columns: [
            { key: 'itemCode', label: 'Item SKU Code', sortable: true },
            { key: 'itemName', label: 'Item Name & Description', sortable: true },
            { key: 'category', label: 'Category', type: 'badge' },
            { key: 'currentStock', label: 'In-Stock Qty', sortable: true },
            { key: 'minReorder', label: 'Safety Level' },
            { key: 'unitPrice', label: 'Unit Price (₹)', type: 'currency' },
            { key: 'totalVal', label: 'Total Value (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { itemCode: 'INV-F-001', itemName: 'Basmati Rice Premium (25kg Bag)', category: 'FOOD', currentStock: 14, minReorder: 10, unitPrice: 2800, totalVal: 39200 },
            { itemCode: 'INV-F-002', itemName: 'Amul Butter Cooking (500g)', category: 'FOOD', currentStock: 4, minReorder: 15, unitPrice: 275, totalVal: 1100 },
            { itemCode: 'INV-B-010', itemName: 'Single Malt Whisky 12Y (750ml)', category: 'BEVERAGE', currentStock: 18, minReorder: 5, unitPrice: 4200, totalVal: 75600 },
            { itemCode: 'INV-T-004', itemName: 'Luxury Bath Towels 600GSM', category: 'LINEN', currentStock: 45, minReorder: 50, unitPrice: 650, totalVal: 29250 }
          ],
          summaryRow: { itemCode: 'TOTAL', itemName: 'Store Inventory Valuation', totalVal: 1245000 }
        };

      default:
        // Generic Fallback Report Generator
        return {
          reportId,
          title: item.title,
          category: item.categoryLabel,
          subtitle: item.description,
          kpis: [
            { label: 'Audit Entries', value: '42 Records', icon: 'analytics', subtext: 'Current Operational Window' },
            { label: 'Financial Volume', value: '₹1,85,000', icon: 'payments', subtext: 'Total Value' },
            { label: 'Reconciliation Status', value: '98.5%', change: 'Normal', changeType: 'positive', icon: 'check_circle', subtext: 'Audit Reconciled' }
          ],
          chartData: {
            labels: ['06 AM', '09 AM', '12 PM', '03 PM', '06 PM', '09 PM'],
            datasets: [
              { label: 'Activity Value', data: [15, 45, 80, 65, 90, 40], color: '#0F3D3E' }
            ]
          },
          columns: [
            { key: 'id', label: 'Reference ID', sortable: true },
            { key: 'time', label: 'Time Stamp', type: 'date' },
            { key: 'description', label: 'Operational Event', sortable: true },
            { key: 'val', label: 'Amount (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { id: 'ADM-101', time: '31/07/2026 09:30 AM', description: 'Department operational audit entry', val: 24500 },
            { id: 'ADM-102', time: '31/07/2026 11:15 AM', description: 'System log reconciliation check', val: 18200 },
            { id: 'ADM-103', time: '31/07/2026 01:45 PM', description: 'Department shift summary close', val: 35000 }
          ],
          summaryRow: { id: 'TOTAL', description: 'Department Summary Total', val: 77700 }
        };
    }
  }
}
