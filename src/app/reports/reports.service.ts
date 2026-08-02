import { Injectable, signal, computed } from '@angular/core';

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
    datasets: { label: string; data: number[]; color: string }[];
  };
  columns: ReportTableColumn[];
  rows: any[];
  summaryRow?: Record<string, any>;
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
      id: 'pos-payment-split',
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
      id: 'pos-top-items',
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

  // Analytical Dataset Generator for Viewer
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
            { key: 'adr', label: 'ADR (₹)', type: 'currency' },
            { key: 'revpar', label: 'RevPAR (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { roomCategory: 'Deluxe Queen Room', totalRooms: 45, occupied: 41, vacantClean: 2, vacantDirty: 1, ooo: 1, occPercent: 91.1, adr: 3200, revpar: 2915 },
            { roomCategory: 'Executive King Room', totalRooms: 35, occupied: 31, vacantClean: 3, vacantDirty: 1, ooo: 0, occPercent: 88.6, adr: 4100, revpar: 3632 },
            { roomCategory: 'Superior Twin Room', totalRooms: 25, occupied: 20, vacantClean: 3, vacantDirty: 1, ooo: 1, occPercent: 80.0, adr: 2900, revpar: 2320 },
            { roomCategory: 'Luxury Ocean Suite', totalRooms: 12, occupied: 10, vacantClean: 1, vacantDirty: 0, ooo: 1, occPercent: 83.3, adr: 7500, revpar: 6247 },
            { roomCategory: 'Presidential Penthouse', totalRooms: 8, occupied: 6, vacantClean: 1, vacantDirty: 0, ooo: 1, occPercent: 75.0, adr: 14500, revpar: 10875 }
          ],
          summaryRow: { roomCategory: 'OVERALL HOTEL YIELD', totalRooms: 125, occupied: 108, vacantClean: 10, vacantDirty: 3, ooo: 4, occPercent: 86.4, adr: 3560, revpar: 3076 }
        };

      case 'fo-cashier-settlement':
        return {
          reportId,
          title: 'Front Desk Cashier Settlement Audit',
          category: 'Front Office',
          subtitle: 'Shift collections audit by Cash, Credit Card, UPI, and Folio settlements.',
          kpis: [
            { label: 'Total Collections Today', value: '₹3,84,500', change: '+14.2%', changeType: 'positive', icon: 'payments', subtext: 'All Payment Modes' },
            { label: 'Credit & Debit Cards', value: '₹2,00,000', icon: 'credit_card', subtext: '52.0% Share' },
            { label: 'Cash Collections', value: '₹1,07,600', icon: 'money', subtext: '28.0% Share' },
            { label: 'UPI / Digital Payment', value: '₹57,675', icon: 'qr_code_scanner', subtext: '15.0% Share' }
          ],
          chartData: {
            labels: ['Credit Card', 'Cash', 'UPI App', 'City Ledger', 'Bank Transfer'],
            datasets: [
              { label: 'Collection Amount (₹)', data: [200000, 107600, 57675, 12000, 7225], color: '#1E3A8A' }
            ]
          },
          columns: [
            { key: 'receiptNo', label: 'Receipt No.', sortable: true },
            { key: 'time', label: 'Time & Shift', type: 'date' },
            { key: 'guestRoom', label: 'Guest Name / Room' },
            { key: 'payMode', label: 'Payment Mode', type: 'badge' },
            { key: 'cashier', label: 'Front Desk Cashier' },
            { key: 'amount', label: 'Amount (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { receiptNo: 'RCP-801', time: '09:15 AM (Morning)', guestRoom: 'Rajesh Sharma (Room 302)', payMode: 'CREDIT CARD', cashier: 'Sunil Kumar', amount: 45000 },
            { receiptNo: 'RCP-802', time: '10:30 AM (Morning)', guestRoom: 'Infosys Corp (Room 405)', payMode: 'CITY LEDGER', cashier: 'Sunil Kumar', amount: 88000 },
            { receiptNo: 'RCP-803', time: '11:45 AM (Morning)', guestRoom: 'Sarah Jenkins (Room 214)', payMode: 'UPI', cashier: 'Sunil Kumar', amount: 15000 },
            { receiptNo: 'RCP-804', time: '01:20 PM (Evening)', guestRoom: 'Amitav Ghosh (Room 108)', payMode: 'CASH', cashier: 'Priya Sharma', amount: 28500 },
            { receiptNo: 'RCP-805', time: '03:10 PM (Evening)', guestRoom: 'David Miller (Room 218)', payMode: 'CREDIT CARD', cashier: 'Priya Sharma', amount: 34000 }
          ],
          summaryRow: { receiptNo: 'TOTAL', guestRoom: 'Shift Collections Total', amount: 210500 }
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

      case 'pos-top-items':
        return {
          reportId,
          title: 'Top-Selling Fast Moving Items Analysis',
          category: 'POS & Dining',
          subtitle: 'Best-selling dishes and drinks, quantity sold, category contribution, and item margins.',
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
          title: 'Room Cleanliness & Maintenance Audit',
          category: 'Housekeeping',
          subtitle: 'Real-time room cleanliness status (Clean, Dirty, Inspected, Out-of-Order).',
          kpis: [
            { label: 'Total Hotel Rooms', value: '125 Rooms', icon: 'domain', subtext: 'Inventory' },
            { label: 'Occupied Rooms', value: '108 Rooms', icon: 'king_bed', subtext: 'In-House Guests' },
            { label: 'Vacant Clean', value: '10 Rooms', icon: 'check_circle', subtext: 'Ready for Check-In' },
            { label: 'Out-of-Order (OOO)', value: '4 Rooms', icon: 'construction', subtext: 'Maintenance In Progress' }
          ],
          chartData: {
            labels: ['Occupied', 'Vacant Clean', 'Vacant Dirty', 'OOO Blocked'],
            datasets: [
              { label: 'Room Count', data: [108, 10, 3, 4], color: '#2A9D8F' }
            ]
          },
          columns: [
            { key: 'floor', label: 'Floor Block', sortable: true },
            { key: 'occupied', label: 'Occupied', sortable: true },
            { key: 'clean', label: 'Vacant Clean' },
            { key: 'dirty', label: 'Vacant Dirty' },
            { key: 'ooo', label: 'OOO Maintenance' },
            { key: 'attendant', label: 'Assigned Attendant' }
          ],
          rows: [
            { floor: 'Floor 1 (Rooms 101-125)', occupied: 22, clean: 2, dirty: 1, ooo: 0, attendant: 'Ramesh Kumar' },
            { floor: 'Floor 2 (Rooms 201-225)', occupied: 24, clean: 1, dirty: 0, ooo: 0, attendant: 'Sita Devi' },
            { floor: 'Floor 3 (Rooms 301-325)', occupied: 23, clean: 1, dirty: 1, ooo: 0, attendant: 'Vikram Singh' },
            { floor: 'Floor 4 (Rooms 401-425)', occupied: 21, clean: 3, dirty: 1, ooo: 0, attendant: 'Sunita Sharma' },
            { floor: 'Floor 5 (Rooms 501-525 Executive)', occupied: 18, clean: 3, dirty: 0, ooo: 4, attendant: 'Deepak Patel' }
          ],
          summaryRow: { floor: 'TOTAL HOTEL STATUS', occupied: 108, clean: 10, dirty: 3, ooo: 4 }
        };

      case 'laundry-guest-ledger':
        return {
          reportId,
          title: 'Guest Laundry Billing & Orders Ledger',
          category: 'Laundry',
          subtitle: 'Room-wise guest laundry service charges, dry cleaning revenue, and delivery log.',
          kpis: [
            { label: 'Laundry Revenue Today', value: '₹18,400', change: '+12.0%', changeType: 'positive', icon: 'local_laundry_service', subtext: 'Guest Billing' },
            { label: 'Completed Orders', value: '28 Orders', icon: 'task_alt', subtext: '100% On-Time' },
            { label: 'Express Pressing', value: '18 Garments', icon: 'dry_cleaning', subtext: '2-Hour Turnaround' },
            { label: 'Dry Cleaning', value: '₹8,200', icon: 'wash', subtext: 'Suit & Dress Care' }
          ],
          chartData: {
            labels: ['Morning (8-12)', 'Afternoon (12-4)', 'Evening (4-8)'],
            datasets: [
              { label: 'Orders Processed', data: [12, 11, 5], color: '#7C3AED' }
            ]
          },
          columns: [
            { key: 'orderNo', label: 'Order #', sortable: true },
            { key: 'roomGuest', label: 'Room & Guest Name' },
            { key: 'serviceType', label: 'Service Type', type: 'badge' },
            { key: 'itemCount', label: 'Garment Pcs', sortable: true },
            { key: 'status', label: 'Delivery Status', type: 'badge' },
            { key: 'amount', label: 'Amount (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { orderNo: 'LND-301', roomGuest: 'Room 501 • Vikramaditya Birla', serviceType: 'DRY CLEANING', itemCount: 4, status: 'DELIVERED', amount: 3200 },
            { orderNo: 'LND-302', roomGuest: 'Room 304 • Sarah Connor', serviceType: 'EXPRESS PRESSING', itemCount: 2, status: 'DELIVERED', amount: 950 },
            { orderNo: 'LND-303', roomGuest: 'Room 412 • Dr. Ananya Roy', serviceType: 'WASH & FOLD', itemCount: 8, status: 'DELIVERED', amount: 1400 },
            { orderNo: 'LND-304', roomGuest: 'Room 218 • David Miller', serviceType: 'DRY CLEANING', itemCount: 3, status: 'IN PROGRESS', amount: 2400 }
          ],
          summaryRow: { orderNo: 'TOTAL', roomGuest: '28 Orders Processed Today', amount: 18400 }
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
