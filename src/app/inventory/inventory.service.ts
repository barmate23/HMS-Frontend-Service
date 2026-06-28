import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface StockItemPayload {
  id?: number | string;
  stockId?: number | string;
  itemId?: number | string;
  code?: string;
  itemCode?: string;
  skuCode?: string;
  name?: string;
  itemName?: string;
  category?: string;
  categoryName?: string;
  store?: string;
  storeName?: string;
  unit?: string;
  uom?: string;
  uomName?: string;
  onHand?: number | string;
  currentStock?: number | string;
  availableStock?: number | string;
  stockQuantity?: number | string;
  quantity?: number | string;
  reorderLevel?: number | string;
  reOrderLevel?: number | string;
  minStockLevel?: number | string;
  parLevel?: number | string;
  maxStockLevel?: number | string;
  unitCost?: number | string;
  rate?: number | string;
  costPrice?: number | string;
  lastUpdated?: string;
  updatedAt?: string;
}

export interface StoreIssuePayload {
  id?: number | string;
  storeIssueId?: number | string;
  issueId?: number | string;
  /* Write fields — match actual API contract */
  itemId?: number | string;
  departmentId?: number | string;
  issuedTo?: string;
  quantity?: number | string;
  issueNote?: string;
  issueDate?: string;
  statusId?: number | string;
  /* Read aliases — returned by GET endpoints */
  issueNo?: string;
  issueNumber?: string;
  storeIssueNo?: string;
  code?: string;
  department?: string;
  departmentName?: string;
  issuedToName?: string;
  item?: string;
  itemName?: string;
  itemCode?: string;
  qty?: number | string;
  uomId?: number | string;
  unit?: string;
  uom?: string;
  uomName?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  statusName?: string;
  statusCode?: string;
  remarks?: string;
  note?: string;
}

export interface ItemConfigPayload {
  id?: number | string;
  itemId?: number | string;
  code?: string;
  itemCode?: string;
  name?: string;
  itemName?: string;
  category?: string;
  categoryName?: string;
  uomId?: number | string;
  unit?: string;
  uom?: string;
  uomName?: string;
  unitCost?: number | string;
  rate?: number | string;
  unitPrice?: number | string;
  costPrice?: number | string;
  isActive?: boolean;
  active?: boolean;
}

export interface PurchaseRequestLinePayload {
  id?: number | string;
  itemId?: number | string;
  itemName?: string;
  itemCode?: string;
  quantity?: number | string;
  requiredQuantity?: number | string;
  rate?: number | string;
  estimatedRate?: number | string;
  unitPrice?: number | string;
  uomId?: number | string;
  unit?: string;
}

export interface PurchaseRequestPayload {
  id?: number | string;
  purchaseRequestId?: number | string;
  prNo?: string;
  prNumber?: string;
  departmentId?: number | string;
  departmentName?: string;
  department?: string;
  requestedBy?: string;
  neededBy?: string;
  priority?: string;
  priorityId?: number | string;
  purpose?: string;
  justification?: string;
  statusId?: number | string;
  status?: string;
  statusName?: string;
  statusCode?: string;
  totalAmount?: number | string;
  expectedAmount?: number | string;
  createdAt?: string;
  updatedAt?: string;
  issueDate?: string;
  lines?: PurchaseRequestLinePayload[];
  items?: PurchaseRequestLinePayload[];
}

interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly stockBase = '/api/hmsService/v1/inventory/stocks';
  private readonly storeIssueBase = '/api/hmsService/v1/inventory/store-issues';
  private readonly itemConfigBase = '/api/hmsService/v1/inventory/item-configs';
  private readonly purchaseRequestBase = '/api/hmsService/v1/inventory/purchase-requests';

  getAllStockItems(): Observable<StockItemPayload[]> {
    return this.http
      .get<StockItemPayload[] | StandardResponse<StockItemPayload[]> | { data?: { content?: StockItemPayload[] } }>(`${this.stockBase}/getAllStockItems`)
      .pipe(map(response => this.listData(response)));
  }

  getAllStoreIssues(): Observable<StoreIssuePayload[]> {
    return this.http
      .get<StoreIssuePayload[] | StandardResponse<StoreIssuePayload[]> | { data?: { content?: StoreIssuePayload[] } }>(`${this.storeIssueBase}/getAllStoreIssue`)
      .pipe(map(response => this.listData(response)));
  }

  getStoreIssueById(id: number | string): Observable<StoreIssuePayload | null> {
    return this.http
      .get<StoreIssuePayload | StandardResponse<StoreIssuePayload>>(`${this.storeIssueBase}/getByStoreIssueId/${id}`)
      .pipe(map(response => this.itemData(response)));
  }

  getItemConfigs(): Observable<ItemConfigPayload[]> {
    return this.http
      .get<ItemConfigPayload[] | StandardResponse<ItemConfigPayload[]> | { data?: { content?: ItemConfigPayload[] } }>(`${this.itemConfigBase}/getAllItems`)
      .pipe(map(response => this.listData(response)));
  }

  createStoreIssue(payload: StoreIssuePayload): Observable<StoreIssuePayload> {
    return this.http
      .post<StoreIssuePayload | StandardResponse<StoreIssuePayload>>(`${this.storeIssueBase}/createStoreIssue`, payload)
      .pipe(map(response => this.itemData(response) || payload));
  }

  updateStoreIssue(id: number | string, payload: StoreIssuePayload): Observable<StoreIssuePayload> {
    return this.http
      .put<StoreIssuePayload | StandardResponse<StoreIssuePayload>>(`${this.storeIssueBase}/updateStoreIssue/${id}`, payload)
      .pipe(map(response => this.itemData(response) || { ...payload, id }));
  }

  deleteStoreIssue(id: number | string): Observable<void> {
    return this.http
      .delete<void | StandardResponse<void>>(`${this.storeIssueBase}/deleteStoreIssue/${id}`)
      .pipe(map(() => void 0));
  }

  // --- Purchase Requests ---

  getAllPurchaseRequests(): Observable<PurchaseRequestPayload[]> {
    return this.http
      .get<PurchaseRequestPayload[] | StandardResponse<PurchaseRequestPayload[]> | { data?: { content?: PurchaseRequestPayload[] } }>(`${this.purchaseRequestBase}/getAllPurchaseRequest`)
      .pipe(map(response => this.listData(response)));
  }

  getPurchaseRequestById(id: number | string): Observable<PurchaseRequestPayload | null> {
    return this.http
      .get<PurchaseRequestPayload | StandardResponse<PurchaseRequestPayload>>(`${this.purchaseRequestBase}/getPurchaseRequestById/${id}`)
      .pipe(map(response => this.itemData(response)));
  }

  createPurchaseRequest(payload: PurchaseRequestPayload): Observable<PurchaseRequestPayload> {
    return this.http
      .post<PurchaseRequestPayload | StandardResponse<PurchaseRequestPayload>>(`${this.purchaseRequestBase}/createPurchaseRequest`, payload)
      .pipe(map(response => this.itemData(response) || payload));
  }

  updatePurchaseRequest(id: number | string, payload: PurchaseRequestPayload): Observable<PurchaseRequestPayload> {
    return this.http
      .put<PurchaseRequestPayload | StandardResponse<PurchaseRequestPayload>>(`${this.purchaseRequestBase}/updatePurchaseRequest/${id}`, payload)
      .pipe(map(response => this.itemData(response) || { ...payload, id }));
  }

  deletePurchaseRequest(id: number | string): Observable<void> {
    return this.http
      .delete<void | StandardResponse<void>>(`${this.purchaseRequestBase}/deletePurchaseRequest/${id}`)
      .pipe(map(() => void 0));
  }

  private listData<T>(response: T[] | StandardResponse<T[]> | { data?: { content?: T[] } } | null): T[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'content' in data && Array.isArray(data.content)) return data.content;

    return [];
  }

  private itemData<T>(response: T | StandardResponse<T> | null): T | null {
    if (!response) return null;
    if (typeof response === 'object' && 'success' in response) return response.data || null;
    return response as T;
  }
}
