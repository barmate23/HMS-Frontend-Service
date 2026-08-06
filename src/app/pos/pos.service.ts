import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, map, catchError } from 'rxjs';

import { UserManagementService } from '../user-management/user-management.service';
import { IngredientMaster, RecipeMaster } from './models/recipe.model';

export type PosTab = 'dashboard' | 'outlets' | 'dining' | 'orders' | 'billing' | 'menu' | 'billing-setup' | 'ingredient-master' | 'recipes';
export type OutletType = string;
export type OutletStatus = 'ACTIVE' | 'INACTIVE';
export type TableStatus = string;
export type OrderType = 'TABLE' | 'TAKEAWAY' | 'ROOM';
export type OrderStatus = string;
export type BillStatus = string;
export type PaymentMode = string;
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface PosOutlet {
  id: number;
  name: string;
  typeId?: number;
  type: OutletType;
  location: string;
  timing: string;
  taxProfile: string;
  managerId?: number;
  active: boolean;
  manager: string;
}

export interface PosMenuItem {
  id: number;
  outletId: number;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  taxPercent: number;
  variants: string[];
  modifiers: string[];
  available: boolean;
  featured: boolean;
  happyHourPrice?: number;
  happyHourWindow?: string;
  stockItem: string;
  imageUrl: string;
}

export interface PosTable {
  id: number;
  outletId: number;
  number: string;
  section: string;
  status: TableStatus;
  covers: number;
  server: string;
  guestName?: string;
  bookingTime?: string;
  mergedWith?: string;
  activeOrderNo?: number | null;
  numberOfItems?: number | null;
}


export interface PosOrderLine {
  itemId: number;
  name: string;
  qty: number;
  price: number;
  course: string;
  notes: string;
}

export interface PosOrder {
  id: number;
  outletId: number;
  orderNo: string;
  type: OrderType;
  floorId?: number | null;
  roomId?: number | null;
  tableNo?: string;
  roomNo?: string;
  guestName?: string;
  server: string;
  status: OrderStatus;
  kotNo?: string;
  kotStatusId?: number;
  kotStatusName?: string;
  openedAt: string;
  notes: string;
  lines: PosOrderLine[];
}

export interface PosBill {
  id: number;
  orderId: number;
  billNo: string;
  orderType?: OrderType;
  tableId?: number | null;
  tableNo?: string;
  floorId?: number | null;
  roomId?: number | null;
  guestName?: string;
  roomNo?: string;
  subtotal: number;
  discount: number;
  tax: number; // GST Percentage Rate (e.g. 18)
  taxAmount?: number; // Calculated Tax Amount in Rupees (e.g. 366.10)
  compReason?: string;
  compVoidReasonId?: number | null;
  paid: number;
  status: BillStatus;
  statusId?: number;
  paymentMethodId?: number | null;
  paymentModes: PaymentMode[];
  postedToFolio: boolean;
  folioPostingId?: number | null;
  isRoomOrder?: boolean;
  notes?: string;
}

export interface PosShift {
  id: number;
  outletId: number;
  name: string;
  cashier: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  roomCharges: number;
  discounts: number;
  voids: number;
  comps: number;
  status: ShiftStatus;
}

export interface PosAuditLog {
  id: number;
  at: string;
  user: string;
  action: string;
  module: string;
  reference: string;
}

export interface PosDashboardFloorPulse {
  totalTables?: number;
  occupied?: number;
  available?: number;
  reserved?: number;
  occupiedPercent?: number;
  availablePercent?: number;
  reservedPercent?: number;
}

export interface PosDashboardKotQueueItem {
  orderId?: string;
  outletName?: string;
  info?: string;
  itemCount?: number;
  status?: string;
}

export interface PosDashboardOutletRevenue {
  outletName?: string;
  billCount?: number;
  totalAmount?: number;
}

export interface PosDashboardPaymentSplit {
  method?: string;
  percentage?: number;
  amount?: number;
}

export interface PosDashboardFastMovingItem {
  itemName?: string;
  outletName?: string;
  soldQty?: number;
  imageUrl?: string | null;
}

export interface PosDashboardBillingWatch {
  openBillsCount?: number;
  openBillsAmount?: number;
  roomPostingPendingCount?: number;
  roomPostingPendingAmount?: number;
  voidsCount?: number;
  voidsAmount?: number;
}

export interface PosDashboardRecentActivity {
  activityType?: string;
  linkedEntityId?: string;
  timestamp?: string;
}

export interface PosDashboardData {
  floorPulse?: PosDashboardFloorPulse;
  kotQueue?: PosDashboardKotQueueItem[];
  revenueMix?: PosDashboardOutletRevenue[];
  paymentSplit?: PosDashboardPaymentSplit[];
  fastMovingItems?: PosDashboardFastMovingItem[];
  billingWatch?: PosDashboardBillingWatch;
  recentActivity?: PosDashboardRecentActivity[];
}

export interface PosDashboardCards {
  activeOutlets: number;
  openOrders: number;
  kotRunning: number;
  bills: number;
  roomPostings: number;
  grossSales: number;
}

interface ApiOutlet {
  id: number;
  name?: string;
  typeId?: number;
  typeValue?: string;
  location?: string;
  timing?: string;
  taxProfile?: string;
  managerId?: number;
  managerName?: string;
  isActive?: boolean;
}

interface ApiDiningTable {
  id: number;
  outletId?: number;
  outletName?: string;
  tableNumber?: string;
  sectionId?: number;
  sectionName?: string;
  statusId?: number;
  statusName?: TableStatus;
  covers?: number;
  serverId?: number;
  serverName?: string;
  linkedTableId?: number;
  linkedTableNumber?: string;
  guestName?: string | null;
  activeOrderNo?: number | null;
  numberOfItems?: number | null;
}

interface ApiMenuItem {
  id: number;
  outletId?: number;
  outletName?: string;
  itemName?: string;
  categoryId?: number;
  categoryName?: string;
  subcategoryId?: number;
  subcategoryName?: string;
  itemImage?: string;
  price?: number;
  taxPercent?: number;
  variants?: string;
  modifiers?: string;
  happyHourPrice?: number;
  happyHourWindow?: string;
  linkedStockItem?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
}

interface ApiOrderLine {
  itemId?: number;
  menuId?: number;
  menuItemId?: number;
  itemName?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  rate?: number;
  course?: string;
  notes?: string;
}

interface ApiOrder {
  id: number;
  outletId?: number;
  outletName?: string;
  orderNo?: string;
  orderNumber?: string;
  orderType?: OrderType;
  type?: OrderType;
  floorId?: number | null;
  roomId?: number | null;
  tableId?: number;
  tableNo?: string;
  tableNumber?: string;
  roomNo?: string;
  roomNumber?: string;
  guestName?: string;
  serverId?: number;
  serverName?: string;
  orderTakerId?: number;
  orderTakerName?: string;
  status?: OrderStatus;
  statusName?: OrderStatus;
  kotNo?: string;
  kotNumber?: string;
  kotStatusId?: number;
  kotStatusName?: string;
  openedAt?: string;
  notes?: string;
  orderLines?: ApiOrderLine[];
  lines?: ApiOrderLine[];
  items?: ApiOrderLine[];
}

export interface ApiGstRule {
  id: number;
  displayId?: string;
  serviceCategory: string;
  hsnSacCode?: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  description?: string;
  isActive?: boolean;
}

interface ApiBill {
  id?: number;
  orderId?: number;
  orderRef?: string;
  billNo?: string;
  billNumber?: string;
  orderType?: OrderType;
  orderFrom?: OrderType;
  tableId?: number | null;
  tableNo?: string | null;
  tableNumber?: string | null;
  floorId?: number | null;
  roomId?: number | null;
  roomNo?: string | null;
  roomNumber?: string | null;
  guestName?: string | null;
  grossAmount?: number;
  netAmount?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  taxAmount?: number;
  gstPercent?: number | null;
  gstAmount?: number | null;
  totalAmount?: number;
  paid?: number;
  paidAmount?: number;
  paymentMethodId?: number | null;
  paymentMethodName?: string | null;
  paymentModes?: string[] | string;
  paymentMode?: string;
  statusId?: number;
  status?: BillStatus;
  statusName?: BillStatus;
  compReason?: string;
  compVoidReasonId?: number | null;
  compVoidReasonName?: string | null;
  postedToFolio?: boolean;
  isPostedToFolio?: boolean;
  postToFolio?: boolean;
  folioPostingId?: number | null;
  isRoomOrder?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface StandardResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
}

interface ApiListResponse<T = any> {
  value?: T[];
  Value?: T[];
  count?: number;
  Count?: number;
}

interface ApiCommonMaster {
  id?: number;
  category?: string;
  code?: string;
  value?: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);
  private readonly userManagement: any = inject(UserManagementService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly posBaseUrl = '/api/hmsService/v1/pos';
  private readonly hmsBaseUrl = '/api/hmsService/v1';
  private readonly defaultOutletTypes: OutletType[] = ['Restaurant', 'Bar', 'Cafe', 'Spa', 'Gift Shop', 'Room Service', 'Mini Bar'];
  private readonly defaultShiftSchedules: string[] = ['09:00 AM - 09:00 PM', '07:00 AM - 11:00 PM', '05:00 PM - 01:00 AM', '24 Hours'];
  private readonly defaultTableStatuses: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED', 'MOPPING', 'DIRTY'];
  private readonly defaultTableSections: string[] = ['Indoor', 'Patio', 'Lounge', 'Bar Counter'];
  private readonly defaultMenuCategories: string[] = ['Food', 'Beverage', 'Retail', 'Room Service'];
  private readonly defaultMenuSubcategories: string[] = ['Starter', 'Main Course', 'Dessert', 'Beverage', 'Room Service'];
  private readonly defaultOrderStatuses: OrderStatus[] = ['OPEN', 'KOT_SENT', 'HELD', 'BILLED', 'CANCELLED'];
  private readonly defaultBillStatuses: BillStatus[] = ['Open', 'Paid', 'Partial', 'Void'];
  private readonly defaultPaymentModes: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Room Charge', 'City Ledger', 'Voucher'];
  private readonly defaultVoidReasons: string[] = ['Void marked by supervisor', 'Guest complaint', 'Wrong item billed', 'Manager approval'];
  private readonly defaultUsers = ['Rajan Mehta', 'Meena Pillai', 'Arjun Menon', 'Deepa Thomas', 'Outlet Manager'];

  readonly outletTypes = signal<OutletType[]>(this.defaultOutletTypes);
  readonly outletTypeMasters = signal<ApiCommonMaster[]>([]);
  readonly shiftSchedules = signal<string[]>(this.defaultShiftSchedules);
  readonly tableStatuses = signal<TableStatus[]>(this.defaultTableStatuses);
  readonly tableStatusMasters = signal<ApiCommonMaster[]>([]);
  readonly tableSections = signal<string[]>(this.defaultTableSections);
  readonly tableSectionMasters = signal<ApiCommonMaster[]>([]);
  readonly menuCategories = signal<string[]>(this.defaultMenuCategories);
  readonly menuCategoryMasters = signal<ApiCommonMaster[]>([]);
  readonly menuSubcategories = signal<string[]>(this.defaultMenuSubcategories);
  readonly menuSubcategoryMasters = signal<ApiCommonMaster[]>([]);
  readonly orderStatuses = signal<OrderStatus[]>(this.defaultOrderStatuses);
  readonly orderStatusMasters = signal<ApiCommonMaster[]>([]);
  readonly kotStatusMasters = signal<ApiCommonMaster[]>([]);
  readonly billStatuses = signal<BillStatus[]>(this.defaultBillStatuses);
  readonly billStatusMasters = signal<ApiCommonMaster[]>([]);

  readonly paymentModes = signal<PaymentMode[]>(this.defaultPaymentModes);
  readonly voidReasons = signal<string[]>(this.defaultVoidReasons);
  readonly users = computed(() => {
    const rawUsers: any[] = (this.userManagement.users() as any) || [];
    const names = rawUsers
      .filter((user: any) => user?.status === 'ACTIVE')
      .map((user: any) => user?.fullName)
      .filter(Boolean);
    return names.length ? names : this.defaultUsers;
  });

  readonly outlets = signal<PosOutlet[]>([]);
  readonly menuItems = signal<PosMenuItem[]>([]);
  readonly tables = signal<PosTable[]>([]);
  readonly orders = signal<PosOrder[]>([]);
  readonly bills = signal<PosBill[]>([]);
  readonly billsPage = signal<number>(0);
  readonly billsPageSize = signal<number>(20);
  readonly billsTotalRecords = signal<number>(0);
  readonly billsTotalPages = signal<number>(1);
  readonly shifts = signal<PosShift[]>([]);
  readonly auditLogs = signal<PosAuditLog[]>([]);
  readonly posDashboard = signal<PosDashboardData | null>(null);
  readonly posDashboardCards = signal<PosDashboardCards | null>(null);

  readonly ingredients = signal<IngredientMaster[]>([
    {
      id: 1,
      code: 'ING-001',
      name: 'Paneer (Cottage Cheese)',
      category: 'Dairy',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 95,
      costPerPurchaseUnit: 360,
      costPerBaseUnit: 0.36,
      currentStock: 8500,
      reorderLevel: 5000,
      reorderQuantity: 15000,
      storageType: 'CHILLED',
      supplierName: 'Milma Dairy Supplies',
      isActive: true
    },
    {
      id: 2,
      code: 'ING-002',
      name: 'Capsicum (Green Pepper)',
      category: 'Produce',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 90,
      costPerPurchaseUnit: 80,
      costPerBaseUnit: 0.08,
      currentStock: 3200,
      reorderLevel: 4000,
      reorderQuantity: 10000,
      storageType: 'CHILLED',
      supplierName: 'GreenField Fresh Produce',
      isActive: true
    },
    {
      id: 3,
      code: 'ING-003',
      name: 'Tandoori Marinade Masala',
      category: 'Spices & Condiments',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 100,
      costPerPurchaseUnit: 450,
      costPerBaseUnit: 0.45,
      currentStock: 4200,
      reorderLevel: 2000,
      reorderQuantity: 5000,
      storageType: 'DRY_STORE',
      supplierName: 'MDH Spice Distributors',
      isActive: true
    },
    {
      id: 4,
      code: 'ING-004',
      name: 'Amul Fresh Cream',
      category: 'Dairy',
      baseUnit: 'ML',
      purchaseUnit: 'LITER',
      conversionFactor: 1000,
      yieldPercentage: 98,
      costPerPurchaseUnit: 220,
      costPerBaseUnit: 0.22,
      currentStock: 1800,
      reorderLevel: 3000,
      reorderQuantity: 10000,
      storageType: 'CHILLED',
      supplierName: 'Amul Depot',
      isActive: true
    },
    {
      id: 5,
      code: 'ING-005',
      name: 'Chicken (Boneless Breasts)',
      category: 'Poultry & Meat',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 92,
      costPerPurchaseUnit: 280,
      costPerBaseUnit: 0.28,
      currentStock: 12500,
      reorderLevel: 8000,
      reorderQuantity: 20000,
      storageType: 'FROZEN',
      supplierName: 'RealFresh Meats',
      isActive: true
    },
    {
      id: 6,
      code: 'ING-006',
      name: 'Desi Ghee / Pure Butter',
      category: 'Oils & Ghee',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 100,
      costPerPurchaseUnit: 580,
      costPerBaseUnit: 0.58,
      currentStock: 6500,
      reorderLevel: 3000,
      reorderQuantity: 10000,
      storageType: 'DRY_STORE',
      supplierName: 'Mother Dairy Direct',
      isActive: true
    },
    {
      id: 7,
      code: 'ING-007',
      name: 'Basmati Rice (Premium)',
      category: 'Dry Grocery',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 98,
      costPerPurchaseUnit: 140,
      costPerBaseUnit: 0.14,
      currentStock: 45000,
      reorderLevel: 20000,
      reorderQuantity: 50000,
      storageType: 'DRY_STORE',
      supplierName: 'India Gate Traders',
      isActive: true
    },
    {
      id: 8,
      code: 'ING-008',
      name: 'Ginger Garlic Paste',
      category: 'Spices & Condiments',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 95,
      costPerPurchaseUnit: 160,
      costPerBaseUnit: 0.16,
      currentStock: 2800,
      reorderLevel: 1500,
      reorderQuantity: 5000,
      storageType: 'CHILLED',
      supplierName: 'Capital Foods',
      isActive: true
    },
    {
      id: 9,
      code: 'ING-009',
      name: 'Fresh Tomatoes (Ripe Red)',
      category: 'Produce',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 92,
      costPerPurchaseUnit: 45,
      costPerBaseUnit: 0.045,
      currentStock: 18500,
      reorderLevel: 10000,
      reorderQuantity: 30000,
      storageType: 'CHILLED',
      supplierName: 'GreenField Fresh Produce',
      isActive: true
    },
    {
      id: 10,
      code: 'ING-010',
      name: 'Onions (Red Medium)',
      category: 'Produce',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 88,
      costPerPurchaseUnit: 35,
      costPerBaseUnit: 0.035,
      currentStock: 25000,
      reorderLevel: 12000,
      reorderQuantity: 40000,
      storageType: 'DRY_STORE',
      supplierName: 'GreenField Fresh Produce',
      isActive: true
    },
    {
      id: 11,
      code: 'ING-011',
      name: 'Refined Sunflower Oil',
      category: 'Oils & Ghee',
      baseUnit: 'ML',
      purchaseUnit: 'LITER',
      conversionFactor: 1000,
      yieldPercentage: 100,
      costPerPurchaseUnit: 145,
      costPerBaseUnit: 0.145,
      currentStock: 35000,
      reorderLevel: 15000,
      reorderQuantity: 50000,
      storageType: 'DRY_STORE',
      supplierName: 'Fortune Oil Depot',
      isActive: true
    },
    {
      id: 12,
      code: 'ING-012',
      name: 'Cashew Nuts (Whole W320)',
      category: 'Dry Grocery',
      baseUnit: 'GRAM',
      purchaseUnit: 'KG',
      conversionFactor: 1000,
      yieldPercentage: 98,
      costPerPurchaseUnit: 820,
      costPerBaseUnit: 0.82,
      currentStock: 4800,
      reorderLevel: 2500,
      reorderQuantity: 10000,
      storageType: 'DRY_STORE',
      supplierName: 'Royal Dry Fruits',
      isActive: true
    }
  ]);

  readonly recipes = signal<RecipeMaster[]>([
    {
      id: 1,
      menuItemId: 1,
      recipeCode: 'RCP-001',
      recipeName: 'Paneer Tikka Standard Recipe',
      portionSize: 1,
      portionUnit: 'PLATE',
      prepTimeMins: 20,
      sellingPrice: 320,
      totalPortionCost: 103.07,
      foodCostPercent: 32.2,
      grossMarginPercent: 67.8,
      instructions: 'Marinate cottage cheese cubes with tandoori spices and capsicum for 30 mins before roasting in tandoor at 240C.',
      isActive: true,
      ingredients: [
        {
          ingredientId: 1,
          ingredientCode: 'ING-001',
          ingredientName: 'Paneer (Cottage Cheese)',
          category: 'Dairy',
          netQuantity: 200,
          unit: 'GRAM',
          wastePercent: 5,
          grossQuantity: 210.53,
          unitCost: 0.36,
          lineCost: 75.79
        },
        {
          ingredientId: 2,
          ingredientCode: 'ING-002',
          ingredientName: 'Capsicum (Green Pepper)',
          category: 'Produce',
          netQuantity: 50,
          unit: 'GRAM',
          wastePercent: 10,
          grossQuantity: 55.56,
          unitCost: 0.08,
          lineCost: 4.44
        },
        {
          ingredientId: 3,
          ingredientCode: 'ING-003',
          ingredientName: 'Tandoori Marinade Masala',
          category: 'Spices & Condiments',
          netQuantity: 25,
          unit: 'GRAM',
          wastePercent: 0,
          grossQuantity: 25,
          unitCost: 0.45,
          lineCost: 11.25
        },
        {
          ingredientId: 6,
          ingredientCode: 'ING-006',
          ingredientName: 'Desi Ghee / Pure Butter',
          category: 'Oils & Ghee',
          netQuantity: 20,
          unit: 'GRAM',
          wastePercent: 0,
          grossQuantity: 20,
          unitCost: 0.58,
          lineCost: 11.60
        },
        {
          ingredientId: 12,
          ingredientCode: 'ING-012',
          ingredientName: 'Cashew Nuts (Whole W320)',
          category: 'Dry Grocery',
          netQuantity: 15,
          unit: 'GRAM',
          wastePercent: 2,
          grossQuantity: 15.31,
          unitCost: 0.82,
          lineCost: 12.55
        }
      ]
    },
    {
      id: 2,
      menuItemId: 2,
      recipeCode: 'RCP-002',
      recipeName: 'Murgh Makhani (Butter Chicken)',
      portionSize: 1,
      portionUnit: 'PORTION',
      prepTimeMins: 25,
      sellingPrice: 420,
      totalPortionCost: 109.48,
      foodCostPercent: 26.1,
      grossMarginPercent: 73.9,
      instructions: 'Simmer roasted tandoori chicken in rich tomato and cashew gravy enriched with butter and fresh cream.',
      isActive: true,
      ingredients: [
        {
          ingredientId: 5,
          ingredientCode: 'ING-005',
          ingredientName: 'Chicken (Boneless Breasts)',
          category: 'Poultry & Meat',
          netQuantity: 250,
          unit: 'GRAM',
          wastePercent: 8,
          grossQuantity: 271.74,
          unitCost: 0.28,
          lineCost: 76.09
        },
        {
          ingredientId: 4,
          ingredientCode: 'ING-004',
          ingredientName: 'Amul Fresh Cream',
          category: 'Dairy',
          netQuantity: 60,
          unit: 'ML',
          wastePercent: 2,
          grossQuantity: 61.22,
          unitCost: 0.22,
          lineCost: 13.47
        },
        {
          ingredientId: 6,
          ingredientCode: 'ING-006',
          ingredientName: 'Desi Ghee / Pure Butter',
          category: 'Oils & Ghee',
          netQuantity: 30,
          unit: 'GRAM',
          wastePercent: 0,
          grossQuantity: 30,
          unitCost: 0.58,
          lineCost: 17.40
        },
        {
          ingredientId: 8,
          ingredientCode: 'ING-008',
          ingredientName: 'Ginger Garlic Paste',
          category: 'Spices & Condiments',
          netQuantity: 15,
          unit: 'GRAM',
          wastePercent: 5,
          grossQuantity: 15.79,
          unitCost: 0.16,
          lineCost: 2.53
        }
      ]
    }
  ]);
  readonly gstRules = signal<ApiGstRule[]>([
    { id: 1, serviceCategory: 'Room', cgstRate: 9, sgstRate: 9, igstRate: 18, isActive: true },
    { id: 2, serviceCategory: 'Food', cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, isActive: true },
    { id: 3, serviceCategory: 'Laundry', cgstRate: 9, sgstRate: 9, igstRate: 18, isActive: true },
    { id: 5, serviceCategory: 'Beverages', cgstRate: 9, sgstRate: 9, igstRate: 18, isActive: true }
  ]);

  readonly outletMap = computed(() => new Map(this.outlets().map(outlet => [outlet.id, outlet])));

  constructor() {
    this.loadPosMasters();
  }

  loadPosMasters(): void {
    this.loadOutletTypes();
    this.loadShiftSchedules();
    this.loadTableStatuses();
    this.loadTableSections();
    this.loadMenuCategories();
    this.loadMenuSubcategories();
    this.loadOrderStatuses();
    this.loadKotStatusMasters();
    this.loadBillStatuses();
    this.loadPaymentModes();
    this.loadVoidReasons();
    this.loadGstRules();
    this.loadOutlets();
    this.loadTables();
    this.loadMenuItems();
    this.loadOrders();
    this.loadBills();
    this.loadPosDashboard();
    this.loadPosDashboardCards();
  }

  loadOutletTypes(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/OUTLET_TYPE`).subscribe({
      next: response => {
        const outletTypes = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        this.outletTypeMasters.set(this.commonMastersData(response));
        if (outletTypes.length) this.outletTypes.set(outletTypes);
      },
      error: error => this.addAudit('Unable to load outlet types from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadShiftSchedules(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/SHIFT_SCHEDULE`).subscribe({
      next: response => {
        const shiftSchedules = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (shiftSchedules.length) this.shiftSchedules.set(shiftSchedules);
      },
      error: error => this.addAudit('Unable to load shift schedules from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTableStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/TABLE_STATUS`).subscribe({
      next: response => {
        this.tableStatusMasters.set(this.commonMastersData(response));
        const tableStatuses = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (tableStatuses.length) this.tableStatuses.set(tableStatuses);
      },
      error: error => this.addAudit('Unable to load table statuses from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTableSections(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/TABLE_SECTION`).subscribe({
      next: response => {
        this.tableSectionMasters.set(this.commonMastersData(response));
        const tableSections = this.commonMastersData(response)
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (tableSections.length) this.tableSections.set(tableSections);
      },
      error: error => this.addAudit('Unable to load table sections from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadMenuCategories(): void {
    this.http.get<ApiCommonMaster[] | ApiListResponse<ApiCommonMaster> | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/FOOD_CATEGORY`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        this.menuCategoryMasters.set(masters);
        const categories = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (categories.length) this.menuCategories.set(categories);
      },
      error: error => this.addAudit('Unable to load menu categories from API', 'Menu', error?.error?.message || error?.message || 'API error')
    });
  }

  loadMenuSubcategories(): void {
    this.http.get<ApiCommonMaster[] | ApiListResponse<ApiCommonMaster> | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/FOOD_SUBCATEGORY`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        this.menuSubcategoryMasters.set(masters);
        const subcategories = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (subcategories.length) this.menuSubcategories.set(subcategories);
      },
      error: error => this.addAudit('Unable to load menu subcategories from API', 'Menu', error?.error?.message || error?.message || 'API error')
    });
  }

  loadOrderStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/ORDER_STATUS`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        this.orderStatusMasters.set(masters);
        const orderStatuses = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (orderStatuses.length) this.orderStatuses.set(orderStatuses);
      },
      error: error => this.addAudit('Unable to load order statuses from API', 'Orders', error?.error?.message || error?.message || 'API error')
    });
  }

  loadKotStatusMasters(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/KOT_STATUS`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        console.log('KOT_STATUS masters loaded:', masters);
        this.kotStatusMasters.set(masters);
      },
      error: error => {
        console.error('Failed to load KOT_STATUS masters:', error);
        this.addAudit('Unable to load KOT statuses from API', 'Orders', error?.error?.message || error?.message || 'API error');
      }
    });
  }

  loadBillStatuses(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/BILL_STATUS`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        if (masters.length) this.billStatusMasters.set(masters);
        const billStatuses = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (billStatuses.length) this.billStatuses.set(billStatuses);
      },
      error: error => this.addAudit('Unable to load bill statuses from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  readonly paymentModeMasters = signal<ApiCommonMaster[]>([]);
  readonly voidReasonMasters = signal<ApiCommonMaster[]>([]);

  loadPaymentModes(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/PAYMENT_MODE`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        if (masters.length) this.paymentModeMasters.set(masters);
        const paymentModes = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (paymentModes.length) this.paymentModes.set(paymentModes);
      },
      error: error => this.addAudit('Unable to load payment modes from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  loadVoidReasons(): void {
    this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/VOID_REASON`).subscribe({
      next: response => {
        const masters = this.commonMastersData(response);
        if (masters.length) this.voidReasonMasters.set(masters);
        const voidReasons = masters
          .map(item => item.value || item.code || '')
          .map(value => value.trim())
          .filter(Boolean);
        if (voidReasons.length) this.voidReasons.set(voidReasons);
      },
      error: error => this.addAudit('Unable to load void reasons from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  loadGstRules(): void {
    this.http.get<StandardResponse<ApiGstRule[]>>('/api/masterService/v1/gstRules/getAllGstRules?page=0&size=500').subscribe({
      next: response => {
        const rules = (response?.data || []).filter(r => r.isActive !== false);
        if (rules.length) this.gstRules.set(rules);
      },
      error: () => {
        this.http.get<StandardResponse<ApiGstRule[]>>(`${this.hmsBaseUrl}/master/gstRules/getAllGstRules?page=0&size=500`).subscribe({
          next: response => {
            const rules = (response?.data || []).filter(r => r.isActive !== false);
            if (rules.length) this.gstRules.set(rules);
          },
          error: error => this.addAudit('Unable to load GST rules from API', 'Billing', error?.error?.message || error?.message || 'API error')
        });
      }
    });
  }

  fetchRoomsByFloor(floorId?: number | null, page: number = 0, size: number = 10): Observable<any> {
    const floorParam = floorId ? `floorId=${floorId}&` : '';
    const primaryUrl = `/api/masterService/v1/rooms/getAllRooms?${floorParam}page=${page}&size=${size}`;
    return this.http.get<any>(primaryUrl).pipe(
      catchError(() => {
        return this.http.get<any>(`${this.hmsBaseUrl}/master/rooms/getAllRooms?${floorParam}page=${page}&size=${size}`);
      })
    );
  }



  loadOutlets(): void {
    this.http.get<ApiOutlet[] | ApiListResponse<ApiOutlet> | StandardResponse<ApiOutlet[]>>(`${this.posBaseUrl}/outlets/getAllOutlets`).subscribe({
      next: response => this.outlets.set(this.listData(response).map(item => this.mapOutlet(item))),
      error: error => this.addAudit('Unable to load outlets from API', 'Outlets', error?.error?.message || error?.message || 'API error')
    });
  }

  loadTables(outletId?: number): void {
    const url = outletId
      ? `${this.posBaseUrl}/tables/getAllTables?outletId=${outletId}`
      : `${this.posBaseUrl}/tables/getAllTables`;
    this.http.get<ApiDiningTable[] | ApiListResponse<ApiDiningTable> | StandardResponse<ApiDiningTable[]>>(url).subscribe({
      next: response => {
        const loadedTables = this.listData(response).map(item => this.mapTable(item));
        this.tables.set(loadedTables);
      },
      error: error => this.addAudit('Unable to load dining tables from API', 'Table Dining', error?.error?.message || error?.message || 'API error')
    });
  }

  loadMenuItems(outletId?: number): void {
    const url = outletId
      ? `${this.posBaseUrl}/menu/getAllMenu?outletId=${outletId}`
      : `${this.posBaseUrl}/menu/getAllMenu`;
    this.http.get<ApiMenuItem[] | ApiListResponse<ApiMenuItem> | StandardResponse<ApiMenuItem[]>>(url).subscribe({
      next: response => {
        const menuItems = this.listData(response).map(item => this.mapMenuItem(item));
        this.menuItems.set(menuItems);
      },
      error: error => this.addAudit('Unable to load menu from API', 'Menu', error?.error?.message || error?.message || 'API error')
    });
  }

  loadOrders(outletId?: number): void {
    const url = outletId
      ? `${this.posBaseUrl}/orders/getAllOrders?outletId=${outletId}`
      : `${this.posBaseUrl}/orders/getAllOrders`;
    this.http.get<ApiOrder[] | ApiListResponse<ApiOrder> | StandardResponse<ApiOrder[]>>(url).subscribe({
      next: response => {
        const loadedOrders = this.listData(response).map(item => this.mapOrder(item));
        this.orders.set(loadedOrders);
      },
      error: error => this.addAudit('Unable to load orders from API', 'Orders', error?.error?.message || error?.message || 'API error')
    });
  }


  loadBills(status?: string, page: number = 0, size: number = 20): void {
    const pageParam = `page=${page}&size=${size}`;
    const url = status && status !== 'ALL'
      ? `${this.posBaseUrl}/billing/getBillsByStatus?status=${status}&${pageParam}`
      : `${this.posBaseUrl}/billing/getAllBills?${pageParam}`;

    this.http.get<any>(url).subscribe({
      next: response => {
        const items = this.listData(response).map((item: any) => this.mapBill(item));
        this.bills.set(items);

        const metadata = response?.metadata || {};
        this.billsPage.set(metadata.currentPage ?? page);
        this.billsPageSize.set(metadata.pageSize ?? size);
        this.billsTotalRecords.set(metadata.totalRecords ?? items.length);
        this.billsTotalPages.set(metadata.totalPages ?? 1);
      },
      error: error => this.addAudit('Unable to load bills from API', 'Billing', error?.error?.message || error?.message || 'API error')
    });
  }

  getBillById(id: number): Observable<PosBill | null> {
    return this.http.get<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/getBillById/${id}`).pipe(
      map(response => {
        const item = (response as StandardResponse<ApiBill>)?.data || response;
        return item ? this.mapBill(item) : null;
      })
    );
  }

  saveIngredient(item: IngredientMaster): void {
    if (item.id) {
      this.ingredients.update(list => list.map(existing => existing.id === item.id ? item : existing));
      this.addAudit('Ingredient updated', 'Ingredient Master', item.name);
    } else {
      const nextId = Math.max(0, ...this.ingredients().map(i => i.id)) + 1;
      const newItem = { ...item, id: nextId, code: `ING-${String(nextId).padStart(3, '0')}` };
      this.ingredients.update(list => [newItem, ...list]);
      this.addAudit('Ingredient created', 'Ingredient Master', newItem.name);
    }
  }

  deleteIngredient(id: number): void {
    const item = this.ingredients().find(i => i.id === id);
    this.ingredients.update(list => list.filter(i => i.id !== id));
    if (item) this.addAudit('Ingredient deleted', 'Ingredient Master', item.name);
  }

  saveRecipe(item: RecipeMaster): void {
    if (item.id) {
      this.recipes.update(list => list.map(existing => existing.id === item.id ? item : existing));
      this.addAudit('Recipe updated', 'Recipes', item.recipeName);
    } else {
      const nextId = Math.max(0, ...this.recipes().map(r => r.id)) + 1;
      const newItem = { ...item, id: nextId, recipeCode: `RCP-${String(nextId).padStart(3, '0')}` };
      this.recipes.update(list => [newItem, ...list]);
      this.addAudit('Recipe created', 'Recipes', newItem.recipeName);
    }
  }

  deleteRecipe(id: number): void {
    const recipe = this.recipes().find(r => r.id === id);
    this.recipes.update(list => list.filter(r => r.id !== id));
    if (recipe) this.addAudit('Recipe deleted', 'Recipes', recipe.recipeName);
  }

  getBillByOrderId(orderId: number): Observable<PosBill | null> {
    return this.http.get<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/getBillByOrderId/${orderId}`).pipe(
      map(response => {
        const item = (response as StandardResponse<ApiBill>)?.data || response;
        return item ? this.mapBill(item) : null;
      })
    );
  }

  getActiveOrders(tableId: number): Observable<PosOrder[]> {
    return this.http.get<ApiOrder[] | StandardResponse<ApiOrder[]>>(`${this.posBaseUrl}/orders/getActiveOrders?tableId=${tableId}`).pipe(
      map(response => {
        const data = this.listData(response);
        return data.map(item => this.mapOrder(item));
      })
    );
  }

  getOpenOrders(outletId: number): Observable<PosOrder[]> {
    return this.http.get<ApiOrder[] | StandardResponse<ApiOrder[]>>(`${this.posBaseUrl}/orders/getOpenOrders?outletId=${outletId}`).pipe(
      map(response => {
        const data = this.listData(response);
        return data.map(item => this.mapOrder(item));
      })
    );
  }


  loadPosDashboard(): void {
    this.http.get<StandardResponse<PosDashboardData>>(`${this.posBaseUrl}/dashboard/getPosDashboardData`).subscribe({
      next: response => this.posDashboard.set(response?.data || null),
      error: error => this.addAudit('Unable to load POS dashboard from API', 'Dashboard', error?.error?.message || error?.message || 'API error')
    });
  }

  loadPosDashboardCards(): void {
    this.http.get<StandardResponse<PosDashboardCards>>(`${this.posBaseUrl}/dashboard/getPosDashboardCards`).subscribe({
      next: response => this.posDashboardCards.set(response?.data || null),
      error: () => { /* silently fall back to computed values */ }
    });
  }

  saveOutlet(input: Partial<PosOutlet>): void {
    const nextId = Math.max(0, ...this.outlets().map(item => item.id)) + 1;
    const outlet: PosOutlet = {
      id: input.id ?? nextId,
      name: input.name || 'New Outlet',
      typeId: input.typeId,
      type: input.type || 'Restaurant',
      location: input.location || '',
      timing: input.timing || '09:00 AM - 09:00 PM',
      taxProfile: '',
      managerId: input.managerId,
      active: input.active ?? true,
      manager: input.manager || 'Outlet Manager'
    };
    const request$ = input.id
      ? this.http.put<ApiOutlet | StandardResponse<ApiOutlet>>(`${this.posBaseUrl}/outlets/updateOutlet/${input.id}`, this.toApiOutlet(outlet))
      : this.http.post<ApiOutlet | StandardResponse<ApiOutlet>>(`${this.posBaseUrl}/outlets/createOutlet`, this.toApiOutlet(outlet));

    request$.subscribe({
      next: response => {
        const responseOutlet = this.itemData(response);
        const saved = responseOutlet ? this.mapOutlet(responseOutlet) : outlet;
        this.outlets.update(items => input.id ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]);
        this.loadPosDashboardCards();
        this.addAudit(input.id ? 'Outlet updated' : 'Outlet created', 'Outlets', saved.name);
      },
      error: error => this.addAudit(input.id ? 'Outlet update failed' : 'Outlet create failed', 'Outlets', error?.error?.message || error?.message || outlet.name)
    });
  }

  deleteOutlet(id: number): void {
    const outlet = this.outletMap().get(id);
    this.http.delete<void>(`${this.posBaseUrl}/outlets/deleteOutlet/${id}`).subscribe({
      next: () => {
        this.outlets.update(items => items.filter(item => item.id !== id));
        if (outlet) this.addAudit('Outlet deleted', 'Outlets', outlet.name);
      },
      error: error => this.addAudit('Outlet delete failed', 'Outlets', error?.error?.message || error?.message || `Outlet #${id}`)
    });
  }

  saveMenuItem(input: Partial<PosMenuItem>): void {
    const nextId = Math.max(0, ...this.menuItems().map(item => item.id)) + 1;
    const item: PosMenuItem = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      name: input.name || 'New Item',
      category: input.category || 'Food',
      subcategory: input.subcategory || '',
      price: Number(input.price || 0),
      taxPercent: Number(input.taxPercent ?? 5),
      variants: input.variants || [],
      modifiers: input.modifiers || [],
      available: input.available ?? true,
      featured: input.featured ?? false,
      happyHourPrice: input.happyHourPrice ? Number(input.happyHourPrice) : undefined,
      happyHourWindow: input.happyHourWindow || '',
      stockItem: input.stockItem || '',
      imageUrl: input.imageUrl || ''
    };
    const request$ = input.id
      ? this.http.put<ApiMenuItem | StandardResponse<ApiMenuItem>>(`${this.posBaseUrl}/menu/updateMenu/${input.id}`, this.toApiMenuItem(item))
      : this.http.post<ApiMenuItem | StandardResponse<ApiMenuItem>>(`${this.posBaseUrl}/menu/createMenu`, this.toApiMenuItem(item));

    request$.subscribe({
      next: response => {
        const responseItem = this.itemData(response);
        const saved = responseItem ? this.mapMenuItem(responseItem) : item;
        this.loadMenuItems();
        this.loadPosDashboardCards();
        this.addAudit(input.id ? 'Menu item updated' : 'Menu item created', 'Menu', saved.name);
      },
      error: error => this.addAudit(input.id ? 'Menu item update failed' : 'Menu item create failed', 'Menu', error?.error?.message || error?.message || item.name)
    });
  }

  deleteMenuItem(id: number): void {
    const item = this.menuItems().find(value => value.id === id);
    this.http.delete<void>(`${this.posBaseUrl}/menu/deleteMenu/${id}`).subscribe({
      next: () => {
        this.menuItems.update(items => items.filter(value => value.id !== id));
        this.loadMenuItems();
        this.loadPosDashboardCards();
        if (item) this.addAudit('Menu item deleted', 'Menu', item.name);
      },
      error: error => this.addAudit('Menu item delete failed', 'Menu', error?.error?.message || error?.message || `Menu #${id}`)
    });
  }

  saveOrder(input: Partial<PosOrder>): void {
    const isUpdate = !!input.id && this.orders().some(item => item.id === input.id);
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: PosOrder = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      orderNo: input.orderNo || `ORD-${1000 + nextId}`,
      type: input.type || 'TABLE',
      floorId: input.floorId || null,
      roomId: input.roomId || null,
      tableNo: input.tableNo || '',
      roomNo: input.roomNo || '',
      guestName: input.guestName || '',
      server: input.server || 'Unassigned',
      status: input.status || 'OPEN',
      kotNo: input.kotNo || '',
      kotStatusId: input.kotStatusId,
      kotStatusName: input.kotStatusName,
      openedAt: input.openedAt || 'Just now',
      notes: input.notes || '',
      lines: input.lines?.length ? input.lines : []
    };
    const request$ = isUpdate
      ? this.http.put<ApiOrder | StandardResponse<ApiOrder>>(`${this.posBaseUrl}/orders/updateOrder/${input.id}`, this.toApiOrder(order))
      : this.http.post<ApiOrder | StandardResponse<ApiOrder>>(`${this.posBaseUrl}/orders/createOrder`, this.toApiOrder(order));

    request$.subscribe({
      next: response => {
        const responseOrder = this.itemData(response);
        const saved = responseOrder ? this.mapOrder(responseOrder) : order;
        this.orders.update(items => isUpdate ? items.map(existing => existing.id === saved.id ? saved : existing) : [saved, ...items]);
        this.loadOrders();
        this.loadTables();
        this.loadPosDashboardCards();
        this.addAudit(isUpdate ? 'Order updated' : 'Order created', 'Orders', saved.orderNo);
      },
      error: error => {
        const errMsg = error?.error?.message || error?.message || (isUpdate ? 'Order update failed' : 'Order create failed');
        this.snackBar.open(errMsg, 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['snackbar-error']
        });
        this.addAudit(isUpdate ? 'Order update failed' : 'Order create failed', 'Orders', errMsg);
      }
    });
  }

  updateOrderStatus(id: number, status: OrderStatus): void {
    console.log('updateOrderStatus called with id:', id, 'status:', status);
    if (status === 'KOT_SENT') {
      console.log('Fetching KOT_STATUS master from API...');
      this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/common/getCommonMaster/KOT_STATUS`).subscribe({
        next: response => {
          const masters = this.commonMastersData(response);
          console.log('Fetched KOT_STATUS masters:', masters);
          const kotStatus = masters.find(m => {
            const code = (m.code || '').toLowerCase();
            const value = (m.value || '').toLowerCase();
            return code === 'kot_send' || code === 'kot_sent' || code === 'sent' ||
                   value === 'kot send' || value === 'kot sent' || value === 'sent';
          });
          console.log('Matched kotStatus:', kotStatus);
          if (kotStatus && kotStatus.id) {
            console.log('Sending PATCH request to update KOT status for order:', id, 'with kotStatusId:', kotStatus.id);
            this.http.patch<any>(`${this.posBaseUrl}/orders/updateKotStatus/${id}`, null, {
              params: { kotStatusId: kotStatus.id.toString() }
            }).subscribe({
              next: () => {
                console.log('PATCH updateKotStatus success for order:', id);
                this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: item.kotNo || `KOT-${500 + id}` } : item));
                this.loadOrders();
                this.loadPosDashboard();
                this.loadPosDashboardCards();
                this.addAudit('KOT status updated on backend', 'Orders', `ORD-${1000 + id}`);
              },
              error: error => {
                console.error('Failed to update KOT status on backend:', error);
                this.addAudit('KOT status update failed on backend', 'Orders', error?.error?.message || error?.message || `ORD-${1000 + id}`);
                this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: item.kotNo || `KOT-${500 + id}` } : item));
              }
            });
          } else {
            console.warn('KOT_STATUS common master not found for KOT_SENT, falling back to local update');
            this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: item.kotNo || `KOT-${500 + id}` } : item));
          }
        },
        error: error => {
          console.error('Failed to fetch KOT_STATUS common master:', error);
          this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: item.kotNo || `KOT-${500 + id}` } : item));
        }
      });
    } else {
      this.orders.update(items => items.map(item => item.id === id ? { ...item, status, kotNo: status === 'KOT_SENT' ? item.kotNo || `KOT-${500 + id}` : item.kotNo } : item));
    }
    this.addAudit(`Order marked ${status}`, 'Orders', `ORD-${1000 + id}`);
  }

  saveTable(input: PosTable): void {
    const nextId = Math.max(0, ...this.tables().map(item => item.id)) + 1;
    const table: PosTable = {
      id: input.id || nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      number: input.number || `T${String(nextId).padStart(2, '0')}`,
      section: input.section || 'Indoor',
      status: input.status || 'AVAILABLE',
      covers: Number(input.covers || 0),
      server: input.server || 'Unassigned',
      guestName: input.guestName || '',
      bookingTime: input.bookingTime || '',
      mergedWith: input.mergedWith || ''
    };
    const request$ = input.id
      ? this.http.put<ApiDiningTable | StandardResponse<ApiDiningTable>>(`${this.posBaseUrl}/tables/updateTable/${input.id}`, this.toApiTable(table))
      : this.http.post<ApiDiningTable | StandardResponse<ApiDiningTable>>(`${this.posBaseUrl}/tables/createTable`, this.toApiTable(table));

    request$.subscribe({
      next: response => {
        const responseTable = this.itemData(response);
        const saved = responseTable ? this.mapTable(responseTable) : table;
        this.loadTables();
        this.loadPosDashboardCards();
        this.addAudit(input.id ? 'Dining table updated' : 'Dining table created', 'Table Dining', saved.number);
      },
      error: error => this.addAudit(input.id ? 'Dining table update failed' : 'Dining table create failed', 'Table Dining', error?.error?.message || error?.message || table.number)
    });
  }

  deleteTable(id: number): void {
    const table = this.tables().find(item => item.id === id);
    this.http.delete<void>(`${this.posBaseUrl}/tables/deleteTable/${id}`).subscribe({
      next: () => {
        this.tables.update(items => items.filter(item => item.id !== id));
        this.loadTables();
        this.loadPosDashboardCards();
        if (table) this.addAudit('Dining table deleted', 'Table Dining', table.number);
      },
      error: error => this.addAudit('Dining table delete failed', 'Table Dining', error?.error?.message || error?.message || `Table #${id}`)
    });
  }

  startTableOrder(table: PosTable, lines: PosOrderLine[] = []): void {
    const outlet = this.outletMap().get(table.outletId);
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const orderLines = lines.length ? lines : [
      { itemId: 1, name: 'Paneer Tikka', qty: 1, price: 420, course: 'Starter', notes: 'Fresh order from table dining' }
    ];
    const order: PosOrder = {
      id: nextId,
      outletId: table.outletId,
      orderNo: `ORD-${1000 + nextId}`,
      type: 'TABLE',
      tableNo: table.number,
      guestName: table.guestName || '',
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      status: 'OPEN',
      openedAt: 'Just now',
      notes: `${table.covers || 2} covers at ${outlet?.name || 'Outlet'}.`,
      lines: orderLines
    };
    this.saveOrder(order);

    const totalItems = orderLines.reduce((sum, line) => sum + (Number(line.qty) || 1), 0);
    const updatedTable: PosTable = {
      ...table,
      status: 'OCCUPIED',
      covers: table.covers || 2,
      server: order.server,
      guestName: table.guestName || '',
      activeOrderNo: nextId,
      numberOfItems: totalItems
    };

    this.tables.update(items => items.map(item => item.id === table.id ? updatedTable : item));
    this.saveTable(updatedTable);

    this.addAudit('Started table order', 'Table Dining', `${table.number} / ${order.orderNo}`);
  }

  startRoomOrder(input: { outletId: number; roomNo: string; guestName: string; server: string; notes?: string }, lines: PosOrderLine[] = []): void {
    const nextId = Math.max(0, ...this.orders().map(item => item.id)) + 1;
    const order: PosOrder = {
      id: nextId,
      outletId: input.outletId,
      orderNo: `ORD-${1000 + nextId}`,
      type: 'ROOM',
      roomNo: input.roomNo,
      guestName: input.guestName,
      server: input.server || 'Meena Pillai',
      status: 'OPEN',
      openedAt: 'Just now',
      notes: input.notes || 'Room service order created from table dining.',
      lines
    };
    this.saveOrder(order);
    this.addAudit('Started room service order', 'Room Service', `Room ${input.roomNo} / ${order.orderNo}`);
  }

  bookTable(table: PosTable, input: { guestName: string; covers: number; server: string; bookingTime: string }): void {
    this.tables.update(items => items.map(item => item.id === table.id ? {
      ...item,
      status: 'RESERVED',
      covers: Number(input.covers || item.covers || 2),
      server: input.server || item.server || 'Unassigned',
      guestName: input.guestName || item.guestName || '',
      bookingTime: input.bookingTime || item.bookingTime || 'Today'
    } : item));
    this.addAudit('Table booked for dine-in', 'Table Dining', `${table.number} / ${input.guestName || 'Guest'}`);
  }

  mergeTables(primary: PosTable, secondary: PosTable): void {
    this.tables.update(items => items.map(item => {
      if (item.id === primary.id) return { ...item, status: 'OCCUPIED', covers: primary.covers + Math.max(secondary.covers, 2), mergedWith: secondary.number };
      if (item.id === secondary.id) return { ...item, status: 'OCCUPIED', covers: 0, server: primary.server, mergedWith: primary.number };
      return item;
    }));
    this.addAudit('Merged tables', 'Table Dining', `${primary.number} + ${secondary.number}`);
  }

  resetPaidTables(outletId?: number): void {
    const paidOrderIds = new Set(this.bills().filter(bill => bill.status === 'PAID').map(bill => bill.orderId));
    const paidTableNumbers = new Set(
      this.orders()
        .filter(order => paidOrderIds.has(order.id) && order.type === 'TABLE' && (!outletId || order.outletId === outletId) && order.tableNo)
        .map(order => order.tableNo as string)
    );
    const released: string[] = [];

    this.tables.update(items => items.map(table => {
      const linkedToPaid = !!table.mergedWith && paidTableNumbers.has(table.mergedWith);
      const isPaidTable = paidTableNumbers.has(table.number);
      const isBilledInOutlet = table.status === 'BILLED' && (!outletId || table.outletId === outletId);
      if (!isPaidTable && !linkedToPaid && !isBilledInOutlet) return table;

      released.push(table.number);
      return { ...table, status: 'AVAILABLE', covers: 0, server: 'Unassigned', guestName: '', bookingTime: '', mergedWith: '' };
    }));

    this.addAudit('Reset paid table layout', 'Table Dining', released.length ? released.join(', ') : 'No paid tables');
  }

  saveBill(input: Partial<PosBill>): void {
    const isPostedSelected = !!input.status && String(input.status).toLowerCase() === 'posted';

    const executeSave = () => {
      const nextId = Math.max(0, ...this.bills().map(item => item.id)) + 1;
      const bill: PosBill = {
        id: input.id ?? nextId,
        orderId: Number(input.orderId || this.orders()[0]?.id || 1),
        billNo: input.billNo || `BILL-${7000 + nextId}`,
        orderType: input.orderType,
        tableNo: input.tableNo || '',
        floorId: input.floorId || null,
        roomId: input.roomId || null,
        guestName: input.guestName || '',
        roomNo: input.roomNo || '',
        subtotal: Number(input.subtotal || 0),
        discount: Number(input.discount || 0),
        tax: Number(input.tax ?? 18),
        taxAmount: Number(input.taxAmount || 0),
        compReason: input.compReason || '',
        paid: Number(input.paid || 0),
        status: input.status || 'OPEN',
        statusId: input.statusId,
        paymentModes: input.paymentModes?.length ? input.paymentModes : ['Cash'],
        postedToFolio: isPostedSelected || !!input.postedToFolio,
        isRoomOrder: input.isRoomOrder
      };

      const payload = this.toApiBill(bill);
      const request$ = input.id
        ? this.http.put<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/updateBill/${input.id}`, payload)
        : this.http.post<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/createBill`, payload);

      request$.subscribe({
        next: response => {
          const savedApiItem = (response as StandardResponse<ApiBill>)?.data || response;
          const savedBill = savedApiItem && savedApiItem.id ? this.mapBill(savedApiItem) : bill;
          this.bills.update(items => input.id
            ? items.map(existing => existing.id === input.id ? savedBill : existing)
            : [savedBill, ...items]
          );
          this.addAudit(input.id ? 'Bill updated' : 'Bill generated', 'Billing', savedBill.billNo);
          this.loadPosDashboardCards();
          this.snackBar.open(input.id ? 'Bill updated successfully' : 'Bill created successfully', 'Close', { duration: 3000 });
        },
        error: error => {
          this.bills.update(items => input.id ? items.map(existing => existing.id === input.id ? bill : existing) : [bill, ...items]);
          this.addAudit(input.id ? 'Bill updated (local fallback)' : 'Bill generated (local fallback)', 'Billing', bill.billNo);
        }
      });
    };

    if (isPostedSelected) {
      const isRoomOrder = input.isRoomOrder ?? (input.orderType === 'ROOM' || !!input.roomId || !!input.roomNo);
      if (!isRoomOrder) {
        this.snackBar.open('Cannot set status to Posted: Bill must be a Room order.', 'Close', { duration: 4000 });
        return;
      }
      if (input.id) {
        this.postBillToRoom(input.id, () => {
          executeSave();
        });
      } else {
        executeSave();
      }
    } else {
      executeSave();
    }

  }

  voidBill(id: number, reason?: string): void {
    this.http.patch<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/voidBill/${id}`, { compReason: reason || 'Voided' }).subscribe({
      next: () => {
        this.bills.update(items => items.map(item => item.id === id ? { ...item, status: 'VOID' } : item));
        this.addAudit('Voided POS bill', 'Billing', `Bill #${id}`);
      },
      error: () => {
        this.bills.update(items => items.map(item => item.id === id ? { ...item, status: 'VOID' } : item));
        this.addAudit('Voided POS bill (local)', 'Billing', `Bill #${id}`);
      }
    });
  }

  deleteBill(id: number): void {
    this.http.delete(`${this.posBaseUrl}/billing/deleteBill/${id}`).subscribe({
      next: () => {
        this.bills.update(items => items.filter(item => item.id !== id));
        this.addAudit('Deleted POS bill', 'Billing', `Bill #${id}`);
      },
      error: () => {
        this.bills.update(items => items.filter(item => item.id !== id));
        this.addAudit('Deleted POS bill (local)', 'Billing', `Bill #${id}`);
      }
    });
  }

  postBillToRoom(id: number, onSuccess?: () => void): void {
    const bill = this.bills().find(item => item.id === id);
    if (!bill || !bill.isRoomOrder) return;
    if (bill.postedToFolio || (bill.status && String(bill.status).toLowerCase() === 'posted')) {
      this.snackBar.open('Bill is already posted to room folio', 'Close', { duration: 3000 });
      return;
    }

    const order = this.orders().find(o => o.id === bill.orderId);
    const roomId = bill.roomId ? Number(bill.roomId) : (order?.roomId ? Number(order.roomId) : 1);
    const totalAmount = Number(bill.subtotal || 0);
    const taxTypeStr = `GST ${bill.tax || 18}%`;
    const descStr = `POS Bill ${bill.billNo} - ${bill.orderType || 'Order'} (${bill.guestName || 'Guest'})`;

    const payload = {
      roomId: roomId,
      source: 'POS Billing',
      amount: totalAmount,
      taxType: taxTypeStr,
      description: descStr
    };

    this.http.post<StandardResponse<any>>(`${this.hmsBaseUrl}/billing/folios/postToFolio`, payload).subscribe({
      next: (response: any) => {
        if (response && response.success === false) {
          const errorMsg = response.error?.details || response.error?.message || response.message || 'Failed to post bill to folio';
          this.snackBar.open(`Failed to Post to Folio: ${errorMsg}`, 'Close', { duration: 4000 });
          return; // Strictly stop here! Do NOT update status or call update bill API on failure.
        }

        const postedMaster = this.billStatusMasters().find(m =>
          (m.value && m.value.toLowerCase() === 'posted') ||
          (m.code && m.code.toLowerCase() === 'posted')
        );

        const updatedBill: PosBill = {
          ...bill,
          postedToFolio: true,
          status: 'Posted',
          statusId: postedMaster?.id || bill.statusId
        };

        this.bills.update(items => items.map(item => item.id === id ? updatedBill : item));
        this.addAudit('Posted POS charge to room folio', 'Room Posting', `Bill ${bill.billNo} - Room ${bill.roomNo || roomId}`);
        this.snackBar.open(`Posted to Folio: Charge of ₹${totalAmount} posted to Room Folio successfully.`, 'Close', { duration: 4000 });

        const apiPayload = this.toApiBill(updatedBill);
        this.http.put<ApiBill | StandardResponse<ApiBill>>(`${this.posBaseUrl}/billing/updateBill/${id}`, apiPayload).subscribe({
          next: updateRes => {
            const savedApiItem = (updateRes as StandardResponse<ApiBill>)?.data || updateRes;
            if (savedApiItem && savedApiItem.id) {
              this.bills.update(items => items.map(existing => existing.id === id ? this.mapBill(savedApiItem) : existing));
            }
            if (onSuccess) onSuccess();
          },
          error: err => {
            console.error('[POS] Failed to sync Posted status to bill edit API:', err);
            if (onSuccess) onSuccess();
          }
        });
      },
      error: error => {
        console.error('[POS] Failed to post bill to folio API:', error);
        const errorMsg = error?.error?.details || error?.error?.message || error?.message || 'Failed to post bill to folio';
        this.snackBar.open(`Failed to Post to Folio: ${errorMsg}`, 'Close', { duration: 4000 });
        // Strictly DO NOT update status or call update bill API if post to folio failed!
      }
    });
  }


  saveShift(input: Partial<PosShift>): void {
    const nextId = Math.max(0, ...this.shifts().map(item => item.id)) + 1;
    const shift: PosShift = {
      id: input.id ?? nextId,
      outletId: Number(input.outletId || this.outlets()[0]?.id || 1),
      name: input.name || 'New Shift',
      cashier: input.cashier || 'Rajan Mehta',
      openedAt: input.openedAt || 'Just now',
      closedAt: input.closedAt || '',
      openingCash: Number(input.openingCash || 0),
      cashSales: Number(input.cashSales || 0),
      cardSales: Number(input.cardSales || 0),
      upiSales: Number(input.upiSales || 0),
      roomCharges: Number(input.roomCharges || 0),
      discounts: Number(input.discounts || 0),
      voids: Number(input.voids || 0),
      comps: Number(input.comps || 0),
      status: input.status || 'OPEN'
    };
    this.shifts.update(items => input.id ? items.map(existing => existing.id === input.id ? shift : existing) : [shift, ...items]);
    this.addAudit(input.id ? 'Shift updated' : 'Shift opened', 'Shifts', shift.name);
  }

  private addAudit(action: string, module: string, reference: string): void {
    const nextId = Math.max(0, ...this.auditLogs().map(item => item.id)) + 1;
    this.auditLogs.update(logs => [{ id: nextId, at: 'Just now', user: 'Outlet Manager', action, module, reference }, ...logs]);
  }

  private mapOutlet(item: ApiOutlet): PosOutlet {
    return {
      id: Number(item.id),
      name: item.name || 'Outlet',
      typeId: item.typeId ? Number(item.typeId) : undefined,
      type: this.asOutletType(item.typeValue),
      location: item.location || '',
      timing: item.timing || '',
      taxProfile: item.taxProfile || '',
      managerId: item.managerId ? Number(item.managerId) : undefined,
      active: item.isActive !== false,
      manager: item.managerName || ''
    };
  }

  private toApiOutlet(item: PosOutlet): ApiOutlet {
    const typeMaster = this.outletTypeMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === item.type.toLowerCase())
    );
    const manager = ((this.userManagement.users() as any) || []).find((user: any) => String(user?.fullName || '').toLowerCase() === item.manager.toLowerCase());

    return {
      id: item.id,
      name: item.name,
      typeId: typeMaster?.id ? Number(typeMaster.id) : item.typeId,
      typeValue: item.type,
      location: item.location,
      timing: item.timing,
      managerId: manager?.id || item.managerId,
      managerName: item.manager,
      isActive: item.active
    };
  }

  private mapTable(item: ApiDiningTable): PosTable {
    const rawStatus = String(item.statusName || 'AVAILABLE').toUpperCase();
    const mappedStatus: TableStatus =
      rawStatus === 'OCCUPIED' ? 'OCCUPIED' :
      rawStatus === 'RESERVED' ? 'RESERVED' :
      rawStatus === 'BILLED' ? 'BILLED' :
      rawStatus === 'DIRTY' ? 'DIRTY' :
      rawStatus === 'MOPPING' ? 'MOPPING' :
      this.asTableStatus(item.statusName);

    const isAvailable = mappedStatus === 'AVAILABLE';

    return {
      id: Number(item.id),
      outletId: Number(item.outletId || this.outlets()[0]?.id || 1),
      number: item.tableNumber || `T${item.id}`,
      section: item.sectionName || '',
      status: mappedStatus,
      covers: Number(item.covers || 0),
      server: item.serverName || 'Unassigned',
      guestName: isAvailable ? '' : (item.guestName ? String(item.guestName).trim() : ''),
      activeOrderNo: isAvailable ? null : (item.activeOrderNo ? Number(item.activeOrderNo) : null),
      numberOfItems: isAvailable ? null : (item.numberOfItems ? Number(item.numberOfItems) : null),
      mergedWith: item.linkedTableNumber || ''
    };
  }


  private toApiTable(item: PosTable): ApiDiningTable {
    const sectionMaster = this.tableSectionMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === item.section.toLowerCase())
    );
    const statusValue = item.status === 'BILLED' ? 'OCCUPIED' : item.status;
    const statusMaster = this.tableStatusMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === String(statusValue).toLowerCase())
    );
    const linkedTable = this.tables().find(table => table.number === item.mergedWith);

    return {
      id: item.id,
      outletId: item.outletId,
      tableNumber: item.number,
      sectionId: sectionMaster?.id ? Number(sectionMaster.id) : undefined,
      sectionName: item.section,
      statusId: statusMaster?.id ? Number(statusMaster.id) : undefined,
      statusName: statusValue,
      covers: item.covers,
      linkedTableId: linkedTable?.id,
      linkedTableNumber: item.mergedWith || undefined,
      guestName: item.guestName || null,
      activeOrderNo: item.activeOrderNo ?? null,
      numberOfItems: item.numberOfItems ?? null
    };
  }

  private mapMenuItem(item: ApiMenuItem): PosMenuItem {
    return {
      id: Number(item.id),
      outletId: Number(item.outletId || this.outlets()[0]?.id || 1),
      name: item.itemName || 'Menu Item',
      category: item.categoryName || 'Food',
      subcategory: item.subcategoryName || '',
      price: Number(item.price || 0),
      taxPercent: Number(item.taxPercent ?? 0),
      variants: this.toTokens(item.variants),
      modifiers: this.toTokens(item.modifiers),
      available: item.isAvailable !== false,
      featured: !!item.isFeatured,
      happyHourPrice: item.happyHourPrice ? Number(item.happyHourPrice) : undefined,
      happyHourWindow: item.happyHourWindow || '',
      stockItem: item.linkedStockItem || '',
      imageUrl: this.toImagePreviewUrl(item.itemImage)
    };
  }

  private toApiMenuItem(item: PosMenuItem): ApiMenuItem {
    const categoryMaster = this.menuCategoryMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === item.category.toLowerCase())
    );
    const subcategoryMaster = this.menuSubcategoryMasters().find(master =>
      [master.value, master.code].some(value => String(value || '').toLowerCase() === item.subcategory.toLowerCase())
    );

    return {
      id: item.id,
      outletId: item.outletId,
      itemName: item.name,
      categoryId: categoryMaster?.id ? Number(categoryMaster.id) : undefined,
      categoryName: item.category,
      subcategoryId: subcategoryMaster?.id ? Number(subcategoryMaster.id) : undefined,
      subcategoryName: item.subcategory,
      itemImage: this.toImageBase64Payload(item.imageUrl),
      price: item.price,
      taxPercent: item.taxPercent,
      variants: item.variants.join(', '),
      modifiers: item.modifiers.join(', '),
      happyHourPrice: item.happyHourPrice,
      happyHourWindow: item.happyHourWindow,
      linkedStockItem: item.stockItem,
      isAvailable: item.available,
      isFeatured: item.featured
    };
  }

  private mapOrder(item: ApiOrder): PosOrder {
    const lines = item.orderLines || item.lines || item.items || [];
    const type = item.orderType || item.type || (item.roomNo || item.roomNumber ? 'ROOM' : 'TABLE');

    return {
      id: Number(item.id),
      outletId: Number(item.outletId || this.outlets()[0]?.id || 1),
      orderNo: item.orderNo || item.orderNumber || `ORD-${item.id}`,
      type,
      floorId: item.floorId || null,
      roomId: item.roomId || null,
      tableNo: item.tableNo || item.tableNumber || '',
      roomNo: item.roomNo || item.roomNumber || '',
      guestName: item.guestName || '',
      server: item.serverName || item.orderTakerName || 'Unassigned',
      status: item.statusName || item.status || 'OPEN',
      kotNo: item.kotNo || item.kotNumber || '',
      kotStatusId: item.kotStatusId,
      kotStatusName: item.kotStatusName,
      openedAt: item.openedAt || 'Just now',
      notes: item.notes || '',
      lines: lines.map(line => this.mapOrderLine(line))
    };
  }

  private mapOrderLine(line: ApiOrderLine): PosOrderLine {
    const itemId = Number(line.itemId || line.menuItemId || line.menuId || 0);
    const menuItem = this.menuItems().find(item => item.id === itemId);

    return {
      itemId,
      name: line.itemName || menuItem?.name || 'Menu Item',
      qty: Number(line.quantity || line.qty || 1),
      price: Number(line.price || line.rate || menuItem?.price || 0),
      course: line.course || menuItem?.subcategory || 'Main',
      notes: line.notes || ''
    };
  }

  private toApiOrder(item: PosOrder): ApiOrder {
    const table = this.tables().find(value => value.outletId === item.outletId && value.number === item.tableNo);
    const server = ((this.userManagement.users() as any) || []).find((user: any) => String(user?.fullName || '').toLowerCase() === item.server.toLowerCase());
    const lines = item.lines.map(line => this.toApiOrderLine(line));

    return {
      id: item.id,
      outletId: item.outletId,
      orderNo: item.orderNo,
      orderNumber: item.orderNo,
      orderType: item.type,
      type: item.type,
      floorId: item.floorId || null,
      roomId: item.roomId || null,
      tableId: table?.id,
      tableNo: item.tableNo || '',
      tableNumber: item.tableNo || '',
      roomNo: item.roomNo || '',
      roomNumber: item.roomNo || '',
      guestName: item.guestName || '',
      serverId: server?.id,
      serverName: item.server,
      orderTakerId: server?.id,
      orderTakerName: item.server,
      status: item.status,
      statusName: item.status,
      kotNo: item.kotNo || '',
      kotNumber: item.kotNo || '',
      kotStatusId: item.kotStatusId,
      kotStatusName: item.kotStatusName,
      openedAt: item.openedAt,
      notes: item.notes,
      orderLines: lines,
      lines,
      items: lines
    };
  }

  private toApiOrderLine(line: PosOrderLine): ApiOrderLine {
    return {
      itemId: line.itemId,
      menuId: line.itemId,
      menuItemId: line.itemId,
      itemName: line.name,
      quantity: Number(line.qty || 1),
      qty: Number(line.qty || 1),
      price: Number(line.price || 0),
      rate: Number(line.price || 0),
      course: line.course,
      notes: line.notes
    };
  }

  private mapBill(item: ApiBill): PosBill {
    let modes: string[] = ['Cash'];
    if (Array.isArray(item.paymentModes)) {
      modes = item.paymentModes.filter(Boolean);
    } else if (typeof item.paymentModes === 'string' && item.paymentModes) {
      modes = item.paymentModes.split(',').map(m => m.trim()).filter(Boolean);
    } else if (item.paymentMethodName) {
      modes = [item.paymentMethodName];
    } else if (item.paymentMode) {
      modes = [item.paymentMode];
    }
    if (!modes.length) modes = ['Cash'];

    const rawStatus = String(item.statusName || item.status || 'Open').trim();
    let status: string = item.statusName || item.status || 'Open';
    if (rawStatus.toUpperCase() === 'OPEN') status = 'Open';
    else if (rawStatus.toUpperCase() === 'PAID' || rawStatus.toUpperCase() === 'SETTLED') status = 'Paid';
    else if (rawStatus.toUpperCase().includes('PARTIAL')) status = 'Partial';
    else if (rawStatus.toUpperCase().includes('VOID')) status = 'Void';

    const orderFromRaw = String(item.orderFrom || item.orderType || 'TABLE').toUpperCase();
    const orderType: OrderType = orderFromRaw.includes('ROOM') ? 'ROOM' : orderFromRaw.includes('TAKEAWAY') ? 'TAKEAWAY' : 'TABLE';

    const billNo = item.billNumber || item.billNo || `BILL-${item.id}`;
    const roomNo = item.roomNumber || item.roomNo || '';
    const tableNo = item.tableNumber || item.tableNo || '';
    const guestName = item.guestName || (roomNo ? `Room ${roomNo} Guest` : tableNo ? `Table ${tableNo} Guest` : 'Walk-in');

    const grossOrSubtotal = Number(item.grossAmount ?? item.subtotal ?? 0);
    const totalAmount = Number(item.netAmount ?? item.totalAmount ?? grossOrSubtotal);
    const paidAmount = Number(item.paidAmount ?? item.paid ?? 0);

    return {
      id: Number(item.id),
      orderId: Number(item.orderId || 0),
      billNo,
      orderType,
      tableId: item.tableId ? Number(item.tableId) : null,
      tableNo,
      floorId: item.floorId || null,
      roomId: item.roomId || null,
      guestName,
      roomNo,
      subtotal: grossOrSubtotal,
      discount: Number(item.discount || 0),
      tax: Number(item.gstPercent ?? item.tax ?? 0),
      taxAmount: Number(item.gstAmount ?? item.taxAmount ?? 0),
      compReason: item.compVoidReasonName || item.compReason || '',
      compVoidReasonId: item.compVoidReasonId ? Number(item.compVoidReasonId) : null,
      paid: paidAmount,
      status,
      statusId: item.statusId ? Number(item.statusId) : undefined,
      paymentMethodId: item.paymentMethodId ? Number(item.paymentMethodId) : null,
      paymentModes: modes,
      postedToFolio: item.postToFolio ?? item.postedToFolio ?? item.isPostedToFolio ?? false,
      folioPostingId: item.folioPostingId ? Number(item.folioPostingId) : null,
      isRoomOrder: item.isRoomOrder ?? (orderType === 'ROOM'),
      notes: item.notes || ''
    };
  }

  private toApiBill(item: PosBill): ApiBill {
    const gstPercentage = item.tax && item.tax <= 100 ? item.tax : 18;
    const computedTaxAmount = item.taxAmount ?? (item.tax > 100 ? item.tax : Number((item.subtotal * (gstPercentage / 100)).toFixed(2)));

    const statusMaster = this.billStatusMasters().find(m =>
      (m.value && m.value.toLowerCase() === (item.status || '').toLowerCase()) ||
      (m.code && m.code.toLowerCase() === (item.status || '').toLowerCase()) ||
      (m.id && Number(m.id) === Number(item.statusId))
    );
    const resolvedStatusId = item.statusId || statusMaster?.id || 52;

    const primaryPaymentMode = item.paymentModes && item.paymentModes.length ? item.paymentModes[0] : 'Cash';
    const paymentMaster = this.paymentModeMasters().find(m =>
      (m.value && m.value.toLowerCase() === primaryPaymentMode.toLowerCase()) ||
      (m.code && m.code.toLowerCase() === primaryPaymentMode.toLowerCase()) ||
      (m.name && m.name.toLowerCase() === primaryPaymentMode.toLowerCase())
    );
    const resolvedPaymentMethodId = item.paymentMethodId || paymentMaster?.id || (primaryPaymentMode.toLowerCase() === 'cash' ? 1 : primaryPaymentMode.toLowerCase() === 'card' ? 2 : primaryPaymentMode.toLowerCase() === 'upi' ? 3 : 1);

    const voidReasonMaster = this.voidReasonMasters().find(m =>
      (m.value && m.value.toLowerCase() === (item.compReason || '').toLowerCase()) ||
      (m.code && m.code.toLowerCase() === (item.compReason || '').toLowerCase())
    );
    const resolvedCompVoidReasonId = item.compVoidReasonId || voidReasonMaster?.id || null;

    const netAmt = Number((item.subtotal - item.discount + computedTaxAmount).toFixed(2));

    return {
      id: item.id,
      billNumber: item.billNo,
      orderId: item.orderId,
      orderRef: item.orderId ? (String(item.orderId).startsWith('ORD-') ? String(item.orderId) : `ORD-${item.orderId}`) : '',
      orderFrom: item.orderType || 'TABLE',
      tableId: item.tableId || null,
      tableNumber: item.tableNo || null,
      roomId: item.roomId || null,
      roomNumber: item.roomNo || null,
      guestName: item.guestName || '',
      isRoomOrder: item.isRoomOrder ?? (item.orderType === 'ROOM'),
      grossAmount: item.subtotal,
      discount: item.discount,
      netAmount: netAmt,
      paidAmount: item.paid,
      gstPercent: gstPercentage,
      gstAmount: computedTaxAmount,
      paymentMethodId: resolvedPaymentMethodId,
      paymentMethodName: primaryPaymentMode,
      statusId: resolvedStatusId,
      statusName: item.status,
      compVoidReasonId: resolvedCompVoidReasonId,
      compVoidReasonName: item.compReason || null,
      postToFolio: Boolean(item.postedToFolio),
      folioPostingId: item.folioPostingId || null,
      notes: item.notes || ''
    };
  }

  private asOutletType(value?: string): OutletType {
    return this.outletTypes().find(type => type.toLowerCase() === String(value || '').toLowerCase()) || value || this.outletTypes()[0] || 'Restaurant';
  }

  private asTableStatus(value?: string): TableStatus {
    const normalized = String(value || 'AVAILABLE').toUpperCase();
    return this.tableStatuses().find(status => status.toUpperCase() === normalized) || value || this.tableStatuses()[0] || 'AVAILABLE';
  }

  private toTokens(value?: string): string[] {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  private toImageBase64Payload(value?: string): string {
    const image = String(value || '').trim();
    if (!image) return '';
    const dataUrlMatch = image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (dataUrlMatch?.[1]) return dataUrlMatch[1];
    return image.startsWith('http') ? '' : image;
  }

  private toImagePreviewUrl(value?: string): string {
    const image = String(value || '').trim();
    if (!image || image.startsWith('http') || image.startsWith('data:image/')) return image;
    return `data:image/png;base64,${image}`;
  }

  private commonMastersData(response: ApiCommonMaster[] | ApiListResponse<ApiCommonMaster> | StandardResponse<ApiCommonMaster[]> | null): ApiCommonMaster[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if ('success' in response) return response.data || [];
    return response.value || response.Value || [];
  }

  private listData<T>(response: T[] | ApiListResponse<T> | StandardResponse<T[]> | null): T[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if ('success' in response) return response.data || [];
    return response.value || response.Value || [];
  }

  private itemData<T extends object>(response: T | StandardResponse<T> | null): T | null {
    if (!response) return null;
    if ('success' in response) return response.data || null;
    return response;
  }
}
