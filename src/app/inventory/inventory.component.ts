import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

type InventoryTab = 'dashboard' | 'stock' | 'minibar' | 'requests' | 'issues';
type StockStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OVERSTOCK';
type RequestStatus = 'Draft' | 'Submitted' | 'Approved' | 'Ordered';
type IssueStatus = 'Open' | 'Issued' | 'Closed';

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

interface MinibarItem {
  id: number;
  room: string;
  item: string;
  par: number;
  current: number;
  consumed: number;
  charge: number;
  status: 'Balanced' | 'Refill' | 'Posted';
}

interface PurchaseRequest {
  id: string;
  department: string;
  requestedBy: string;
  items: number;
  amount: number;
  neededBy: string;
  status: RequestStatus;
}

interface StoreIssue {
  id: string;
  department: string;
  issuedTo: string;
  item: string;
  quantity: number;
  unit: string;
  date: string;
  status: IssueStatus;
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
  categoryFilter = signal('ALL');
  storeFilter = signal('ALL');
  requestStatusFilter = signal<'ALL' | RequestStatus>('ALL');
  createModal = signal<'stock' | 'minibar' | 'request' | 'issue' | null>(null);
  selectedStockItem = signal<StoreItem | null>(null);
  selectedMinibarItem = signal<MinibarItem | null>(null);
  selectedPurchaseRequest = signal<PurchaseRequest | null>(null);
  selectedStoreIssue = signal<StoreIssue | null>(null);

  readonly stockItems = signal<StoreItem[]>([
    { id: 1, code: 'HK-LIN-001', name: 'Bath Towel', category: 'Housekeeping Linen', store: 'Main Store', unit: 'Pcs', onHand: 82, reorderLevel: 60, parLevel: 140, unitCost: 220, lastUpdated: '2026-06-15 09:10' },
    { id: 2, code: 'HK-AMN-014', name: 'Dental Kit', category: 'Guest Amenities', store: 'HK Pantry', unit: 'Pcs', onHand: 24, reorderLevel: 40, parLevel: 120, unitCost: 18, lastUpdated: '2026-06-15 08:45' },
    { id: 3, code: 'LND-DET-003', name: 'Laundry Detergent', category: 'Laundry Consumable', store: 'Laundry Store', unit: 'Kg', onHand: 38, reorderLevel: 25, parLevel: 70, unitCost: 96, lastUpdated: '2026-06-14 18:20' },
    { id: 4, code: 'MB-BEV-009', name: 'Soda Can', category: 'Minibar', store: 'Minibar Store', unit: 'Can', onHand: 110, reorderLevel: 80, parLevel: 180, unitCost: 32, lastUpdated: '2026-06-15 10:05' },
    { id: 5, code: 'HK-CHEM-007', name: 'Floor Cleaner', category: 'Cleaning Chemical', store: 'Main Store', unit: 'Ltr', onHand: 11, reorderLevel: 18, parLevel: 45, unitCost: 145, lastUpdated: '2026-06-15 07:55' },
    { id: 6, code: 'FB-DRY-012', name: 'Coffee Sachet', category: 'Guest Amenities', store: 'HK Pantry', unit: 'Pcs', onHand: 310, reorderLevel: 100, parLevel: 240, unitCost: 7, lastUpdated: '2026-06-14 16:10' }
  ]);

  readonly minibarItems = signal<MinibarItem[]>([
    { id: 1, room: '101', item: 'Soda Can', par: 2, current: 1, consumed: 1, charge: 95, status: 'Refill' },
    { id: 2, room: '104', item: 'Chocolate Bar', par: 2, current: 2, consumed: 0, charge: 0, status: 'Balanced' },
    { id: 3, room: '205', item: 'Mineral Water', par: 4, current: 2, consumed: 2, charge: 120, status: 'Posted' }
  ]);

  readonly purchaseRequests = signal<PurchaseRequest[]>([
    { id: 'PR-1007', department: 'Housekeeping', requestedBy: 'Meena Pillai', items: 4, amount: 18450, neededBy: '2026-06-18', status: 'Approved' },
    { id: 'PR-1008', department: 'Laundry', requestedBy: 'Laundry Desk', items: 2, amount: 7200, neededBy: '2026-06-17', status: 'Submitted' },
    { id: 'PR-1009', department: 'Minibar', requestedBy: 'Front Office', items: 6, amount: 12800, neededBy: '2026-06-20', status: 'Draft' }
  ]);

  readonly storeIssues = signal<StoreIssue[]>([
    { id: 'ISS-2401', department: 'Housekeeping', issuedTo: 'Floor 1 Pantry', item: 'Bath Towel', quantity: 12, unit: 'Pcs', date: '2026-06-15', status: 'Issued' },
    { id: 'ISS-2402', department: 'Laundry', issuedTo: 'Laundry Desk', item: 'Laundry Detergent', quantity: 8, unit: 'Kg', date: '2026-06-15', status: 'Issued' },
    { id: 'ISS-2403', department: 'Minibar', issuedTo: 'Minibar Store', item: 'Soda Can', quantity: 24, unit: 'Can', date: '2026-06-14', status: 'Closed' }
  ]);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
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

  readonly filteredRequests = computed(() => {
    const status = this.requestStatusFilter();
    return this.purchaseRequests().filter(request => status === 'ALL' || request.status === status);
  });

  readonly dashboard = computed(() => {
    const stock = this.stockItems();
    const low = stock.filter(item => this.stockStatus(item) === 'LOW' || this.stockStatus(item) === 'CRITICAL').length;
    const value = stock.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);
    const openRequests = this.purchaseRequests().filter(request => request.status !== 'Ordered').length;
    const minibarDue = this.minibarItems().filter(item => item.status === 'Refill').length;
    return { totalSku: stock.length, low, value, openRequests, minibarDue };
  });

  setTab(tab: InventoryTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/inventory/${tab}`]);
  }

  openCreateModal(type: 'stock' | 'minibar' | 'request' | 'issue'): void {
    if (type === 'stock') this.selectedStockItem.set(null);
    if (type === 'minibar') this.selectedMinibarItem.set(null);
    if (type === 'request') this.selectedPurchaseRequest.set(null);
    if (type === 'issue') this.selectedStoreIssue.set(null);
    this.createModal.set(type);
  }

  closeCreateModal(): void {
    this.createModal.set(null);
    this.selectedMinibarItem.set(null);
    this.selectedPurchaseRequest.set(null);
    this.selectedStoreIssue.set(null);
    this.selectedStockItem.set(null);
  }

  createModalTitle(): string {
    const type = this.createModal();
    if (type === 'stock') return this.selectedStockItem() ? 'Edit Stock Item' : 'Add Stock Item';
    if (type === 'minibar') return this.selectedMinibarItem() ? 'Edit Minibar Posting' : 'Post Minibar Consumption';
    if (type === 'request') return this.selectedPurchaseRequest() ? 'Edit Purchase Request' : 'Create Purchase Request';
    if (type === 'issue') return this.selectedStoreIssue() ? 'Edit Store Issue' : 'Issue Store Stock';
    return '';
  }

  editStockItem(item: StoreItem): void {
    this.selectedStockItem.set(item);
    this.createModal.set('stock');
  }

  deleteStockItem(id: number): void {
    this.stockItems.update(items => items.filter(item => item.id !== id));
  }

  editMinibarItem(item: MinibarItem): void {
    this.selectedMinibarItem.set(item);
    this.createModal.set('minibar');
  }

  deleteMinibarItem(id: number): void {
    this.minibarItems.update(items => items.filter(item => item.id !== id));
  }

  editPurchaseRequest(request: PurchaseRequest): void {
    this.selectedPurchaseRequest.set(request);
    this.createModal.set('request');
  }

  deletePurchaseRequest(id: string): void {
    this.purchaseRequests.update(requests => requests.filter(request => request.id !== id));
  }

  editStoreIssue(issue: StoreIssue): void {
    this.selectedStoreIssue.set(issue);
    this.createModal.set('issue');
  }

  deleteStoreIssue(id: string): void {
    this.storeIssues.update(issues => issues.filter(issue => issue.id !== id));
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

  private updateTabFromUrl(url: string): void {
    if (url.includes('/inventory/stock')) this.activeTab.set('stock');
    else if (url.includes('/inventory/minibar')) this.activeTab.set('minibar');
    else if (url.includes('/inventory/requests')) this.activeTab.set('requests');
    else if (url.includes('/inventory/issues')) this.activeTab.set('issues');
    else this.activeTab.set('dashboard');
  }
}
