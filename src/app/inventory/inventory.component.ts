import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { InventoryService, ItemConfigPayload, StockItemPayload, StoreIssuePayload } from './inventory.service';

type InventoryTab = 'dashboard' | 'stock' | 'requests' | 'issues';
type StockStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OVERSTOCK';
type IssueStatus = 'Open' | 'Issued' | 'Closed';
type RequestStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Ordered';
type RequestPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

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
  department: string;
  issuedTo: string;
  item: string;
  quantity: number;
  unit: string;
  date: string;
  status: IssueStatus;
  note: string;
}

interface StoreIssueDraft {
  itemId: number | string | '';
  department: string;
  issuedTo: string;
  item: string;
  quantity: number;
  unit: string;
  date: string;
  status: IssueStatus;
  note: string;
}

interface IssueItemOption {
  id: number | string;
  code: string;
  name: string;
  unit: string;
}

interface PurchaseRequestLine {
  id: number;
  itemId: number | string | '';
  item: string;
  unit: string;
  quantity: number;
  estimatedRate: number;
}

interface PurchaseRequest {
  id: string;
  department: string;
  requestedBy: string;
  neededBy: string;
  priority: RequestPriority;
  status: RequestStatus;
  purpose: string;
  lines: PurchaseRequestLine[];
}

interface PurchaseRequestDraft {
  id?: string;
  department: string;
  requestedBy: string;
  neededBy: string;
  priority: RequestPriority;
  status: RequestStatus;
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
  status: IssueStatus;
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
  issueError = signal<string | null>(null);
  issueItemError = signal<string | null>(null);
  issueSaving = signal(false);
  issueDeletingId = signal<number | string | null>(null);
  createModal = signal<'request' | 'issue' | null>(null);
  selectedPurchaseRequest = signal<PurchaseRequest | null>(null);
  purchaseRequestDetail = signal<PurchaseRequest | null>(null);
  purchaseRequestPendingDelete = signal<PurchaseRequest | null>(null);
  purchaseRequestDraft = signal<PurchaseRequestDraft>(this.emptyPurchaseRequestDraft());
  selectedStoreIssue = signal<StoreIssue | null>(null);
  storeIssueDraft = signal<StoreIssueDraft>(this.emptyStoreIssueDraft());

  readonly stockItems = signal<StoreItem[]>([]);
  readonly issueItems = signal<IssueItemOption[]>([]);

  readonly purchaseRequests = signal<PurchaseRequest[]>([
    {
      id: 'PR-1007',
      department: 'Housekeeping',
      requestedBy: 'Meena Pillai',
      neededBy: '2026-06-29',
      priority: 'High',
      status: 'Approved',
      purpose: 'Replenish floor pantry linen for weekend occupancy.',
      lines: [
        { id: 1, itemId: 'HK-LIN-001', item: 'Bath Towel', unit: 'Pcs', quantity: 60, estimatedRate: 220 },
        { id: 2, itemId: 'HK-AMN-014', item: 'Dental Kit', unit: 'Pcs', quantity: 120, estimatedRate: 18 }
      ]
    },
    {
      id: 'PR-1008',
      department: 'Laundry',
      requestedBy: 'Laundry Desk',
      neededBy: '2026-06-30',
      priority: 'Normal',
      status: 'Submitted',
      purpose: 'Monthly detergent and consumables requirement.',
      lines: [
        { id: 1, itemId: 'LND-DET-003', item: 'Laundry Detergent', unit: 'Kg', quantity: 75, estimatedRate: 96 }
      ]
    },
    {
      id: 'PR-1009',
      department: 'Engineering',
      requestedBy: 'Amit Rao',
      neededBy: '2026-07-02',
      priority: 'Urgent',
      status: 'Draft',
      purpose: 'Emergency cleaning chemical buffer for public area deep clean.',
      lines: [
        { id: 1, itemId: 'HK-CHEM-007', item: 'Floor Cleaner', unit: 'Ltr', quantity: 24, estimatedRate: 145 }
      ]
    }
  ]);

  readonly storeIssues = signal<StoreIssue[]>([]);

  constructor(
    private readonly router: Router,
    private readonly inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.loadStockItems();
    this.loadIssueItems();
    this.loadStoreIssues();
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
      { id: 'HK-LIN-001', code: 'HK-LIN-001', name: 'Bath Towel', unit: 'Pcs' },
      { id: 'HK-AMN-014', code: 'HK-AMN-014', name: 'Dental Kit', unit: 'Pcs' },
      { id: 'LND-DET-003', code: 'LND-DET-003', name: 'Laundry Detergent', unit: 'Kg' },
      { id: 'HK-CHEM-007', code: 'HK-CHEM-007', name: 'Floor Cleaner', unit: 'Ltr' }
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
        request.priority,
        request.status,
        request.purpose,
        ...request.lines.map(line => line.item)
      ].some(value => value.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  });

  readonly dashboardKpis = computed<InventoryDashboardKpi[]>(() => [
    { label: 'Total SKUs', value: '1,248', delta: '+5.2% vs last 7 days', icon: 'inventory_2', tone: 'blue' },
    { label: 'Low Stock SKUs', value: '36', delta: '+12.5% needs attention', icon: 'warning', tone: 'red' },
    { label: 'Stock Value', value: this.formatINR(1248350), delta: '+8.7% vs last 7 days', icon: 'currency_rupee', tone: 'green' },
    { label: 'Open PRs', value: '23', delta: '8 pending approval', icon: 'assignment_add', tone: 'amber' },
    { label: 'Open Store Issues', value: '18', delta: '6 issued today', icon: 'outbox', tone: 'teal' }
  ]);

  readonly stockHealth = signal<StockHealthSlice[]>([
    { label: 'Healthy', value: 924, percent: 74, color: '#149b72' },
    { label: 'Low Stock', value: 36, percent: 3, color: '#dc7a28' },
    { label: 'Out of Stock', value: 22, percent: 2, color: '#e64251' },
    { label: 'Overstock', value: 266, percent: 21, color: '#2563eb' }
  ]);

  readonly reorderWatch = signal<ReorderWatchItem[]>([
    { item: 'Bath Towel', store: 'Main Store', onHand: '82 Pcs', reorderAt: '140 Pcs', status: 'LOW' },
    { item: 'Laundry Detergent', store: 'Laundry Store', onHand: '8 Kg', reorderAt: '25 Kg', status: 'CRITICAL' },
    { item: 'Coffee Sachet', store: 'HK Pantry', onHand: '18 Pcs', reorderAt: '100 Pcs', status: 'LOW' },
    { item: 'Dental Kit', store: 'HK Pantry', onHand: '6 Pcs', reorderAt: '40 Pcs', status: 'CRITICAL' },
    { item: 'Floor Cleaner', store: 'Main Store', onHand: '4 Ltr', reorderAt: '18 Ltr', status: 'LOW' }
  ]);

  readonly prPipeline = signal([
    { status: 'Draft', count: 5, value: 56240, color: '#8a8f91' },
    { status: 'Submitted', count: 8, value: 248760, color: '#2563eb' },
    { status: 'Approved', count: 6, value: 391820, color: '#dc7a28' },
    { status: 'Ordered', count: 3, value: 132450, color: '#7c3aed' },
    { status: 'Rejected', count: 1, value: 18900, color: '#e64251' }
  ]);

  readonly dashboardMovements = signal<DashboardMovement[]>([
    { id: 'ISS-2401', department: 'Housekeeping', item: 'Bath Towel', qty: '12 Pcs', status: 'Issued', date: 'May 11' },
    { id: 'ISS-2402', department: 'Laundry', item: 'Laundry Detergent', qty: '8 Kg', status: 'Open', date: 'May 11' },
    { id: 'ISS-2403', department: 'Housekeeping', item: 'Dental Kit', qty: '48 Pcs', status: 'Issued', date: 'May 10' },
    { id: 'ISS-2404', department: 'Front Office', item: 'Coffee Sachet', qty: '75 Pcs', status: 'Closed', date: 'May 10' }
  ]);

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
    if (!pending) return;
    this.purchaseRequests.update(requests => requests.filter(request => request.id !== pending.id));
    this.purchaseRequestPendingDelete.set(null);
  }

  updatePurchaseRequestDraft(field: keyof Omit<PurchaseRequestDraft, 'lines'>, value: string): void {
    this.purchaseRequestDraft.update(draft => ({ ...draft, [field]: value }));
  }

  addRequestLine(): void {
    this.purchaseRequestDraft.update(draft => ({
      ...draft,
      lines: [
        ...draft.lines,
        { id: Date.now(), itemId: '', item: '', unit: 'Pcs', quantity: 1, estimatedRate: 0 }
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
          unit: selected?.unit || line.unit
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
    const draft = this.purchaseRequestDraft();
    const selected = this.selectedPurchaseRequest();
    const request: PurchaseRequest = {
      ...draft,
      id: selected?.id || this.nextPurchaseRequestId(),
      lines: draft.lines.map((line, index) => ({ ...line, id: index + 1 }))
    };

    this.purchaseRequests.update(requests => selected
      ? requests.map(existing => existing.id === selected.id ? request : existing)
      : [request, ...requests]
    );
    this.closeCreateModal();
  }

  requestTotal(request: PurchaseRequest | PurchaseRequestDraft): number {
    return request.lines.reduce((sum, line) => sum + line.quantity * line.estimatedRate, 0);
  }

  editStoreIssue(issue: StoreIssue): void {
    this.selectedStoreIssue.set(issue);
    this.storeIssueDraft.set({
      department: issue.department,
      issuedTo: issue.issuedTo,
      itemId: issue.itemId,
      item: issue.item,
      quantity: issue.quantity,
      unit: issue.unit,
      date: issue.date,
      status: issue.status,
      note: issue.note
    });
    this.createModal.set('issue');
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
      unit: selected?.unit || draft.unit
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
      },
      error: error => {
        this.issueError.set(error?.error?.message || error?.message || 'Unable to save store issue.');
        this.issueSaving.set(false);
      }
    });
  }

  deleteStoreIssue(issue: StoreIssue): void {
    if (this.issueDeletingId()) return;

    this.issueDeletingId.set(issue.apiId);
    this.issueError.set(null);
    this.inventoryService.deleteStoreIssue(issue.apiId).subscribe({
      next: () => {
        this.issueDeletingId.set(null);
        this.loadStoreIssues();
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

  private loadIssueItems(): void {
    this.isLoadingIssueItems.set(true);
    this.issueItemError.set(null);
    this.inventoryService.getItemConfigs().subscribe({
      next: items => {
        this.issueItems.set(items.map((item, index) => this.mapIssueItemOption(item, index)).filter(item => item.name));
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

    return {
      apiId,
      itemId: issue.itemId ?? '',
      id: this.text(issue.issueNo ?? issue.issueNumber ?? issue.storeIssueNo ?? issue.code ?? apiId, `ISS-${String(index + 1).padStart(4, '0')}`),
      department: this.text(issue.department ?? issue.departmentName, '-'),
      issuedTo: this.text(issue.issuedTo ?? issue.issuedToName, '-'),
      item: itemName,
      quantity: this.toNumber(issue.quantity ?? issue.qty),
      unit: this.text(issue.unit ?? issue.uom ?? issue.uomName, ''),
      date: this.formatDateValue(issue.issueDate ?? issue.date ?? issue.createdAt),
      status,
      note: this.text(issue.issueNote ?? issue.note ?? issue.remarks, '')
    };
  }

  private storeIssuePayload(draft: StoreIssueDraft): StoreIssuePayload {
    return {
      itemId: draft.itemId || undefined,
      department: draft.department,
      issuedTo: draft.issuedTo,
      item: draft.item,
      quantity: draft.quantity,
      unit: draft.unit,
      issueDate: draft.date,
      status: draft.status,
      note: draft.note
    };
  }

  private emptyStoreIssueDraft(): StoreIssueDraft {
    return {
      itemId: '',
      department: 'Housekeeping',
      issuedTo: '',
      item: '',
      quantity: 1,
      unit: 'Pcs',
      date: new Date().toISOString().slice(0, 10),
      status: 'Issued',
      note: ''
    };
  }

  private emptyPurchaseRequestDraft(): PurchaseRequestDraft {
    return {
      department: 'Housekeeping',
      requestedBy: 'Store Desk',
      neededBy: new Date().toISOString().slice(0, 10),
      priority: 'Normal',
      status: 'Draft',
      purpose: '',
      lines: [
        { id: 1, itemId: '', item: '', unit: 'Pcs', quantity: 1, estimatedRate: 0 }
      ]
    };
  }

  private clonePurchaseRequest(request: PurchaseRequest): PurchaseRequestDraft {
    return {
      id: request.id,
      department: request.department,
      requestedBy: request.requestedBy,
      neededBy: request.neededBy,
      priority: request.priority,
      status: request.status,
      purpose: request.purpose,
      lines: request.lines.map(line => ({ ...line }))
    };
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
      unit: this.text(item.unit ?? item.uom ?? item.uomName, 'Pcs')
    };
  }

  private normalizeIssueStatus(value: unknown): IssueStatus {
    const status = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (status === 'open') return 'Open';
    if (status === 'closed') return 'Closed';
    return 'Issued';
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

  private updateTabFromUrl(url: string): void {
    if (url.includes('/inventory/stock')) this.activeTab.set('stock');
    else if (url.includes('/inventory/requests')) this.activeTab.set('requests');
    else if (url.includes('/inventory/issues')) this.activeTab.set('issues');
    else this.activeTab.set('dashboard');
  }
}
