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
  itemId?: number | string;
  issueNo?: string;
  issueNumber?: string;
  storeIssueNo?: string;
  code?: string;
  department?: string;
  departmentName?: string;
  issuedTo?: string;
  issuedToName?: string;
  item?: string;
  itemName?: string;
  itemCode?: string;
  quantity?: number | string;
  qty?: number | string;
  unit?: string;
  uom?: string;
  uomName?: string;
  date?: string;
  issueDate?: string;
  createdAt?: string;
  status?: string;
  statusName?: string;
  statusCode?: string;
  remarks?: string;
  note?: string;
  issueNote?: string;
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
  unit?: string;
  uom?: string;
  uomName?: string;
  isActive?: boolean;
  active?: boolean;
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
