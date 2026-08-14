import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, forkJoin } from 'rxjs';
import { ItemConfigPayload, PurchaseMasterOption, PurchaseOrderPayload, PurchaseService, SupplierPayload, PurchaseDashboardData } from './purchase.service';

type PurchaseTab = 'dashboard' | 'suppliers' | 'orders' | 'items';
type SupplierStatus = string;
type PoStatus = 'Draft' | 'Approved' | 'Partially Received' | 'Closed';

interface Supplier {
  id: number;
  code: string;
  name: string;
  categoryId?: number;
  category: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstin: string;
  pan: string;
  paymentTermsId?: number;
  paymentTerms: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  creditLimit: number;
  outstanding: number;
  statusId?: number;
  statusCode?: string;
  status: SupplierStatus;
}

interface SupplierDraft {
  id?: number;
  name: string;
  categoryId?: number;
  contact: string;
  phone: string;
  email: string;
  paymentTermsId?: number;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstin: string;
  pan: string;
  creditLimit: number | null;
  bankName: string;
  accountNo: string;
  ifsc: string;
  statusId?: number;
}

interface PurchaseOrderItem {
  id?: number;
  itemId?: number;
  itemCode: string;
  itemName: string;
  uom: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  discountPercent: number;
  total: number;
}

interface PurchaseOrder {
  recordId?: number;
  id: string;
  supplierId?: number;
  supplier: string;
  departmentId?: number;
  department: string;
  orderedOn: string;
  expectedOn: string;
  items: number;
  amount: number;
  status: PoStatus;
  statusId?: number;
  statusCode?: string;
  
  deliveryLocation: string;
  deliveryStoreId?: number;
  paymentTermsId?: number;
  paymentTerms: string;
  requestedBy: string;
  poDate: string;
  referenceNo?: string;
  shippingCharges: number;
  subtotal: number;
  taxTotal: number;
  notes?: string;
  purchaseItemCategoryId?: number;
  itemCategoryScope?: string;
  lineItems: PurchaseOrderItem[];
}

interface PurchaseOrderDraft {
  id?: string;
  poNumber: string;
  supplierId?: number;
  supplier: string;
  department: string;
  poDate: string;
  expectedOn: string;
  departmentId?: number;
  deliveryLocation: string;
  deliveryStoreId?: number;
  paymentTermsId?: number;
  paymentTerms: string;
  requestedBy: string;
  referenceNo: string;
  shippingCharges: number;
  notes: string;
  purchaseItemCategoryId?: number;
  itemCategoryScope?: string;
  lineItems: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  amount: number;
}

interface MasterInventoryItem {
  id: number;
  code: string;
  name: string;
  categoryId?: number;
  category: string;
  uomId?: number;
  unit: string;
  unitCost: number;
  taxRate: number;
  description?: string;
  hsnCode?: string;
  reorderLevel?: number;
  onHandStock?: number;
  parLevel?: number;
  isActive: boolean;
}

interface LowStockDisplayItem extends MasterInventoryItem {
  currentStock: number;
  isLow: boolean;
}

interface ItemDraft {
  id?: number;
  code: string;
  name: string;
  categoryId?: number;
  category: string;
  uomId?: number;
  unit: string;
  unitCost: number | null;
  taxRate: number | null;
  description: string;
  hsnCode: string;
  reorderLevel: number | null;
  onHandStock: number | null;
  parLevel: number | null;
  isActive: boolean;
}

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css']
})
export class PurchaseComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  activeTab = signal<PurchaseTab>('dashboard');
  search = signal('');
  poStatusFilter = signal<'ALL' | PoStatus>('ALL');
  createModal = signal<'supplier' | 'po' | 'item' | null>(null);
  selectedSupplier = signal<Supplier | null>(null);
  supplierDraft = signal<SupplierDraft>(this.emptySupplierDraft());
  supplierFormSubmitted = signal(false);
  touchedFields = signal<Record<string, boolean>>({});
  supplierDetail = signal<Supplier | null>(null);
  supplierPendingDelete = signal<Supplier | null>(null);
  purchaseOrderPendingDelete = signal<PurchaseOrder | null>(null);
  purchaseOrderDetail = signal<PurchaseOrder | null>(null);
  purchaseOrderDetailError = signal('');
  poDeleting = signal(false);
  poDeleteError = signal('');
  selectedPurchaseOrder = signal<PurchaseOrder | null>(null);
  supplierCategories = signal<PurchaseMasterOption[]>([]);
  departments = signal<PurchaseMasterOption[]>([]);
  deliveryStores = signal<PurchaseMasterOption[]>([]);
  paymentTerms = signal<PurchaseMasterOption[]>([]);
  supplierStatuses = signal<PurchaseMasterOption[]>([]);
  itemCategoryScopes = signal<PurchaseMasterOption[]>([]);
  itemCategories = signal<PurchaseMasterOption[]>([]);
  uomOptions = signal<PurchaseMasterOption[]>([]);
  supplierLoading = signal(false);
  poLoading = signal(false);
  poSaving = signal(false);
  poError = signal('');
  dashboardData = signal<PurchaseDashboardData | null>(null);

  readonly suppliers = signal<Supplier[]>([]);

  masterItems = signal<MasterInventoryItem[]>([]);

  kitchenIngredientsPage = signal<number>(0);
  kitchenIngredientsTotalPages = signal<number>(1);
  kitchenIngredientsLoading = signal<boolean>(false);
  kitchenIngredients = signal<MasterInventoryItem[]>([]);

  loadKitchenIngredients(page: number = 0, size: number = 20, append: boolean = false): void {
    if (this.kitchenIngredientsLoading()) return;
    this.kitchenIngredientsLoading.set(true);

    this.purchaseService.getKitchenIngredients(page, size).subscribe({
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

        const mapped: MasterInventoryItem[] = rawItems.map(item => ({
          id: Number(item.id || 0),
          code: item.ingredientCode || item.code || `ING-${String(item.id || 1).padStart(3, '0')}`,
          name: item.ingredientName || item.name || 'Raw Ingredient',
          category: 'Kitchen Raw Material',
          unit: item.purchaseUnitName || item.baseUnitName || item.purchaseUnit || item.baseUnit || 'Kg',
          unitCost: Number(item.costPerPurchaseUnit ?? item.costPerBaseUnit ?? item.unitCost ?? 0),
          taxRate: 5,
          description: `${item.ingredientName || item.name || 'Ingredient'} (${item.categoryName || 'Kitchen Raw'})`,
          reorderLevel: Number(item.reorderThresholdLevel || 0),
          parLevel: Number(item.reorderQuantity || 0),
          isActive: true
        }));

        this.kitchenIngredientsPage.set(currentPage);
        this.kitchenIngredientsTotalPages.set(totalPages);

        if (append) {
          this.kitchenIngredients.update(existing => {
            const existingIds = new Set(existing.map(i => i.id));
            const newItems = mapped.filter(i => !existingIds.has(i.id));
            return [...existing, ...newItems];
          });
        } else {
          this.kitchenIngredients.set(mapped);
        }
      },
      error: (err) => {
        this.kitchenIngredientsLoading.set(false);
        console.warn('[Purchase] Unable to load kitchen raw ingredients from API:', err);
      }
    });
  }

  nextKitchenIngredientsPage(): void {
    if (this.kitchenIngredientsPage() < this.kitchenIngredientsTotalPages() - 1) {
      this.loadKitchenIngredients(this.kitchenIngredientsPage() + 1, 20);
    }
  }

  prevKitchenIngredientsPage(): void {
    if (this.kitchenIngredientsPage() > 0) {
      this.loadKitchenIngredients(this.kitchenIngredientsPage() - 1, 20);
    }
  }

  readonly availablePoMasterItems = computed(() => {
    const scope = (this.poDraft().itemCategoryScope || 'ALL').toUpperCase();
    const items = this.masterItems();
    const apiKitchen = this.kitchenIngredients();

    if (scope === 'HOTEL_GENERAL' || scope.includes('HOTEL') || scope.includes('GENERAL')) {
      return items.filter(item => !item.category.toLowerCase().includes('kitchen') && item.code.indexOf('ING-') !== 0);
    }
    if (scope === 'KITCHEN_INGREDIENTS' || scope.includes('KITCHEN') || scope.includes('INGREDIENT')) {
      if (apiKitchen.length) {
        const apiIds = new Set(apiKitchen.map(k => k.id));
        const mockKitchen = items.filter(i => (i.category.toLowerCase().includes('kitchen') || i.code.indexOf('ING-') === 0) && !apiIds.has(i.id));
        return [...apiKitchen, ...mockKitchen];
      }
      return items.filter(item => item.category.toLowerCase().includes('kitchen') || item.code.indexOf('ING-') === 0);
    }
    if (apiKitchen.length) {
      const apiIds = new Set(apiKitchen.map(k => k.id));
      const nonKitchen = items.filter(i => !apiIds.has(i.id));
      return [...apiKitchen, ...nonKitchen];
    }
    return items;
  });

  readonly purchaseOrders = signal<PurchaseOrder[]>([]);

  poDraft = signal<PurchaseOrderDraft>(this.emptyPoDraft());
  poFormSubmitted = signal(false);
  poTouchedFields = signal<Record<string, boolean>>({});

  itemDraft = signal<ItemDraft>(this.emptyItemDraft());
  itemFormSubmitted = signal(false);
  itemTouchedFields = signal<Record<string, boolean>>({});
  selectedItem = signal<MasterInventoryItem | null>(null);
  itemPendingDelete = signal<MasterInventoryItem | null>(null);
  itemSearch = signal('');
  itemLoading = signal(false);
  itemSaving = signal(false);
  itemError = signal('');
  itemDeleting = signal(false);
  itemDeleteError = signal('');

  readonly filteredItems = computed(() => {
    const q = this.itemSearch().toLowerCase().trim();
    return this.masterItems().filter(item =>
      !q || [item.code, item.name, item.category, item.unit, item.hsnCode || ''].some(v => v.toLowerCase().includes(q))
    );
  });

  constructor(
    private readonly router: Router,
    private readonly purchaseService: PurchaseService
  ) {}

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => this.updateTabFromUrl((event as NavigationEnd).urlAfterRedirects));
    this.loadSupplierLookups();
    this.loadItemConfigs();
    this.purchaseOrders.set([]);
    this.loadPurchaseOrders();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  readonly filteredSuppliers = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.suppliers().filter(supplier => !q || [supplier.code, supplier.name, supplier.category, supplier.contact, supplier.phone, supplier.email, supplier.gstin].some(value => value.toLowerCase().includes(q)));
  });

  readonly filteredOrders = computed(() => {
    const status = this.poStatusFilter();
    return this.purchaseOrders().filter(order => status === 'ALL' || order.status === status);
  });

  readonly activePurchaseOrders = computed<PurchaseOrder[]>(() => {
    const data = this.dashboardData();
    if (data) {
      return data.pendingProcurement.map(po => ({
        recordId: po.poId,
        id: po.poNumber,
        supplier: po.supplierName,
        expectedOn: po.expectedDate,
        status: po.status as PoStatus,
        statusCode: po.statusCode,
        department: '',
        orderedOn: '',
        items: 0,
        amount: 0,
        deliveryLocation: '',
        paymentTerms: '',
        requestedBy: '',
        poDate: '',
        shippingCharges: 0,
        subtotal: 0,
        taxTotal: 0,
        lineItems: [] as PurchaseOrderItem[]
      } as PurchaseOrder));
    }
    return this.purchaseOrders()
      .filter(order => order.status !== 'Closed')
      .sort((left, right) => left.expectedOn.localeCompare(right.expectedOn));
  });

  readonly summary = computed(() => {
    const data = this.dashboardData();
    if (data) {
      return {
        suppliers: data.stats.suppliersCount,
        openPo: data.stats.openPosCount,
        poValue: data.stats.poValue
      };
    }
    const openPo = this.activePurchaseOrders().length;
    const poValue = this.purchaseOrders().reduce((sum, order) => sum + order.amount, 0);
    return { suppliers: this.suppliers().length, openPo, poValue };
  });

  readonly lowStockItems = computed<LowStockDisplayItem[]>(() => {
    const data = this.dashboardData();
    if (data) {
      return data.lowStockAlerts.map(alert => {
        const item = this.masterItems().find(mi => mi.code === alert.itemCode);
        return {
          id: alert.itemConfigId ?? item?.id ?? 0,
          code: alert.itemCode,
          name: alert.itemName,
          category: item?.category || 'General',
          unit: alert.uom || item?.unit || 'Pcs',
          unitCost: item?.unitCost ?? 0,
          taxRate: item?.taxRate ?? 18,
          description: item?.description || '',
          hsnCode: item?.hsnCode || '',
          reorderLevel: alert.reorderLevel,
          parLevel: item?.parLevel ?? (alert.reorderLevel * 2),
          isActive: item?.isActive ?? true,
          currentStock: alert.currentStock,
          isLow: true
        } as LowStockDisplayItem;
      });
    }
    const stockLevels: Record<string, number> = {
      'HK-LIN-001': 35,
      'HK-AMN-014': 250,
      'LND-DET-003': 12,
      'MB-BEV-009': 150,
      'HK-CHEM-007': 8,
      'FB-DRY-012': 600,
      'HK-LIN-002': 15,
      'HK-LIN-003': 90,
      'FB-KIT-001': 30,
      'FB-KIT-002': 12
    };

    return this.masterItems()
      .map(item => ({
        ...item,
        currentStock: stockLevels[item.code] ?? 100,
        isLow: (stockLevels[item.code] ?? 100) < (item.reorderLevel || 0)
      } as LowStockDisplayItem))
      .filter(i => i.isLow);
  });

  readonly poStatusSummary = computed(() => {
    const data = this.dashboardData();
    if (data) {
      const pipeline = data.procurementPipeline;
      const newOrders = pipeline.newOrders ?? ((pipeline.draft || 0) + (pipeline.approved || 0));
      const receivedGrn = pipeline.receivedGrn ?? (pipeline.partiallyReceived || 0);
      const invoiced = pipeline.invoiced ?? (pipeline.closed || 0);
      return {
        newOrders,
        receivedGrn,
        invoiced,
        total: pipeline.totalPos || (newOrders + receivedGrn + invoiced)
      };
    }
    const orders = this.purchaseOrders();
    const newOrders = orders.filter(o => o.status === 'Draft' || o.status === 'Approved').length;
    const receivedGrn = orders.filter(o => o.status === 'Partially Received').length;
    const invoiced = orders.filter(o => o.status === 'Closed').length;
    return { newOrders, receivedGrn, invoiced, total: orders.length };
  });

  readonly supplierCategorySummary = computed(() => {
    const data = this.dashboardData();
    if (data) {
      const totalSuppliers = data.stats.suppliersCount || 1;
      return data.supplierCategories.map(cat => ({
        name: cat.categoryName,
        count: cat.supplierCount,
        outstanding: cat.totalPoValue,
        percentage: Math.min(100, Math.round((cat.supplierCount / totalSuppliers) * 100))
      }));
    }
    const sups = this.suppliers();
    const categories: Record<string, { count: number; outstanding: number }> = {};
    sups.forEach(s => {
      const cat = s.category || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = { count: 0, outstanding: 0 };
      }
      categories[cat].count++;
      categories[cat].outstanding += s.outstanding;
    });
    return Object.entries(categories).map(([name, val]) => ({
      name,
      count: val.count,
      outstanding: val.outstanding,
      percentage: sups.length ? Math.round((val.count / sups.length) * 100) : 0
    }));
  });

  fetchNextPoNumber(): void {
    this.purchaseService.generatePurchaseOrderNumber().subscribe({
      next: (poNo) => {
        if (poNo && poNo.trim()) {
          this.poDraft.update(draft => ({ ...draft, poNumber: poNo.trim() }));
        }
      },
      error: () => {}
    });
  }

  createPoForItem(item: any): void {
    const draft = this.emptyPoDraft();
    const targetStock = item.parLevel || (item.reorderLevel * 2);
    const qty = Math.max(1, targetStock - item.currentStock);
    draft.lineItems = [{
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      uom: item.unit,
      quantity: qty,
      rate: item.unitCost,
      taxPercent: item.taxRate,
      discountPercent: 0,
      total: qty * item.unitCost
    }];
    draft.subtotal = draft.lineItems[0].total;
    draft.taxTotal = Math.round(draft.subtotal * (item.taxRate / 100));
    draft.amount = draft.subtotal + draft.taxTotal;
    
    this.poDraft.set(draft);
    this.poFormSubmitted.set(false);
    this.poTouchedFields.set({});
    this.selectedPurchaseOrder.set(null);
    this.fetchNextPoNumber();
    this.createModal.set('po');
  }

  readonly supplierValidationErrors = computed(() => this.validateSupplierDraft(this.supplierDraft()));

  setTab(tab: PurchaseTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/purchase/${tab}`]);
  }

  openCreateModal(type: 'supplier' | 'po' | 'item'): void {
    if (type === 'supplier') {
      this.selectedSupplier.set(null);
      this.supplierDraft.set(this.emptySupplierDraft());
      this.supplierFormSubmitted.set(false);
      this.touchedFields.set({});
    }
    if (type === 'po') {
      this.selectedPurchaseOrder.set(null);
      this.poDraft.set(this.emptyPoDraft());
      this.poFormSubmitted.set(false);
      this.poTouchedFields.set({});
      this.fetchNextPoNumber();
    }

    if (type === 'item') {
      this.selectedItem.set(null);
      this.itemDraft.set(this.emptyItemDraft());
      this.itemFormSubmitted.set(false);
      this.itemTouchedFields.set({});
      this.itemError.set('');
    }
    this.createModal.set(type);
  }

  closeCreateModal(): void {
    this.createModal.set(null);
    this.selectedSupplier.set(null);
    this.supplierDraft.set(this.emptySupplierDraft());
    this.supplierFormSubmitted.set(false);
    this.touchedFields.set({});
    this.selectedPurchaseOrder.set(null);
    this.poDraft.set(this.emptyPoDraft());
    this.poFormSubmitted.set(false);
    this.poTouchedFields.set({});

    this.selectedItem.set(null);
    this.itemDraft.set(this.emptyItemDraft());
    this.itemFormSubmitted.set(false);
    this.itemTouchedFields.set({});
    this.itemError.set('');
  }

  createModalTitle(): string {
    const type = this.createModal();
    if (type === 'supplier') return this.selectedSupplier() ? 'Edit Supplier' : 'Add Supplier';
    if (type === 'po') return this.selectedPurchaseOrder() ? 'Edit Purchase Order' : 'Create Purchase Order';
    if (type === 'item') return this.selectedItem() ? 'Edit Item' : 'Add Item';
    return '';
  }

  viewSupplier(supplier: Supplier): void {
    this.purchaseService.getSupplierById(supplier.id).subscribe({
      next: response => this.supplierDetail.set(response ? this.mapSupplier(response) : supplier),
      error: () => this.supplierDetail.set(supplier)
    });
  }

  editSupplier(supplier: Supplier): void {
    this.supplierDetail.set(null);
    this.selectedSupplier.set(supplier);
    this.supplierDraft.set(this.draftFromSupplier(supplier));
    this.touchedFields.set({});
    this.createModal.set('supplier');
  }

  deleteSupplier(id: number): void {
    const supplier = this.suppliers().find(item => item.id === id);
    if (supplier) this.supplierPendingDelete.set(supplier);
  }

  closeSupplierDetail(): void {
    this.supplierDetail.set(null);
  }

  closeDeleteSupplier(): void {
    this.supplierPendingDelete.set(null);
  }

  confirmDeleteSupplier(): void {
    const supplier = this.supplierPendingDelete();
    if (!supplier) return;

    this.purchaseService.deleteSupplier(supplier.id).subscribe({
      next: () => {
        this.suppliers.update(suppliers => suppliers.filter(item => item.id !== supplier.id));
        this.closeDeleteSupplier();
      },
      error: () => alert('Unable to delete supplier. Please try again.')
    });
  }

  viewPurchaseOrder(order: PurchaseOrder): void {
    this.purchaseOrderDetail.set(order);
    this.purchaseOrderDetailError.set('');
    if (order.recordId) {
      this.purchaseService.getPurchaseOrderById(order.recordId).subscribe({
        next: response => {
          if (!response) return;
          this.purchaseOrderDetail.set(this.mapPurchaseOrder(response));
        },
        error: () => this.purchaseOrderDetailError.set('Unable to refresh purchase order details.')
      });
    }
  }

  closePurchaseOrderDetail(): void {
    this.purchaseOrderDetail.set(null);
    this.purchaseOrderDetailError.set('');
  }

  editPurchaseOrder(order: PurchaseOrder): void {
    this.selectedPurchaseOrder.set(order);
    this.poDraft.set(this.draftFromPo(order));
    this.poFormSubmitted.set(false);
    this.poTouchedFields.set({});
    this.createModal.set('po');
    if (order.recordId) {
      this.purchaseService.getPurchaseOrderById(order.recordId).subscribe({
        next: response => {
          if (!response) return;
          const detailedOrder = this.mapPurchaseOrder(response);
          this.selectedPurchaseOrder.set(detailedOrder);
          this.poDraft.set(this.draftFromPo(detailedOrder));
        },
        error: () => this.poError.set('Unable to refresh purchase order details.')
      });
    }
  }

  deletePurchaseOrder(id: string): void {
    const order = this.purchaseOrders().find(item => item.id === id);
    if (!order?.recordId) return;
    this.poDeleteError.set('');
    this.purchaseOrderPendingDelete.set(order);
  }

  closePurchaseOrderDelete(): void {
    if (this.poDeleting()) return;
    this.poDeleteError.set('');
    this.purchaseOrderPendingDelete.set(null);
  }

  confirmDeletePurchaseOrder(): void {
    const order = this.purchaseOrderPendingDelete();
    if (!order?.recordId || this.poDeleting()) return;

    this.poDeleting.set(true);
    this.poDeleteError.set('');
    this.purchaseService.deletePurchaseOrder(order.recordId).subscribe({
      next: () => {
        this.purchaseOrders.update(orders => orders.filter(item => item.recordId !== order.recordId));
        this.poDeleting.set(false);
        this.purchaseOrderPendingDelete.set(null);
        this.loadDashboard();
      },
      error: error => {
        this.poDeleting.set(false);
        this.poDeleteError.set(error?.error?.message || 'Unable to delete this purchase order. Please try again.');
      }
    });
  }



  formatINR(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  updateSupplierDraft<K extends keyof SupplierDraft>(field: K, value: SupplierDraft[K]): void {
    this.supplierDraft.update(draft => ({ ...draft, [field]: value }));
    this.touchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  markFieldAsTouched(field: string): void {
    this.touchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  saveSupplier(): void {
    this.supplierFormSubmitted.set(true);
    if (this.supplierValidationErrors().length) return;

    const draft = this.supplierDraft();
    const payload = this.supplierPayloadFromDraft(draft);
    const request = draft.id
      ? this.purchaseService.updateSupplier(draft.id, payload)
      : this.purchaseService.createSupplier(payload);

    request.subscribe({
      next: supplier => {
        const mapped = this.mapSupplier(supplier);
        this.suppliers.update(suppliers => {
          const index = suppliers.findIndex(item => item.id === mapped.id);
          if (index === -1) return [mapped, ...suppliers];
          const next = [...suppliers];
          next[index] = mapped;
          return next;
        });
        this.closeCreateModal();
        this.loadDashboard();
      },
      error: () => alert('Unable to save supplier. Please check required fields and try again.')
    });
  }

  statusClass(status: string): string {
    return String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'active';
  }

  supplierFieldError(field: string): string {
    if (!this.supplierFormSubmitted() && !this.touchedFields()[field]) return '';
    return this.supplierValidationErrors().find(error => error.field === field)?.message || '';
  }

  printPurchaseOrder(order: PurchaseOrder): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const rows = (order.lineItems || []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${item.itemCode || '-'}</strong></td>
        <td>${item.itemName}</td>
        <td>${item.quantity} ${item.uom}</td>
        <td>${this.formatINR(item.rate)}</td>
        <td>${item.discountPercent}%</td>
        <td>${item.taxPercent}%</td>
        <td><strong>${this.formatINR(item.total)}</strong></td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>PO - ${order.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 32px; color: #333; line-height: 1.4; }
            h1 { font-size: 24px; margin: 0 0 4px; color: #0f172a; }
            .muted { color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 18px; }
            .box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background: #f8fafc; font-size: 12px; }
            .box strong { color: #475569; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 4px; }
            h2 { font-size: 15px; margin: 24px 0 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 11px; }
            th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; }
            .totals-block { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals-table { width: 280px; border: none; }
            .totals-table td { border: none; padding: 4px 8px; font-size: 12px; }
            .totals-table tr.grand-total td { font-size: 14px; font-weight: 700; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; color: #0f172a; }
            .notes { margin-top: 30px; font-size: 11px; color: #64748b; background: #f8fafc; padding: 12px; border-left: 3px solid #cbd5e1; border-radius: 4px; }
            .notes strong { display: block; color: #475569; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h1>Purchase Order</h1>
          <div class="muted">HMS Cloud • Reference: ${order.id}</div>
          
          <div class="grid">
            <div class="box"><strong>Supplier</strong>${order.supplier}</div>
            <div class="box"><strong>Delivery Location</strong>${order.deliveryLocation || 'Main Store'}</div>
            <div class="box"><strong>Payment Terms</strong>${order.paymentTerms || '30 Days'}</div>
            <div class="box"><strong>Requested By</strong>${order.requestedBy || '-'}</div>
            <div class="box"><strong>Order Date</strong>${order.poDate || order.orderedOn}</div>
            <div class="box"><strong>Expected Delivery</strong>${order.expectedOn}</div>
          </div>

          <h2>Line Items</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 90px;">Item Code</th>
                <th>Item Description</th>
                <th style="width: 70px;">Qty</th>
                <th style="width: 90px;">Rate</th>
                <th style="width: 70px;">Disc</th>
                <th style="width: 70px;">GST</th>
                <th style="width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="totals-block">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">${this.formatINR(order.subtotal || 0)}</td>
              </tr>
              <tr>
                <td>Tax Amount:</td>
                <td style="text-align: right;">${this.formatINR(order.taxTotal || 0)}</td>
              </tr>
              <tr>
                <td>Shipping & Freight:</td>
                <td style="text-align: right;">${this.formatINR(order.shippingCharges || 0)}</td>
              </tr>
              <tr class="grand-total">
                <td>Grand Total:</td>
                <td style="text-align: right;">${this.formatINR(order.amount)}</td>
              </tr>
            </table>
          </div>

          ${order.notes ? `<div class="notes"><strong>Terms & Conditions / Special Instructions</strong>${order.notes}</div>` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  loadDashboard(): void {
    this.purchaseService.getPurchaseDashboard().subscribe({
      next: data => {
        if (data) this.dashboardData.set(data);
      },
      error: () => {}
    });
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/purchase/suppliers')) this.activeTab.set('suppliers');
    else if (url.includes('/purchase/orders')) this.activeTab.set('orders');
    else if (url.includes('/purchase/items')) this.activeTab.set('items');
    else this.activeTab.set('dashboard');
  }

  private loadSuppliers(): void {
    this.supplierLoading.set(true);
    this.purchaseService.getSuppliers().subscribe({
      next: suppliers => {
        this.suppliers.set(suppliers.map(supplier => this.mapSupplier(supplier)));
        this.supplierLoading.set(false);
      },
      error: () => {
        this.suppliers.set([]);
        this.supplierLoading.set(false);
      }
    });
  }

  private loadPurchaseOrders(): void {
    this.poLoading.set(true);
    this.poError.set('');
    this.purchaseService.getPurchaseOrders().subscribe({
      next: orders => {
        this.purchaseOrders.set(orders.map(order => this.mapPurchaseOrder(order)));
        this.poLoading.set(false);
      },
      error: error => {
        this.purchaseOrders.set([]);
        this.poLoading.set(false);
        this.poError.set(error?.error?.message || 'Unable to load purchase orders.');
      }
    });
  }

  private loadItemConfigs(): void {
    this.itemLoading.set(true);
    this.itemError.set('');
    this.purchaseService.getItemConfigs().subscribe({
      next: items => {
        this.masterItems.set(items.map(item => this.mapItemConfig(item)));
        this.itemLoading.set(false);
      },
      error: error => {
        this.masterItems.set([]);
        this.itemLoading.set(false);
        this.itemError.set(error?.error?.message || 'Unable to load item configuration.');
      }
    });
  }

  private mapItemConfig(input: ItemConfigPayload): MasterInventoryItem {
    return {
      id: Number(input.id || 0),
      code: String(input.itemCode || '').trim().toUpperCase(),
      name: String(input.itemName || '').trim(),
      categoryId: input.categoryId ? Number(input.categoryId) : undefined,
      category: String(input.categoryName || '').trim(),
      uomId: input.uomId ? Number(input.uomId) : undefined,
      unit: String(input.uomName || '').trim() || 'Pcs',
      unitCost: Number(input.unitCost || 0),
      taxRate: Number(input.gstTaxRate || 0),
      description: String(input.description || '').trim(),
      hsnCode: String(input.hsnSacCode || '').trim().toUpperCase(),
      reorderLevel: input.reorderLevel === undefined || input.reorderLevel === null ? undefined : Number(input.reorderLevel),
      onHandStock: input.onHandStock === undefined || input.onHandStock === null ? undefined : Number(input.onHandStock),
      parLevel: input.maxStockLevel === undefined || input.maxStockLevel === null ? undefined : Number(input.maxStockLevel),
      isActive: input.isActive ?? true
    };
  }

  private itemPayloadFromDraft(draft: ItemDraft, existing: MasterInventoryItem | null): ItemConfigPayload {
    const categoryOption = this.optionById(this.itemCategories(), draft.categoryId);
    const uomOption = this.optionById(this.uomOptions(), draft.uomId);

    const catId = draft.categoryId ?? existing?.categoryId ?? categoryOption?.id;
    const catName = categoryOption?.value || draft.category.trim();

    const uomId = draft.uomId ?? existing?.uomId ?? uomOption?.id;
    const uomName = uomOption?.value || draft.unit.trim();

    const reorderVal = draft.reorderLevel === null || draft.reorderLevel === undefined ? undefined : Number(draft.reorderLevel);
    const onHandVal = draft.onHandStock === null || draft.onHandStock === undefined ? 0 : Number(draft.onHandStock);
    const maxStockVal = draft.parLevel === null || draft.parLevel === undefined ? undefined : Number(draft.parLevel);

    return {
      id: existing?.id,
      itemCode: draft.code.trim().toUpperCase(),
      itemName: draft.name.trim(),
      categoryId: catId ? Number(catId) : undefined,
      categoryName: catName || undefined,
      uomId: uomId ? Number(uomId) : undefined,
      uomName: uomName || undefined,
      unitCost: Number(draft.unitCost || 0),
      gstTaxRate: Number(draft.taxRate ?? 0),
      hsnSacCode: draft.hsnCode.trim().toUpperCase() || undefined,
      reorderLevel: reorderVal,
      onHandStock: onHandVal,
      maxStockLevel: maxStockVal,
      minimumQty: reorderVal,
      maximumQty: maxStockVal,
      description: draft.description.trim() || undefined,
      isActive: draft.isActive
    };
  }

  private mapPurchaseOrder(input: PurchaseOrderPayload): PurchaseOrder {
    const lines = (input.lines || []).map(line => {
      const masterItem = this.resolvePoMasterItem(line.itemId, line.itemCode, line.itemName);
      return {
        id: line.id ? Number(line.id) : undefined,
        itemId: line.itemId ? Number(line.itemId) : masterItem?.id,
        itemCode: String(line.itemCode || masterItem?.code || '').trim(),
        itemName: String(line.itemName || masterItem?.name || '').trim(),
        uom: masterItem?.unit || 'Pcs',
        quantity: Number(line.quantity || 0),
        rate: Number(line.rate || 0),
        taxPercent: Number(line.gstPercentage || 0),
        discountPercent: Number(line.discountPercentage || 0),
        total: Number(line.totalAmount || 0)
      };
    });
    const subtotal = lines.reduce((sum, line) => {
      const gross = line.quantity * line.rate;
      return sum + gross - (gross * line.discountPercent / 100);
    }, 0);
    const taxTotal = lines.reduce((sum, line) => sum + Math.max(0, line.total - (
      line.quantity * line.rate * (1 - line.discountPercent / 100)
    )), 0);

    return {
      recordId: input.id ? Number(input.id) : undefined,
      id: String(input.poNumber || `PO-${input.id || ''}`).trim(),
      supplierId: input.supplierId ? Number(input.supplierId) : undefined,
      supplier: String(input.supplierName || '').trim(),
      department: String(input.departmentName || '').trim(),
      departmentId: input.departmentId ? Number(input.departmentId) : undefined,
      orderedOn: String(input.poDate || ''),
      expectedOn: String(input.expectedDate || ''),
      items: Number(input.itemCount ?? lines.length),
      amount: Number(input.totalAmount || lines.reduce((sum, line) => sum + line.total, 0)),
      status: this.mapPoStatus(input.statusName || input.statusCode),
      statusId: input.statusId ? Number(input.statusId) : undefined,
      statusCode: String(input.statusCode || '').trim(),
      deliveryLocation: String(input.deliveryStoreName || '').trim(),
      deliveryStoreId: input.deliveryStoreId ? Number(input.deliveryStoreId) : undefined,
      paymentTermsId: input.paymentTermsId ? Number(input.paymentTermsId) : undefined,
      paymentTerms: String(input.paymentTermsName || this.optionValue(this.paymentTerms(), input.paymentTermsId) || '').trim(),
      requestedBy: String(input.requestedBy || '').trim(),
      poDate: String(input.poDate || ''),
      referenceNo: String(input.prNumber || '').trim(),
      shippingCharges: Number(input.shippingFreightRate ?? 0),
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      notes: String(input.poNote || '').trim(),
      purchaseItemCategoryId: input.purchaseItemCategoryId ? Number(input.purchaseItemCategoryId) : undefined,
      itemCategoryScope: this.optionById(this.itemCategoryScopes(), input.purchaseItemCategoryId)?.code || input.purchaseItemCategoryName || 'ALL',
      lineItems: lines
    };
  }

  private resolvePoMasterItem(itemId?: number | string, itemCode?: string, itemName?: string): MasterInventoryItem | undefined {
    const code = String(itemCode || '').trim().toLowerCase();
    const name = String(itemName || '').trim().toLowerCase();
    return this.masterItems().find(item =>
      Number(item.id) === Number(itemId) ||
      (!!code && item.code.trim().toLowerCase() === code) ||
      (!!name && item.name.trim().toLowerCase() === name)
    );
  }

  private purchaseOrderPayloadFromDraft(draft: PurchaseOrderDraft, existing: PurchaseOrder | null): PurchaseOrderPayload {
    const paymentTerms = this.optionById(this.paymentTerms(), draft.paymentTermsId);
    const department = this.optionById(this.departments(), draft.departmentId);
    const deliveryStore = this.optionById(this.deliveryStores(), draft.deliveryStoreId);
    const itemCategoryOption = this.optionById(this.itemCategoryScopes(), draft.purchaseItemCategoryId);
    return {
      id: existing?.recordId,
      poNumber: draft.poNumber.trim(),
      supplierId: draft.supplierId,
      supplierName: draft.supplier.trim(),
      departmentId: draft.departmentId,
      departmentName: department?.value || draft.department.trim(),
      poDate: draft.poDate,
      expectedDate: draft.expectedOn,
      prNumber: draft.referenceNo.trim() || undefined,
      deliveryStoreId: draft.deliveryStoreId,
      deliveryStoreName: deliveryStore?.value || draft.deliveryLocation.trim(),
      paymentTermsId: draft.paymentTermsId,
      paymentTermsName: paymentTerms?.value || draft.paymentTerms.trim(),
      purchaseItemCategoryId: draft.purchaseItemCategoryId,
      purchaseItemCategoryName: itemCategoryOption?.value,
      requestedBy: draft.requestedBy.trim(),
      itemCount: draft.lineItems.length,
      poNote: draft.notes.trim() || undefined,
      shippingFreightRate: Number(draft.shippingCharges || 0),
      totalAmount: draft.amount,
      lines: draft.lineItems.map(line => {
        const masterItem = this.resolvePoMasterItem(line.itemId, line.itemCode, line.itemName);
        return {
          id: line.id,
          itemId: line.itemId || masterItem?.id,
          itemCode: (line.itemCode || masterItem?.code || '').trim(),
          itemName: (line.itemName || masterItem?.name || '').trim(),
          quantity: Number(line.quantity || 0),
          rate: Number(line.rate || 0),
          discountPercentage: Number(line.discountPercent || 0),
          gstPercentage: Number(line.taxPercent || 0),
          totalAmount: Number(line.total || 0)
        };
      }),
      statusId: existing?.statusId,
      statusName: existing?.status || 'Draft',
      statusCode: existing?.statusCode || 'DRAFT'
    };
  }

  private mapPoStatus(status?: string): PoStatus {
    const normalized = String(status || '').trim().toUpperCase().replace(/[_-]+/g, ' ');
    if (normalized.includes('PARTIAL')) return 'Partially Received';
    if (normalized.includes('APPROV')) return 'Approved';
    if (normalized.includes('CLOS') || normalized.includes('COMPLET')) return 'Closed';
    return 'Draft';
  }

  private loadSupplierLookups(): void {
    forkJoin({
      departments: this.purchaseService.getDepartments(),
      categories: this.purchaseService.getCommonMaster('SUPPLIER_CATEGORY'),
      terms: this.purchaseService.getCommonMaster('PAYMENT_TERMS'),
      deliveryStores: this.purchaseService.getCommonMaster('DELIVERY_STORE'),
      statuses: this.purchaseService.getCommonMaster('SUPPLIER_STATUS'),
      itemCategoryScopes: this.purchaseService.getCommonMaster('PURCHASE_ITEM_CATEGORY'),
      itemCategories: this.purchaseService.getCommonMaster('ITEM_CATEGORY'),
      uomOptions: this.purchaseService.getCommonMaster('UOM')
    }).subscribe({
      next: response => {
        this.departments.set(response.departments);
        this.supplierCategories.set(response.categories);
        this.paymentTerms.set(response.terms);
        this.deliveryStores.set(response.deliveryStores);
        this.supplierStatuses.set(response.statuses);
        this.itemCategoryScopes.set(response.itemCategoryScopes);
        this.itemCategories.set(response.itemCategories.length ? response.itemCategories : response.itemCategoryScopes);
        this.uomOptions.set(response.uomOptions);
        this.loadSuppliers();
      },
      error: () => {
        this.departments.set([]);
        this.supplierCategories.set([]);
        this.paymentTerms.set([]);
        this.deliveryStores.set([]);
        this.supplierStatuses.set([]);
        this.itemCategoryScopes.set([]);
        this.itemCategories.set([]);
        this.uomOptions.set([]);
        this.loadSuppliers();
      }
    });
  }

  private mapSupplier(input: SupplierPayload): Supplier {
    const id = Number(input.id || 0);
    return {
      id,
      code: `SUP-${String(id || this.suppliers().length + 1).padStart(3, '0')}`,
      name: String(input.supplierName || '').trim(),
      categoryId: input.categoryId ? Number(input.categoryId) : undefined,
      category: String(input.categoryName || this.optionValue(this.supplierCategories(), input.categoryId) || '').trim(),
      contact: String(input.contactPerson || '').trim(),
      phone: String(input.phone || '').trim(),
      email: String(input.email || '').trim(),
      address: String(input.supplierAddress || '').trim(),
      city: String(input.city || '').trim(),
      state: String(input.state || '').trim(),
      pinCode: String(input.pinCode || '').trim(),
      gstin: String(input.gstin || '').trim(),
      pan: String(input.pan || '').trim(),
      paymentTermsId: input.paymentTermsId ? Number(input.paymentTermsId) : undefined,
      paymentTerms: String(input.paymentTermsName || this.optionValue(this.paymentTerms(), input.paymentTermsId) || '').trim(),
      bankName: String(input.bankName || '').trim(),
      accountNo: String(input.accountNumber || '').trim(),
      ifsc: String(input.ifscCode || '').trim(),
      creditLimit: Number(input.creditLimit || 0),
      outstanding: 0,
      statusId: input.statusId ? Number(input.statusId) : undefined,
      statusCode: String(input.statusCode || '').trim(),
      status: String(input.statusName || this.optionValue(this.supplierStatuses(), input.statusId) || input.statusCode || 'ACTIVE').trim()
    };
  }

  private emptySupplierDraft(): SupplierDraft {
    return {
      name: '',
      contact: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pinCode: '',
      gstin: '',
      pan: '',
      creditLimit: null,
      bankName: '',
      accountNo: '',
      ifsc: ''
    };
  }

  private draftFromSupplier(supplier: Supplier): SupplierDraft {
    return {
      id: supplier.id,
      name: supplier.name,
      categoryId: supplier.categoryId,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      paymentTermsId: supplier.paymentTermsId,
      address: supplier.address,
      city: supplier.city,
      state: supplier.state,
      pinCode: supplier.pinCode,
      gstin: supplier.gstin,
      pan: supplier.pan,
      creditLimit: supplier.creditLimit,
      bankName: supplier.bankName,
      accountNo: supplier.accountNo,
      ifsc: supplier.ifsc,
      statusId: supplier.statusId
    };
  }

  private supplierPayloadFromDraft(draft: SupplierDraft): SupplierPayload {
    const category = this.optionById(this.supplierCategories(), draft.categoryId);
    const terms = this.optionById(this.paymentTerms(), draft.paymentTermsId);
    const status = this.optionById(this.supplierStatuses(), draft.statusId);
    return {
      id: draft.id,
      supplierName: draft.name.trim(),
      categoryId: draft.categoryId,
      categoryName: category?.value,
      contactPerson: draft.contact.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      paymentTermsId: draft.paymentTermsId,
      paymentTermsName: terms?.value,
      supplierAddress: draft.address.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      pinCode: draft.pinCode.trim(),
      gstin: draft.gstin.trim(),
      pan: draft.pan.trim(),
      creditLimit: Number(draft.creditLimit || 0),
      bankName: draft.bankName.trim(),
      accountNumber: draft.accountNo.trim(),
      ifscCode: draft.ifsc.trim(),
      statusId: draft.statusId,
      statusName: status?.value,
      statusCode: status?.code
    };
  }

  private optionById(options: PurchaseMasterOption[], id?: number): PurchaseMasterOption | undefined {
    return options.find(option => Number(option.id) === Number(id));
  }

  private optionValue(options: PurchaseMasterOption[], id?: number): string {
    return this.optionById(options, id)?.value || '';
  }

  private validateSupplierDraft(draft: SupplierDraft): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    const phoneDigits = draft.phone.replace(/\D/g, '');
    const email = draft.email.trim();
    const pinCode = draft.pinCode.trim();
    const gstin = draft.gstin.trim().toUpperCase();
    const pan = draft.pan.trim().toUpperCase();
    const ifsc = draft.ifsc.trim().toUpperCase();

    if (!draft.name.trim()) errors.push({ field: 'name', message: 'Supplier name is required.' });
    if (!draft.categoryId) errors.push({ field: 'categoryId', message: 'Select supplier category.' });
    if (!draft.contact.trim()) errors.push({ field: 'contact', message: 'Contact person is required.' });
    if (!draft.phone.trim()) errors.push({ field: 'phone', message: 'Mobile number is required.' });
    else if (!/^[6-9]\d{9}$/.test(phoneDigits.slice(-10))) errors.push({ field: 'phone', message: 'Enter a valid 10 digit mobile number.' });
    if (!email) errors.push({ field: 'email', message: 'Email is required.' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push({ field: 'email', message: 'Enter a valid email address.' });
    if (!draft.paymentTermsId) errors.push({ field: 'paymentTermsId', message: 'Select payment terms.' });
    if (!draft.statusId) errors.push({ field: 'statusId', message: 'Select supplier status.' });
    if (!draft.address.trim()) errors.push({ field: 'address', message: 'Supplier address is required.' });
    if (!draft.city.trim()) errors.push({ field: 'city', message: 'City is required.' });
    if (!draft.state.trim()) errors.push({ field: 'state', message: 'State is required.' });
    if (!pinCode) errors.push({ field: 'pinCode', message: 'Pin code is required.' });
    else if (!/^\d{6}$/.test(pinCode)) errors.push({ field: 'pinCode', message: 'Enter a valid 6 digit pin code.' });
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) errors.push({ field: 'gstin', message: 'Enter a valid GSTIN.' });
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push({ field: 'pan', message: 'Enter a valid PAN.' });
    if (draft.creditLimit !== null && Number(draft.creditLimit) < 0) errors.push({ field: 'creditLimit', message: 'Credit limit cannot be negative.' });
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) errors.push({ field: 'ifsc', message: 'Enter a valid IFSC code.' });
    return errors;
  }

  emptyPoDraft(): PurchaseOrderDraft {
    const today = new Date().toISOString().substring(0, 10);
    const defaultOption = this.itemCategoryScopes()[0];
    return {
      poNumber: `PO-${new Date().getFullYear()}-${String(this.purchaseOrders ? this.purchaseOrders().length + 1001 : 1001)}`,
      supplier: '',
      departmentId: undefined,
      department: '',
      poDate: today,
      expectedOn: '',
      deliveryStoreId: undefined,
      deliveryLocation: '',
      paymentTermsId: undefined,
      paymentTerms: '',
      requestedBy: '',
      referenceNo: '',
      shippingCharges: 0,
      notes: '',
      purchaseItemCategoryId: defaultOption?.id,
      itemCategoryScope: defaultOption?.code || 'ALL',
      lineItems: [this.defaultPoLineItem()],
      subtotal: 0,
      taxTotal: 0,
      amount: 0
    };
  }

  defaultPoLineItem(): PurchaseOrderItem {
    return {
      itemCode: '',
      itemName: '',
      uom: 'Pcs',
      quantity: 1,
      rate: 0,
      taxPercent: 18,
      discountPercent: 0,
      total: 0
    };
  }

  draftFromPo(order: PurchaseOrder): PurchaseOrderDraft {
    const scopeOption = this.optionById(this.itemCategoryScopes(), order.purchaseItemCategoryId);
    return {
      id: order.id,
      poNumber: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      departmentId: order.departmentId,
      department: order.department,
      poDate: order.poDate,
      expectedOn: order.expectedOn,
      deliveryStoreId: order.deliveryStoreId,
      deliveryLocation: order.deliveryLocation,
      paymentTermsId: order.paymentTermsId,
      paymentTerms: order.paymentTerms,
      requestedBy: order.requestedBy,
      referenceNo: order.referenceNo || '',
      shippingCharges: order.shippingCharges,
      notes: order.notes || '',
      purchaseItemCategoryId: order.purchaseItemCategoryId,
      itemCategoryScope: scopeOption?.code || order.itemCategoryScope || (this.itemCategoryScopes().length ? this.itemCategoryScopes()[0].code : 'ALL'),
      lineItems: order.lineItems.map(item => ({ ...item })),
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      amount: order.amount
    };
  }

  updatePoDraft<K extends keyof PurchaseOrderDraft>(field: K, value: PurchaseOrderDraft[K]): void {
    this.poDraft.update(draft => {
      const next = { ...draft, [field]: value };
      if (field === 'supplierId') {
        const sup = this.suppliers().find(s => s.id === Number(value));
        if (sup) {
          next.supplier = sup.name;
          next.paymentTermsId = sup.paymentTermsId;
          next.paymentTerms = sup.paymentTerms;
        }
      }
      if (field === 'departmentId') {
        const department = this.optionById(this.departments(), Number(value));
        next.department = department?.value || '';
      }
      if (field === 'deliveryStoreId') {
        const store = this.optionById(this.deliveryStores(), Number(value));
        next.deliveryLocation = store?.value || '';
      }
      if (field === 'paymentTermsId') {
        const terms = this.optionById(this.paymentTerms(), Number(value));
        next.paymentTerms = terms?.value || '';
      }
      if (field === 'purchaseItemCategoryId') {
        const option = this.optionById(this.itemCategoryScopes(), Number(value));
        next.itemCategoryScope = option?.code || option?.value || '';
        const valStr = (option?.code || option?.value || '').toUpperCase();
        if (valStr.includes('KITCHEN') || valStr.includes('INGREDIENT')) {
          this.loadKitchenIngredients(0, 20);
        }
      }
      if (field === 'itemCategoryScope' && value) {
        const valStr = String(value).toUpperCase();
        if (valStr === 'KITCHEN_INGREDIENTS' || valStr.includes('KITCHEN') || valStr.includes('INGREDIENT')) {
          this.loadKitchenIngredients(0, 20);
        }
      }
      return next;
    });
    this.poTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  markPoFieldAsTouched(field: string): void {
    this.poTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  addPoLineItem(): void {
    this.poDraft.update(draft => ({
      ...draft,
      lineItems: [...draft.lineItems, this.defaultPoLineItem()]
    }));
  }

  removePoLineItem(index: number): void {
    this.poDraft.update(draft => {
      const lineItems = draft.lineItems.filter((_, i) => i !== index);
      const next = {
        ...draft,
        lineItems: lineItems.length ? lineItems : [this.defaultPoLineItem()]
      };
      return this.recalculatePoTotals(next);
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  updatePoLineItem(index: number, field: keyof PurchaseOrderItem, value: any): void {
    this.poDraft.update(draft => {
      const lineItems = draft.lineItems.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        
        // Auto calculate item total
        const subtotal = updated.quantity * updated.rate;
        const discount = subtotal * (updated.discountPercent / 100);
        const taxable = subtotal - discount;
        const tax = taxable * (updated.taxPercent / 100);
        updated.total = Math.round((taxable + tax) * 100) / 100;
        
        return updated;
      });
      const next = { ...draft, lineItems };
      return this.recalculatePoTotals(next);
    });
  }

  activePoItemDropdownIndex = signal<number | null>(null);
  poDropdownStyle = signal<{ top: string; left: string; width: string }>({ top: '0px', left: '0px', width: '310px' });
  poItemSearchQuery = signal<string>('');

  togglePoItemDropdown(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.activePoItemDropdownIndex() === index) {
      this.activePoItemDropdownIndex.set(null);
    } else {
      const scopeStr = String(this.poDraft().itemCategoryScope || '').toUpperCase();
      if ((scopeStr === 'KITCHEN_INGREDIENTS' || scopeStr.includes('KITCHEN') || scopeStr.includes('INGREDIENT')) && !this.kitchenIngredients().length && !this.kitchenIngredientsLoading()) {
        this.loadKitchenIngredients(0, 30);
      }
      this.activePoItemDropdownIndex.set(index);
      this.poItemSearchQuery.set('');

      const rawTarget = event?.target as HTMLElement;
      const target = rawTarget?.closest('.po-item-dropdown-trigger') as HTMLElement || (event?.currentTarget as HTMLElement) || rawTarget;
      if (target) {
        const rect = target.getBoundingClientRect();
        const dropdownHeight = 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let top: number;
        if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
          top = rect.bottom + 4;
        } else {
          top = Math.max(10, rect.top - dropdownHeight - 4);
        }

        const dropdownWidth = Math.max(310, rect.width);
        const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 16);

        this.poDropdownStyle.set({
          top: `${top}px`,
          left: `${Math.max(10, left)}px`,
          width: `${dropdownWidth}px`
        });
      }
    }
  }

  closePoItemDropdown(): void {
    this.activePoItemDropdownIndex.set(null);
  }

  selectPoItemForLine(lineIndex: number, item: MasterInventoryItem | null): void {
    this.onPoItemSelect(lineIndex, item ? item.id : null);
    this.closePoItemDropdown();
  }

  getSelectedPoItemLabel(itemId?: number): string {
    if (!itemId) return '-- Choose Item --';
    const item = this.availablePoMasterItems().find(i => i.id === Number(itemId));
    return item ? `${item.name} (${item.code}) • ${item.category}` : `Item #${itemId}`;
  }

  getFilteredPoItems(items: MasterInventoryItem[]): MasterInventoryItem[] {
    const q = this.poItemSearchQuery().trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }

  onPoItemDropdownScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 25;
    const scopeStr = String(this.poDraft().itemCategoryScope || '').toUpperCase();
    if (nearBottom && (scopeStr === 'KITCHEN_INGREDIENTS' || scopeStr.includes('KITCHEN') || scopeStr.includes('INGREDIENT'))) {
      if (!this.kitchenIngredientsLoading() && this.kitchenIngredientsPage() < this.kitchenIngredientsTotalPages() - 1) {
        this.loadKitchenIngredients(this.kitchenIngredientsPage() + 1, 30, true);
      }
    }
  }

  onPoItemSelect(index: number, itemId: number | null): void {
    const item = this.availablePoMasterItems().find(mi => mi.id === itemId);
    this.poDraft.update(draft => {
      const lineItems = draft.lineItems.map((line, i) => {
        if (i !== index) return line;
        if (!item) {
          return {
            ...line,
            itemId: undefined,
            itemCode: '',
            itemName: '',
            uom: 'Pcs',
            rate: 0,
            taxPercent: 18,
            total: 0
          };
        }
        const updated = {
          ...line,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          uom: item.unit,
          rate: item.unitCost,
          taxPercent: item.taxRate
        };
        const subtotal = updated.quantity * updated.rate;
        const discount = subtotal * (updated.discountPercent / 100);
        const taxable = subtotal - discount;
        const tax = taxable * (updated.taxPercent / 100);
        updated.total = Math.round((taxable + tax) * 100) / 100;
        return updated;
      });
      const next = { ...draft, lineItems };
      return this.recalculatePoTotals(next);
    });
  }

  recalculatePoTotals(draft: PurchaseOrderDraft): PurchaseOrderDraft {
    let subtotal = 0;
    let taxTotal = 0;
    
    draft.lineItems.forEach(item => {
      const lineSub = item.quantity * item.rate;
      const discount = lineSub * (item.discountPercent / 100);
      const taxable = lineSub - discount;
      const tax = taxable * (item.taxPercent / 100);
      subtotal += taxable;
      taxTotal += tax;
    });

    subtotal = Math.round(subtotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    const shipping = Number(draft.shippingCharges || 0);
    const amount = Math.round((subtotal + taxTotal + shipping) * 100) / 100;

    return {
      ...draft,
      subtotal,
      taxTotal,
      amount
    };
  }

  validatePoDraft(draft: PurchaseOrderDraft): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    if (!draft.supplier.trim()) errors.push({ field: 'supplier', message: 'Supplier is required.' });
    if (!draft.expectedOn.trim()) errors.push({ field: 'expectedOn', message: 'Expected delivery date is required.' });
    if (!draft.deliveryLocation.trim()) errors.push({ field: 'deliveryLocation', message: 'Delivery location is required.' });
    if (!draft.requestedBy.trim()) errors.push({ field: 'requestedBy', message: 'Requested By name is required.' });
    
    let validLines = 0;
    draft.lineItems.forEach((item, index) => {
      if (!item.itemName.trim()) {
        errors.push({ field: `line-${index}-itemName`, message: 'Select an item.' });
      }
      if (item.quantity <= 0) {
        errors.push({ field: `line-${index}-quantity`, message: 'Quantity must be > 0.' });
      }
      if (item.rate < 0) {
        errors.push({ field: `line-${index}-rate`, message: 'Rate cannot be negative.' });
      }
      if (item.itemName.trim() && item.quantity > 0) {
        validLines++;
      }
    });

    if (validLines === 0) {
      errors.push({ field: 'lineItems', message: 'At least one valid line item is required.' });
    }

    return errors;
  }

  readonly poValidationErrors = computed(() => this.validatePoDraft(this.poDraft()));

  poFieldError(field: string): string {
    if (!this.poFormSubmitted() && !this.poTouchedFields()[field]) return '';
    return this.poValidationErrors().find(error => error.field === field)?.message || '';
  }

  savePurchaseOrder(): void {
    this.poFormSubmitted.set(true);
    if (this.poValidationErrors().length) return;

    const draft = this.poDraft();
    const existing = this.selectedPurchaseOrder();
    const payload = this.purchaseOrderPayloadFromDraft(draft, existing);
    const request = existing?.recordId
      ? this.purchaseService.updatePurchaseOrder(existing.recordId, payload)
      : this.purchaseService.createPurchaseOrder(payload);

    this.poSaving.set(true);
    this.poError.set('');
    request.subscribe({
      next: response => {
        const saved = this.mapPurchaseOrder(response);
        this.purchaseOrders.update(orders => {
          const index = orders.findIndex(order =>
            saved.recordId ? order.recordId === saved.recordId : order.id === saved.id
          );
          if (index === -1) return [saved, ...orders];
          const next = [...orders];
          next[index] = saved;
          return next;
        });
        this.poSaving.set(false);
        this.closeCreateModal();
        this.loadDashboard();
      },
      error: error => {
        this.poSaving.set(false);
        this.poError.set(error?.error?.message || 'Unable to save purchase order. Please check the entered details and try again.');
      }
    });
  }

  editItem(item: MasterInventoryItem): void {
    this.selectedItem.set(item);
    this.itemDraft.set(this.draftFromItem(item));
    this.itemFormSubmitted.set(false);
    this.itemTouchedFields.set({});
    this.itemError.set('');
    this.createModal.set('item');
    if (item.id) {
      this.purchaseService.getItemConfigById(item.id).subscribe({
        next: response => {
          if (!response) return;
          const detailedItem = this.mapItemConfig(response);
          this.selectedItem.set(detailedItem);
          this.itemDraft.set(this.draftFromItem(detailedItem));
        },
        error: () => this.itemError.set('Unable to refresh item details.')
      });
    }
  }

  deleteItem(id: number): void {
    const item = this.masterItems().find(i => i.id === id);
    if (item) {
      this.itemDeleteError.set('');
      this.itemPendingDelete.set(item);
    }
  }

  closeDeleteItem(): void {
    if (this.itemDeleting()) return;
    this.itemDeleteError.set('');
    this.itemPendingDelete.set(null);
  }

  confirmDeleteItem(): void {
    const item = this.itemPendingDelete();
    if (!item || this.itemDeleting()) return;
    this.itemDeleting.set(true);
    this.itemDeleteError.set('');
    this.purchaseService.deleteItemConfig(item.id).subscribe({
      next: () => {
        this.masterItems.update(items => items.filter(i => i.id !== item.id));
        this.itemDeleting.set(false);
        this.itemPendingDelete.set(null);
        this.loadDashboard();
      },
      error: error => {
        this.itemDeleting.set(false);
        this.itemDeleteError.set(error?.error?.message || 'Unable to delete this item. Please try again.');
      }
    });
  }

  saveItem(): void {
    this.itemFormSubmitted.set(true);
    if (this.itemValidationErrors().length || this.itemSaving()) return;

    const draft = this.itemDraft();
    const existing = this.selectedItem();
    const payload = this.itemPayloadFromDraft(draft, existing);
    const request = existing?.id
      ? this.purchaseService.updateItemConfig(existing.id, payload)
      : this.purchaseService.createItemConfig(payload);

    this.itemSaving.set(true);
    this.itemError.set('');
    request.subscribe({
      next: response => {
        const saved = this.mapItemConfig(response);
        this.masterItems.update(items => {
          const index = items.findIndex(i => i.id === saved.id);
          if (index === -1) return [saved, ...items];
          const next = [...items];
          next[index] = saved;
          return next;
        });
        this.itemSaving.set(false);
        this.closeCreateModal();
        this.loadDashboard();
      },
      error: error => {
        this.itemSaving.set(false);
        this.itemError.set(error?.error?.message || 'Unable to save item. Please check the entered details and try again.');
      }
    });
  }

  updateItemCategory(val: any): void {
    const catId = val !== undefined && val !== null && val !== '' ? Number(val) : undefined;
    const catOption = this.optionById(this.itemCategories(), catId);

    const fallbackNames: Record<number, string> = {
      1: 'Housekeeping Linen',
      2: 'Guest Amenities',
      3: 'Laundry Consumable',
      4: 'Cleaning Chemical',
      5: 'Minibar',
      6: 'Kitchen Raw Material',
      7: 'Stationery',
      8: 'Engineering & Maintenance',
      9: 'Uniforms',
      10: 'Other'
    };

    const catName = catOption?.value || (catId ? fallbackNames[catId] : '') || (typeof val === 'string' ? val : '');

    this.itemDraft.update(draft => ({
      ...draft,
      categoryId: catId,
      category: catName
    }));
    this.itemTouchedFields.update(touched => ({ ...touched, category: true }));
  }

  updateItemUom(val: any): void {
    const uomId = val !== undefined && val !== null && val !== '' ? Number(val) : undefined;
    const uomOption = this.optionById(this.uomOptions(), uomId);

    const fallbackUomNames: Record<number, string> = {
      1: 'Pcs',
      2: 'Kg',
      3: 'Ltr',
      4: 'Can',
      5: 'Box',
      6: 'Carton',
      7: 'Dozen',
      8: 'Set',
      9: 'Pair',
      10: 'Roll',
      11: 'Gm',
      12: 'Ml'
    };

    const uomName = uomOption?.value || (uomId ? fallbackUomNames[uomId] : '') || (typeof val === 'string' ? val : '');

    this.itemDraft.update(draft => ({
      ...draft,
      uomId: uomId,
      unit: uomName
    }));
    this.itemTouchedFields.update(touched => ({ ...touched, unit: true }));
  }

  updateItemDraft<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.itemDraft.update(draft => ({ ...draft, [field]: value }));
    this.itemTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  markItemFieldAsTouched(field: string): void {
    this.itemTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  itemFieldError(field: string): string {
    if (!this.itemFormSubmitted() && !this.itemTouchedFields()[field]) return '';
    return this.itemValidationErrors().find(e => e.field === field)?.message || '';
  }

  readonly itemValidationErrors = computed(() => this.validateItemDraft(this.itemDraft()));

  private validateItemDraft(draft: ItemDraft): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    if (!draft.code.trim()) errors.push({ field: 'code', message: 'Item code is required.' });
    else if (!/^[A-Z0-9\-]+$/i.test(draft.code.trim())) errors.push({ field: 'code', message: 'Code must be alphanumeric (hyphens allowed).' });
    if (!draft.name.trim()) errors.push({ field: 'name', message: 'Item name is required.' });
    if (!draft.categoryId && !draft.category.trim()) errors.push({ field: 'category', message: 'Category is required.' });
    if (!draft.uomId && !draft.unit.trim()) errors.push({ field: 'unit', message: 'Unit of measure is required.' });
    if (draft.unitCost === null || draft.unitCost === undefined || Number(draft.unitCost) < 0)
      errors.push({ field: 'unitCost', message: 'Enter a valid cost (>= 0).' });
    if (draft.taxRate === null || draft.taxRate === undefined || Number(draft.taxRate) < 0 || Number(draft.taxRate) > 100)
      errors.push({ field: 'taxRate', message: 'Tax rate must be between 0 and 100.' });
    if (draft.reorderLevel !== null && Number(draft.reorderLevel) < 0)
      errors.push({ field: 'reorderLevel', message: 'Reorder level cannot be negative.' });
    if (draft.onHandStock !== null && Number(draft.onHandStock) < 0)
      errors.push({ field: 'onHandStock', message: 'On hand stock cannot be negative.' });
    if (draft.parLevel !== null && Number(draft.parLevel) < 0)
      errors.push({ field: 'parLevel', message: 'Maximum stock level cannot be negative.' });
    if (draft.reorderLevel !== null && draft.parLevel !== null && Number(draft.parLevel) < Number(draft.reorderLevel))
      errors.push({ field: 'parLevel', message: 'Maximum stock must be greater than or equal to reorder level.' });
    return errors;
  }

  private emptyItemDraft(): ItemDraft {
    const defaultCat = this.itemCategories()[0];
    const defaultUom = this.uomOptions()[0];
    return {
      code: '',
      name: '',
      categoryId: defaultCat?.id,
      category: defaultCat?.value || '',
      uomId: defaultUom?.id,
      unit: defaultUom?.value || 'Pcs',
      unitCost: null,
      taxRate: 18,
      description: '',
      hsnCode: '',
      reorderLevel: null,
      onHandStock: 0,
      parLevel: null,
      isActive: true
    };
  }

  private draftFromItem(item: MasterInventoryItem): ItemDraft {
    const catOption = this.itemCategories().find(c => c.value.toLowerCase() === item.category.toLowerCase() || c.id === item.categoryId);
    const uomOption = this.uomOptions().find(u => u.value.toLowerCase() === item.unit.toLowerCase() || u.id === item.uomId);
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      categoryId: item.categoryId ?? catOption?.id,
      category: item.category,
      uomId: item.uomId ?? uomOption?.id,
      unit: item.unit,
      unitCost: item.unitCost,
      taxRate: item.taxRate,
      description: item.description || '',
      hsnCode: item.hsnCode || '',
      reorderLevel: item.reorderLevel ?? null,
      onHandStock: item.onHandStock ?? 0,
      parLevel: item.parLevel ?? null,
      isActive: item.isActive
    };
  }

}
