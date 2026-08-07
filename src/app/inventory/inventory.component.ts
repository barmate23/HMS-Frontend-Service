import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { InventoryService, ItemConfigPayload, PurchaseRequestLinePayload, PurchaseRequestPayload, StockItemPayload, StoreIssuePayload, InventoryDashboardData } from './inventory.service';
import { DepartmentOption, UserManagementService } from '../user-management/user-management.service';
import { PurchaseMasterOption, PurchaseService } from '../purchase/purchase.service';

type InventoryTab = 'dashboard' | 'stock' | 'kitchen-stock' | 'requests' | 'issues';
type StockStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OVERSTOCK';
type IssueStatus = 'Open' | 'Issued' | 'Closed';
type RequestStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Ordered';

export interface KitchenIngredientStock {
  id: number | string;
  code: string;
  name: string;
  category: string;
  store: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  yieldPercent: number;
  onHand: number;
  reorderLevel: number;
  reorderQuantity: number;
  costPerBaseUnit: number;
  costPerPurchaseUnit: number;
  totalValue: number;
  storageType: string;
  supplierName: string;
  lastRestocked: string;
  status: 'OK' | 'LOW' | 'CRITICAL';
}

interface StoreItem {
  id: number;
  code: string;
  name: string;
  category: string;
  store: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  parLevel: number;
  unitCost: number;
  lastUpdated: string;
}

interface StoreIssue {
  apiId: number | string;
  itemId: number | string | '';
  id: string;
  departmentId: number | string | '';
  department: string;
  issuedTo: string;
  item: string;
  quantity: number;
  uomId: number | string | '';
  unit: string;
  date: string;
  status: IssueStatus;
  statusId: number | string | '';
  note: string;
}

interface StoreIssueDraft {
  itemId: number | string | '';
  departmentId: number | string | '';
  department: string;
  issuedTo: string;
  item: string;
  quantity: number;
  uomId: number | string | '';
  unit: string;
  date: string;
  status: IssueStatus;
  statusId: number | string | '';
  note: string;
}

interface IssueItemOption {
  id: number | string;
  code: string;
  name: string;
  uomId: number | string | '';
  unit: string;
  rate: number;
  active?: boolean;
}

interface PurchaseRequestLine {
  id: number;
  apiId?: number | string;
  itemId: number | string | '';
  item: string;
  uomId: number | string | '';
  unit: string;
  quantity: number;
  estimatedRate: number;
}

interface PurchaseRequest {
  apiId: number | string;
  id: string;
  departmentId: number | string | '';
  department: string;
  requestedBy: string;
  neededBy: string;
  status: string;
  statusId: number | string | '';
  statusCode: string;
  purpose: string;
  lines: PurchaseRequestLine[];
}

interface PurchaseRequestDraft {
  apiId?: number | string;
  id?: string;
  departmentId: number | string | '';
  department: string;
  requestedBy: string;
  neededBy: string;
  status: string;
  statusId: number | string | '';
  statusCode: string;
  purpose: string;
  lines: PurchaseRequestLine[];
}

interface InventoryDashboardKpi {
  label: string;
  value: string;
  delta: string;
  icon: string;
  tone: 'blue' | 'red' | 'green' | 'amber' | 'teal';
}

interface StockHealthSlice {
  label: string;
  value: number;
  percent: number;
  color: string;
}

interface ReorderWatchItem {
  item: string;
  store: string;
  onHand: string;
  reorderAt: string;
  status: 'LOW' | 'CRITICAL';
}

interface DashboardMovement {
  id: string;
  department: string;
  item: string;
  qty: string;
  status: IssueStatus | string;
  date: string;
}

interface DashboardDistribution {
  name: string;
  count: number | string;
  value: number;
  percent: number;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  activeTab = signal<InventoryTab>('dashboard');
  search = signal('');
  requestSearch = signal('');
  requestStatusFilter = signal<'ALL' | RequestStatus>('ALL');
  categoryFilter = signal('ALL');
  storeFilter = signal('ALL');
  isLoadingStock = signal(false);
  stockError = signal<string | null>(null);
  isLoadingIssues = signal(false);
  isLoadingIssueItems = signal(false);
  isLoadingRequests = signal(false);
  issueError = signal<string | null>(null);
  issueItemError = signal<string | null>(null);
  requestError = signal<string | null>(null);
  issueSaving = signal(false);
  requestSaving = signal(false);
  issueLoadingId = signal<number | string | null>(null);
  issueDeletingId = signal<number | string | null>(null);
  requestLoadingId = signal<number | string | null>(null);
  requestDeletingId = signal<number | string | null>(null);
  createModal = signal<'request' | 'issue' | null>(null);
  selectedPurchaseRequest = signal<PurchaseRequest | null>(null);
  purchaseRequestDetail = signal<PurchaseRequest | null>(null);
  purchaseRequestPendingDelete = signal<PurchaseRequest | null>(null);
  purchaseRequestDraft = signal<PurchaseRequestDraft>(this.emptyPurchaseRequestDraft());
  selectedStoreIssue = signal<StoreIssue | null>(null);
  storeIssuePendingDelete = signal<StoreIssue | null>(null);
  storeIssueDraft = signal<StoreIssueDraft>(this.emptyStoreIssueDraft());
  dashboardData = signal<InventoryDashboardData | null>(null);

  readonly stockItems = signal<StoreItem[]>([]);
  readonly issueItems = signal<IssueItemOption[]>([]);

  // Kitchen Ingredients Stock Ledger signals & mock data
  kitchenStockSearch = signal('');
  kitchenCategoryFilter = signal('ALL');
  kitchenStorageFilter = signal('ALL');

  kitchenIngredientsPage = signal<number>(0);
  kitchenIngredientsTotalPages = signal<number>(1);
  kitchenIngredientsLoading = signal<boolean>(false);

  readonly kitchenStockItems = signal<KitchenIngredientStock[]>([
    {
      id: 1, code: 'ING-001', name: 'Paneer (Cottage Cheese)', category: 'Dairy', store: 'Central Kitchen Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 95,
      onHand: 8500, reorderLevel: 5000, reorderQuantity: 15000, costPerBaseUnit: 0.36, costPerPurchaseUnit: 360,
      totalValue: 3060, storageType: 'CHILLED', supplierName: 'Milma Dairy Supplies', lastRestocked: 'Today, 09:30 AM', status: 'OK'
    },
    {
      id: 2, code: 'ING-002', name: 'Capsicum (Green Pepper)', category: 'Produce', store: 'Cold Room / Chilled Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 88,
      onHand: 3200, reorderLevel: 4000, reorderQuantity: 10000, costPerBaseUnit: 0.08, costPerPurchaseUnit: 80,
      totalValue: 256, storageType: 'CHILLED', supplierName: 'GreenField Fresh', lastRestocked: 'Yesterday', status: 'LOW'
    },
    {
      id: 3, code: 'ING-003', name: 'Tandoori Marinade Masala', category: 'Spices & Condiments', store: 'Spices Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 100,
      onHand: 4200, reorderLevel: 2000, reorderQuantity: 5000, costPerBaseUnit: 0.45, costPerPurchaseUnit: 450,
      totalValue: 1890, storageType: 'DRY_STORE', supplierName: 'MDH Spice Distributors', lastRestocked: '3 days ago', status: 'OK'
    },
    {
      id: 4, code: 'ING-004', name: 'Amul Fresh Cream', category: 'Dairy', store: 'Cold Room / Chilled Store',
      baseUnit: 'ML', purchaseUnit: 'LITER', conversionFactor: 1000, yieldPercent: 98,
      onHand: 1800, reorderLevel: 3000, reorderQuantity: 8000, costPerBaseUnit: 0.22, costPerPurchaseUnit: 220,
      totalValue: 396, storageType: 'CHILLED', supplierName: 'Amul Depot Direct', lastRestocked: 'Yesterday', status: 'LOW'
    },
    {
      id: 5, code: 'ING-005', name: 'Chicken (Boneless Breasts)', category: 'Poultry & Meat', store: 'Deep Freezer',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 92,
      onHand: 12500, reorderLevel: 8000, reorderQuantity: 20000, costPerBaseUnit: 0.28, costPerPurchaseUnit: 280,
      totalValue: 3500, storageType: 'FROZEN', supplierName: 'RealFresh Meats', lastRestocked: 'Today, 07:00 AM', status: 'OK'
    },
    {
      id: 6, code: 'ING-006', name: 'Desi Ghee / Pure Butter', category: 'Oils & Ghee', store: 'Central Kitchen Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 100,
      onHand: 6500, reorderLevel: 3000, reorderQuantity: 10000, costPerBaseUnit: 0.58, costPerPurchaseUnit: 580,
      totalValue: 3770, storageType: 'DRY_STORE', supplierName: 'Mother Dairy Direct', lastRestocked: '4 days ago', status: 'OK'
    },
    {
      id: 7, code: 'ING-007', name: 'Basmati Rice (Premium)', category: 'Dry Grocery', store: 'Dry Grocery Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 100,
      onHand: 45000, reorderLevel: 20000, reorderQuantity: 50000, costPerBaseUnit: 0.14, costPerPurchaseUnit: 140,
      totalValue: 6300, storageType: 'DRY_STORE', supplierName: 'India Gate Traders', lastRestocked: '5 days ago', status: 'OK'
    },
    {
      id: 8, code: 'ING-008', name: 'Ginger Garlic Paste', category: 'Spices & Condiments', store: 'Cold Room / Chilled Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 96,
      onHand: 2800, reorderLevel: 1500, reorderQuantity: 5000, costPerBaseUnit: 0.16, costPerPurchaseUnit: 160,
      totalValue: 448, storageType: 'CHILLED', supplierName: 'Capital Foods', lastRestocked: '2 days ago', status: 'OK'
    },
    {
      id: 9, code: 'ING-009', name: 'Fresh Tomatoes (Ripe Red)', category: 'Produce', store: 'Cold Room / Chilled Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 85,
      onHand: 18500, reorderLevel: 10000, reorderQuantity: 25000, costPerBaseUnit: 0.045, costPerPurchaseUnit: 45,
      totalValue: 832.5, storageType: 'CHILLED', supplierName: 'GreenField Fresh', lastRestocked: 'Today, 08:15 AM', status: 'OK'
    },
    {
      id: 10, code: 'ING-010', name: 'Onions (Red Medium)', category: 'Produce', store: 'Dry Grocery Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 90,
      onHand: 25000, reorderLevel: 12000, reorderQuantity: 30000, costPerBaseUnit: 0.035, costPerPurchaseUnit: 35,
      totalValue: 875, storageType: 'DRY_STORE', supplierName: 'GreenField Fresh', lastRestocked: '2 days ago', status: 'OK'
    },
    {
      id: 11, code: 'ING-011', name: 'Refined Sunflower Oil', category: 'Oils & Ghee', store: 'Central Kitchen Store',
      baseUnit: 'ML', purchaseUnit: 'LITER', conversionFactor: 1000, yieldPercent: 100,
      onHand: 35000, reorderLevel: 15000, reorderQuantity: 40000, costPerBaseUnit: 0.145, costPerPurchaseUnit: 145,
      totalValue: 5075, storageType: 'DRY_STORE', supplierName: 'Fortune Oil Depot', lastRestocked: '4 days ago', status: 'OK'
    },
    {
      id: 12, code: 'ING-012', name: 'Cashew Nuts (Whole W320)', category: 'Dry Grocery', store: 'Dry Grocery Store',
      baseUnit: 'GRAM', purchaseUnit: 'KG', conversionFactor: 1000, yieldPercent: 100,
      onHand: 1200, reorderLevel: 2500, reorderQuantity: 5000, costPerBaseUnit: 0.82, costPerPurchaseUnit: 820,
      totalValue: 984, storageType: 'DRY_STORE', supplierName: 'Royal Dry Fruits', lastRestocked: '6 days ago', status: 'CRITICAL'
    }
  ]);

  loadKitchenIngredients(page: number = 0, size: number = 50, append: boolean = false): void {
    if (this.kitchenIngredientsLoading()) return;
    this.kitchenIngredientsLoading.set(true);

    this.inventoryService.getKitchenIngredients(page, size).subscribe({
      next: (response) => {
        this.kitchenIngredientsLoading.set(false);
        let rawItems: any[] = [];
        let totalPages = 1;
        let currentPage = page;

        if (response && response.data) {
          const d = response.data;
          rawItems = Array.isArray(d.ingredients) ? d.ingredients : Array.isArray(d.content) ? d.content : Array.isArray(d) ? d : [];
          totalPages = d.totalPages ?? 1;
          currentPage = d.currentPage ?? page;
        } else if (response && Array.isArray(response.ingredients)) {
          rawItems = response.ingredients;
        } else if (Array.isArray(response)) {
          rawItems = response;
        }

        const mapped: KitchenIngredientStock[] = rawItems.map((item, idx) => {
          const onHand = Number(item.currentStockLevel ?? item.currentStock ?? item.onHand ?? 5000);
          const reorderLevel = Number(item.reorderThresholdLevel ?? item.reorderLevel ?? 2000);
          const conversionFactor = Number(item.purchaseConversionFactor ?? item.conversionFactor ?? 1000);
          const costPerPurchaseUnit = Number(item.costPerPurchaseUnit ?? item.unitCost ?? 0);
          const costPerBaseUnit = Number(item.costPerBaseUnit ?? (conversionFactor > 0 ? costPerPurchaseUnit / conversionFactor : 0));
          const totalValue = Number((onHand * costPerBaseUnit).toFixed(2));
          
          let status: 'OK' | 'LOW' | 'CRITICAL' = 'OK';
          if (onHand <= 0) status = 'CRITICAL';
          else if (onHand <= reorderLevel) status = 'LOW';

          return {
            id: Number(item.id || idx + 1),
            code: item.ingredientCode || item.code || `ING-${String(item.id || idx + 1).padStart(3, '0')}`,
            name: item.ingredientName || item.name || 'Raw Ingredient',
            category: this.normalizeCategoryName(item.categoryName || item.category || 'Dairy'),
            store: this.normalizeStoreName(item.storageTypeName || item.store),
            baseUnit: item.baseUnitName || item.baseUnit || 'GRAM',
            purchaseUnit: item.purchaseUnitName || item.purchaseUnit || 'KG',
            conversionFactor: conversionFactor > 0 ? conversionFactor : 1000,
            yieldPercent: Number(item.usableYieldPercent || 95),
            onHand,
            reorderLevel,
            reorderQuantity: Number(item.reorderQuantity || 10000),
            costPerBaseUnit: Number(costPerBaseUnit.toFixed(4)),
            costPerPurchaseUnit,
            totalValue,
            storageType: this.normalizeStorageType(item.storageTypeName || item.storageType || 'CHILLED'),
            supplierName: item.preferredSupplier || item.supplierName || 'Kitchen Supplier',
            lastRestocked: 'Recent',
            status
          };
        });

        this.kitchenIngredientsPage.set(currentPage);
        this.kitchenIngredientsTotalPages.set(totalPages);

        if (append) {
          this.kitchenStockItems.update(existing => {
            const existingIds = new Set(existing.map(i => i.id));
            const newItems = mapped.filter(i => !existingIds.has(i.id));
            return [...existing, ...newItems];
          });
        } else if (mapped.length > 0) {
          this.kitchenStockItems.set(mapped);
        }
      },
      error: (err) => {
        this.kitchenIngredientsLoading.set(false);
        console.warn('[Inventory] Unable to load kitchen ingredients from API:', err);
      }
    });
  }

  nextKitchenIngredientsPage(): void {
    if (this.kitchenIngredientsPage() < this.kitchenIngredientsTotalPages() - 1) {
      this.loadKitchenIngredients(this.kitchenIngredientsPage() + 1, 50);
    }
  }

  prevKitchenIngredientsPage(): void {
    if (this.kitchenIngredientsPage() > 0) {
      this.loadKitchenIngredients(this.kitchenIngredientsPage() - 1, 50);
    }
  }

  private normalizeCategoryName(category?: string): string {
    const raw = String(category || '').trim();
    if (!raw) return 'General';
    const upper = raw.toUpperCase();
    if (upper.includes('SPICE') || upper.includes('COND')) return 'Spices & Condiments';
    if (upper.includes('PROD') || upper.includes('VEG')) return 'Produce';
    if (upper.includes('DAIRY')) return 'Dairy';
    if (upper.includes('MEAT') || upper.includes('POULTRY')) return 'Poultry & Meat';
    if (upper.includes('OIL') || upper.includes('GHEE')) return 'Oils & Ghee';
    if (upper.includes('GROC') || upper.includes('DRY')) return 'Dry Grocery';
    return raw;
  }

  private normalizeStorageType(storage?: string): string {
    const raw = String(storage || '').trim();
    if (!raw) return 'Dry Storage';
    const upper = raw.toUpperCase();
    if (upper.includes('CHILL')) return 'Chilled';
    if (upper.includes('FREEZ') || upper.includes('FROZ')) return 'Frozen';
    if (upper.includes('DRY')) return 'Dry Storage';
    if (upper.includes('ROOM')) return 'Room Temp';
    if (upper.includes('DAILY')) return 'Daily Store';
    return raw;
  }

  private normalizeStoreName(store?: string): string {
    const raw = String(store || '').trim();
    if (!raw) return 'Central Kitchen Store';
    const upper = raw.toUpperCase();
    if (upper.includes('DRY')) return 'Dry Grocery Store';
    if (upper.includes('CHILL') || upper.includes('COLD')) return 'Cold Room / Chilled Store';
    if (upper.includes('FREEZ') || upper.includes('FROZ')) return 'Deep Freezer';
    if (upper.includes('SPICE')) return 'Spices Store';
    if (upper.includes('DAIRY') || upper.includes('CENTRAL')) return 'Central Kitchen Store';
    return raw;
  }

  readonly kitchenCategories = computed(() => ['ALL', ...Array.from(new Set(this.kitchenStockItems().map(item => item.category)))]);
  readonly kitchenStorageTypes = computed(() => ['ALL', ...Array.from(new Set(this.kitchenStockItems().map(item => item.storageType)))]);

  readonly filteredKitchenStock = computed(() => {
    const q = this.kitchenStockSearch().toLowerCase().trim();
    const cat = this.kitchenCategoryFilter();
    const stg = this.kitchenStorageFilter();

    return this.kitchenStockItems().filter(item => {
      const matchesSearch = !q || [item.code, item.name, item.category, item.store, item.supplierName, item.storageType].some(v => v.toLowerCase().includes(q));
      const matchesCat = cat === 'ALL' || item.category === cat;
      const matchesStg = stg === 'ALL' || item.storageType === stg;
      return matchesSearch && matchesCat && matchesStg;
    });
  });

  readonly kitchenStockSummary = computed(() => {
    const items = this.kitchenStockItems();
    const lowStockCount = items.filter(i => i.onHand <= i.reorderLevel).length;
    const totalValuation = items.reduce((sum, i) => sum + i.totalValue, 0);
    return {
      totalSkus: items.length,
      lowStockCount,
      totalValuation
    };
  });

  readonly purchaseRequests = signal<PurchaseRequest[]>([]);
  readonly storeIssues = signal<StoreIssue[]>([]);

  /** Departments loaded from the User Management service (shared singleton). */
  private readonly userManagementService = inject(UserManagementService);
  private readonly purchaseService = inject(PurchaseService);
  readonly departments = this.userManagementService.departments;
  readonly prStatuses = signal<PurchaseMasterOption[]>([]);

  constructor(
    private readonly router: Router,
    private readonly inventoryService: InventoryService
  ) { }

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.loadStockItems();
    this.loadIssueItems();
    this.loadPurchaseRequests();
    this.loadStoreIssues();
    this.loadPrStatuses();
    this.loadDashboard();
    this.loadKitchenIngredients(0, 50);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => this.updateTabFromUrl((event as NavigationEnd).urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  readonly categories = computed(() => ['ALL', ...Array.from(new Set(this.stockItems().map(item => item.category)))]);
  readonly stores = computed(() => ['ALL', ...Array.from(new Set(this.stockItems().map(item => item.store)))]);

  readonly filteredStock = computed(() => {
    const q = this.search().toLowerCase().trim();
    const category = this.categoryFilter();
    const store = this.storeFilter();
    return this.stockItems().filter(item => {
      const matchesSearch = !q || [item.code, item.name, item.category, item.store].some(value => value.toLowerCase().includes(q));
      const matchesCategory = category === 'ALL' || item.category === category;
      const matchesStore = store === 'ALL' || item.store === store;
      return matchesSearch && matchesCategory && matchesStore;
    });
  });

  readonly dashboard = computed(() => {
    const stock = this.stockItems();
    const low = stock.filter(item => this.stockStatus(item) === 'LOW' || this.stockStatus(item) === 'CRITICAL').length;
    const value = stock.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);
    const openRequests = this.purchaseRequests().filter(request => !['Rejected', 'Ordered'].includes(request.status)).length;
    return { totalSku: stock.length, low, value, openRequests };
  });

  readonly requestItemOptions = computed(() => {
    const configured = this.issueItems();
    if (configured.length) return configured;
    return [
      { id: 'HK-LIN-001', code: 'HK-LIN-001', name: 'Bath Towel', unit: 'Pcs', uomId: '', rate: 0 },
      { id: 'HK-AMN-014', code: 'HK-AMN-014', name: 'Dental Kit', unit: 'Pcs', uomId: '', rate: 0 },
      { id: 'LND-DET-003', code: 'LND-DET-003', name: 'Laundry Detergent', unit: 'Kg', uomId: '', rate: 0 },
      { id: 'HK-CHEM-007', code: 'HK-CHEM-007', name: 'Floor Cleaner', unit: 'Ltr', uomId: '', rate: 0 }
    ];
  });

  readonly filteredRequests = computed(() => {
    const q = this.requestSearch().toLowerCase().trim();
    const status = this.requestStatusFilter();
    return this.purchaseRequests().filter(request => {
      const matchesStatus = status === 'ALL' || request.status === status;
      const matchesSearch = !q || [
        request.id,
        request.department,
        request.requestedBy,
        request.status,
        request.purpose,
        ...request.lines.map(line => line.item)
      ].some(value => value.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  });

  readonly dashboardKpis = computed<InventoryDashboardKpi[]>(() => {
    const data = this.dashboardData();
    if (data) {
      return [
        { label: 'Total SKUs', value: String(data.stats.totalSkus), delta: 'Live catalogue size', icon: 'inventory_2', tone: 'blue' },
        { label: 'Low Stock SKUs', value: String(data.stats.lowStockCount), delta: 'Needs attention', icon: 'warning', tone: 'red' },
        { label: 'Stock Value', value: this.formatINR(data.stats.totalStockValue), delta: 'Current inventory val.', icon: 'currency_rupee', tone: 'green' },
        { label: 'Open PRs', value: String(data.stats.openPrsCount), delta: 'Pending procurement', icon: 'assignment_add', tone: 'amber' },
        { label: 'Open Store Issues', value: String(data.stats.openStoreIssuesCount), delta: 'Awaiting fulfillment', icon: 'outbox', tone: 'teal' }
      ];
    }
    return [
      { label: 'Total SKUs', value: '1,248', delta: '+5.2% vs last 7 days', icon: 'inventory_2', tone: 'blue' },
      { label: 'Low Stock SKUs', value: '36', delta: '+12.5% needs attention', icon: 'warning', tone: 'red' },
      { label: 'Stock Value', value: this.formatINR(1248350), delta: '+8.7% vs last 7 days', icon: 'currency_rupee', tone: 'green' },
      { label: 'Open PRs', value: '23', delta: '8 pending approval', icon: 'assignment_add', tone: 'amber' },
      { label: 'Open Store Issues', value: '18', delta: '6 issued today', icon: 'outbox', tone: 'teal' }
    ];
  });

  readonly stockHealth = computed<StockHealthSlice[]>(() => {
    const data = this.dashboardData();
    if (data) {
      const h = data.stockHealth;
      const total = (h.healthyCount + h.lowStockCount + h.outOfStockCount + h.overstockCount) || 1;
      return [
        { label: 'Healthy', value: h.healthyCount, percent: Math.round((h.healthyCount / total) * 100), color: '#149b72' },
        { label: 'Low Stock', value: h.lowStockCount, percent: Math.round((h.lowStockCount / total) * 100), color: '#dc7a28' },
        { label: 'Out of Stock', value: h.outOfStockCount, percent: Math.round((h.outOfStockCount / total) * 100), color: '#e64251' },
        { label: 'Overstock', value: h.overstockCount, percent: Math.round((h.overstockCount / total) * 100), color: '#2563eb' }
      ];
    }
    return [
      { label: 'Healthy', value: 924, percent: 74, color: '#149b72' },
      { label: 'Low Stock', value: 36, percent: 3, color: '#dc7a28' },
      { label: 'Out of Stock', value: 22, percent: 2, color: '#e64251' },
      { label: 'Overstock', value: 266, percent: 21, color: '#2563eb' }
    ];
  });

  readonly reorderWatch = computed<ReorderWatchItem[]>(() => {
    const data = this.dashboardData();
    if (data) {
      return data.reorderWatch.map(i => ({
        item: i.itemName,
        store: i.storeName,
        onHand: `${i.onHand} ${i.unit}`,
        reorderAt: `${i.reorderLevel} ${i.unit}`,
        status: (i.status.toUpperCase() === 'CRITICAL' ? 'CRITICAL' : 'LOW') as 'LOW' | 'CRITICAL'
      }));
    }
    return [
      { item: 'Bath Towel', store: 'Main Store', onHand: '82 Pcs', reorderAt: '140 Pcs', status: 'LOW' },
      { item: 'Laundry Detergent', store: 'Laundry Store', onHand: '8 Kg', reorderAt: '25 Kg', status: 'CRITICAL' },
      { item: 'Coffee Sachet', store: 'HK Pantry', onHand: '18 Pcs', reorderAt: '100 Pcs', status: 'LOW' },
      { item: 'Dental Kit', store: 'HK Pantry', onHand: '6 Pcs', reorderAt: '40 Pcs', status: 'CRITICAL' },
      { item: 'Floor Cleaner', store: 'Main Store', onHand: '4 Ltr', reorderAt: '18 Ltr', status: 'LOW' }
    ];
  });

  readonly prPipeline = computed(() => {
    const data = this.dashboardData();
    if (data) {
      const p = data.prPipeline;
      return [
        { status: 'Draft', count: p.draft.count, value: p.draft.value, color: '#8a8f91' },
        { status: 'Submitted', count: p.submitted.count, value: p.submitted.value, color: '#2563eb' },
        { status: 'Approved', count: p.approved.count, value: p.approved.value, color: '#dc7a28' },
        { status: 'Ordered', count: p.ordered.count, value: p.ordered.value, color: '#7c3aed' },
        { status: 'Rejected', count: p.rejected.count, value: p.rejected.value, color: '#e64251' }
      ];
    }
    return [
      { status: 'Draft', count: 5, value: 56240, color: '#8a8f91' },
      { status: 'Submitted', count: 8, value: 248760, color: '#2563eb' },
      { status: 'Approved', count: 6, value: 391820, color: '#dc7a28' },
      { status: 'Ordered', count: 3, value: 132450, color: '#7c3aed' },
      { status: 'Rejected', count: 1, value: 18900, color: '#e64251' }
    ];
  });

  readonly dashboardMovements = computed<DashboardMovement[]>(() => {
    const data = this.dashboardData();
    if (data) {
      return data.todayMovement.map(m => ({
        id: m.issueNo,
        department: m.department,
        item: m.itemName,
        qty: `${m.quantity} ${m.unit}`,
        status: m.status,
        date: 'Today'
      }));
    }
    return [
      { id: 'ISS-2401', department: 'Housekeeping', item: 'Bath Towel', qty: '12 Pcs', status: 'Issued', date: 'May 11' },
      { id: 'ISS-2402', department: 'Laundry', item: 'Laundry Detergent', qty: '8 Kg', status: 'Open', date: 'May 11' },
      { id: 'ISS-2403', department: 'Housekeeping', item: 'Dental Kit', qty: '48 Pcs', status: 'Issued', date: 'May 10' },
      { id: 'ISS-2404', department: 'Front Office', item: 'Coffee Sachet', qty: '75 Pcs', status: 'Closed', date: 'May 10' }
    ];
  });

  readonly categoryExposure = signal<DashboardDistribution[]>([
    { name: 'Housekeeping Supplies', count: 520, value: 512450, percent: 41 },
    { name: 'Guest Amenities', count: 280, value: 234880, percent: 19 },
    { name: 'Laundry Consumables', count: 220, value: 198350, percent: 16 },
    { name: 'F&B Supplies', count: 78, value: 48470, percent: 4 },
    { name: 'Others', count: 150, value: 254200, percent: 20 }
  ]);

  readonly storeDistribution = signal<DashboardDistribution[]>([
    { name: 'Main Store', count: 620, value: 612300, percent: 49 },
    { name: 'HK Pantry', count: 210, value: 218750, percent: 18 },
    { name: 'Laundry Store', count: 180, value: 172900, percent: 14 },
    { name: 'F&B Store', count: 88, value: 54000, percent: 4 },
    { name: 'Others', count: 150, value: 190400, percent: 15 }
  ]);

  readonly quickActions = [
    { label: 'Review Stock Ledger', icon: 'inventory_2', tab: 'stock' as InventoryTab },
    { label: 'Create Purchase Request', icon: 'assignment_add', tab: 'requests' as InventoryTab },
    { label: 'Issue Store Stock', icon: 'outbox', tab: 'issues' as InventoryTab },
    { label: 'Check Reorder Items', icon: 'fact_check', tab: 'stock' as InventoryTab },
    { label: 'PR Approval Queue', icon: 'rule', tab: 'requests' as InventoryTab }
  ];

  setTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/inventory/${tab}`]);
  }

  openCreateModal(type: 'request' | 'issue'): void {
    if (type === 'request') {
      this.selectedPurchaseRequest.set(null);
      this.purchaseRequestDraft.set(this.emptyPurchaseRequestDraft());
    } else if (type === 'issue') {
      this.selectedStoreIssue.set(null);
      this.storeIssueDraft.set(this.emptyStoreIssueDraft());
    }
    this.createModal.set(type);
  }

  closeCreateModal(): void {
    this.createModal.set(null);
    this.selectedPurchaseRequest.set(null);
    this.selectedStoreIssue.set(null);
    this.purchaseRequestDraft.set(this.emptyPurchaseRequestDraft());
    this.storeIssueDraft.set(this.emptyStoreIssueDraft());
  }

  createModalTitle(): string {
    const type = this.createModal();
    if (type === 'request') return this.selectedPurchaseRequest() ? 'Edit Purchase Request' : 'Create Purchase Request';
    if (type === 'issue') return this.selectedStoreIssue() ? 'Edit Store Issue' : 'Issue Store Stock';
    return '';
  }

  viewPurchaseRequest(request: PurchaseRequest): void {
    this.purchaseRequestDetail.set(request);
  }

  closePurchaseRequestDetail(): void {
    this.purchaseRequestDetail.set(null);
  }

  editPurchaseRequest(request: PurchaseRequest): void {
    if (this.requestLoadingId()) return;
    this.requestLoadingId.set(request.apiId);
    this.requestError.set(null);
    this.inventoryService.getPurchaseRequestById(request.apiId).subscribe({
      next: response => {
        this.requestLoadingId.set(null);
        this.openPurchaseRequestEditor(response ? this.mapPurchaseRequest(response, 0) : request);
      },
      error: error => {
        this.requestLoadingId.set(null);
        this.requestError.set(error?.error?.message || error?.message || 'Unable to load purchase request details.');
      }
    });
  }

  private openPurchaseRequestEditor(request: PurchaseRequest): void {
    this.selectedPurchaseRequest.set(request);
    this.purchaseRequestDraft.set(this.clonePurchaseRequest(request));
    this.createModal.set('request');
  }

  deletePurchaseRequest(request: PurchaseRequest): void {
    this.purchaseRequestPendingDelete.set(request);
  }

  closeDeletePurchaseRequest(): void {
    this.purchaseRequestPendingDelete.set(null);
  }

  confirmDeletePurchaseRequest(): void {
    const pending = this.purchaseRequestPendingDelete();
    if (!pending || this.requestDeletingId()) return;

    this.requestDeletingId.set(pending.apiId);
    this.requestError.set(null);
    this.inventoryService.deletePurchaseRequest(pending.apiId).subscribe({
      next: () => {
        this.requestDeletingId.set(null);
        this.purchaseRequestPendingDelete.set(null);
        this.loadPurchaseRequests();
        this.loadDashboard();
      },
      error: error => {
        this.requestError.set(error?.error?.message || error?.message || 'Unable to delete purchase request.');
        this.requestDeletingId.set(null);
      }
    });
  }

  updatePurchaseRequestDraft(field: keyof Omit<PurchaseRequestDraft, 'lines'>, value: string): void {
    this.purchaseRequestDraft.update(draft => ({ ...draft, [field]: value }));
  }

  onPurchaseRequestDepartmentChange(departmentId: number | string): void {
    const selected = this.departments().find((d: DepartmentOption) => String(d.id) === String(departmentId));
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      departmentId,
      department: selected?.name || ''
    }));
  }

  onPurchaseRequestStatusChange(statusId: number | string): void {
    const selected = this.prStatuses().find(s => String(s.id) === String(statusId));
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      statusId,
      status: selected?.value || '',
      statusCode: selected?.code || ''
    }));
  }

  addRequestLine(): void {
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      lines: [
        ...draft.lines,
        { id: Date.now(), itemId: '', item: '', uomId: '', unit: 'Pcs', quantity: 1, estimatedRate: 0 }
      ]
    }));
  }

  updateRequestLine(lineId: number, field: keyof PurchaseRequestLine, value: string | number): void {
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      lines: draft.lines.map(line => {
        if (line.id !== lineId) return line;
        if (field !== 'itemId') return { ...line, [field]: value };

        const selected = this.requestItemOptions().find(item => String(item.id) === String(value));
        return {
          ...line,
          itemId: value,
          item: selected?.name || '',
          uomId: selected?.uomId || '',
          unit: selected?.unit || line.unit,
          estimatedRate: selected?.rate || line.estimatedRate
        };
      })
    }));
  }

  removeRequestLine(lineId: number): void {
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      lines: draft.lines.length > 1 ? draft.lines.filter(line => line.id !== lineId) : draft.lines
    }));
  }

  savePurchaseRequest(): void {
    if (this.requestSaving()) return;

    const draft = this.purchaseRequestDraft();
    const payload = this.purchaseRequestPayload(draft);
    const selected = this.selectedPurchaseRequest();

    this.requestSaving.set(true);
    this.requestError.set(null);

    const apiCall = selected?.apiId
      ? this.inventoryService.updatePurchaseRequest(selected.apiId, payload)
      : this.inventoryService.createPurchaseRequest(payload);

    apiCall.subscribe({
      next: () => {
        this.requestSaving.set(false);
        this.closeCreateModal();
        this.loadPurchaseRequests();
        this.loadDashboard();
      },
      error: error => {
        this.requestError.set(error?.error?.message || error?.message || 'Unable to save purchase request.');
        this.requestSaving.set(false);
      }
    });
  }

  requestTotal(request: PurchaseRequest | PurchaseRequestDraft): number {
    return request.lines.reduce((sum, line) => sum + line.quantity * line.estimatedRate, 0);
  }

  editStoreIssue(issue: StoreIssue): void {
    if (this.issueLoadingId()) return;

    this.issueLoadingId.set(issue.apiId);
    this.issueError.set(null);
    this.inventoryService.getStoreIssueById(issue.apiId).subscribe({
      next: response => {
        this.issueLoadingId.set(null);
        this.openStoreIssueEditor(response ? this.mapStoreIssue(response, 0) : issue);
      },
      error: error => {
        this.issueLoadingId.set(null);
        this.issueError.set(error?.error?.message || error?.message || 'Unable to load store issue details.');
      }
    });
  }

  updateStoreIssueDraft(field: keyof StoreIssueDraft, value: string | number): void {
    this.storeIssueDraft.update(draft => ({ ...draft, [field]: value }));
  }

  onStoreIssueItemChange(itemId: string | number): void {
    const selected = this.issueItems().find(item => String(item.id) === String(itemId));
    this.storeIssueDraft.update(draft => ({
      ...draft,
      itemId,
      item: selected?.name || '',
      uomId: selected?.uomId || '',
      unit: selected?.unit || draft.unit
    }));
  }

  onStoreIssueDepartmentChange(departmentId: number | string): void {
    const selected = this.departments().find((d: DepartmentOption) => String(d.id) === String(departmentId));
    this.storeIssueDraft.update(draft => ({
      ...draft,
      departmentId,
      department: selected?.name || ''
    }));
  }

  saveStoreIssue(): void {
    if (this.issueSaving()) return;

    const draft = this.storeIssueDraft();
    const selected = this.selectedStoreIssue();
    const payload = this.storeIssuePayload(draft);
    const request = selected
      ? this.inventoryService.updateStoreIssue(selected.apiId, payload)
      : this.inventoryService.createStoreIssue(payload);

    this.issueSaving.set(true);
    this.issueError.set(null);
    request.subscribe({
      next: () => {
        this.issueSaving.set(false);
        this.closeCreateModal();
        this.loadStoreIssues();
        this.loadDashboard();
      },
      error: error => {
        this.issueError.set(error?.error?.message || error?.message || 'Unable to save store issue.');
        this.issueSaving.set(false);
      }
    });
  }

  deleteStoreIssue(issue: StoreIssue): void {
    if (this.issueDeletingId()) return;
    this.storeIssuePendingDelete.set(issue);
  }

  closeDeleteStoreIssue(): void {
    if (this.issueDeletingId()) return;
    this.storeIssuePendingDelete.set(null);
  }

  confirmDeleteStoreIssue(): void {
    const issue = this.storeIssuePendingDelete();
    if (!issue || this.issueDeletingId()) return;

    this.issueDeletingId.set(issue.apiId);
    this.issueError.set(null);
    this.inventoryService.deleteStoreIssue(issue.apiId).subscribe({
      next: () => {
        this.issueDeletingId.set(null);
        this.storeIssuePendingDelete.set(null);
        this.loadStoreIssues();
        this.loadDashboard();
      },
      error: error => {
        this.issueError.set(error?.error?.message || error?.message || 'Unable to delete store issue.');
        this.issueDeletingId.set(null);
      }
    });
  }

  stockStatus(item: StoreItem): StockStatus {
    if (item.onHand <= item.reorderLevel * 0.5) return 'CRITICAL';
    if (item.onHand <= item.reorderLevel) return 'LOW';
    if (item.onHand > item.parLevel) return 'OVERSTOCK';
    return 'OK';
  }

  stockStatusLabel(item: StoreItem): string {
    return this.stockStatus(item).replace('_', ' ');
  }

  formatINR(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  private loadDashboard(): void {
    this.inventoryService.getInventoryDashboard().subscribe({
      next: data => this.dashboardData.set(data),
      error: () => this.dashboardData.set(null)
    });
  }

  private loadStockItems(): void {
    this.isLoadingStock.set(true);
    this.stockError.set(null);
    this.inventoryService.getAllStockItems().subscribe({
      next: items => {
        this.stockItems.set(items.map((item, index) => this.mapStockItem(item, index)));
        this.isLoadingStock.set(false);
      },
      error: error => {
        this.stockItems.set([]);
        this.stockError.set(error?.error?.message || error?.message || 'Unable to load stock items.');
        this.isLoadingStock.set(false);
      }
    });
  }

  private loadStoreIssues(): void {
    this.isLoadingIssues.set(true);
    this.issueError.set(null);
    this.inventoryService.getAllStoreIssues().subscribe({
      next: issues => {
        this.storeIssues.set(issues.map((issue, index) => this.mapStoreIssue(issue, index)));
        this.isLoadingIssues.set(false);
      },
      error: error => {
        this.storeIssues.set([]);
        this.issueError.set(error?.error?.message || error?.message || 'Unable to load store issues.');
        this.isLoadingIssues.set(false);
      }
    });
  }

  private loadPurchaseRequests(): void {
    this.isLoadingRequests.set(true);
    this.requestError.set(null);
    this.inventoryService.getAllPurchaseRequests().subscribe({
      next: requests => {
        this.purchaseRequests.set(requests.map((req, index) => this.mapPurchaseRequest(req, index)));
        this.isLoadingRequests.set(false);
      },
      error: error => {
        this.purchaseRequests.set([]);
        this.requestError.set(error?.error?.message || error?.message || 'Unable to load purchase requests.');
        this.isLoadingRequests.set(false);
      }
    });
  }

  private loadIssueItems(): void {
    this.isLoadingIssueItems.set(true);
    this.issueItemError.set(null);
    this.inventoryService.getItemConfigs().subscribe({
      next: items => {
        this.issueItems.set(items
          .map((item, index) => this.mapIssueItemOption(item, index))
          .filter(item => item.name && item.active !== false));
        this.isLoadingIssueItems.set(false);
      },
      error: error => {
        this.issueItems.set([]);
        this.issueItemError.set(error?.error?.message || error?.message || 'Unable to load item configuration.');
        this.isLoadingIssueItems.set(false);
      }
    });
  }

  private mapStockItem(item: StockItemPayload, index: number): StoreItem {
    const onHand = this.toNumber(item.onHand ?? item.currentStock ?? item.availableStock ?? item.stockQuantity ?? item.quantity);
    const reorderLevel = this.toNumber(item.reorderLevel ?? item.reOrderLevel ?? item.minStockLevel);
    const parLevel = this.toNumber(item.parLevel ?? item.maxStockLevel);

    return {
      id: this.toNumber(item.id ?? item.stockId ?? item.itemId) || index + 1,
      code: this.text(item.code ?? item.itemCode ?? item.skuCode, '-'),
      name: this.text(item.name ?? item.itemName, 'Stock Item'),
      category: this.text(item.category ?? item.categoryName, 'Uncategorized'),
      store: this.text(item.store ?? item.storeName, 'Store'),
      unit: this.text(item.unit ?? item.uom ?? item.uomName, 'Unit'),
      onHand,
      reorderLevel,
      parLevel,
      unitCost: this.toNumber(item.unitCost ?? item.rate ?? item.costPrice),
      lastUpdated: this.text(item.lastUpdated ?? item.updatedAt, '')
    };
  }

  private mapStoreIssue(issue: StoreIssuePayload, index: number): StoreIssue {
    const apiId = issue.id ?? issue.storeIssueId ?? issue.issueId ?? index + 1;
    const itemName = this.text(issue.item ?? issue.itemName ?? issue.itemCode, '-');
    const status = this.normalizeIssueStatus(issue.statusName ?? issue.status ?? issue.statusCode);
    // Resolve departmentName from the loaded departments list if departmentId is present
    const deptId = issue.departmentId ?? '';
    const deptName = deptId
      ? (this.departments().find((d: DepartmentOption) => String(d.id) === String(deptId))?.name ?? this.text(issue.department ?? issue.departmentName, '-'))
      : this.text(issue.department ?? issue.departmentName, '-');

    return {
      apiId,
      itemId: issue.itemId ?? '',
      id: this.text(issue.issueNo ?? issue.issueNumber ?? issue.storeIssueNo ?? issue.code ?? apiId, `ISS-${String(index + 1).padStart(4, '0')}`),
      departmentId: deptId,
      department: deptName,
      issuedTo: this.text(issue.issuedTo ?? issue.issuedToName, '-'),
      item: itemName,
      quantity: this.toNumber(issue.quantity ?? issue.qty),
      uomId: issue.uomId ?? '',
      unit: this.text(issue.unit ?? issue.uom ?? issue.uomName, ''),
      date: this.formatDateValue(issue.issueDate ?? issue.date ?? issue.createdAt),
      status,
      statusId: issue.statusId ?? '',
      note: this.text(issue.issueNote ?? issue.note ?? issue.remarks, '')
    };
  }

  private storeIssuePayload(draft: StoreIssueDraft): StoreIssuePayload {
    return {
      itemId: draft.itemId || undefined,
      departmentId: draft.departmentId || undefined,
      issuedTo: draft.issuedTo,
      quantity: draft.quantity,
      issueNote: draft.note,
      issueDate: draft.date,
      statusId: draft.statusId || undefined
    };
  }

  private emptyStoreIssueDraft(): StoreIssueDraft {
    return {
      itemId: '',
      departmentId: '',
      department: '',
      issuedTo: '',
      item: '',
      quantity: 1,
      uomId: '',
      unit: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'Issued',
      statusId: '',
      note: ''
    };
  }

  private emptyPurchaseRequestDraft(): PurchaseRequestDraft {
    return {
      departmentId: '',
      department: '',
      requestedBy: '',
      neededBy: new Date().toISOString().slice(0, 10),
      status: '',
      statusId: '',
      statusCode: '',
      purpose: '',
      lines: [
        { id: 1, itemId: '', item: '', uomId: '', unit: '', quantity: 1, estimatedRate: 0 }
      ]
    };
  }

  private clonePurchaseRequest(request: PurchaseRequest): PurchaseRequestDraft {
    return {
      apiId: request.apiId,
      id: request.id,
      departmentId: request.departmentId,
      department: request.department,
      requestedBy: request.requestedBy,
      neededBy: request.neededBy,
      status: request.status,
      statusId: request.statusId,
      statusCode: request.statusCode,
      purpose: request.purpose,
      lines: request.lines.map(line => ({ ...line }))
    };
  }

  private mapPurchaseRequest(request: PurchaseRequestPayload, index: number): PurchaseRequest {
    const apiId = request.id ?? request.purchaseRequestId ?? index + 1;
    const deptId = request.departmentId ?? '';
    const deptName = deptId
      ? (this.departments().find((d: DepartmentOption) => String(d.id) === String(deptId))?.name ?? this.text(request.department ?? request.departmentName, '-'))
      : this.text(request.department ?? request.departmentName, '-');
    const statusId = request.statusId ?? '';
    const statusCode = this.text(request.statusCode, '');
    const statusName = this.text(request.statusName ?? request.status, 'Draft');

    return {
      apiId,
      id: this.text(request.prNo ?? request.prNumber, `PR-${String(index + 1).padStart(4, '0')}`),
      departmentId: deptId,
      department: deptName,
      requestedBy: this.text(request.requestedBy, '-'),
      neededBy: this.formatDateValue(request.neededBy ?? request.issueDate ?? request.createdAt),
      status: statusName,
      statusId,
      statusCode,
      purpose: this.text(request.purpose ?? request.justification, ''),
      lines: this.listData(request.lines ?? request.items).map((line, lIndex) => {
        const itemConfig = this.issueItems().find(item => String(item.id) === String(line.itemId));
        return {
          id: lIndex + 1,
          apiId: line.id ?? '',
          itemId: line.itemId ?? '',
          item: line.itemName ?? line.itemCode ?? itemConfig?.name ?? '-',
          uomId: itemConfig?.uomId || line.uomId || '',
          unit: itemConfig?.unit || this.text(line.unit, ''),
          quantity: this.toNumber(line.requiredQuantity ?? line.quantity),
          estimatedRate: this.toNumber(line.unitPrice ?? line.rate ?? line.estimatedRate)
        };
      })
    };
  }

  private purchaseRequestPayload(draft: PurchaseRequestDraft): PurchaseRequestPayload {
    const statusOption = this.prStatuses().find(s => String(s.id) === String(draft.statusId));
    return {
      departmentId: draft.departmentId || undefined,
      requestedBy: draft.requestedBy,
      neededBy: draft.neededBy,
      justification: draft.purpose,
      expectedAmount: draft.lines.reduce((sum, l) => sum + l.quantity * l.estimatedRate, 0),
      statusId: draft.statusId || undefined,
      statusName: statusOption?.value || draft.status || undefined,
      statusCode: statusOption?.code || draft.statusCode || undefined,
      items: draft.lines.map(line => ({
        id: line.apiId || undefined,
        itemId: line.itemId || undefined,
        itemName: line.item || undefined,
        itemCode: typeof line.itemId === 'string' ? line.itemId : undefined,
        requiredQuantity: line.quantity,
        unitPrice: line.estimatedRate
      }))
    };
  }

  private listData<T>(res: T[] | undefined | null): T[] {
    return Array.isArray(res) ? res : [];
  }

  private nextPurchaseRequestId(): string {
    const next = Math.max(1000, ...this.purchaseRequests().map(request => Number(request.id.replace(/\D/g, '')) || 0)) + 1;
    return `PR-${next}`;
  }

  private mapIssueItemOption(item: ItemConfigPayload, index: number): IssueItemOption {
    const id = item.id ?? item.itemId ?? index + 1;
    return {
      id,
      code: this.text(item.code ?? item.itemCode, ''),
      name: this.text(item.name ?? item.itemName, ''),
      uomId: item.uomId ?? '',
      unit: this.text(item.unit ?? item.uom ?? item.uomName, 'Pcs'),
      rate: this.toNumber(item.rate ?? item.unitPrice ?? item.costPrice ?? item.unitCost),
      active: item.isActive ?? item.active ?? true
    };
  }

  private openStoreIssueEditor(issue: StoreIssue): void {
    const itemConfig = this.issueItems().find(item => String(item.id) === String(issue.itemId));

    this.selectedStoreIssue.set(issue);
    this.storeIssueDraft.set({
      departmentId: issue.departmentId,
      department: issue.department,
      issuedTo: issue.issuedTo,
      itemId: issue.itemId,
      item: itemConfig?.name || issue.item,
      quantity: issue.quantity,
      uomId: itemConfig?.uomId || issue.uomId,
      unit: itemConfig?.unit || issue.unit,
      date: issue.date,
      status: issue.status,
      statusId: issue.statusId,
      note: issue.note
    });
    this.createModal.set('issue');
  }

  private normalizeIssueStatus(value: unknown): IssueStatus {
    const status = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (status === 'open') return 'Open';
    if (status === 'closed') return 'Closed';
    return 'Issued';
  }

  private loadPrStatuses(): void {
    this.purchaseService.getCommonMaster('PR_STATUS').subscribe({
      next: statuses => this.prStatuses.set(statuses),
      error: () => this.prStatuses.set([])
    });
  }

  private formatDateValue(value: unknown): string {
    const text = String(value || '').trim();
    return text ? text.slice(0, 10) : '';
  }

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private text(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  quickReorderKitchenIngredient(item: KitchenIngredientStock): void {
    const draft = this.emptyPurchaseRequestDraft();
    draft.purpose = `Replenish low stock for ${item.name} (${item.code})`;
    draft.lines = [
      {
        id: Date.now(),
        itemId: item.code,
        item: item.name,
        uomId: '',
        unit: item.purchaseUnit,
        quantity: Math.ceil(item.reorderQuantity / item.conversionFactor),
        estimatedRate: item.costPerPurchaseUnit
      }
    ];
    this.selectedPurchaseRequest.set(null);
    this.purchaseRequestDraft.set(draft);
    this.createModal.set('request');
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/inventory/stock')) this.activeTab.set('stock');
    else if (url.includes('/inventory/kitchen-stock')) this.activeTab.set('kitchen-stock');
    else if (url.includes('/inventory/requests')) this.activeTab.set('requests');
    else if (url.includes('/inventory/issues')) this.activeTab.set('issues');
    else this.activeTab.set('dashboard');
  }
}
