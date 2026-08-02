import { Injectable, signal, computed } from '@angular/core';

export interface ReportItem {
  id: string;
  title: string;
  category: 'occupancy' | 'guest_ops' | 'room_inventory' | 'desk_finance';
  categoryLabel: string;
  description: string;
  icon: string;
  gradientBg: string;
  iconColor: string;
  liveMetric: string;
  liveMetricSubtext: string;
  sparklineData: number[]; // mini graph data points
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

  // Dedicated Front Office Reports Suite
  reportsList = signal<ReportItem[]>([
    // 1. Occupancy & Demand Analytics
    {
      id: 'occupancy-summary',
      title: 'Occupancy Summary & Yield Matrix',
      category: 'occupancy',
      categoryLabel: 'Occupancy & Demand',
      description: 'Real-time room occupancy, vacant clean/dirty status, out-of-order count, and RevPAR yield by room type.',
      icon: 'donut_small',
      gradientBg: 'linear-gradient(135deg, #0F3D3E 0%, #1A5C5E 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '86.4% Occupied',
      liveMetricSubtext: '108 of 125 Active Rooms',
      sparklineData: [65, 72, 78, 85, 88, 94, 86.4],
      isNew: true
    },
    {
      id: 'occupancy-forecast',
      title: '30-Day Occupancy Forecast',
      category: 'occupancy',
      categoryLabel: 'Occupancy & Demand',
      description: 'Forward-looking 30-day room demand projections, expected booking pickup, and yield optimization triggers.',
      icon: 'trending_up',
      gradientBg: 'linear-gradient(135deg, #2A9D8F 0%, #38B000 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '92.0% Projected',
      liveMetricSubtext: 'Next Weekend Surge',
      sparklineData: [78, 82, 85, 89, 92, 95, 92],
      isNew: true
    },
    {
      id: 'occupancy-room-category',
      title: 'Occupancy & ADR by Room Category',
      category: 'occupancy',
      categoryLabel: 'Occupancy & Demand',
      description: 'Performance matrix comparing Deluxe, Executive, Suite, and Penthouse sales, ADR, and RevPAR.',
      icon: 'bar_chart',
      gradientBg: 'linear-gradient(135deg, #C08261 0%, #E29578 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹3,560 ADR',
      liveMetricSubtext: 'RevPAR: ₹3,076',
      sparklineData: [3200, 3350, 3400, 3480, 3520, 3600, 3560]
    },
    {
      id: 'day-use-report',
      title: 'Day-Use & Transit Stay Analytics',
      category: 'occupancy',
      categoryLabel: 'Occupancy & Demand',
      description: 'Hourly transit stays checked in and out on the same operational day with quick turnaround metrics.',
      icon: 'wb_sunny',
      gradientBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '8 Day-Stays',
      liveMetricSubtext: '₹24,000 Revenue Added',
      sparklineData: [4, 5, 6, 4, 7, 9, 8],
      isNew: true
    },

    // 2. Guest Arrival, Departure & In-House Operations
    {
      id: 'arrivals-manifest',
      title: 'Expected Arrivals & VIP Manifest',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Real-time arrival schedule today with flight arrival times, VIP tags, pick-up service, and room assignment.',
      icon: 'flight_land',
      gradientBg: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '24 Arrivals Today',
      liveMetricSubtext: '18 Checked-in (75%)',
      sparklineData: [12, 16, 20, 22, 25, 28, 24]
    },
    {
      id: 'due-out-overstay',
      title: 'Due Out & Overstay Risk Ledger',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Guests scheduled to depart today, folio balance clearance status, and flagged overstay alerts.',
      icon: 'flight_takeoff',
      gradientBg: 'linear-gradient(135deg, #E63946 0%, #D62828 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '19 Departures',
      liveMetricSubtext: '14 Completed (5 Pending)',
      sparklineData: [15, 18, 22, 20, 19, 21, 19]
    },
    {
      id: 'in-house-guest-list',
      title: 'In-House Guest Master Ledger',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Complete directory of current in-house guests, nationality, reservation ref, room number, and rate code.',
      icon: 'people',
      gradientBg: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '142 In-House Guests',
      liveMetricSubtext: '108 Rooms Occupied',
      sparklineData: [110, 120, 132, 138, 145, 148, 142]
    },
    {
      id: 'no-show-cancellation',
      title: 'No-Show & Cancellation Penalty Audit',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Missed check-ins, cancelled bookings, retention policy penalty fees, and released inventory log.',
      icon: 'person_off',
      gradientBg: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '2 No-Shows Today',
      liveMetricSubtext: '₹7,200 Retention Billed',
      sparklineData: [1, 3, 0, 2, 1, 4, 2]
    },
    {
      id: 'early-checkin-late-checkout',
      title: 'Early Check-In / Late Checkout Log',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Tracking early room key access or extended departure requests with automated fee posting.',
      icon: 'schedule',
      gradientBg: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '6 Extensions Billed',
      liveMetricSubtext: '₹9,500 Surcharges',
      sparklineData: [3, 4, 5, 2, 8, 7, 6],
      isNew: true
    },
    {
      id: 'guest-360-profile',
      title: '360° Guest Profile & Lifetime Value',
      category: 'guest_ops',
      categoryLabel: 'Guest Operations',
      description: 'Historical stay frequency, direct booking yield, preference notes, and total lifetime spend per guest.',
      icon: 'face',
      gradientBg: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '42% Repeat Guests',
      liveMetricSubtext: 'High Direct Loyalty',
      sparklineData: [35, 38, 40, 41, 44, 43, 42]
    },

    // 3. Room Inventory & Status Analytics
    {
      id: 'room-status-matrix',
      title: 'Room Status & Housekeeping Sync',
      category: 'room_inventory',
      categoryLabel: 'Room Inventory',
      description: 'Real-time interactive matrix of room states (Vacant Clean, Vacant Dirty, Inspected, Occupied, OOO).',
      icon: 'meeting_room',
      gradientBg: 'linear-gradient(135deg, #0F3D3E 0%, #2A9D8F 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '10 Vacant Clean',
      liveMetricSubtext: '3 Vacant Dirty Ready',
      sparklineData: [15, 12, 8, 14, 9, 11, 10],
      isNew: true
    },
    {
      id: 'blocked-ooo-audit',
      title: 'Blocked & Out-of-Order (OOO) Audit',
      category: 'room_inventory',
      categoryLabel: 'Room Inventory',
      description: 'Rooms blocked for AC maintenance, plumbing work, deep cleaning, or VIP executive reserves.',
      icon: 'block',
      gradientBg: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '4 Rooms Blocked',
      liveMetricSubtext: 'Estimated Ready: 18:00',
      sparklineData: [6, 5, 4, 3, 5, 4, 4]
    },
    {
      id: 'room-shift-audit',
      title: 'Room Shift & Mid-Stay Swap Log',
      category: 'room_inventory',
      categoryLabel: 'Room Inventory',
      description: 'Audit log of guest room changes, upgrade reasons, housekeeping movement, and rate differential.',
      icon: 'published_with_changes',
      gradientBg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '3 Shifts Today',
      liveMetricSubtext: '1 Complimentary Upgrade',
      sparklineData: [1, 2, 4, 1, 3, 2, 3],
      isNew: true
    },

    // 4. Front Desk Financials & Collections
    {
      id: 'fo-cashier-collection',
      title: 'Front Office Cashier Collection',
      category: 'desk_finance',
      categoryLabel: 'Front Desk Finance',
      description: 'Real-time collection audit by shift and payment mode (Credit Card, Cash, UPI, Bank Wire, City Ledger).',
      icon: 'point_of_sale',
      gradientBg: 'linear-gradient(135deg, #1E3A8A 0%, #6D28D9 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹3,84,500 Collected',
      liveMetricSubtext: '52% Credit Card | 28% Cash',
      sparklineData: [280000, 310000, 340000, 365000, 390000, 375000, 384500],
      isNew: true
    },
    {
      id: 'folio-current-dues',
      title: 'Guest Folio High Balance & Dues',
      category: 'desk_finance',
      categoryLabel: 'Front Desk Finance',
      description: 'Active in-house room folios approaching or exceeding authorized credit limits.',
      icon: 'account_balance_wallet',
      gradientBg: 'linear-gradient(135deg, #E63946 0%, #B91C1C 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹48,200 High Balance',
      liveMetricSubtext: '3 Folios Exceeding Limit',
      sparklineData: [65000, 52000, 48000, 55000, 42000, 50000, 48200],
      isNew: true
    },
    {
      id: 'incidental-extra-charges',
      title: 'Incidental & Extra Charges Summary',
      category: 'desk_finance',
      categoryLabel: 'Front Desk Finance',
      description: 'Non-room posting log (Extra Bed, Spa, Transport, Mini-Bar, Late Check-out fees).',
      icon: 'add_card',
      gradientBg: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
      iconColor: '#FFFFFF',
      liveMetric: '₹32,400 Extras Billed',
      liveMetricSubtext: '42 Incidental Items Posted',
      sparklineData: [18000, 22000, 26000, 29000, 31000, 34000, 32400]
    },
    {
      id: 'night-audit-trial-balance',
      title: 'Night Audit Trial Balance & Closing',
      category: 'desk_finance',
      categoryLabel: 'Front Desk Finance',
      description: 'Daily trial balance statement, room revenue postings, tax accruals, and shift closure audit.',
      icon: 'bedtime',
      gradientBg: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
      iconColor: '#FFFFFF',
      liveMetric: 'Balanced & Closed',
      liveMetricSubtext: 'System Audit Passed',
      sparklineData: [100, 100, 100, 100, 100, 100, 100]
    }
  ]);

  // Favourites Signals & Helpers
  favouriteReportIds = computed(() => this.favouritesSignal());

  favouriteReports = computed(() => {
    const ids = new Set(this.favouritesSignal());
    return this.reportsList().filter(r => ids.has(r.id));
  });

  private loadFavourites(): string[] {
    const saved = localStorage.getItem('hms_favourite_fo_reports');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback defaults
      }
    }
    return [
      'occupancy-summary',
      'arrivals-manifest',
      'fo-cashier-collection',
      'room-status-matrix',
      'due-out-overstay',
      'folio-current-dues'
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
    localStorage.setItem('hms_favourite_fo_reports', JSON.stringify(current));
  }

  isFavourite(reportId: string): boolean {
    return this.favouritesSignal().includes(reportId);
  }

  getReportById(reportId: string): ReportItem | undefined {
    return this.reportsList().find(r => r.id === reportId);
  }

  // Dynamic Front Office Dataset Generator for Analytical Viewer
  getAnalyticalReportData(reportId: string): AnalyticalReportData {
    const item: ReportItem = this.getReportById(reportId) || {
      id: reportId,
      title: 'Front Office Report',
      category: 'occupancy',
      categoryLabel: 'Front Office',
      description: 'Front Office performance statement.',
      icon: 'assessment',
      gradientBg: 'linear-gradient(135deg, #0F3D3E 0%, #1A5C5E 100%)',
      iconColor: '#FFFFFF',
      liveMetric: 'Active Status',
      liveMetricSubtext: 'Front Office Operations',
      sparklineData: [10, 20, 30, 40, 50]
    };

    switch (reportId) {
      case 'occupancy-summary':
        return {
          reportId,
          title: 'Occupancy Summary & Room Category Yield',
          category: 'Front Office Analytics',
          subtitle: 'Real-time room occupancy, vacant clean/dirty status, out-of-order count, and RevPAR yield.',
          kpis: [
            { label: 'Total Active Capacity', value: '125 Rooms', icon: 'domain', subtext: 'Hotel Inventory' },
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
            { key: 'roomCategory', label: 'Room Category / Type', sortable: true },
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

      case 'arrivals-manifest':
        return {
          reportId,
          title: 'Expected Arrivals & VIP Manifest Today',
          category: 'Guest Operations',
          subtitle: 'Real-time arrival schedule today with flight arrival times, VIP status, pick-up service, and room status.',
          kpis: [
            { label: 'Expected Arrivals Today', value: '24 Guests', icon: 'flight_land', subtext: 'Scheduled Check-Ins' },
            { label: 'Checked In So Far', value: '18 Guests', change: '75.0%', changeType: 'positive', icon: 'check_circle', subtext: '6 Remaining' },
            { label: 'VIP Guest Arrivals', value: '5 VIPs', icon: 'star', subtext: 'Welcome Amenities Ready' },
            { label: 'Pre-Assigned Rooms', value: '22 Rooms', icon: 'key', subtext: '2 Rooms Pending Keys' }
          ],
          chartData: {
            labels: ['08 AM - 11 AM', '11 AM - 02 PM', '02 PM - 05 PM', '05 PM - 08 PM', '08 PM - 11 PM'],
            datasets: [
              { label: 'Arrivals Count', data: [3, 9, 7, 3, 2], color: '#1E3A8A' }
            ]
          },
          columns: [
            { key: 'resRef', label: 'Res. Ref', sortable: true },
            { key: 'guestName', label: 'Guest Name & Title', sortable: true },
            { key: 'vipTag', label: 'VIP Status', type: 'badge' },
            { key: 'roomType', label: 'Assigned Room / Type' },
            { key: 'eta', label: 'ETA Flight/Time' },
            { key: 'pax', label: 'Pax (Adults/Kids)' },
            { key: 'ratePlan', label: 'Rate Code' },
            { key: 'status', label: 'Check-In Status', type: 'badge' }
          ],
          rows: [
            { resRef: 'RES-9041', guestName: 'Mr. Vikramaditya Birla', vipTag: 'VIP Platinum', roomType: 'Suite 501', eta: 'AI-402 (11:30 AM)', pax: '2 A / 0 C', ratePlan: 'CORP-EP', status: 'CHECKED IN' },
            { resRef: 'RES-9042', guestName: 'Ms. Sarah Connor', vipTag: 'Regular', roomType: 'Room 304', eta: '12:00 PM', pax: '1 A / 0 C', ratePlan: 'BAR-CP', status: 'CHECKED IN' },
            { resRef: 'RES-9043', guestName: 'Dr. Ananya Roy', vipTag: 'VIP Gold', roomType: 'Room 412', eta: '02:30 PM', pax: '2 A / 1 C', ratePlan: 'DIRECT-MAP', status: 'PENDING' },
            { resRef: 'RES-9044', guestName: 'Infosys Corp Group (10 Pax)', vipTag: 'Corporate', roomType: 'Floor 3 Block', eta: '03:15 PM', pax: '10 A / 0 C', ratePlan: 'CORP-SPECIAL', status: 'PENDING' },
            { resRef: 'RES-9045', guestName: 'Mr. David Miller', vipTag: 'Regular', roomType: 'Room 218', eta: '06:00 PM', pax: '1 A / 0 C', ratePlan: 'OTA-BOOKING', status: 'PENDING' }
          ],
          summaryRow: { resRef: 'TOTAL', guestName: '24 Expected Arrivals', pax: '32 Adults / 4 Kids' }
        };

      case 'fo-cashier-collection':
        return {
          reportId,
          title: 'Front Office Cashier Collection & Shift Settlement',
          category: 'Front Desk Finance',
          subtitle: 'Real-time collection audit by shift and payment mode (Credit Card, Cash, UPI, City Ledger).',
          kpis: [
            { label: 'Total Collections Today', value: '₹3,84,500', change: '+14.2%', changeType: 'positive', icon: 'payments', subtext: 'All Payment Modes' },
            { label: 'Credit & Debit Cards', value: '₹2,00,000', icon: 'credit_card', subtext: '52.0% Share' },
            { label: 'Cash Collections', value: '₹1,07,600', icon: 'money', subtext: '28.0% Share' },
            { label: 'UPI / Digital Payment', value: '₹57,675', icon: 'qr_code_scanner', subtext: '15.0% Share' }
          ],
          chartData: {
            labels: ['Credit Card', 'Cash', 'UPI App', 'City Ledger', 'Bank Transfer'],
            datasets: [
              { label: 'Collection Amount (₹)', data: [200000, 107600, 57675, 12000, 7225], color: '#6D28D9' }
            ]
          },
          columns: [
            { key: 'receiptNo', label: 'Receipt No.', sortable: true },
            { key: 'time', label: 'Time & Shift', type: 'date' },
            { key: 'guestRoom', label: 'Guest Name / Room' },
            { key: 'payMode', label: 'Payment Mode', type: 'badge' },
            { key: 'cashier', label: 'Front Desk Cashier' },
            { key: 'remarks', label: 'Folio / Settlement Note' },
            { key: 'amount', label: 'Amount (₹)', type: 'currency', sortable: true }
          ],
          rows: [
            { receiptNo: 'RCP-2026-0811', time: '09:15 AM (Morning Shift)', guestRoom: 'Rajesh Sharma (Room 302)', payMode: 'CREDIT CARD', cashier: 'Sunil Kumar', remarks: 'Check-out settlement folio #401', amount: 45000 },
            { receiptNo: 'RCP-2026-0812', time: '10:30 AM (Morning Shift)', guestRoom: 'Infosys Corp (Room 405)', payMode: 'CITY LEDGER', cashier: 'Sunil Kumar', remarks: 'Corporate Direct Billing', amount: 88000 },
            { receiptNo: 'RCP-2026-0813', time: '11:45 AM (Morning Shift)', guestRoom: 'Sarah Jenkins (Room 214)', payMode: 'UPI / GOOGLEPAY', cashier: 'Sunil Kumar', remarks: 'Advance deposit for stay', amount: 15000 },
            { receiptNo: 'RCP-2026-0814', time: '01:20 PM (Evening Shift)', guestRoom: 'Amitav Ghosh (Room 108)', payMode: 'CASH', cashier: 'Priya Sharma', remarks: 'Partial settlement & incidentals', amount: 28500 },
            { receiptNo: 'RCP-2026-0815', time: '03:10 PM (Evening Shift)', guestRoom: 'David Miller (Room 218)', payMode: 'CREDIT CARD', cashier: 'Priya Sharma', remarks: 'Folio settlement', amount: 34000 }
          ],
          summaryRow: { receiptNo: 'SHIFT TOTAL', guestRoom: 'Consolidated Cashier Audit', amount: 210500 }
        };

      default:
        // Generic Front Office Mock Generator for all other FO reports
        return {
          reportId,
          title: item.title,
          category: item.categoryLabel,
          subtitle: item.description,
          kpis: [
            { label: 'Active Audit Entries', value: '42 Records', icon: 'analytics', subtext: 'Today Operational Window' },
            { label: 'Processed Volume', value: '₹1,85,000', icon: 'payments', subtext: 'Financial Value' },
            { label: 'Cleared Status', value: '94.2%', change: 'High', changeType: 'positive', icon: 'check_circle', subtext: 'Audit Reconciled' },
            { label: 'Action Items', value: '3 Pending', icon: 'priority_high', subtext: 'Requires Manager Signature' }
          ],
          chartData: {
            labels: ['06 AM', '09 AM', '12 PM', '03 PM', '06 PM', '09 PM'],
            datasets: [
              { label: 'Activity Score', data: [15, 45, 80, 65, 90, 40], color: '#0F3D3E' }
            ]
          },
          columns: [
            { key: 'id', label: 'Reference ID', sortable: true },
            { key: 'time', label: 'Time Stamp', type: 'date' },
            { key: 'description', label: 'Operational Event Details', sortable: true },
            { key: 'category', label: 'FO Sub-Domain' },
            { key: 'val', label: 'Amount / Value', type: 'currency', sortable: true },
            { key: 'status', label: 'Audit Status', type: 'badge' }
          ],
          rows: [
            { id: 'FO-801', time: '31/07/2026 09:30 AM', description: 'Front desk system event reconciled', category: item.categoryLabel, val: 24500, status: 'VERIFIED' },
            { id: 'FO-802', time: '31/07/2026 11:15 AM', description: 'Room allocation and key audit check', category: item.categoryLabel, val: 18200, status: 'VERIFIED' },
            { id: 'FO-803', time: '31/07/2026 01:45 PM', description: 'Mid-shift cash drawer balance log', category: item.categoryLabel, val: 35000, status: 'VERIFIED' },
            { id: 'FO-804', time: '31/07/2026 04:10 PM', description: 'Incidental charges verification', category: item.categoryLabel, val: 12500, status: 'PENDING' }
          ],
          summaryRow: { id: 'TOTAL', description: 'Operational Summary Total', val: 90200 }
        };
    }
  }
}
