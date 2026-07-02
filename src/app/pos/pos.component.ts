import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { HotelMastersService } from '../masters/hotel-masters.service';
import {
  OrderStatus,
  PosAuditLog,
  PosBill,
  PosDashboardData,
  PosMenuItem,
  PosOrder,
  PosOrderLine,
  PosOutlet,
  PosService,
  PosTab,
  PosTable,
  TableStatus
} from './pos.service';

type ModalKind = 'outlet' | 'menu' | 'order' | 'bill' | 'table';
type ModalMode = 'create' | 'edit';
type DiningAction = 'START' | 'ROOM' | 'BOOK' | 'MERGE' | 'RESET';
type DeleteTarget = { kind: 'outlet' | 'menu' | 'table'; id: number; title: string; message: string };
type BillingSetupSection = 'identity' | 'taxation' | 'offers';
type BillingSetup = {
  legalName: string;
  gstNumber: string;
  panNumber: string;
  invoicePrefix: string;
  placeOfSupply: string;
  defaultTaxProfile: string;
  enableInclusiveTax: boolean;
  enableRoomPosting: boolean;
  enableOfferStacking: boolean;
};
type TaxRule = { name: string; rate: number; appliesTo: string; code: string; active: boolean };
type OfferRule = { code: string; name: string; type: string; value: number; validFrom: string; validTo: string; active: boolean };
type BillLinePreview = PosOrderLine & { taxRate: number; taxableAmount: number; taxAmount: number; totalAmount: number };
type BillTaxBucket = { rate: number; taxableAmount: number; cgst: number; sgst: number; taxAmount: number };
type BillBreakdown = {
  order: PosOrder | null;
  lines: BillLinePreview[];
  grossAmount: number;
  discount: number;
  taxableSubtotal: number;
  taxTotal: number;
  total: number;
  paid: number;
  due: number;
  taxBuckets: BillTaxBucket[];
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, OnDestroy {
  readonly pos = inject(PosService);
  readonly masters = inject(HotelMastersService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  activeTab = signal<PosTab>('outlets');
  search = signal('');
  outletFilter = signal<number | 'ALL'>('ALL');
  statusFilter = signal<string>('ALL');
  modalKind = signal<ModalKind>('outlet');
  modalMode = signal<ModalMode>('create');
  isModalOpen = signal(false);

  currentOutlet = signal<Partial<PosOutlet>>({});
  currentMenuItem = signal<Partial<PosMenuItem>>({});
  currentOrder = signal<Partial<PosOrder>>({});
  currentBill = signal<Partial<PosBill>>({});
  selectedBillingOrder = signal<PosOrder | null>(null);
  currentTable = signal<Partial<PosTable>>({});
  selectedTable = signal<PosTable | null>(null);
  activeTableOrders = signal<PosOrder[]>([]);
  activeTableOrdersLoading = signal(false);
  activeTableOrdersError = signal('');
  tableOrderEditMode = signal(false);
  isTableOrderDetailOpen = signal(false);
  diningAction = signal<DiningAction | null>(null);
  isDiningActionOpen = signal(false);
  deleteTarget = signal<DeleteTarget | null>(null);
  diningForm = signal<{ server: string; covers: number; secondaryTableId: number | null; floorId: number | null; roomId: number | null; roomNo: string; guestName: string; bookingTime: string; notes: string }>({
    server: 'Arjun Menon',
    covers: 2,
    secondaryTableId: null,
    floorId: null,
    roomId: null,
    roomNo: '102',
    guestName: 'Rajan Mehta',
    bookingTime: 'Today, 08:00 PM',
    notes: ''
  });
  startOrderLines = signal<PosOrderLine[]>([]);
  billingSetupSection = signal<BillingSetupSection>('identity');
  billingSetupEditMode = signal<Record<BillingSetupSection, boolean>>({
    identity: false,
    taxation: false,
    offers: false
  });
  billingSetup = signal({
    legalName: 'HMS Cloud Hospitality Pvt. Ltd.',
    gstNumber: '27ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    invoicePrefix: 'POS',
    placeOfSupply: 'Maharashtra',
    defaultTaxProfile: 'GST 5%',
    enableInclusiveTax: true,
    enableRoomPosting: true,
    enableOfferStacking: false
  });
  taxRules = signal<TaxRule[]>([
    { name: 'Restaurant Food GST', rate: 5, appliesTo: 'Restaurant dine-in and takeaway food', code: 'GST_FOOD_5', active: true },
    { name: 'Bar Beverage GST', rate: 18, appliesTo: 'Alcoholic and premium beverage billing', code: 'GST_BEV_18', active: true },
    { name: 'Service Charge', rate: 10, appliesTo: 'Optional hotel service charge before GST', code: 'SVC_10', active: false }
  ]);
  offerRules = signal<OfferRule[]>([
    { code: 'WELCOME10', name: 'Welcome dining offer', type: 'Percentage', value: 10, validFrom: '2026-06-01', validTo: '2026-06-30', active: true },
    { code: 'ROOMDINING', name: 'Room dining credit', type: 'Flat', value: 500, validFrom: '2026-06-01', validTo: '2026-07-15', active: false }
  ]);

  readonly dashboardOutlets = computed(() => {
    const revenueMix = this.pos.posDashboard()?.revenueMix || [];
    if (revenueMix.length) {
      return revenueMix.map((row, index) => ({
        id: index + 1,
        name: row.outletName || `Outlet ${index + 1}`,
        type: 'Restaurant',
        location: '',
        timing: '',
        taxProfile: '',
        active: true,
        manager: ''
      }));
    }
    return this.sampleDashboardOutlets();
  });
  readonly dashboardMenuItems = computed(() => this.sampleDashboardMenuItems());
  readonly dashboardTables = computed(() => this.pos.tables());
  readonly dashboardOrders = computed(() => this.dashboardOrdersFromApi(this.pos.posDashboard()) || this.sampleDashboardOrders());
  readonly dashboardBills = computed(() => this.sampleDashboardBills());
  readonly dashboardAuditLogs = computed(() => this.dashboardActivityFromApi(this.pos.posDashboard()) || this.sampleDashboardAuditLogs());

  stats = computed(() => {
    const bills = this.pos.bills();
    const totalSales = bills.reduce((sum, bill) => sum + this.billTotal(bill), 0);
    return {
      outlets: this.pos.outlets().filter(outlet => outlet.active).length,
      orders: this.pos.orders().filter(order => order.status !== 'BILLED' && order.status !== 'CANCELLED').length,
      kot: this.pos.orders().filter(order => order.status === 'KOT_SENT').length,
      bills: bills.filter(bill => bill.status !== 'VOID').length,
      roomPostings: bills.filter(bill => bill.postedToFolio).length,
      sales: totalSales
    };
  });

  dashboardKpis = computed(() => {
    const orders = this.dashboardOrders();
    const bills = this.dashboardBills();
    const tables = this.dashboardTables();
    const menuItems = this.dashboardMenuItems();
    const activeOrders = orders.filter(order => !['BILLED', 'CANCELLED'].includes(order.status));
    const occupiedTables = tables.filter(table => ['OCCUPIED', 'RESERVED'].includes(String(table.status).toUpperCase())).length;
    const availableTables = tables.filter(table => String(table.status).toUpperCase() === 'AVAILABLE').length;
    const totalTables = Math.max(1, tables.length);
    const paidSales = bills.filter(bill => bill.status !== 'VOID').reduce((sum, bill) => sum + this.billTotal(bill), 0);
    const roomPostingAmount = bills
      .filter(bill => bill.postedToFolio)
      .reduce((sum, bill) => sum + this.billTotal(bill), 0);
    const unpaidAmount = bills
      .filter(bill => bill.status === 'OPEN' || bill.status === 'PARTIAL')
      .reduce((sum, bill) => sum + Math.max(0, this.billTotal(bill) - Number(bill.paid || 0)), 0);

    return {
      activeOrders: activeOrders.length,
      tableLoad: Math.round((occupiedTables / totalTables) * 100),
      availableTables,
      paidSales,
      roomPostingAmount,
      unpaidAmount,
      kotPending: orders.filter(order => order.status === 'OPEN' || order.status === 'HELD').length,
      menuAvailability: this.percent(menuItems.filter(item => item.available).length, menuItems.length)
    };
  });

  tableStatusSummary = computed(() => {
    const floorPulse = this.pos.posDashboard()?.floorPulse;
    if (floorPulse?.totalTables) {
      const rows = [
        { status: 'AVAILABLE', count: Number(floorPulse.available || 0), percent: Math.round(Number(floorPulse.availablePercent || 0)) },
        { status: 'OCCUPIED', count: Number(floorPulse.occupied || 0), percent: Math.round(Number(floorPulse.occupiedPercent || 0)) },
        { status: 'RESERVED', count: Number(floorPulse.reserved || 0), percent: Math.round(Number(floorPulse.reservedPercent || 0)) }
      ];
      const knownCount = rows.reduce((sum, row) => sum + row.count, 0);
      const otherCount = Math.max(0, Number(floorPulse.totalTables || 0) - knownCount);
      if (otherCount) {
        rows.push({
          status: 'OTHER',
          count: otherCount,
          percent: Math.max(0, 100 - rows.reduce((sum, row) => sum + row.percent, 0))
        });
      }
      return rows
        .filter(row => row.count > 0 || row.percent > 0)
        .map(row => ({
          ...row,
          icon: this.tableStatusIcon(row.status),
          color: this.tableStatusColor(row.status)
        }))
        .sort((a, b) => b.count - a.count);
    }

    const statuses = new Map<string, number>();
    const tables = this.dashboardTables();
    for (const table of tables) {
      const status = String(table.status || 'AVAILABLE').toUpperCase();
      statuses.set(status, (statuses.get(status) || 0) + 1);
    }
    const total = Math.max(1, tables.length);
    return Array.from(statuses.entries())
      .map(([status, count]) => ({
        status,
        count,
        percent: Math.round((count / total) * 100),
        icon: this.tableStatusIcon(status),
        color: this.tableStatusColor(status)
      }))
      .sort((a, b) => b.count - a.count);
  });

  tableStatusPie = computed(() => {
    let cursor = 0;
    const segments = this.tableStatusSummary().map(row => {
      const start = cursor;
      cursor += row.percent;
      return `${row.color} ${start}% ${cursor}%`;
    });

    return segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(var(--surface-200) 0% 100%)';
  });

  outletRevenue = computed(() => {
    const revenueMix = this.pos.posDashboard()?.revenueMix || [];
    if (revenueMix.length) {
      const rows = revenueMix
        .map((row, index) => ({
          outletId: index + 1,
          name: row.outletName || `Outlet ${index + 1}`,
          amount: Number(row.totalAmount || 0),
          orders: Number(row.billCount || 0)
        }))
        .sort((a, b) => b.amount - a.amount || b.orders - a.orders)
        .slice(0, 5);
      const max = Math.max(1, ...rows.map(row => row.amount));
      return rows.map(row => ({ ...row, width: Math.max(6, Math.round((row.amount / max) * 100)) }));
    }

    const outlets = this.dashboardOutlets();
    const ordersById = new Map(this.dashboardOrders().map(order => [order.id, order]));
    const totals = new Map<number, { outletId: number; name: string; amount: number; orders: number }>();

    for (const outlet of outlets) {
      totals.set(outlet.id, { outletId: outlet.id, name: outlet.name, amount: 0, orders: 0 });
    }

    for (const bill of this.dashboardBills().filter(item => item.status !== 'VOID')) {
      const order = ordersById.get(Number(bill.orderId));
      const outletId = Number(order?.outletId || outlets[0]?.id || 0);
      const current = totals.get(outletId) || { outletId, name: this.dashboardOutletName(outletId), amount: 0, orders: 0 };
      current.amount += this.billTotal(bill);
      current.orders += 1;
      totals.set(outletId, current);
    }

    const rows = Array.from(totals.values()).sort((a, b) => b.amount - a.amount || b.orders - a.orders).slice(0, 5);
    const max = Math.max(1, ...rows.map(row => row.amount));
    return rows.map(row => ({ ...row, width: Math.max(6, Math.round((row.amount / max) * 100)) }));
  });

  paymentMix = computed(() => {
    const paymentSplit = this.pos.posDashboard()?.paymentSplit || [];
    if (paymentSplit.length) {
      return paymentSplit
        .map(row => ({
          mode: row.method || 'Unspecified',
          amount: Number(row.amount || 0),
          percent: Math.round(Number(row.percentage || 0))
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    const totals = new Map<string, number>();
    for (const bill of this.dashboardBills().filter(item => item.status !== 'VOID')) {
      const amount = this.billTotal(bill);
      const modes = bill.paymentModes.length ? bill.paymentModes : ['Unspecified'];
      for (const mode of modes) {
        totals.set(mode, (totals.get(mode) || 0) + amount / modes.length);
      }
    }
    const total = Math.max(1, Array.from(totals.values()).reduce((sum, value) => sum + value, 0));
    return Array.from(totals.entries())
      .map(([mode, amount]) => ({ mode, amount, percent: Math.round((amount / total) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  });

  topMenuItems = computed(() => {
    const fastMovingItems = this.pos.posDashboard()?.fastMovingItems || [];
    if (fastMovingItems.length) {
      return fastMovingItems.map((item, index) => ({
        itemId: index + 1,
        name: item.itemName || `Item ${index + 1}`,
        qty: Number(item.soldQty || 0),
        revenue: 0,
        outlet: item.outletName || 'Outlet',
        imageUrl: item.imageUrl || this.menuImage({})
      }));
    }

    const menuById = new Map(this.dashboardMenuItems().map(item => [item.id, item]));
    const totals = new Map<number, { itemId: number; name: string; qty: number; revenue: number; outlet: string; imageUrl: string }>();
    for (const order of this.dashboardOrders()) {
      for (const line of order.lines) {
        const menuItem = menuById.get(line.itemId);
        const current = totals.get(line.itemId) || {
          itemId: line.itemId,
          name: line.name,
          qty: 0,
          revenue: 0,
          outlet: this.dashboardOutletName(order.outletId),
          imageUrl: menuItem?.imageUrl || this.menuImage(menuItem || {})
        };
        current.qty += Number(line.qty || 0);
        current.revenue += Number(line.qty || 0) * Number(line.price || 0);
        totals.set(line.itemId, current);
      }
    }
    return Array.from(totals.values()).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5);
  });

  kitchenQueue = computed(() => {
    return this.dashboardOrders()
      .filter(order => !['BILLED', 'CANCELLED'].includes(order.status))
      .slice(0, 6)
      .map(order => ({
        ...order,
        amount: this.orderTotal(order),
        itemCount: order.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
      }));
  });

  billingWatch = computed(() => {
    const watch = this.pos.posDashboard()?.billingWatch;
    if (watch) {
      return [
        { label: 'Open / Partial Bills', value: Number(watch.openBillsCount || 0), amount: Number(watch.openBillsAmount || 0), icon: 'pending_actions', route: 'billing' as PosTab, color: '#b45309', bg: '#fff7ed' },
        { label: 'Room Posting Pending', value: Number(watch.roomPostingPendingCount || 0), amount: Number(watch.roomPostingPendingAmount || 0), icon: 'bed', route: 'billing' as PosTab, color: '#2563eb', bg: '#eff6ff' },
        { label: 'Voids / Comps', value: Number(watch.voidsCount || 0), amount: Number(watch.voidsAmount || 0), icon: 'block', route: 'billing' as PosTab, color: '#dc2626', bg: '#fef2f2' }
      ];
    }

    const bills = this.dashboardBills();
    const pendingFolio = bills.filter(bill => bill.roomNo && !bill.postedToFolio && bill.status !== 'VOID');
    const openBills = bills.filter(bill => bill.status === 'OPEN' || bill.status === 'PARTIAL');
    const voidBills = bills.filter(bill => bill.status === 'VOID');
    return [
      { label: 'Open / Partial Bills', value: openBills.length, amount: openBills.reduce((sum, bill) => sum + Math.max(0, this.billTotal(bill) - Number(bill.paid || 0)), 0), icon: 'pending_actions', route: 'billing' as PosTab, color: '#b45309', bg: '#fff7ed' },
      { label: 'Room Posting Pending', value: pendingFolio.length, amount: pendingFolio.reduce((sum, bill) => sum + this.billTotal(bill), 0), icon: 'bed', route: 'billing' as PosTab, color: '#2563eb', bg: '#eff6ff' },
      { label: 'Voids / Comps', value: voidBills.length, amount: voidBills.reduce((sum, bill) => sum + this.billTotal(bill), 0), icon: 'block', route: 'billing' as PosTab, color: '#dc2626', bg: '#fef2f2' }
    ];
  });

  setupReadiness = computed(() => {
    const outlets = this.dashboardOutlets();
    const menuItems = this.dashboardMenuItems();
    const activeOutlets = outlets.filter(outlet => outlet.active).length;
    const availableItems = menuItems.filter(item => item.available).length;
    const readyRules = this.taxRules().filter(rule => rule.active).length + this.offerRules().filter(rule => rule.active).length;
    return [
      { label: 'Active outlets', value: activeOutlets, total: outlets.length, route: 'outlets' as PosTab },
      { label: 'Available menu', value: availableItems, total: menuItems.length, route: 'menu' as PosTab },
      { label: 'Billing rules', value: readyRules, total: this.taxRules().length + this.offerRules().length, route: 'billing-setup' as PosTab }
    ];
  });

  filteredOutlets = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.pos.outlets().filter(outlet => {
      const status = this.statusFilter();
      const matchStatus = status === 'ALL' || (status === 'ACTIVE' ? outlet.active : !outlet.active);
      return matchStatus && (!q || outlet.name.toLowerCase().includes(q) || outlet.type.toLowerCase().includes(q) || outlet.location.toLowerCase().includes(q));
    });
  });

  filteredMenu = computed(() => {
    const q = this.search().toLowerCase().trim();
    const outlet = this.outletFilter();
    const status = this.statusFilter();
    return this.pos.menuItems().filter(item => {
      const matchOutlet = outlet === 'ALL' || item.outletId === Number(outlet);
      const matchStatus = status === 'ALL' || (status === 'AVAILABLE' ? item.available : !item.available);
      const matchQuery = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.subcategory.toLowerCase().includes(q);
      return matchOutlet && matchStatus && matchQuery;
    });
  });

  filteredOrders = computed(() => {
    const q = this.search().toLowerCase().trim();
    const outlet = this.outletFilter();
    const status = this.statusFilter();
    return this.pos.orders().filter(order => {
      const matchOutlet = outlet === 'ALL' || order.outletId === Number(outlet);
      const matchStatus = status === 'ALL' || order.status === status;
      const matchQuery = !q || order.orderNo.toLowerCase().includes(q) || (order.tableNo || '').toLowerCase().includes(q) || (order.roomNo || '').toLowerCase().includes(q) || (order.guestName || '').toLowerCase().includes(q) || order.server.toLowerCase().includes(q);
      return matchOutlet && matchStatus && matchQuery;
    });
  });

  filteredBills = computed(() => {
    const q = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    return this.pos.bills().filter(bill => {
      const matchStatus = status === 'ALL' || bill.status === status;
      const matchQuery = !q || bill.billNo.toLowerCase().includes(q) || (bill.roomNo || '').includes(q) || (bill.guestName || '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  });

  outletTables = computed(() => {
    const outlet = this.outletFilter();
    return this.pos.tables()
      .filter(table => outlet === 'ALL' || table.outletId === Number(outlet))
      .sort((a, b) => a.outletId - b.outletId || a.number.localeCompare(b.number, undefined, { numeric: true }));
  });

  selectedTableOrder = computed(() => {
    const orders = this.activeTableOrders();
    if (orders.length) return orders[0];
    const table = this.selectedTable();
    return table ? this.activeOrderForTable(table) : null;
  });

  mergeCandidates = computed(() => {
    const selected = this.selectedTable();
    return this.outletTables().filter(table => table.id !== selected?.id);
  });

  tableMenuItems = computed(() => {
    const table = this.selectedTable();
    const outletId = table?.outletId || this.defaultOutletId();
    return this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
  });

  diningMenuItems = computed(() => {
    const action = this.diningAction();
    const outletId = action === 'ROOM' ? this.roomServiceOutletId() : (this.selectedTable()?.outletId || this.defaultOutletId());
    const items = this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
    return items.length ? items : this.pos.menuItems().filter(item => item.available);
  });

  roomServiceFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  roomServiceRooms = computed(() => {
    const floorId = Number(this.diningForm().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  });

  selectedRoomServiceRoom = computed(() => {
    const roomId = Number(this.diningForm().roomId || 0);
    return this.masters.rooms().find(room => room.id === roomId) || this.roomServiceRooms()[0] || null;
  });

  orderTables = computed(() => {
    const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
    return this.pos.tables()
      .filter(table => table.outletId === outletId)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  });

  orderRoomFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  orderRooms = computed(() => {
    const floorId = Number(this.currentOrder().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  });

  orderMenuItems = computed(() => {
    const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
    const items = this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
    return items.length ? items : this.pos.menuItems().filter(item => item.available);
  });

  billOrders = computed(() => {
    const type = this.currentBill().orderType;
    return this.pos.orders().filter(order => !type || order.type === type);
  });

  billableOrders = computed(() => {
    const billedOrderIds = new Set(this.pos.bills().filter(bill => bill.status !== 'VOID').map(bill => Number(bill.orderId)));
    return this.pos.orders().filter(order => order.status !== 'CANCELLED' && !billedOrderIds.has(order.id));
  });

  currentBillBreakdown = computed(() => this.billBreakdown(this.currentBill()));

  billTables = computed(() => {
    const order = this.pos.orders().find(item => item.id === Number(this.currentBill().orderId));
    const outletId = Number(order?.outletId || this.defaultOutletId());
    return this.pos.tables()
      .filter(table => table.outletId === outletId)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  });

  billRoomFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  billRooms = computed(() => {
    const floorId = Number(this.currentBill().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  });

  startOrderTotal = computed(() => this.startOrderLines().reduce((sum, line) => sum + line.qty * line.price, 0));

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  switchTab(tab: PosTab): void {
    this.router.navigate([`/pos/${tab}`]);
  }

  changeOutletFilter(value: number | string): void {
    const outlet = value === 'ALL' ? 'ALL' : Number(value);
    this.outletFilter.set(outlet);
    this.selectedTable.set(null);
    this.activeTableOrders.set([]);

    if (this.activeTab() === 'dining') {
      this.pos.loadTables(outlet === 'ALL' ? undefined : outlet);
    }
  }

  openCreate(kind: ModalKind): void {
    this.modalKind.set(kind);
    this.modalMode.set('create');
    this.tableOrderEditMode.set(false);
    if (kind === 'outlet') this.currentOutlet.set({ name: '', type: this.pos.outletTypes()[0] || 'Restaurant', location: '', timing: this.pos.shiftSchedules()[0] || '09:00 AM - 09:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Outlet Manager' });
    if (kind === 'menu') this.currentMenuItem.set({ outletId: this.defaultOutletId(), name: '', category: this.pos.menuCategories()[0] || 'Food', subcategory: this.pos.menuSubcategories()[0] || '', price: 0, taxPercent: 5, variants: [], modifiers: [], available: true, featured: false, stockItem: '', imageUrl: '' });
    if (kind === 'order') {
      const outletId = this.defaultOutletId();
      const table = this.pos.tables().find(item => item.outletId === outletId);
      this.currentOrder.set({ outletId, type: 'TABLE', tableNo: table?.number || '', roomNo: '', guestName: '', server: 'Unassigned', status: this.pos.orderStatuses()[0] || 'OPEN', notes: '', lines: [] });
    }
    if (kind === 'bill') {
      this.currentBill.set({
        orderId: undefined,
        orderType: 'TABLE',
        tableNo: '',
        guestName: '',
        status: this.pos.billStatuses()[0] || 'OPEN',
        paymentModes: [this.pos.paymentModes()[0] || 'Cash'],
        discount: 0,
        paid: 0,
        compReason: '',
        postedToFolio: false
      });
      this.selectedBillingOrder.set(null);
    }
    if (kind === 'table') this.currentTable.set({ outletId: this.defaultOutletId(), number: '', section: this.pos.tableSections()[0] || 'Indoor', status: this.pos.tableStatuses()[0] || 'AVAILABLE', covers: 0, server: 'Unassigned', mergedWith: '' });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEdit(kind: ModalKind, item: any): void {
    this.modalKind.set(kind);
    this.modalMode.set('edit');
    this.tableOrderEditMode.set(false);
    if (kind === 'table') {
      this.pos.getTableById(Number(item.id)).subscribe({
        next: table => {
          this.currentTable.set(table);
          this.isModalOpen.set(true);
          document.body.style.overflow = 'hidden';
        },
        error: error => {
          console.error('[POS] Unable to load table details', error);
          this.currentTable.set({ ...item });
          this.isModalOpen.set(true);
          document.body.style.overflow = 'hidden';
        }
      });
      return;
    }
    if (kind === 'outlet') this.currentOutlet.set({ ...item });
    if (kind === 'menu') this.currentMenuItem.set({ ...item, variants: [...item.variants], modifiers: [...item.modifiers] });
    if (kind === 'order') this.currentOrder.set({ ...item, lines: item.lines.map((line: PosOrderLine) => ({ ...line })) });
    if (kind === 'bill') {
      const order = this.pos.orders().find(value => value.id === Number(item.orderId));
      const synced = this.billDraftForOrder(order, item);
      this.selectedBillingOrder.set(order || null);
      this.currentBill.set({
        ...synced,
        orderType: item.orderType || order?.type || synced.orderType,
        tableNo: item.tableNo || order?.tableNo || synced.tableNo || '',
        floorId: item.floorId || order?.floorId || synced.floorId || null,
        roomId: item.roomId || order?.roomId || synced.roomId || null,
        roomNo: item.roomNo || order?.roomNo || synced.roomNo || '',
        guestName: item.guestName || order?.guestName || synced.guestName || '',
        paymentModes: [...item.paymentModes]
      });
    }
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openBillFromOrder(order: PosOrder): void {
    this.isTableOrderDetailOpen.set(false);
    this.modalKind.set('bill');
    this.modalMode.set('create');
    this.selectedBillingOrder.set(order);
    this.currentBill.set(this.billDraftForOrder(order, { status: this.pos.billStatuses()[0] || 'OPEN', paymentModes: [this.pos.paymentModes()[0] || 'Cash'], discount: 0, paid: 0 }));
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openSelectedTableOrder(order: PosOrder): void {
    this.isTableOrderDetailOpen.set(false);
    this.modalKind.set('order');
    this.modalMode.set('edit');
    this.tableOrderEditMode.set(true);
    this.currentOrder.set({ ...order, lines: order.lines.map(line => ({ ...line })) });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  private currentTimeValue(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.tableOrderEditMode.set(false);
    document.body.style.overflow = '';
  }

  closeTableOrderDetail(): void {
    this.isTableOrderDetailOpen.set(false);
    this.activeTableOrdersLoading.set(false);
    this.activeTableOrdersError.set('');
    document.body.style.overflow = '';
  }

  saveModal(): void {
    const kind = this.modalKind();
    if (kind === 'outlet') this.pos.saveOutlet(this.currentOutlet());
    if (kind === 'menu') this.pos.saveMenuItem(this.currentMenuItem());
    if (kind === 'order') this.pos.saveOrder(this.currentOrder());
    if (kind === 'bill') this.pos.saveBill(this.billDraftForOrder(this.billOrder(this.currentBill()), this.currentBill()));
    if (kind === 'table') this.pos.saveTable(this.currentTable() as PosTable);
    this.closeModal();
  }

  deleteOutlet(id: number): void {
    const outlet = this.pos.outlets().find(item => item.id === id);
    this.openDeleteConfirm({
      kind: 'outlet',
      id,
      title: outlet?.name || 'Outlet',
      message: 'This outlet will be removed from POS outlet management.'
    });
  }

  deleteMenuItem(id: number): void {
    const item = this.pos.menuItems().find(value => value.id === id);
    this.openDeleteConfirm({
      kind: 'menu',
      id,
      title: item?.name || 'Menu item',
      message: 'This menu item will be removed from the selected outlet menu.'
    });
  }

  deleteTable(table: PosTable, event?: Event): void {
    event?.stopPropagation();
    this.openDeleteConfirm({
      kind: 'table',
      id: table.id,
      title: `Table ${table.number}`,
      message: 'This table will be removed from the dining layout.'
    });
  }

  openDeleteConfirm(target: DeleteTarget): void {
    this.deleteTarget.set(target);
    document.body.style.overflow = 'hidden';
  }

  closeDeleteConfirm(): void {
    this.deleteTarget.set(null);
    if (!this.isModalOpen() && !this.isDiningActionOpen()) document.body.style.overflow = '';
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    if (target.kind === 'outlet') this.pos.deleteOutlet(target.id);
    if (target.kind === 'menu') this.pos.deleteMenuItem(target.id);
    if (target.kind === 'table') {
      this.pos.deleteTable(target.id);
      if (this.selectedTable()?.id === target.id) this.selectedTable.set(null);
    }
    this.closeDeleteConfirm();
  }

  toggleOutlet(outlet: PosOutlet): void {
    this.pos.saveOutlet({ ...outlet, active: !outlet.active });
  }

  toggleMenuAvailability(item: PosMenuItem): void {
    this.pos.saveMenuItem({ ...item, available: !item.available });
  }

  updateOrderStatus(order: PosOrder, status: OrderStatus): void {
    this.pos.updateOrderStatus(order.id, status);
  }

  voidBill(bill: PosBill): void {
    this.pos.saveBill({ ...bill, status: 'VOID', compReason: bill.compReason || 'Void marked by supervisor' });
  }

  addOrderLine(): void {
    const firstItem = this.orderMenuItems()[0];
    if (firstItem) this.addMenuItemToOrder(firstItem);
  }

  removeOrderLine(index: number): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).filter((_, i) => i !== index) }));
  }

  addMenuItemToOrder(item: PosMenuItem): void {
    this.currentOrder.update(order => {
      const lines = order.lines || [];
      const existing = lines.find(line => line.itemId === item.id);
      const nextLines = existing
        ? lines.map(line => line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line)
        : [...lines, { itemId: item.id, name: item.name, qty: 1, price: item.happyHourPrice || item.price, course: item.subcategory || 'Main', notes: item.modifiers[0] || '' }];
      return { ...order, lines: nextLines };
    });
  }

  updateOrderLineQty(index: number, value: number): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).map((line, i) => i === index ? { ...line, qty: Math.max(1, Number(value) || 1) } : line) }));
  }

  updateOrderLineNotes(index: number, value: string): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).map((line, i) => i === index ? { ...line, notes: value } : line) }));
  }

  updateOrderOutlet(value: number | string): void {
    const outletId = Number(value || this.defaultOutletId());
    const firstTable = this.pos.tables().find(table => table.outletId === outletId);
    this.currentOrder.update(order => ({
      ...order,
      outletId,
      tableNo: order.type === 'TABLE' ? firstTable?.number || '' : order.tableNo,
      roomNo: order.type === 'TABLE' ? '' : order.roomNo,
      roomId: order.type === 'TABLE' ? null : order.roomId,
      floorId: order.type === 'TABLE' ? null : order.floorId
    }));
  }

  updateOrderType(value: 'TABLE' | 'TAKEAWAY' | 'ROOM'): void {
    if (value === 'TABLE') {
      const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
      const firstTable = this.pos.tables().find(table => table.outletId === outletId);
      this.currentOrder.update(order => ({ ...order, type: value, tableNo: firstTable?.number || '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
      return;
    }

    if (value === 'ROOM') {
      const firstFloor = this.orderRoomFloors()[0] || null;
      const firstRoom = this.masters.rooms()
        .filter(room => room.isActive)
        .filter(room => !firstFloor || room.floorId === firstFloor.id)
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
      this.currentOrder.update(order => ({
        ...order,
        type: value,
        outletId: this.roomServiceOutletId(),
        tableNo: '',
        floorId: firstFloor?.id || null,
        roomId: firstRoom?.id || null,
        roomNo: firstRoom?.roomNumber || '',
        guestName: order.guestName || ''
      }));
      return;
    }

    this.currentOrder.update(order => ({ ...order, type: value, tableNo: '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
  }

  updateOrderTable(value: string): void {
    this.currentOrder.update(order => ({ ...order, tableNo: value }));
  }

  updateOrderFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
    this.currentOrder.update(order => ({
      ...order,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateOrderRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.currentOrder.update(order => ({
      ...order,
      roomId,
      roomNo: room?.roomNumber || ''
    }));
  }

  selectDiningTable(table: PosTable): void {
    this.selectedTable.set(table);
    this.activeTableOrders.set([]);
    this.activeTableOrdersError.set('');
    this.diningForm.set({
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      covers: table.covers || 2,
      secondaryTableId: this.mergeCandidates()[0]?.id || null,
      floorId: this.diningForm().floorId,
      roomId: this.diningForm().roomId,
      roomNo: '102',
      guestName: table.guestName || (table.server !== 'Unassigned' ? table.server : 'Guest'),
      bookingTime: table.bookingTime || 'Today, 08:00 PM',
      notes: ''
    });

    this.activeTableOrdersLoading.set(true);
    this.pos.getActiveOrders(table.id).subscribe({
      next: orders => {
        this.activeTableOrdersLoading.set(false);
        this.activeTableOrders.set(orders);
        if (orders.length) {
          this.isTableOrderDetailOpen.set(true);
          document.body.style.overflow = 'hidden';
        }
      },
      error: error => {
        this.activeTableOrdersLoading.set(false);
        this.activeTableOrdersError.set(error?.error?.message || error?.message || 'Unable to load active orders');
      }
    });
  }

  activeOrderForTable(table: PosTable): PosOrder | null {
    const inactiveStatuses = new Set(['BILLED', 'PAID', 'CLOSED', 'CANCELLED', 'VOID']);
    if (String(table.status || '').toUpperCase() !== 'OCCUPIED') return null;

    return this.pos.orders().find(order =>
      order.type === 'TABLE' &&
      order.outletId === table.outletId &&
      order.tableNo === table.number &&
      !inactiveStatuses.has(String(order.status || '').toUpperCase())
    ) || null;
  }

  openDiningAction(action: DiningAction): void {
    if (action !== 'RESET' && action !== 'ROOM' && !this.selectedTable()) {
      const first = this.outletTables()[0];
      if (first) this.selectDiningTable(first);
    }
    this.diningAction.set(action);
    if (action === 'ROOM') this.prepareRoomServiceDefaults();
    if (action === 'START' || action === 'ROOM') this.seedStartOrderLines();
    this.isDiningActionOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDiningAction(): void {
    this.isDiningActionOpen.set(false);
    this.diningAction.set(null);
    this.startOrderLines.set([]);
    document.body.style.overflow = '';
  }

  applyDiningAction(): void {
    const form = this.diningForm();
    const action = this.diningAction();
    if (action === 'RESET') {
      const outletId = this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id : Number(this.outletFilter());
      this.pos.resetPaidTables(outletId);
      this.selectedTable.set(null);
      this.closeDiningAction();
      return;
    }

    if (action === 'ROOM') {
      const room = this.selectedRoomServiceRoom();
      const roomNo = room?.roomNumber || form.roomNo;
      this.pos.startRoomOrder({
        outletId: this.roomServiceOutletId(),
        roomNo,
        guestName: form.guestName,
        server: form.server,
        notes: form.notes || `Deliver to room ${roomNo}.`
      }, this.startOrderLines());
      this.closeDiningAction();
      return;
    }

    const table = this.selectedTable();
    if (!table) return;

    if (action === 'START') {
      this.pos.startTableOrder({ ...table, server: form.server, covers: form.covers, guestName: form.guestName }, this.startOrderLines());
    }
    if (action === 'BOOK') {
      this.pos.bookTable(table, {
        guestName: form.guestName,
        covers: form.covers,
        server: form.server,
        bookingTime: form.bookingTime
      });
    }
    if (action === 'MERGE') {
      const secondary = this.pos.tables().find(item => item.id === Number(form.secondaryTableId));
      if (secondary) this.pos.mergeTables({ ...table, server: form.server, covers: form.covers }, secondary);
    }

    const updated = this.pos.tables().find(item => item.id === table.id);
    if (updated) this.selectedTable.set(updated);
    this.closeDiningAction();
  }

  addMenuItemToStartOrder(item: PosMenuItem): void {
    this.startOrderLines.update(lines => {
      const existing = lines.find(line => line.itemId === item.id);
      if (existing) {
        return lines.map(line => line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line);
      }
      return [...lines, { itemId: item.id, name: item.name, qty: 1, price: item.happyHourPrice || item.price, course: item.subcategory || 'Main', notes: item.modifiers[0] || '' }];
    });
  }

  updateStartLineQty(index: number, value: number): void {
    this.startOrderLines.update(lines => lines.map((line, i) => i === index ? { ...line, qty: Math.max(1, Number(value) || 1) } : line));
  }

  updateStartLineNotes(index: number, value: string): void {
    this.startOrderLines.update(lines => lines.map((line, i) => i === index ? { ...line, notes: value } : line));
  }

  updateRoomServiceFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];

    this.diningForm.update(form => ({
      ...form,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateRoomServiceRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.diningForm.update(form => ({
      ...form,
      roomId,
      roomNo: room?.roomNumber || form.roomNo
    }));
  }

  removeStartLine(index: number): void {
    this.startOrderLines.update(lines => lines.filter((_, i) => i !== index));
  }

  updateMenuTokens(field: 'variants' | 'modifiers', value: string): void {
    const tokens = value.split(',').map(item => item.trim()).filter(Boolean);
    this.currentMenuItem.update(item => ({ ...item, [field]: tokens }));
  }

  updatePaymentModes(value: string): void {
    const modes = value.split(',').map(item => item.trim()).filter(Boolean) as any;
    this.currentBill.update(bill => ({ ...bill, paymentModes: modes }));
  }

  updatePaymentMode(value: string): void {
    this.currentBill.update(bill => ({ ...bill, paymentModes: value ? [value] : [] }));
  }

  updateBillDiscount(value: number | string): void {
    this.currentBill.update(bill => this.billDraftForOrder(this.billOrder(bill), { ...bill, discount: Number(value || 0) }));
  }

  updateBillPaid(value: number | string): void {
    this.currentBill.update(bill => ({ ...bill, paid: Number(value || 0) }));
  }

  switchBillingSetupSection(section: BillingSetupSection): void {
    this.billingSetupSection.set(section);
  }

  setBillingSetupEdit(section: BillingSetupSection, editable: boolean): void {
    this.billingSetupEditMode.update(state => ({ ...state, [section]: editable }));
  }

  saveBillingSetupSection(section: BillingSetupSection): void {
    this.setBillingSetupEdit(section, false);
  }

  updateBillingSetup(field: keyof BillingSetup, value: string | boolean): void {
    this.billingSetup.update(setup => ({ ...setup, [field]: value }));
  }

  updateTaxRule(index: number, field: keyof TaxRule, value: string | number | boolean): void {
    this.taxRules.update(rules => rules.map((rule, i) => i === index ? { ...rule, [field]: field === 'rate' ? Number(value) : value } as TaxRule : rule));
  }

  updateOfferRule(index: number, field: keyof OfferRule, value: string | number | boolean): void {
    this.offerRules.update(offers => offers.map((offer, i) => i === index ? { ...offer, [field]: field === 'value' ? Number(value) : value } as OfferRule : offer));
  }

  addOfferRule(): void {
    const today = new Date().toISOString().slice(0, 10);
    const nextNumber = this.offerRules().length + 1;
    this.offerRules.update(offers => [
      ...offers,
      {
        code: `COUPON${nextNumber}`,
        name: '',
        type: 'Percentage',
        value: 0,
        validFrom: today,
        validTo: today,
        active: true
      }
    ]);
    this.setBillingSetupEdit('offers', true);
  }

  deleteOfferRule(index: number): void {
    this.offerRules.update(offers => offers.filter((_, i) => i !== index));
  }

  updateBillOrderType(value: 'TABLE' | 'TAKEAWAY' | 'ROOM'): void {
    this.selectedBillingOrder.set(null);
    this.currentBill.update(bill => ({
      ...bill,
      orderId: undefined,
      orderType: value,
      tableNo: '',
      floorId: null,
      roomId: null,
      roomNo: '',
      guestName: ''
    }));
  }

  updateBillOrder(value: number | string): void {
    const order = this.pos.orders().find(item => item.id === Number(value));
    if (!order) return;
    this.selectedBillingOrder.set(order);
    this.currentBill.update(bill => this.billDraftForOrder(order, bill));
  }

  updateBillTable(value: string): void {
    this.currentBill.update(bill => ({ ...bill, tableNo: value }));
  }

  updateBillFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
    this.currentBill.update(bill => ({
      ...bill,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateBillRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.currentBill.update(bill => ({
      ...bill,
      roomId,
      roomNo: room?.roomNumber || ''
    }));
  }

  handleMenuImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.currentMenuItem.update(item => ({ ...item, imageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  }

  outletName(id?: number): string {
    return this.pos.outletMap().get(Number(id))?.name || 'Unknown Outlet';
  }

  dashboardOutletName(id?: number): string {
    return this.dashboardOutlets().find(outlet => outlet.id === Number(id))?.name || 'Unknown Outlet';
  }

  billOrder(bill: Partial<PosBill>): PosOrder | null {
    return this.pos.orders().find(order => order.id === Number(bill.orderId || 0)) || null;
  }

  billingOrderForDisplay(): PosOrder | null {
    return this.selectedBillingOrder()
      || this.billOrder(this.currentBill())
      || null;
  }

  billBreakdown(bill: Partial<PosBill>): BillBreakdown {
    const order = this.billOrder(bill);
    const rawLines = order?.lines || [];
    const grossAmount = rawLines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const discount = Math.min(Number(bill.discount || 0), grossAmount);
    const inclusive = this.billingSetup().enableInclusiveTax;
    const bucketMap = new Map<number, BillTaxBucket>();
    let taxableSubtotal = 0;
    let taxTotal = 0;

    const lines = rawLines.map(line => {
      const menuItem = this.pos.menuItems().find(item => item.id === line.itemId);
      const taxRate = Number(menuItem?.taxPercent ?? 0);
      const grossLineAmount = line.qty * line.price;
      const discountShare = grossAmount ? discount * (grossLineAmount / grossAmount) : 0;
      const discountedAmount = Math.max(0, grossLineAmount - discountShare);
      const taxableAmount = inclusive ? discountedAmount / (1 + taxRate / 100) : discountedAmount;
      const taxAmount = inclusive ? discountedAmount - taxableAmount : taxableAmount * taxRate / 100;
      const totalAmount = inclusive ? discountedAmount : taxableAmount + taxAmount;
      const bucket = bucketMap.get(taxRate) || { rate: taxRate, taxableAmount: 0, cgst: 0, sgst: 0, taxAmount: 0 };

      bucket.taxableAmount += taxableAmount;
      bucket.taxAmount += taxAmount;
      bucket.cgst += taxAmount / 2;
      bucket.sgst += taxAmount / 2;
      bucketMap.set(taxRate, bucket);
      taxableSubtotal += taxableAmount;
      taxTotal += taxAmount;

      return { ...line, taxRate, taxableAmount, taxAmount, totalAmount };
    });

    const total = taxableSubtotal + taxTotal;
    const paid = Number(bill.paid || 0);

    return {
      order,
      lines,
      grossAmount,
      discount,
      taxableSubtotal,
      taxTotal,
      total,
      paid,
      due: Math.max(0, total - paid),
      taxBuckets: Array.from(bucketMap.values()).sort((a, b) => a.rate - b.rate)
    };
  }

  billDraftForOrder(order?: PosOrder | null, input: Partial<PosBill> = {}): Partial<PosBill> {
    const base: Partial<PosBill> = {
      ...input,
      orderId: order?.id ?? input.orderId,
      orderType: order?.type || input.orderType || 'TABLE',
      tableNo: order?.type === 'TABLE' ? order.tableNo || '' : input.tableNo || '',
      floorId: order?.type === 'ROOM' ? order.floorId || null : input.floorId || null,
      roomId: order?.type === 'ROOM' ? order.roomId || null : input.roomId || null,
      roomNo: order?.type === 'ROOM' ? order.roomNo || '' : input.roomNo || '',
      guestName: order?.guestName || input.guestName || '',
      discount: Number(input.discount || 0),
      paid: Number(input.paid || 0),
      status: input.status || this.pos.billStatuses()[0] || 'OPEN',
      paymentModes: input.paymentModes?.length ? input.paymentModes : [this.pos.paymentModes()[0] || 'Cash'],
      compReason: input.compReason || '',
      postedToFolio: !!input.postedToFolio
    };
    const breakdown = this.billBreakdown(base);

    return {
      ...base,
      subtotal: Math.round(breakdown.taxableSubtotal * 100) / 100,
      tax: Math.round(breakdown.taxTotal * 100) / 100
    };
  }

  billTotal(bill: Partial<PosBill>): number {
    return this.billBreakdown(bill).total || Number(bill.subtotal || 0) - Number(bill.discount || 0) + Number(bill.tax || 0);
  }

  orderTotal(order: PosOrder | Partial<PosOrder>): number {
    if (order.totalAmount != null) return Number(order.totalAmount || 0);
    return (order.lines || []).reduce((sum, line) => sum + line.qty * line.price, 0);
  }

  orderOpenedLabel(order: PosOrder): string {
    const value = order.createdAt || order.openedAt;
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  percent(value: number, total: number): number {
    return total ? Math.round((Number(value || 0) / total) * 100) : 0;
  }

  tableStatusIcon(status: TableStatus): string {
    return status === 'AVAILABLE' ? 'check_circle' : status === 'OCCUPIED' ? 'room_service' : status === 'RESERVED' ? 'event' : 'receipt_long';
  }

  tableStatusColor(status: TableStatus): string {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'AVAILABLE') return '#0f8f86';
    if (normalized === 'OCCUPIED') return '#0d4b4b';
    if (normalized === 'RESERVED') return '#b7791f';
    return '#475569';
  }

  menuImage(item: Partial<PosMenuItem>): string {
    return item.imageUrl || 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=240&q=80';
  }

  diningActionTitle(): string {
    const action = this.diningAction();
    if (action === 'START') return 'Start Table Order';
    if (action === 'ROOM') return 'Room Service Order';
    if (action === 'BOOK') return 'Book Table';
    if (action === 'MERGE') return 'Merge Tables';
    if (action === 'RESET') return 'Reset Paid Tables';
    return 'Dining Action';
  }

  roomServiceFloorLabel(): string {
    const room = this.selectedRoomServiceRoom();
    if (!room) return 'Select Floor / Room';
    const floor = this.masters.floorsMap().get(room.floorId);
    return `Floor ${floor?.floorNumber || room.floorId}`;
  }

  roomServiceRoomNumber(): string {
    return this.selectedRoomServiceRoom()?.roomNumber || this.diningForm().roomNo || 'No.';
  }

  private defaultOutletId(): number {
    return this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id || 1 : Number(this.outletFilter());
  }

  private roomServiceOutletId(): number {
    return this.pos.outlets().find(outlet => outlet.type === 'Room Service' && outlet.active)?.id || this.defaultOutletId();
  }

  private prepareRoomServiceDefaults(): void {
    const current = this.diningForm();
    const floors = this.roomServiceFloors();
    const floorId = current.floorId || floors[0]?.id || null;
    const rooms = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    const room = rooms.find(item => item.id === current.roomId) || rooms[0] || null;

    this.diningForm.set({
      ...current,
      floorId,
      roomId: room?.id || null,
      roomNo: room?.roomNumber || current.roomNo || '',
      guestName: current.guestName || 'Guest',
      server: current.server || 'Meena Pillai'
    });
  }

  private seedStartOrderLines(): void {
    if (this.startOrderLines().length) return;
    const featured = this.diningMenuItems().filter(item => item.featured).slice(0, 2);
    this.startOrderLines.set(featured.map(item => ({
      itemId: item.id,
      name: item.name,
      qty: 1,
      price: item.happyHourPrice || item.price,
      course: item.subcategory || 'Main',
      notes: item.modifiers[0] || ''
    })));
  }

  private dashboardOrdersFromApi(data: PosDashboardData | null): PosOrder[] | null {
    const queue = data?.kotQueue || [];
    if (!queue.length) return null;

    return queue.map((item, index) => {
      const infoParts = String(item.info || '').split('•').map(part => part.trim()).filter(Boolean);
      const typeText = String(infoParts[0] || 'TABLE').toUpperCase();
      const type: PosOrder['type'] = typeText === 'ROOM' ? 'ROOM' : typeText === 'TAKEAWAY' ? 'TAKEAWAY' : 'TABLE';
      const itemCount = Number(item.itemCount || 0);

      return {
        id: index + 1,
        outletId: index + 1,
        orderNo: item.orderId || `ORD-${index + 1}`,
        type,
        tableNo: type === 'TABLE' ? infoParts[1] || '' : '',
        roomNo: type === 'ROOM' ? infoParts[1] || '' : '',
        guestName: infoParts[1] || '',
        server: item.outletName || 'Outlet',
        status: String(item.status || 'OPEN').toUpperCase(),
        openedAt: '',
        notes: item.info || '',
        lines: itemCount ? [{ itemId: index + 1, name: 'Items', qty: itemCount, price: 0, course: 'Queue', notes: '' }] : []
      };
    });
  }

  private dashboardActivityFromApi(data: PosDashboardData | null): PosAuditLog[] | null {
    const activity = data?.recentActivity || [];
    if (!activity.length) return null;

    return activity.map((item, index) => ({
      id: index + 1,
      at: this.dashboardTimeLabel(item.timestamp),
      user: 'POS',
      action: item.activityType || 'POS activity',
      module: 'POS Dashboard',
      reference: item.linkedEntityId || '-'
    }));
  }

  private dashboardTimeLabel(value?: string): string {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const diffMs = Date.now() - date.getTime();
    if (diffMs >= 0 && diffMs < 60_000) return 'Just now';
    if (diffMs >= 0 && diffMs < 3_600_000) return `${Math.max(1, Math.round(diffMs / 60_000))} min ago`;
    if (diffMs >= 0 && diffMs < 86_400_000) return `${Math.max(1, Math.round(diffMs / 3_600_000))} hr ago`;

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private sampleDashboardOutlets(): PosOutlet[] {
    return [
      { id: 1, name: 'Azure Restaurant', type: 'Restaurant', location: 'Lobby Level', timing: '07:00 AM - 11:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Rajan Mehta' },
      { id: 2, name: 'Skyline Bar', type: 'Bar', location: 'Rooftop', timing: '05:00 PM - 01:00 AM', taxProfile: 'GST 18%', active: true, manager: 'Deepa Thomas' },
      { id: 3, name: 'Room Service', type: 'Room Service', location: 'Back Office', timing: '24 Hours', taxProfile: 'GST 5%', active: true, manager: 'Meena Pillai' },
      { id: 4, name: 'Atrium Cafe', type: 'Cafe', location: 'Ground Floor', timing: '09:00 AM - 09:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Arjun Menon' }
    ];
  }

  private sampleDashboardMenuItems(): PosMenuItem[] {
    return [
      { id: 1, outletId: 1, name: 'Paneer Tikka', category: 'Food', subcategory: 'Starter', price: 420, taxPercent: 5, variants: ['Regular', 'Family'], modifiers: ['Extra mint chutney', 'No onion'], available: true, featured: true, stockItem: 'Paneer', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=180&q=80' },
      { id: 2, outletId: 1, name: 'Butter Chicken', category: 'Food', subcategory: 'Main Course', price: 620, taxPercent: 5, variants: ['Half', 'Full'], modifiers: ['Less spicy', 'Extra gravy'], available: true, featured: true, stockItem: 'Chicken curry cut', imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=180&q=80' },
      { id: 3, outletId: 1, name: 'Veg Biryani', category: 'Food', subcategory: 'Main Course', price: 480, taxPercent: 5, variants: ['Single', 'Family'], modifiers: ['Raita', 'Salad'], available: true, featured: false, stockItem: 'Basmati rice', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=180&q=80' },
      { id: 4, outletId: 2, name: 'Craft Lager', category: 'Beverage', subcategory: 'Beverage', price: 360, taxPercent: 18, variants: ['330 ml', 'Pitcher'], modifiers: ['Chilled glass'], available: true, featured: true, happyHourPrice: 300, happyHourWindow: '05:00 PM - 07:00 PM', stockItem: 'Lager keg', imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=180&q=80' },
      { id: 5, outletId: 2, name: 'Citrus Mocktail', category: 'Beverage', subcategory: 'Beverage', price: 280, taxPercent: 5, variants: ['Classic', 'Spicy'], modifiers: ['No sugar', 'Extra ice'], available: true, featured: true, stockItem: 'Orange juice', imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=180&q=80' },
      { id: 6, outletId: 3, name: 'Club Sandwich', category: 'Room Service', subcategory: 'Room Service', price: 390, taxPercent: 5, variants: ['Veg', 'Chicken'], modifiers: ['Fries', 'No mayo'], available: true, featured: false, stockItem: 'Bread loaf', imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=180&q=80' },
      { id: 7, outletId: 4, name: 'Cappuccino', category: 'Beverage', subcategory: 'Beverage', price: 220, taxPercent: 5, variants: ['Regular', 'Large'], modifiers: ['Oat milk', 'Extra shot'], available: true, featured: true, stockItem: 'Coffee beans', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=180&q=80' },
      { id: 8, outletId: 4, name: 'Chocolate Pastry', category: 'Food', subcategory: 'Dessert', price: 260, taxPercent: 5, variants: ['Slice'], modifiers: ['Warm', 'No garnish'], available: false, featured: false, stockItem: 'Pastry', imageUrl: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=180&q=80' }
    ];
  }

  private sampleDashboardOrders(): PosOrder[] {
    return [
      { id: 1, outletId: 1, orderNo: 'ORD-1001', type: 'TABLE', tableNo: 'T01', guestName: 'Nisha Rao', server: 'Arjun Menon', status: 'KOT_SENT', kotNo: 'KOT-501', openedAt: '18 min ago', notes: 'Anniversary table', lines: [
        { itemId: 1, name: 'Paneer Tikka', qty: 2, price: 420, course: 'Starter', notes: 'Extra mint chutney' },
        { itemId: 2, name: 'Butter Chicken', qty: 1, price: 620, course: 'Main Course', notes: 'Less spicy' }
      ] },
      { id: 2, outletId: 2, orderNo: 'ORD-1002', type: 'TABLE', tableNo: 'B01', guestName: 'Walk-in Guest', server: 'Rajan Mehta', status: 'OPEN', kotNo: '', openedAt: '9 min ago', notes: 'Bar counter service', lines: [
        { itemId: 4, name: 'Craft Lager', qty: 2, price: 360, course: 'Beverage', notes: 'Chilled glass' },
        { itemId: 5, name: 'Citrus Mocktail', qty: 1, price: 280, course: 'Beverage', notes: 'Extra ice' }
      ] },
      { id: 3, outletId: 3, orderNo: 'ORD-1003', type: 'ROOM', roomNo: '204', guestName: 'Rohan Malhotra', server: 'Meena Pillai', status: 'HELD', kotNo: 'KOT-502', openedAt: '24 min ago', notes: 'Deliver after 20 minutes', lines: [
        { itemId: 6, name: 'Club Sandwich', qty: 2, price: 390, course: 'Room Service', notes: 'No mayo' },
        { itemId: 7, name: 'Cappuccino', qty: 2, price: 220, course: 'Beverage', notes: 'Extra hot' }
      ] },
      { id: 4, outletId: 1, orderNo: 'ORD-1004', type: 'TABLE', tableNo: 'T04', guestName: 'Amit Shah', server: 'Deepa Thomas', status: 'BILLED', kotNo: 'KOT-499', openedAt: '54 min ago', notes: 'Bill generated', lines: [
        { itemId: 3, name: 'Veg Biryani', qty: 2, price: 480, course: 'Main Course', notes: 'Raita' }
      ] },
      { id: 5, outletId: 4, orderNo: 'ORD-1005', type: 'TAKEAWAY', guestName: 'Cafe Pickup', server: 'Arjun Menon', status: 'OPEN', kotNo: '', openedAt: '5 min ago', notes: 'Pickup at counter', lines: [
        { itemId: 7, name: 'Cappuccino', qty: 3, price: 220, course: 'Beverage', notes: 'Two regular, one oat milk' }
      ] }
    ];
  }

  private sampleDashboardBills(): PosBill[] {
    return [
      { id: 1, orderId: 4, billNo: 'BILL-7001', orderType: 'TABLE', tableNo: 'T04', guestName: 'Amit Shah', subtotal: 960, discount: 50, tax: 46, paid: 956, status: 'PAID', paymentModes: ['Card'], postedToFolio: false },
      { id: 2, orderId: 3, billNo: 'BILL-7002', orderType: 'ROOM', roomNo: '204', guestName: 'Rohan Malhotra', subtotal: 1220, discount: 0, tax: 61, paid: 0, status: 'OPEN', paymentModes: ['Room Charge'], postedToFolio: false },
      { id: 3, orderId: 1, billNo: 'BILL-7003', orderType: 'TABLE', tableNo: 'T01', guestName: 'Nisha Rao', subtotal: 1460, discount: 100, tax: 68, paid: 800, status: 'PARTIAL', paymentModes: ['UPI', 'Cash'], postedToFolio: false },
      { id: 4, orderId: 2, billNo: 'BILL-7004', orderType: 'TABLE', tableNo: 'B01', guestName: 'Walk-in Guest', subtotal: 1000, discount: 0, tax: 126, paid: 1126, status: 'PAID', paymentModes: ['UPI'], postedToFolio: false },
      { id: 5, orderId: 3, billNo: 'BILL-7005', orderType: 'ROOM', roomNo: '204', guestName: 'Rohan Malhotra', subtotal: 520, discount: 0, tax: 26, paid: 0, status: 'PARTIAL', paymentModes: ['Room Charge'], postedToFolio: true }
    ];
  }

  private sampleDashboardAuditLogs(): PosAuditLog[] {
    return [
      { id: 1, at: 'Just now', user: 'Outlet Manager', action: 'KOT sent to kitchen', module: 'Orders', reference: 'ORD-1001' },
      { id: 2, at: '4 min ago', user: 'Rajan Mehta', action: 'Bill settled by UPI', module: 'Billing', reference: 'BILL-7004' },
      { id: 3, at: '9 min ago', user: 'Meena Pillai', action: 'Room service order held', module: 'Room Service', reference: 'Room 204' },
      { id: 4, at: '15 min ago', user: 'Deepa Thomas', action: 'Table marked billed', module: 'Table Dining', reference: 'T04' },
      { id: 5, at: '22 min ago', user: 'Arjun Menon', action: 'Cafe takeaway created', module: 'Orders', reference: 'ORD-1005' }
    ];
  }

  private updateTabFromUrl(url: string): void {
    const last = url.split('/').pop()?.split('?')[0] as PosTab;
    const tab = ['dashboard', 'outlets', 'dining', 'orders', 'billing', 'menu', 'billing-setup'].includes(last) ? last : 'dashboard';
    this.activeTab.set(tab);
    if (tab === 'dining') {
      const outlet = this.outletFilter();
      this.pos.loadTables(outlet === 'ALL' ? undefined : Number(outlet));
    }
    this.search.set('');
    this.statusFilter.set('ALL');
  }
}
