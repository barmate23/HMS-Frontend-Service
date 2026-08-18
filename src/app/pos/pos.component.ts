import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { HotelMastersService, Room } from '../masters/hotel-masters.service';
import { ToastService, formatApiErrorMessage } from '../shared/toast/toast.service';

import {
  ActiveReservationDetails,
  OrderStatus,
  OrderType,
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

import { IngredientCategory, IngredientMaster, RecipeIngredient, RecipeMaster, StorageType } from './models/recipe.model';

type ModalKind = 'outlet' | 'menu' | 'order' | 'bill' | 'table' | 'ingredient' | 'recipe';
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
type BillTaxBucket = { rate: number; cgstRate: number; sgstRate: number; taxableAmount: number; cgst: number; sgst: number; taxAmount: number };
type KitchenQueueItem = PosOrder & { outletDisplayName: string; itemCount: number };

type BillBreakdown = {
  order: PosOrder | null;
  lines: BillLinePreview[];
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
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
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, OnDestroy {
  readonly pos = inject(PosService);
  readonly masters = inject(HotelMastersService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly toast = inject(ToastService);
  private routerSub?: Subscription;


  activeTab = signal<PosTab>('outlets');
  search = signal('');
  outletFilter = signal<number | 'ALL'>(this.pos.selectedOutletId());
  statusFilter = signal<string>('ALL');
  modalKind = signal<ModalKind>('outlet');
  modalMode = signal<ModalMode>('create');
  isModalOpen = signal(false);
  modalErrorMessage = signal('');
  isSubmittingModal = signal(false);

  currentOutlet = signal<Partial<PosOutlet>>({});
  currentMenuItem = signal<Partial<PosMenuItem>>({});
  currentOrder = signal<Partial<PosOrder>>({});
  currentBill = signal<Partial<PosBill>>({});
  selectedBillOutletId = signal<number>(1);
  openOrdersForBill = signal<PosOrder[]>([]);
  currentTable = signal<Partial<PosTable>>({});
  selectedTable = signal<PosTable | null>(null);
  diningAction = signal<DiningAction | null>(null);
  isDiningActionOpen = signal(false);
  deleteTarget = signal<DeleteTarget | null>(null);

  readonly pagedOrderRooms = signal<Room[]>([]);
  readonly orderRoomPage = signal<number>(0);
  readonly orderRoomSize = signal<number>(10);
  readonly orderRoomTotalPages = signal<number>(1);
  readonly isLoadingOrderRooms = signal<boolean>(false);
  readonly hasMoreOrderRooms = signal<boolean>(false);
  diningForm = signal<{ server: string; covers: number; secondaryTableId: number | null; floorId: number | null; roomId: number | null; roomNo: string; guestName: string; bookingTime: string; notes: string; orderType: string }>({
    server: '',
    covers: 2,
    secondaryTableId: null,
    floorId: null,
    roomId: null,
    roomNo: '',
    guestName: '',
    bookingTime: '',
    notes: '',
    orderType: 'ROOM'
  });
  startOrderLines = signal<PosOrderLine[]>([]);
  billingSetupSection = signal<BillingSetupSection>('identity');
  billingSetupEditMode = signal<Record<BillingSetupSection, boolean>>({
    identity: false,
    taxation: false,
    offers: false
  });
  billingSetup = signal({
    legalName: '',
    gstNumber: '',
    panNumber: '',
    invoicePrefix: 'POS',
    placeOfSupply: '',
    defaultTaxProfile: '',
    enableInclusiveTax: false,
    enableRoomPosting: true,
    enableOfferStacking: false
  });
  taxRules = signal<TaxRule[]>([]);
  offerRules = signal<OfferRule[]>([]);

  ingredientCategoryFilter = signal<string>('ALL');

  currentIngredient = signal<IngredientMaster>({
    id: 0,
    code: '',
    name: '',
    category: 'Dairy',
    baseUnit: 'GRAM',
    purchaseUnit: 'KG',
    conversionFactor: 1000,
    yieldPercentage: 95,
    costPerPurchaseUnit: 0,
    costPerBaseUnit: 0,
    currentStock: 0,
    reorderLevel: 0,
    reorderQuantity: 0,
    storageType: 'DRY_STORE',
    supplierName: '',
    isActive: true
  });

  currentRecipe = signal<RecipeMaster>({
    id: 0,
    menuItemId: 0,
    recipeCode: '',
    recipeName: '',
    portionSize: 1,
    portionUnit: 'PLATE',
    prepTimeMins: 15,
    ingredients: [],
    totalPortionCost: 0,
    sellingPrice: 0,
    foodCostPercent: 0,
    grossMarginPercent: 0,
    instructions: '',
    isActive: true
  });

  recipeIngredientRows = signal<RecipeIngredient[]>([]);

  selectedRecipeForView = signal<RecipeMaster | null>(null);
  isRecipeViewModalOpen = signal<boolean>(false);

  selectedBillForView = signal<PosBill | null>(null);
  isViewBillModalOpen = signal<boolean>(false);
  isLoadingViewBill = signal<boolean>(false);

  readonly activeRoomReservation = signal<ActiveReservationDetails | null>(null);
  readonly isLoadingActiveReservation = signal<boolean>(false);

  activeIngredientDropdownIndex = signal<number | null>(null);
  ingredientSearchQuery = signal<string>('');

  filteredIngredients = computed(() => {
    let list = this.pos.ingredients();
    const cat = this.ingredientCategoryFilter();
    const query = this.search().trim().toLowerCase();

    if (cat !== 'ALL') {
      list = list.filter(item => item.category === cat);
    }
    if (query) {
      list = list.filter(item => item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.category.toLowerCase().includes(query));
    }
    return list;
  });

  ingredientStats = computed(() => {
    const list = this.pos.ingredients();
    const lowStock = list.filter(item => item.currentStock <= item.reorderLevel).length;
    const categories = new Set(list.map(item => item.category)).size;
    const totalValue = list.reduce((sum, item) => sum + (item.currentStock * item.costPerBaseUnit), 0);
    return { total: list.length, lowStock, categories, totalValue };
  });

  filteredRecipes = computed(() => {
    let list = this.pos.recipes();
    const query = this.search().trim().toLowerCase();
    if (query) {
      list = list.filter(item => item.recipeName.toLowerCase().includes(query) || item.recipeCode.toLowerCase().includes(query));
    }
    return list;
  });

  recipeStats = computed(() => {
    const list = this.pos.recipes();
    if (!list.length) return { total: 0, avgFoodCost: 0, avgMargin: 0, highMargin: 0 };
    const avgFoodCost = (list.reduce((sum, r) => sum + r.foodCostPercent, 0) / list.length).toFixed(1);
    const avgMargin = (list.reduce((sum, r) => sum + r.grossMarginPercent, 0) / list.length).toFixed(1);
    const highMargin = list.filter(r => r.grossMarginPercent >= 65).length;
    return { total: list.length, avgFoodCost, avgMargin, highMargin };
  });

  readonly dashboardOutlets = computed(() => this.pos.outlets());
  readonly dashboardMenuItems = computed(() => this.pos.menuItems());
  readonly dashboardTables = computed(() => this.pos.tables());
  readonly dashboardOrders = computed(() => this.pos.orders());
  readonly dashboardBills = computed(() => this.pos.bills());
  readonly dashboardAuditLogs = computed(() => {
    const activity = this.pos.posDashboard()?.recentActivity;
    if (activity && activity.length > 0) {
      return activity.map((item, index) => ({
        id: index + 1,
        at: this.dashboardTimeLabel(item.timestamp),
        user: 'POS User',
        action: item.activityType || 'POS activity',
        module: 'Orders',
        reference: item.linkedEntityId || '-'
      }));
    }
    return this.pos.auditLogs();
  });

  stats = computed(() => {
    const cards = this.pos.posDashboardCards();
    // Prefer accurate backend API values when available
    if (cards) {
      return {
        outlets: Number(cards.activeOutlets ?? 0),
        orders: Number(cards.openOrders ?? 0),
        kot: Number(cards.kotRunning ?? 0),
        bills: Number(cards.bills ?? 0),
        roomPostings: Number(cards.roomPostings ?? 0),
        sales: Number(cards.grossSales ?? 0)
      };
    }
    // Fallback: compute from local signals while API loads
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
    if (floorPulse && (floorPulse.totalTables || 0) > 0) {
      const rows = [
        { status: 'OCCUPIED', count: Number(floorPulse.occupied || 0), percent: Math.round(Number(floorPulse.occupiedPercent || 0)) },
        { status: 'AVAILABLE', count: Number(floorPulse.available || 0), percent: Math.round(Number(floorPulse.availablePercent || 0)) },
        { status: 'RESERVED', count: Number(floorPulse.reserved || 0), percent: Math.round(Number(floorPulse.reservedPercent || 0)) }
      ];
      return rows
        .filter(row => row.count > 0 || row.percent > 0)
        .map(row => ({
          ...row,
          icon: this.tableStatusIcon(row.status),
          color: this.tableStatusColor(row.status)
        }));
    }

    const tables = this.pos.tables();
    if (!tables.length) return [];

    const statuses = new Map<string, number>();
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
    const data = this.pos.posDashboard();
    const revenueMix = data?.revenueMix;

    if (revenueMix && revenueMix.length > 0) {
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

    const outlets = this.pos.outlets();
    const bills = this.pos.bills().filter(item => item.status !== 'VOID');
    if (!outlets.length || !bills.length) return [];

    const ordersById = new Map(this.pos.orders().map(order => [order.id, order]));
    const totals = new Map<number, { outletId: number; name: string; amount: number; orders: number }>();

    for (const outlet of outlets) {
      totals.set(outlet.id, { outletId: outlet.id, name: outlet.name, amount: 0, orders: 0 });
    }

    for (const bill of bills) {
      const order = ordersById.get(Number(bill.orderId));
      const outletId = Number(order?.outletId || outlets[0]?.id || 0);
      const current = totals.get(outletId) || { outletId, name: this.outletName(outletId), amount: 0, orders: 0 };
      current.amount += this.billTotal(bill);
      current.orders += 1;
      totals.set(outletId, current);
    }

    const rows = Array.from(totals.values()).filter(row => row.amount > 0 || row.orders > 0).sort((a, b) => b.amount - a.amount || b.orders - a.orders).slice(0, 5);
    if (!rows.length) return [];
    const max = Math.max(1, ...rows.map(row => row.amount));
    return rows.map(row => ({ ...row, width: Math.max(6, Math.round((row.amount / max) * 100)) }));
  });

  paymentMix = computed(() => {
    const data = this.pos.posDashboard();
    const paymentSplit = data?.paymentSplit;

    if (paymentSplit && paymentSplit.length > 0) {
      return paymentSplit
        .map(row => ({
          mode: row.method || 'Unspecified',
          amount: Number(row.amount || 0),
          percent: Math.round(Number(row.percentage || 0))
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    const bills = this.pos.bills().filter(item => item.status !== 'VOID');
    if (!bills.length) return [];

    const totals = new Map<string, number>();
    for (const bill of bills) {
      const amount = this.billTotal(bill);
      const modes = bill.paymentModes.length ? bill.paymentModes : ['Cash'];
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
    const data = this.pos.posDashboard();
    const fastMovingItems = data?.fastMovingItems;

    if (fastMovingItems && fastMovingItems.length > 0) {
      return fastMovingItems.map((item, index) => {
        const menuItem = this.pos.menuItems().find(m => m.name.toLowerCase() === (item.itemName || '').toLowerCase());
        return {
          itemId: menuItem?.id || index + 1,
          name: item.itemName || `Item ${index + 1}`,
          qty: Number(item.soldQty || 0),
          revenue: menuItem ? menuItem.price * Number(item.soldQty || 0) : 0,
          outlet: item.outletName || 'Outlet',
          imageUrl: item.imageUrl || menuItem?.imageUrl || this.menuImage(menuItem || {})
        };
      });
    }

    const orders = this.pos.orders();
    const menuItems = this.pos.menuItems();
    if (!orders.length || !menuItems.length) return [];

    const menuById = new Map(menuItems.map(item => [item.id, item]));
    const totals = new Map<number, { itemId: number; name: string; qty: number; revenue: number; outlet: string; imageUrl: string }>();

    for (const order of orders) {
      for (const line of order.lines) {
        const menuItem = menuById.get(line.itemId);
        const current = totals.get(line.itemId) || {
          itemId: line.itemId,
          name: line.name,
          qty: 0,
          revenue: 0,
          outlet: this.outletName(order.outletId),
          imageUrl: menuItem?.imageUrl || this.menuImage(menuItem || {})
        };
        current.qty += Number(line.qty || 0);
        current.revenue += Number(line.qty || 0) * Number(line.price || 0);
        totals.set(line.itemId, current);
      }
    }
    return Array.from(totals.values()).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5);
  });

  kitchenQueue = computed<KitchenQueueItem[]>(() => {
    const data = this.pos.posDashboard();
    const queue = data?.kotQueue;

    if (queue && queue.length > 0) {
      return queue.map((item, index): KitchenQueueItem => {
        const infoParts = String(item.info || '').split('•').map(p => p.trim()).filter(Boolean);
        const tableOrRoom = infoParts[0] || '';
        const guestOrServer = infoParts[1] || '';
        const matchingOutlet = this.pos.outlets().find(o => o.name.toLowerCase() === (item.outletName || '').toLowerCase());
        const isRoom = tableOrRoom.startsWith('RM') || tableOrRoom.startsWith('Room');
        const orderType: OrderType = isRoom ? 'ROOM' : 'TABLE';
        const itemCount = Number(item.itemCount || 0);
        const rawStatus = String(item.status || 'OPEN').toUpperCase();
        const status: OrderStatus = rawStatus === 'OPEN' ? 'OPEN' : rawStatus === 'KOT_SENT' ? 'KOT_SENT' : 'OPEN';

        return {
          id: index + 1,
          outletId: matchingOutlet?.id || this.pos.outlets()[0]?.id || 1,
          outletDisplayName: item.outletName || matchingOutlet?.name || 'Grand Palace Hotel',
          orderNo: item.orderId || `ORD-${index + 1}`,
          type: orderType,
          tableNo: isRoom ? '' : tableOrRoom,
          roomNo: isRoom ? tableOrRoom : '',
          guestName: guestOrServer,
          server: guestOrServer || 'Staff',
          status,
          openedAt: 'Just now',
          notes: item.info || '',
          lines: itemCount ? [{ itemId: index + 1, name: 'Item', qty: itemCount, price: 0, course: 'Main', notes: '' }] : [],
          itemCount
        };
      });
    }

    return this.pos.orders()
      .filter(order => !['BILLED', 'CANCELLED'].includes(order.status))
      .slice(0, 6)
      .map((order): KitchenQueueItem => ({
        ...order,
        outletDisplayName: this.outletName(order.outletId),
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

    const bills = this.pos.bills();
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
      const matchOutlet = String(outlet) === 'ALL' || item.outletId === Number(outlet);
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
      const matchOutlet = String(outlet) === 'ALL' || order.outletId === Number(outlet);
      const matchStatus = status === 'ALL' || order.status === status;
      const matchQuery = !q || order.orderNo.toLowerCase().includes(q) || (order.tableNo || '').toLowerCase().includes(q) || (order.roomNo || '').toLowerCase().includes(q) || (order.guestName || '').toLowerCase().includes(q) || order.server.toLowerCase().includes(q);
      return matchOutlet && matchStatus && matchQuery;
    }).sort((a, b) => b.id - a.id);
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
    const q = this.search().toLowerCase().trim();
    const outlet = this.outletFilter();
    return this.pos.tables().filter(table => {
      const matchOutlet = String(outlet) === 'ALL' || table.outletId === Number(outlet);
      const matchQuery = !q ||
        table.number.toLowerCase().includes(q) ||
        table.section.toLowerCase().includes(q) ||
        table.server.toLowerCase().includes(q) ||
        (table.guestName || '').toLowerCase().includes(q) ||
        (table.status || '').toLowerCase().includes(q);
      return matchOutlet && matchQuery;
    });
  });

  onOutletFilterChange(val: any): void {
    const newFilter = Number(val);
    if (newFilter && !isNaN(newFilter)) {
      this.outletFilter.set(newFilter);
      this.pos.setSelectedOutletId(newFilter);
      this.reloadTabApis(this.activeTab());
    }
  }


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
    const allItems = this.pos.menuItems();
    const items = allItems.filter(item => item.outletId === outletId && item.available);
    if (items.length) return items;
    return allItems.filter(item => item.available);
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
    const paged = this.pagedOrderRooms();
    if (paged.length > 0) return paged;
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

  currentBillStatus = computed(() => {
    const current = this.currentBill().status || '';
    // Default to 'Paid' for new bills with no status
    if (!current) return 'Paid';
    const available = this.availableBillStatuses();
    const matched = available.find(s => s.toLowerCase() === current.toLowerCase());
    return matched || current;
  });

  availableBillStatuses = computed(() => {
    const statuses = this.pos.billStatuses();
    const bill = this.currentBill();
    const isRoomOrder = bill.isRoomOrder ?? (bill.orderType === 'ROOM' || !!bill.roomId || !!bill.roomNo);

    if (!isRoomOrder) {
      return statuses.filter(s => s.toLowerCase() !== 'posted');
    }
    return statuses;
  });

  currentBillIsRoomOrder = computed(() => {
    const bill = this.currentBill();
    if (bill.isRoomOrder) return true;
    if (bill.orderType === 'ROOM' || !!bill.roomId || !!bill.roomNo) return true;
    const order = this.billOrder(bill);
    if (order && (order.type === 'ROOM' || !!order.roomId || !!order.roomNo)) return true;
    return false;
  });


  billsPaginationRangeLabel = computed(() => {
    const total = this.pos.billsTotalRecords();
    if (total === 0) return 'Showing 0 of 0 bills';
    const page = this.pos.billsPage();
    const size = this.pos.billsPageSize();
    const start = page * size + 1;
    const end = Math.min((page + 1) * size, total);
    return `Showing ${start} - ${end} of ${total} bills`;
  });

  prevBillsPage(): void {
    const currentPage = this.pos.billsPage();
    if (currentPage > 0) {
      this.pos.loadBills(this.statusFilter(), currentPage - 1, this.pos.billsPageSize());
    }
  }

  nextBillsPage(): void {
    const currentPage = this.pos.billsPage();
    const totalPages = this.pos.billsTotalPages();
    if (currentPage + 1 < totalPages) {
      this.pos.loadBills(this.statusFilter(), currentPage + 1, this.pos.billsPageSize());
    }
  }

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
    this.activeTab.set(tab);
    this.router.navigate([`/pos/${tab}`]);
  }


  openCreate(kind: ModalKind): void {
    this.modalKind.set(kind);
    this.modalMode.set('create');
    if (kind === 'outlet') this.currentOutlet.set({ name: '', type: this.pos.outletTypes()[0] || 'Restaurant', location: '', timing: this.pos.shiftSchedules()[0] || '09:00 AM - 09:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Outlet Manager' });
    if (kind === 'menu') this.currentMenuItem.set({ outletId: this.defaultOutletId(), name: '', category: this.pos.menuCategories()[0] || 'Food', subcategory: this.pos.menuSubcategories()[0] || '', price: 0, taxPercent: 0, variants: [], modifiers: [], available: true, featured: false, stockItem: '', imageUrl: '' });
    if (kind === 'order') {
      const outletId = this.defaultOutletId();
      this.pos.loadMenuItems(outletId);
      this.pos.loadTables(outletId);
      const table = this.pos.tables().find(item => item.outletId === outletId);
      this.currentOrder.set({ outletId, type: 'TABLE', orderType: 'TABLE', tableNo: table?.number || '', roomNo: '', guestName: '', server: 'Unassigned', status: this.pos.orderStatuses()[0] || 'OPEN', notes: '', lines: [] });
    }
    if (kind === 'bill') {
      const outletId = String(this.outletFilter()) !== 'ALL' ? Number(this.outletFilter()) : this.defaultOutletId();
      this.selectedBillOutletId.set(outletId);
      this.currentBill.set({
        orderId: 0,
        status: this.pos.billStatuses()[0] || 'OPEN',
        paymentModes: [this.pos.paymentModes()[0] || 'Cash'],
        discount: 0,
        paid: 0
      });
      this.loadOpenOrdersForBill(outletId);
    }
    if (kind === 'table') this.currentTable.set({ outletId: this.defaultOutletId(), number: '', section: this.pos.tableSections()[0] || 'Indoor', status: this.pos.tableStatuses()[0] || 'AVAILABLE', covers: 0, server: 'Unassigned', mergedWith: '' });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  isOrderBilled(order: PosOrder | any): boolean {
    if (!order || !order.status) return false;
    const s = String(order.status).toUpperCase().trim();
    return s === 'BILLED' || s === 'PAID' || s === 'COMPLETED' || s === 'CLOSED' || s.includes('BILLED') || s.includes('PAID');
  }

  openEdit(kind: ModalKind, item: any): void {
    this.modalKind.set(kind);
    this.modalMode.set('edit');
    if (kind === 'outlet') this.currentOutlet.set({ ...item });
    if (kind === 'menu') this.currentMenuItem.set({ ...item, variants: [...item.variants], modifiers: [...item.modifiers] });
    if (kind === 'order') {
      if (this.isOrderBilled(item)) {
        this.toast.warning(`Order ${item.orderNo || ''} is BILLED and cannot be edited.`, 'Order Finalized');
        return;
      }
      this.pos.loadMenuItems(item.outletId);
      this.pos.loadTables(item.outletId);
      this.currentOrder.set({ ...item, lines: item.lines.map((line: PosOrderLine) => ({ ...line })) });
      if (item.type === 'ROOM') {
        const floorId = item.floorId || null;
        this.loadOrderRoomsPage(floorId, 0, this.orderRoomSize(), false);
      }
    }
    if (kind === 'bill') {
      const order = this.pos.orders().find(value => value.id === Number(item.orderId));
      const outletId = order?.outletId || this.defaultOutletId();
      this.selectedBillOutletId.set(outletId);
      const synced = this.billDraftForOrder(order, item);
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
      this.loadOpenOrdersForBill(outletId, Number(item.orderId));
    }
    if (kind === 'table') this.currentTable.set({ ...item });
    this.modalErrorMessage.set('');
    this.isSubmittingModal.set(false);
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openBillFromOrder(order: PosOrder): void {
    this.modalKind.set('bill');
    this.modalMode.set('create');
    this.currentBill.set(this.billDraftForOrder(order, { status: this.pos.billStatuses()[0] || 'OPEN', paymentModes: [this.pos.paymentModes()[0] || 'Cash'], discount: 0, paid: 0 }));
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  private currentTimeValue(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    document.body.style.overflow = '';
  }

  saveModal(): void {
    const kind = this.modalKind();
    this.modalErrorMessage.set('');

    if (kind === 'table') {
      const table = this.currentTable() as PosTable;
      if (!table.number || !table.number.trim()) {
        const msg = 'Table Number is required.';
        this.modalErrorMessage.set(msg);
        this.toast.error(msg, 'Validation Error');
        return;
      }

      this.isSubmittingModal.set(true);
      this.pos.saveTable(table).subscribe({
        next: (savedTable) => {
          this.toast.success(`Table "${savedTable.number}" saved successfully!`, 'Table Saved');
          this.isSubmittingModal.set(false);
          this.closeModal();
        },
        error: err => {
          const errMsg = err.message || formatApiErrorMessage(err, 'Failed to save dining table.');
          this.modalErrorMessage.set(errMsg);
          this.toast.error(errMsg, 'Table Creation Failed');
          this.isSubmittingModal.set(false);
        }
      });
      return;
    }

    if (kind === 'outlet') this.pos.saveOutlet(this.currentOutlet());
    if (kind === 'menu') this.pos.saveMenuItem(this.currentMenuItem());
    if (kind === 'order') {
      const order = this.currentOrder();
      if (this.isOrderBilled(order)) {
        this.toast.warning('Billed orders cannot be modified.', 'Order Finalized');
        return;
      }
      this.pos.saveOrder(order);
      this.closeModal();
    }
    if (kind === 'bill') {
      const order = this.billOrder(this.currentBill());
      const draft = this.billDraftForOrder(order, this.currentBill());
      const breakdown = this.billBreakdown({ ...draft, orderId: order?.id || draft.orderId });
      const effectiveGstRate = breakdown.taxBuckets[0]?.rate || 18;

      this.pos.saveBill({
        ...draft,
        subtotal: Number(breakdown.taxableSubtotal.toFixed(2)),
        tax: effectiveGstRate,
        taxAmount: Number(breakdown.taxTotal.toFixed(2)),
        paid: Number(draft.paid || breakdown.total)
      });
    }
    if (kind === 'ingredient') {
      const ing = this.currentIngredient();
      const conv = Math.max(1, Number(ing.conversionFactor || 1));
      const costPerBase = Number(ing.costPerPurchaseUnit || 0) / conv;
      this.pos.saveIngredient({ ...ing, conversionFactor: conv, costPerBaseUnit: costPerBase });
    }
    if (kind === 'recipe') {
      const rec = this.currentRecipe();
      const rows = this.recipeIngredientRows();

      const ingredientIds = rows.map(r => r.ingredientId);
      const uniqueIds = new Set(ingredientIds);
      if (uniqueIds.size !== ingredientIds.length) {
        this.toast.error('Duplicate ingredients detected! Each ingredient can only be added once per recipe.', 'Validation Error');
        return;
      }

      const totalPortionCost = rows.reduce((sum, r) => sum + (r.lineCost || 0), 0);
      const sellingPrice = Number(rec.sellingPrice || 0);
      const foodCostPercent = sellingPrice > 0 ? Number(((totalPortionCost / sellingPrice) * 100).toFixed(1)) : 0;
      const grossMarginPercent = sellingPrice > 0 ? Number((((sellingPrice - totalPortionCost) / sellingPrice) * 100).toFixed(1)) : 0;

      this.pos.saveRecipe({
        ...rec,
        ingredients: rows,
        totalPortionCost: Number(totalPortionCost.toFixed(2)),
        foodCostPercent,
        grossMarginPercent
      });
    }
    this.closeModal();
  }

  openCreateIngredient(): void {
    this.modalKind.set('ingredient');
    this.modalMode.set('create');
    this.currentIngredient.set({
      id: 0,
      code: '',
      name: '',
      category: 'Dairy',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 95,
      costPerPurchaseUnit: 100,
      costPerBaseUnit: 0.10,
      currentStock: 5000,
      reorderLevel: 2000,
      reorderQuantity: 10000,
      storageType: 'DRY_STORE',
      supplierName: '',
      isActive: true
    });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEditIngredient(ing: IngredientMaster): void {
    this.modalKind.set('ingredient');
    this.modalMode.set('edit');
    this.currentIngredient.set({ ...ing });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  onIngredientCategoryChange(value: string): void {
    const master = this.pos.ingredientCategoryMasters().find(m => (m.value || m.name || m.code) === value);
    this.currentIngredient.update(ing => ({
      ...ing,
      category: value as any,
      categoryId: master?.id ? Number(master.id) : ing.categoryId
    }));
  }

  onBaseUnitChange(value: string): void {
    const master = this.pos.baseUnitMasters().find(m => (m.value || m.name || m.code) === value);
    this.currentIngredient.update(ing => ({
      ...ing,
      baseUnit: value,
      baseUnitId: master?.id ? Number(master.id) : ing.baseUnitId
    }));
  }

  onPurchaseUnitChange(value: string): void {
    const master = this.pos.purchaseUnitMasters().find(m => (m.value || m.name || m.code) === value);
    this.currentIngredient.update(ing => ({
      ...ing,
      purchaseUnit: value,
      purchaseUnitId: master?.id ? Number(master.id) : ing.purchaseUnitId
    }));
  }

  onStorageTypeChange(value: string): void {
    const master = this.pos.storageTypeMasters().find(m => (m.value || m.name || m.code) === value);
    this.currentIngredient.update(ing => ({
      ...ing,
      storageType: value as any,
      storageTypeId: master?.id ? Number(master.id) : ing.storageTypeId
    }));
  }

  openCreateRecipe(): void {
    this.modalKind.set('recipe');
    this.modalMode.set('create');
    const firstMenuItem = this.pos.menuItems()[0];
    this.currentRecipe.set({
      id: 0,
      menuItemId: firstMenuItem?.id || 1,
      recipeCode: '',
      recipeName: firstMenuItem ? `${firstMenuItem.name} Recipe` : 'New Dish Recipe',
      portionSize: 1,
      portionUnit: 'PLATE',
      prepTimeMins: 20,
      ingredients: [],
      totalPortionCost: 0,
      sellingPrice: firstMenuItem?.price || 250,
      foodCostPercent: 0,
      grossMarginPercent: 0,
      instructions: '',
      isActive: true
    });
    this.recipeIngredientRows.set([]);
    this.addIngredientRowToRecipe();
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEditRecipe(recipe: RecipeMaster): void {
    this.modalKind.set('recipe');
    this.modalMode.set('edit');
    this.currentRecipe.set({ ...recipe });
    this.recipeIngredientRows.set([...recipe.ingredients]);
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openRecipeDetails(recipe: RecipeMaster): void {
    this.selectedRecipeForView.set(recipe);
    this.isRecipeViewModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeRecipeDetails(): void {
    this.selectedRecipeForView.set(null);
    this.isRecipeViewModalOpen.set(false);
    if (!this.isModalOpen() && !this.isDiningActionOpen()) document.body.style.overflow = '';
  }

  openViewBill(bill: PosBill): void {
    this.isLoadingViewBill.set(true);
    this.selectedBillForView.set(bill);
    this.isViewBillModalOpen.set(true);
    document.body.style.overflow = 'hidden';

    this.pos.getBillById(bill.id).subscribe({
      next: fullBill => {
        this.isLoadingViewBill.set(false);
        if (fullBill) {
          this.selectedBillForView.set(fullBill);
        }
      },
      error: () => {
        this.isLoadingViewBill.set(false);
      }
    });
  }

  closeViewBillModal(): void {
    this.selectedBillForView.set(null);
    this.isViewBillModalOpen.set(false);
    if (!this.isModalOpen() && !this.isDiningActionOpen() && !this.isRecipeViewModalOpen()) {
      document.body.style.overflow = '';
    }
  }

  printBillReceipt(): void {
    window.print();
  }

  onRecipeMenuItemChange(menuItemId: number): void {
    const item = this.pos.menuItems().find(m => m.id === Number(menuItemId));
    if (item) {
      this.currentRecipe.update(rec => ({
        ...rec,
        menuItemId: item.id,
        recipeName: `${item.name} Recipe`,
        sellingPrice: item.price
      }));
    }
  }

  addIngredientRowToRecipe(): void {
    const existingIds = new Set(this.recipeIngredientRows().map(r => r.ingredientId));
    const availableIng = this.pos.ingredients().find(i => !existingIds.has(i.id)) || this.pos.ingredients()[0];
    if (!availableIng) return;

    if (existingIds.has(availableIng.id)) {
      this.snackBar.open('All available ingredients are already added to this recipe.', 'Close', {
        duration: 4000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }

    const netQty = 100;
    const yieldPct = Math.max(1, availableIng.yieldPercentage || 100);
    const grossQty = Number((netQty / (yieldPct / 100)).toFixed(2));
    const unitCost = availableIng.costPerBaseUnit;
    const lineCost = Number((grossQty * unitCost).toFixed(2));

    const newRow: RecipeIngredient = {
      ingredientId: availableIng.id,
      ingredientCode: availableIng.code,
      ingredientName: availableIng.name,
      category: availableIng.category,
      netQuantity: netQty,
      unit: availableIng.baseUnit,
      wastePercent: 100 - yieldPct,
      grossQuantity: grossQty,
      unitCost: unitCost,
      lineCost: lineCost
    };
    this.recipeIngredientRows.update(rows => [...rows, newRow]);
    this.recalculateRecipeTotals();

    setTimeout(() => {
      const container = document.querySelector('.ingredient-rows-table-wrapper');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  isIngredientSelectedInOtherRow(ingredientId: number, rowIndex: number): boolean {
    return this.recipeIngredientRows().some((r, i) => i !== rowIndex && r.ingredientId === ingredientId);
  }

  trackByRowIndex(index: number, _item: any): any {
    return index;
  }

  getCategoryLabel(category?: string): string {
    if (!category) return 'Dairy';
    const upper = String(category).trim().toUpperCase();
    if (upper.includes('SPICE') || upper.includes('COND') || upper.includes('MASALA')) {
      return 'Spices & Condiments';
    }
    if (upper.includes('POULTRY') || upper.includes('MEAT') || upper.includes('CHICKEN') || upper.includes('MUTTON')) {
      return 'Poultry & Meat';
    }
    if (upper.includes('PRODUCE') || upper.includes('VEG') || upper.includes('FRUIT')) {
      return 'Produce';
    }
    if (upper.includes('OIL') || upper.includes('GHEE') || upper.includes('FAT')) {
      return 'Oils & Ghee';
    }
    if (upper.includes('DRY') || upper.includes('GROCERY') || upper.includes('GRAIN')) {
      return 'Dry Grocery';
    }
    if (upper.includes('BEV') || upper.includes('DRINK') || upper.includes('JUICE')) {
      return 'Beverage Raw';
    }
    if (upper.includes('DAIRY') || upper.includes('MILK') || upper.includes('CHEESE') || upper.includes('PANEER')) {
      return 'Dairy';
    }
    return category;
  }

  activeRowDropdownIndex = signal<number | null>(null);
  dropdownStyle = signal<{ top: string; left: string; width: string }>({ top: '0px', left: '0px', width: '290px' });

  toggleRowDropdown(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.activeRowDropdownIndex() === index) {
      this.activeRowDropdownIndex.set(null);
    } else {
      if (!this.pos.ingredients().length) {
        this.pos.loadIngredients(0, 20);
      }
      this.activeRowDropdownIndex.set(index);
      this.ingredientSearchQuery.set('');

      const rawTarget = event?.target as HTMLElement;
      const target = rawTarget?.closest('.ingredient-dropdown-trigger') as HTMLElement || (event?.currentTarget as HTMLElement) || rawTarget;
      if (target) {
        const rect = target.getBoundingClientRect();
        const dropdownHeight = 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let top: number;
        if (spaceBelow >= 140 || spaceBelow >= spaceAbove) {
          top = rect.bottom + 4;
        } else {
          top = Math.max(10, rect.top - dropdownHeight - 4);
        }

        const dropdownWidth = Math.max(300, rect.width);
        const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 16);

        this.dropdownStyle.set({
          top: `${top}px`,
          left: `${Math.max(10, left)}px`,
          width: `${dropdownWidth}px`
        });
      }
    }
  }

  closeRowDropdown(): void {
    this.activeRowDropdownIndex.set(null);
  }

  selectRowIngredient(rowIndex: number, ing: IngredientMaster): void {
    if (this.isIngredientSelectedInOtherRow(ing.id, rowIndex)) {
      this.snackBar.open(`"${ing.name}" is already added to this recipe. Duplicate ingredients are not allowed.`, 'Close', {
        duration: 4000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });
      return;
    }
    this.updateRecipeIngredientRow(rowIndex, 'ingredientId', ing.id);
    this.closeRowDropdown();
  }

  onIngredientSearch(query: string): void {
    const q = query || '';
    this.ingredientSearchQuery.set(q);
    this.pos.loadIngredients(0, 20, false, q);
  }

  onIngredientDropdownScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 25;
    if (nearBottom && !this.pos.ingredientsLoading() && this.pos.ingredientsPage() < this.pos.ingredientsTotalPages() - 1) {
      this.pos.loadIngredients(this.pos.ingredientsPage() + 1, 20, true);
    }
  }

  recipeDropdownFilteredIngredients = computed(() => {
    const query = (this.ingredientSearchQuery() || '').toLowerCase().trim();
    const all = this.pos.ingredients();
    if (!query) return all;
    return all.filter(ing =>
      (ing.name || '').toLowerCase().includes(query) ||
      (ing.code || '').toLowerCase().includes(query) ||
      (ing.category || '').toLowerCase().includes(query)
    );
  });

  getRowIngredientOptions(currentIngredientId?: number): IngredientMaster[] {
    const filtered = this.recipeDropdownFilteredIngredients();
    if (!currentIngredientId) return filtered;
    const selected = this.pos.ingredients().find(i => i.id === Number(currentIngredientId));
    if (selected && !filtered.some(f => f.id === selected.id)) {
      return [selected, ...filtered];
    }
    return filtered;
  }

  getSelectedIngredientLabel(ingredientId?: number): string {
    if (!ingredientId) return '-- Select Ingredient --';
    const ing = this.pos.ingredients().find(i => i.id === Number(ingredientId));
    return ing ? `${ing.name} (₹${ing.costPerBaseUnit}/${ing.baseUnit})` : `Ingredient #${ingredientId}`;
  }

  selectIngredientForRecipeRow(rowAreaIndex: number, ing: IngredientMaster): void {
    this.updateRecipeIngredientRow(rowAreaIndex, 'ingredientId', ing.id);
    this.closeRowDropdown();
  }

  removeIngredientRowFromRecipe(index: number): void {
    this.recipeIngredientRows.update(rows => rows.filter((_, i) => i !== index));
    this.recalculateRecipeTotals();
  }

  updateRecipeIngredientRow(index: number, field: string, value: any): void {
    if (field === 'ingredientId') {
      const selectedId = Number(value);
      const isDuplicate = this.recipeIngredientRows().some((row, i) => i !== index && row.ingredientId === selectedId);
      if (isDuplicate) {
        const ing = this.pos.ingredients().find(i => i.id === selectedId);
        const name = ing?.name || 'This ingredient';
        this.snackBar.open(`"${name}" is already added to this recipe. Duplicate ingredients are not allowed.`, 'Close', {
          duration: 4000,
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
        return;
      }
    }

    this.recipeIngredientRows.update(rows => {
      const updated = [...rows];
      const row = { ...updated[index] };
      if (field === 'ingredientId') {
        const ing = this.pos.ingredients().find(i => i.id === Number(value));
        if (ing) {
          row.ingredientId = ing.id;
          row.ingredientCode = ing.code;
          row.ingredientName = ing.name;
          row.category = ing.category;
          row.unit = ing.baseUnit;
          row.unitCost = ing.costPerBaseUnit;
          row.wastePercent = 100 - ing.yieldPercentage;
        }
      }
      if (field === 'netQuantity') row.netQuantity = Number(value || 0);
      if (field === 'wastePercent') row.wastePercent = Number(value || 0);

      const yieldPct = Math.max(1, 100 - row.wastePercent);
      row.grossQuantity = Number((row.netQuantity / (yieldPct / 100)).toFixed(2));
      row.lineCost = Number((row.grossQuantity * row.unitCost).toFixed(2));
      updated[index] = row;
      return updated;
    });
    this.recalculateRecipeTotals();
  }

  recalculateRecipeTotals(): void {
    const totalCost = this.recipeIngredientRows().reduce((sum, r) => sum + (r.lineCost || 0), 0);
    const sellingPrice = Number(this.currentRecipe().sellingPrice || 0);
    const foodCostPct = sellingPrice > 0 ? Number(((totalCost / sellingPrice) * 100).toFixed(1)) : 0;
    const grossMarginPct = sellingPrice > 0 ? Number((((sellingPrice - totalCost) / sellingPrice) * 100).toFixed(1)) : 0;

    this.currentRecipe.update(rec => ({
      ...rec,
      totalPortionCost: Number(totalCost.toFixed(2)),
      foodCostPercent: foodCostPct,
      grossMarginPercent: grossMarginPct
    }));
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

  deleteIngredient(id: number): void {
    const item = this.pos.ingredients().find(i => i.id === id);
    this.openDeleteConfirm({
      kind: 'ingredient' as any,
      id,
      title: item?.name || 'Ingredient',
      message: 'This raw ingredient will be removed from the Ingredient Master catalog.'
    });
  }

  deleteRecipe(id: number): void {
    const recipe = this.pos.recipes().find(r => r.id === id);
    this.openDeleteConfirm({
      kind: 'recipe' as any,
      id,
      title: recipe?.recipeName || 'Recipe',
      message: 'This dish recipe (BOM) will be permanently deleted.'
    });
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
    if ((target.kind as string) === 'ingredient') this.pos.deleteIngredient(target.id);
    if ((target.kind as string) === 'recipe') this.pos.deleteRecipe(target.id);
    this.closeDeleteConfirm();
  }

  toggleOutlet(outlet: PosOutlet): void {
    this.pos.saveOutlet({ ...outlet, active: !outlet.active });
  }

  toggleMenuAvailability(item: PosMenuItem): void {
    this.pos.saveMenuItem({ ...item, available: !item.available });
  }

  updateOrderStatus(order: PosOrder, status: OrderStatus): void {
    if (this.isOrderBilled(order)) {
      this.toast.warning(`Order ${order.orderNo || ''} is BILLED and cannot be modified.`, 'Order Finalized');
      return;
    }
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
    this.pos.loadMenuItems(outletId);
    this.pos.loadTables(outletId);
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
      this.currentOrder.update(order => ({ ...order, type: value, orderType: value, tableNo: firstTable?.number || '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
      return;
    }

    if (value === 'ROOM') {
      const firstFloor = this.orderRoomFloors()[0] || null;
      this.currentOrder.update(order => ({
        ...order,
        type: value,
        orderType: value,
        outletId: this.roomServiceOutletId(),
        tableNo: '',
        floorId: firstFloor?.id || null,
        roomId: null,
        roomNo: '',
        guestName: order.guestName || ''
      }));
      this.loadOrderRoomsPage(firstFloor?.id || null, 0, this.orderRoomSize(), true);
      return;
    }

    this.currentOrder.update(order => ({ ...order, type: value, orderType: value, tableNo: '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
  }

  updateOrderTable(value: string): void {
    this.currentOrder.update(order => ({ ...order, tableNo: value }));
  }

  loadOrderRoomsPage(floorId: number | null, page: number, size: number, resetFirstRoom: boolean = false): void {
    if (this.isLoadingOrderRooms()) return;
    this.isLoadingOrderRooms.set(true);

    this.pos.fetchRoomsByFloor(floorId, page, size).subscribe({
      next: response => {
        this.isLoadingOrderRooms.set(false);
        const dataList = response?.data || response || [];
        const rooms: Room[] = (Array.isArray(dataList) ? dataList : []).map((r: any) => ({
          id: Number(r.id),
          roomNumber: String(r.roomNumber || r.number || r.id),
          floorId: Number(r.floorId || floorId || 0),
          roomTypeId: Number(r.roomTypeId || r.typeId || 0),
          typeId: Number(r.typeId || r.roomTypeId || 0),
          status: r.statusName || r.statusValue || r.status || 'VACANT',
          maxOccupancy: Number(r.maxOccupancy || 2),
          telephone: r.telephone || '',
          createdAt: r.createdAt || '',
          updatedAt: r.updatedAt || '',
          isActive: r.isActive !== false
        }));

        const metadata = response?.metadata;
        const totalPages = metadata?.totalPages ?? (rooms.length < size ? page + 1 : page + 2);
        this.orderRoomTotalPages.set(totalPages);
        this.orderRoomPage.set(page);

        if (page === 0) {
          this.pagedOrderRooms.set(rooms);
        } else {
          const existingIds = new Set(this.pagedOrderRooms().map(r => r.id));
          const newUniqueRooms = rooms.filter(r => !existingIds.has(r.id));
          this.pagedOrderRooms.update(current => [...current, ...newUniqueRooms]);
        }

        const hasMore = (page + 1) < totalPages && rooms.length >= size;
        this.hasMoreOrderRooms.set(hasMore);

        if (resetFirstRoom && rooms.length > 0) {
          const firstRoom = rooms[0];
          this.currentOrder.update(order => ({
            ...order,
            floorId,
            roomId: firstRoom.id,
            roomNo: firstRoom.roomNumber
          }));
        }
      },
      error: () => {
        this.isLoadingOrderRooms.set(false);
        const localRooms = this.masters.rooms()
          .filter(room => room.isActive && (!floorId || room.floorId === floorId));
        this.pagedOrderRooms.set(localRooms);
        this.hasMoreOrderRooms.set(false);
        if (resetFirstRoom && localRooms.length > 0) {
          this.currentOrder.update(order => ({
            ...order,
            floorId,
            roomId: localRooms[0].id,
            roomNo: localRooms[0].roomNumber
          }));
        }
      }
    });
  }

  loadNextOrderRoomsPage(): void {
    if (!this.hasMoreOrderRooms() || this.isLoadingOrderRooms()) return;
    const nextPage = this.orderRoomPage() + 1;
    const floorId = this.currentOrder().floorId || null;
    this.loadOrderRoomsPage(floorId, nextPage, this.orderRoomSize(), false);
  }

  updateOrderFloor(value: number | string): void {
    const floorId = Number(value) || null;
    this.orderRoomPage.set(0);
    this.pagedOrderRooms.set([]);
    this.hasMoreOrderRooms.set(true);

    this.currentOrder.update(order => ({ ...order, floorId, roomId: null, roomNo: '' }));
    this.loadOrderRoomsPage(floorId, 0, this.orderRoomSize(), true);
  }

  updateOrderRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.pagedOrderRooms().find(item => item.id === roomId) || this.masters.rooms().find(item => item.id === roomId);
    this.currentOrder.update(order => ({
      ...order,
      roomId,
      roomNo: room?.roomNumber || order.roomNo || ''
    }));
    if (roomId) {
      this.loadActiveReservationForRoom(roomId, (guestName) => {
        this.currentOrder.update(order => ({ ...order, guestName }));
      });
    }
  }

  selectDiningTable(table: PosTable): void {
    this.selectedTable.set(table);
    this.diningForm.set({
      server: table.server === 'Unassigned' ? '' : table.server,
      covers: table.covers || 2,
      secondaryTableId: this.mergeCandidates()[0]?.id || null,
      floorId: this.diningForm().floorId,
      roomId: this.diningForm().roomId,
      roomNo: '',
      guestName: table.guestName || '',
      bookingTime: table.bookingTime || '',
      notes: '',
      orderType: 'ROOM'
    });

    if (table.status === 'OCCUPIED' || table.status === 'BILLED' || table.activeOrderNo) {
      this.pos.getActiveOrders(table.id).subscribe({
        next: activeOrders => {
          if (activeOrders && activeOrders.length > 0) {
            this.openEdit('order', activeOrders[0]);
          } else {
            this.handleNoActiveOrderForTable(table);
          }
        },
        error: () => {
          this.handleNoActiveOrderForTable(table);
        }
      });
    }
  }

  private handleNoActiveOrderForTable(table: PosTable): void {
    const localOrder = this.pos.orders().find(o =>
      (table.activeOrderNo && (o.id === table.activeOrderNo || o.orderNo === `ORD-${table.activeOrderNo}` || o.orderNo === String(table.activeOrderNo))) ||
      (o.type === 'TABLE' && o.tableNo === table.number && o.status !== 'BILLED' && o.status !== 'CANCELLED')
    );

    if (localOrder) {
      this.openEdit('order', localOrder);
    } else {
      this.openDiningAction('START');
    }
  }


  onSelectTableIdInModal(tableId: number | string): void {
    const table = this.outletTables().find(t => t.id === Number(tableId));
    if (table) {
      this.selectedTable.set(table);
    }
  }

  updateDiningOrderType(type: string): void {
    this.diningForm.update(f => ({ ...f, orderType: type }));
  }

  openDiningAction(action: DiningAction): void {
    if (action !== 'RESET' && action !== 'ROOM' && !this.selectedTable()) {
      this.toast.warning('Please select a dining table first before starting an order.', 'Select Table First');
      return;
    }
    this.diningAction.set(action);
    const outletId = action === 'ROOM' ? this.roomServiceOutletId() : (this.selectedTable()?.outletId || this.defaultOutletId());
    this.pos.loadMenuItems(outletId);
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
      const outletId = String(this.outletFilter()) === 'ALL' ? this.pos.outlets()[0]?.id : Number(this.outletFilter());
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
        floorId: form.floorId || room?.floorId || null,
        roomId: form.roomId || room?.id || null,
        roomNo,
        guestName: form.guestName,
        server: form.server,
        notes: form.notes || `Deliver to room ${roomNo}.`,
        orderType: (form.orderType || 'ROOM') as 'TABLE' | 'TAKEAWAY' | 'ROOM'
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
    if (firstRoom?.id) {
      this.loadActiveReservationForRoom(firstRoom.id);
    } else {
      this.activeRoomReservation.set(null);
    }
  }

  updateRoomServiceRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.diningForm.update(form => ({
      ...form,
      roomId,
      roomNo: room?.roomNumber || form.roomNo
    }));
    if (roomId) {
      this.loadActiveReservationForRoom(roomId);
    } else {
      this.activeRoomReservation.set(null);
    }
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

  onPostedToFolioChange(checked: boolean): void {
    const isRoom = this.currentBillIsRoomOrder();

    if (checked && !isRoom) {
      this.snackBar.open('Post to guest room folio is only available for Room orders.', 'Close', { duration: 3000 });
      this.currentBill.update(b => ({ ...b, postedToFolio: false }));
      return;
    }

    if (checked) {
      const postedMaster = this.pos.billStatusMasters().find(m =>
        (m.value && m.value.toLowerCase() === 'posted') ||
        (m.code && m.code.toLowerCase() === 'posted')
      );
      this.currentBill.update(b => ({
        ...b,
        postedToFolio: true,
        status: 'Posted',
        statusId: postedMaster?.id || b.statusId
      }));
    } else {
      this.currentBill.update(b => ({
        ...b,
        postedToFolio: false,
        status: String(b.status).toLowerCase() === 'posted' ? 'Open' : b.status
      }));
    }
  }

  updateBillStatus(value: string): void {
    const bill = this.currentBill();
    const isRoomOrder = bill.isRoomOrder ?? (bill.orderType === 'ROOM' || !!bill.roomId || !!bill.roomNo);

    if (value && value.toLowerCase() === 'posted') {
      if (!isRoomOrder) {
        this.snackBar.open('Posted status is only allowed for Room orders.', 'Close', { duration: 3000 });
        return;
      }
      const master = this.pos.billStatusMasters().find(m =>
        (m.value && m.value.toLowerCase() === 'posted') ||
        (m.code && m.code.toLowerCase() === 'posted')
      );
      this.currentBill.update(b => ({
        ...b,
        status: 'Posted',
        statusId: master?.id || b.statusId,
        postedToFolio: true
      }));
      return;
    }

    const master = this.pos.billStatusMasters().find(m =>
      (m.value && m.value.toLowerCase() === value.toLowerCase()) ||
      (m.code && m.code.toLowerCase() === value.toLowerCase())
    );
    this.currentBill.update(b => ({
      ...b,
      status: value,
      statusId: master?.id || b.statusId,
      postedToFolio: false
    }));
  }


  updateBillDiscount(value: number | string): void {
    const discount = Math.min(100, Math.max(0, Number(value || 0)));
    this.currentBill.update(bill => {
      const order = this.billOrder(bill);
      const draft = this.billDraftForOrder(order, { ...bill, discount });
      const breakdown = this.billBreakdown(draft);
      return {
        ...draft,
        paid: Number(breakdown.total.toFixed(2))
      };
    });
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

  onBillOutletChange(val: any): void {
    const outletId = Number(val || this.defaultOutletId());
    this.selectedBillOutletId.set(outletId);
    this.loadOpenOrdersForBill(outletId);
  }

  loadOpenOrdersForBill(outletId: number, preferredOrderId?: number): void {
    this.pos.getOpenOrders(outletId).subscribe({
      next: orders => {
        this.openOrdersForBill.set(orders);
        const targetOrder = (preferredOrderId ? orders.find(o => o.id === preferredOrderId) : null) || orders[0];
        if (targetOrder) {
          this.applyOrderToBill(targetOrder);
        } else if (!preferredOrderId) {
          this.currentBill.update(bill => ({
            ...bill,
            orderId: 0,
            guestName: '',
            tableNo: '',
            roomNo: '',
            subtotal: 0,
            tax: 0,
            paid: 0
          }));
        }
      },
      error: () => {
        const fallback = this.pos.orders().filter(o => o.outletId === outletId);
        this.openOrdersForBill.set(fallback);
        const targetOrder = (preferredOrderId ? fallback.find(o => o.id === preferredOrderId) : null) || fallback[0];
        if (targetOrder) {
          this.applyOrderToBill(targetOrder);
        }
      }
    });
  }

  applyOrderToBill(order: PosOrder): void {
    const draft = this.billDraftForOrder(order, this.currentBill());
    const breakdown = this.billBreakdown({ ...draft, orderId: order.id });
    const effectiveGstRate = breakdown.taxBuckets[0]?.rate || 18;

    this.currentBill.set({
      ...draft,
      orderId: order.id,
      orderType: order.type || 'TABLE',
      tableNo: order.tableNo || '',
      roomNo: order.roomNo || '',
      guestName: order.guestName || '',
      subtotal: Number(breakdown.taxableSubtotal.toFixed(2)) || breakdown.grossAmount,
      tax: effectiveGstRate,
      taxAmount: Number(breakdown.taxTotal.toFixed(2)),
      paid: Number(breakdown.total.toFixed(2))
    });
  }



  updateBillOrderType(value: 'TABLE' | 'TAKEAWAY' | 'ROOM'): void {
    const order = this.openOrdersForBill().find(item => item.type === value) || this.pos.orders().find(item => item.type === value);
    this.currentBill.update(bill => this.billDraftForOrder(order, { ...bill, orderType: value }));
  }

  updateBillOrder(value: number | string): void {
    const orderId = Number(value);
    const order = this.openOrdersForBill().find(item => item.id === orderId) || this.pos.orders().find(item => item.id === orderId);
    if (!order) return;
    this.applyOrderToBill(order);
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

  readonly imageUploadError = signal<string>('');

  handleMenuImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 1;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
      this.imageUploadError.set(`Image size ${(file.size / (1024 * 1024)).toFixed(2)} MB exceeds the ${MAX_SIZE_MB} MB limit. Please choose a smaller image.`);
      input.value = ''; // reset input
      return;
    }

    this.imageUploadError.set('');
    const reader = new FileReader();
    reader.onload = () => {
      this.currentMenuItem.update(item => ({ ...item, imageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
    input.value = ''; // reset so same file can be re-selected
  }

  outletName(id?: number): string {
    return this.pos.outletMap().get(Number(id))?.name || 'Unknown Outlet';
  }

  dashboardOutletName(id?: number): string {
    return this.dashboardOutlets().find(outlet => outlet.id === Number(id))?.name || 'Unknown Outlet';
  }

  billOrder(bill: Partial<PosBill>): PosOrder | null {
    const targetId = Number(bill.orderId || 0);
    if (!targetId) return null;
    return this.openOrdersForBill().find(order => order.id === targetId) ||
           this.pos.orders().find(order => order.id === targetId) || null;
  }

  billOrderRef(bill: PosBill): string {
    const order = this.billOrder(bill);
    if (order?.orderNo) return order.orderNo;
    if (bill.orderId) return `ORD-${bill.orderId}`;
    return 'N/A';
  }


  billBreakdown(bill: Partial<PosBill>): BillBreakdown {
    const order = this.billOrder(bill);
    const rawLines = order?.lines || [];
    const grossAmount = rawLines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const discountPercent = Math.min(100, Math.max(0, Number(bill.discount || 0)));
    const discountAmount = Number(((grossAmount * discountPercent) / 100).toFixed(2));
    const inclusive = this.billingSetup().enableInclusiveTax;
    const bucketMap = new Map<number, BillTaxBucket>();
    let taxableSubtotal = 0;
    let taxTotal = 0;

    const gstRules = this.pos.gstRules();

    const lines = rawLines.map(line => {
      const menuItem = this.pos.menuItems().find(item => item.id === line.itemId);
      const catName = String(menuItem?.category || menuItem?.subcategory || line.course || 'Food').toLowerCase();
      const matchedRule = gstRules.find(r => catName.includes(r.serviceCategory.toLowerCase()) || r.serviceCategory.toLowerCase().includes(catName))
        || gstRules.find(r => r.serviceCategory.toLowerCase() === 'food')
        || { cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 };

      const cgstRate = Number(matchedRule.cgstRate ?? 2.5);
      const sgstRate = Number(matchedRule.sgstRate ?? 2.5);
      const taxRate = Number(matchedRule.igstRate || (cgstRate + sgstRate));

      const grossLineAmount = line.qty * line.price;
      const discountShare = grossAmount ? discountAmount * (grossLineAmount / grossAmount) : 0;
      const discountedAmount = Math.max(0, grossLineAmount - discountShare);
      const taxableAmount = inclusive ? discountedAmount / (1 + taxRate / 100) : discountedAmount;
      const taxAmount = inclusive ? discountedAmount - taxableAmount : taxableAmount * taxRate / 100;
      const totalAmount = inclusive ? discountedAmount : taxableAmount + taxAmount;
      const bucket = bucketMap.get(taxRate) || { rate: taxRate, cgstRate, sgstRate, taxableAmount: 0, cgst: 0, sgst: 0, taxAmount: 0 };

      bucket.taxableAmount += taxableAmount;
      bucket.taxAmount += taxAmount;
      bucket.cgst += inclusive ? (taxAmount / 2) : (taxableAmount * cgstRate / 100);
      bucket.sgst += inclusive ? (taxAmount / 2) : (taxableAmount * sgstRate / 100);
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
      discountPercent,
      discountAmount,
      discount: discountAmount,
      taxableSubtotal,
      taxTotal,
      total,
      paid,
      due: Math.max(0, total - paid),
      taxBuckets: Array.from(bucketMap.values()).sort((a, b) => a.rate - b.rate)
    };
  }

  billDraftForOrder(order?: PosOrder | null, input: Partial<PosBill> = {}): Partial<PosBill> {
    const isRoom = order?.type === 'ROOM' || !!order?.roomNo || !!order?.roomId || input.orderType === 'ROOM' || !!input.roomNo || !!input.roomId;

    const base: Partial<PosBill> = {
      ...input,
      orderId: order?.id ?? input.orderId,
      orderType: order?.type || input.orderType || (isRoom ? 'ROOM' : 'TABLE'),
      tableNo: order?.type === 'TABLE' ? order.tableNo || '' : input.tableNo || '',
      floorId: isRoom ? (order?.floorId || input.floorId || null) : null,
      roomId: isRoom ? (order?.roomId || input.roomId || null) : null,
      roomNo: isRoom ? (order?.roomNo || input.roomNo || '') : '',
      guestName: order?.guestName || input.guestName || '',
      discount: Number(input.discount || 0),
      paid: Number(input.paid || 0),
      status: input.status || this.pos.billStatuses()[0] || 'OPEN',
      paymentModes: input.paymentModes?.length ? input.paymentModes : [this.pos.paymentModes()[0] || 'Cash'],
      compReason: input.compReason || '',
      postedToFolio: !!input.postedToFolio,
      isRoomOrder: isRoom
    };
    const breakdown = this.billBreakdown(base);

    return {
      ...base,
      subtotal: Math.round(breakdown.taxableSubtotal * 100) / 100,
      tax: Math.round(breakdown.taxTotal * 100) / 100
    };
  }

  billTotal(bill: Partial<PosBill>): number {
    return this.billBreakdown(bill).total || Number(bill.subtotal || 0) - Number(bill.discount || 0) + Number(bill.taxAmount || 0);
  }

  orderTotal(order: PosOrder | Partial<PosOrder>): number {
    return (order.lines || []).reduce((sum, line) => sum + line.qty * line.price, 0);
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
    return String(this.outletFilter()) === 'ALL' ? this.pos.outlets()[0]?.id || 1 : Number(this.outletFilter());
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
      guestName: current.guestName || '',
      server: current.server || ''
    });

    if (room?.id) {
      this.loadActiveReservationForRoom(room.id);
    }
  }

  loadActiveReservationForRoom(roomId: number, callback?: (guestName: string) => void): void {
    if (!roomId) {
      this.activeRoomReservation.set(null);
      return;
    }
    this.isLoadingActiveReservation.set(true);
    this.pos.getActiveReservationByRoomId(roomId).subscribe({
      next: res => {
        this.isLoadingActiveReservation.set(false);
        this.activeRoomReservation.set(res);
        if (res && res.guestName) {
          if (callback) {
            callback(res.guestName);
          } else {
            this.diningForm.update(form => ({
              ...form,
              guestName: res.guestName || form.guestName
            }));
          }
        }
      },
      error: () => {
        this.isLoadingActiveReservation.set(false);
        this.activeRoomReservation.set(null);
      }
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

  private dashboardTablesFromApi(data: PosDashboardData | null): PosTable[] | null {
    const pulse = data?.floorPulse;
    if (!pulse?.totalTables) return null;

    const tables: PosTable[] = [];
    const addTables = (status: TableStatus, count: number): void => {
      for (let index = 0; index < count; index++) {
        const id = tables.length + 1;
        tables.push({
          id,
          outletId: 1,
          number: `D${String(id).padStart(2, '0')}`,
          section: 'Dashboard',
          status,
          covers: 0,
          server: 'Unassigned'
        });
      }
    };

    addTables('AVAILABLE', Number(pulse.available || 0));
    addTables('OCCUPIED', Number(pulse.occupied || 0));
    addTables('RESERVED', Number(pulse.reserved || 0));
    addTables('OTHER', Math.max(0, Number(pulse.totalTables || 0) - tables.length));

    return tables;
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



  private reloadTabApis(tab: PosTab): void {
    const outletId = Number(this.pos.selectedOutletId() || 1);
    this.outletFilter.set(outletId);

    switch (tab) {
      case 'dashboard':
        this.pos.loadPosDashboard();
        this.pos.loadPosDashboardCards();
        this.pos.loadOutlets();
        this.pos.loadOrders(outletId);
        this.pos.loadBills();
        this.pos.loadTables(outletId);
        this.pos.loadMenuItems(outletId);
        break;

      case 'outlets':
        this.pos.loadOutlets();
        this.pos.loadOutletTypes();
        this.pos.loadShiftSchedules();
        break;

      case 'dining':
        this.pos.loadTables(outletId);
        this.pos.loadOrders(outletId);
        this.pos.loadOutlets();
        this.pos.loadMenuItems(outletId);
        this.masters.loadAll();
        break;

      case 'orders':
        this.pos.loadOrders(outletId);
        this.pos.loadMenuItems(outletId);
        this.pos.loadTables(outletId);
        this.pos.loadOutlets();
        this.masters.loadAll();
        break;

      case 'billing':
        this.pos.loadBills(this.statusFilter(), 0, this.pos.billsPageSize());
        this.pos.loadOrders(outletId);
        this.pos.loadOutlets();
        this.pos.loadPaymentModes();
        break;

      case 'menu':
        this.pos.loadMenuItems(outletId);
        this.pos.loadMenuCategories();
        this.pos.loadMenuSubcategories();
        this.pos.loadOutlets();
        break;

      case 'billing-setup':
        this.pos.loadGstRules();
        this.pos.loadPaymentModes();
        this.pos.loadBillStatuses();
        break;

      case 'ingredient-master':
        this.pos.loadIngredients();
        this.pos.loadIngredientCategoryMasters();
        this.pos.loadBaseUnitMasters();
        this.pos.loadPurchaseUnitMasters();
        this.pos.loadStorageTypeMasters();
        break;

      case 'recipes':
        this.pos.loadRecipes();
        this.pos.loadIngredients();
        this.pos.loadMenuItems(outletId);
        break;

      default:
        this.pos.loadPosDashboard();
        this.pos.loadPosDashboardCards();
        this.pos.loadOutlets();
        break;
    }
  }

  private lastLoadedTab: PosTab | null = null;

  private updateTabFromUrl(url: string): void {
    const last = url.split('/').pop()?.split('?')[0] as PosTab;
    const tab: PosTab = ['dashboard', 'outlets', 'dining', 'orders', 'billing', 'menu', 'billing-setup', 'ingredient-master', 'recipes', 'kds'].includes(last) ? last : 'dashboard';
    this.activeTab.set(tab);
    this.search.set('');
    this.statusFilter.set('ALL');

    if (this.lastLoadedTab !== tab) {
      this.lastLoadedTab = tab;
      this.reloadTabApis(tab);
    }
  }
}

