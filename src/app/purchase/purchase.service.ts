import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface PurchaseMasterOption {
  id?: number;
  code: string;
  value: string;
  isActive: boolean;
}

export interface DepartmentPayload {
  id?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayload {
  id?: number;
  supplierName: string;
  categoryId?: number;
  categoryName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  paymentTermsId?: number;
  paymentTermsName?: string;
  supplierAddress: string;
  city: string;
  state: string;
  pinCode: string;
  gstin: string;
  pan: string;
  creditLimit?: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  statusId?: number;
  statusName?: string;
  statusCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderLinePayload {
  id?: number;
  itemId?: number;
  itemCode?: string;
  itemName: string;
  quantity: number;
  rate: number;
  discountPercentage: number;
  gstPercentage: number;
  totalAmount: number;
}

export interface PurchaseOrderPayload {
  id?: number;
  poNumber: string;
  supplierId?: number;
  supplierName?: string;
  departmentId?: number;
  departmentName?: string;
  poDate: string;
  expectedDate: string;
  prId?: number;
  prNumber?: string;
  deliveryStoreId?: number;
  deliveryStoreName?: string;
  paymentTermsId?: number;
  paymentTermsName?: string;
  requestedBy: string;
  itemCount?: number;
  poNote?: string;
  totalAmount: number;
  lines: PurchaseOrderLinePayload[];
  statusId?: number;
  statusName?: string;
  statusCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemConfigPayload {
  id?: number;
  itemCode: string;
  itemName: string;
  categoryId?: number;
  categoryName?: string;
  uomId?: number;
  uomName?: string;
  unitCost: number;
  gstTaxRate: number;
  hsnSacCode?: string;
  reorderLevel?: number;
  maxStockLevel?: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface ApiCommonMaster {
  id?: number;
  code?: string;
  value?: string;
  isActive?: boolean;
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly purchaseBase = '/api/hmsService/v1/purchase';
  private readonly inventoryBase = '/api/hmsService/v1/inventory';
  private readonly commonBase = '/api/hmsService/v1/common';
  private readonly userBase = '/api/hmsUserService/v1';

  getSuppliers(): Observable<SupplierPayload[]> {
    return this.http
      .get<SupplierPayload[] | StandardResponse<SupplierPayload[]>>(`${this.purchaseBase}/suppliers/getAllSupplier`)
      .pipe(map(response => this.listData(response)));
  }

  getSupplierById(id: number): Observable<SupplierPayload | null> {
    return this.http
      .get<SupplierPayload | StandardResponse<SupplierPayload>>(`${this.purchaseBase}/suppliers/getBySupplierId/${id}`)
      .pipe(map(response => this.itemData(response)));
  }

  createSupplier(payload: SupplierPayload): Observable<SupplierPayload> {
    return this.http
      .post<SupplierPayload | StandardResponse<SupplierPayload>>(`${this.purchaseBase}/suppliers/createSupplier`, payload)
      .pipe(map(response => this.itemData(response) || payload));
  }

  updateSupplier(id: number, payload: SupplierPayload): Observable<SupplierPayload> {
    return this.http
      .put<SupplierPayload | StandardResponse<SupplierPayload>>(`${this.purchaseBase}/suppliers/updateSupplier/${id}`, payload)
      .pipe(map(response => this.itemData(response) || { ...payload, id }));
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http
      .delete<void | StandardResponse<void>>(`${this.purchaseBase}/suppliers/deleteSupplier/${id}`)
      .pipe(map(() => void 0));
  }

  getPurchaseOrders(): Observable<PurchaseOrderPayload[]> {
    return this.http
      .get<PurchaseOrderPayload[] | StandardResponse<PurchaseOrderPayload[]>>(`${this.purchaseBase}/orders/getAllPurchaseOrder`)
      .pipe(map(response => this.listData(response)));
  }

  getPurchaseOrderById(id: number): Observable<PurchaseOrderPayload | null> {
    return this.http
      .get<PurchaseOrderPayload | StandardResponse<PurchaseOrderPayload>>(`${this.purchaseBase}/orders/getPurchaseOrderById/${id}`)
      .pipe(map(response => this.itemData(response)));
  }

  createPurchaseOrder(payload: PurchaseOrderPayload): Observable<PurchaseOrderPayload> {
    return this.http
      .post<PurchaseOrderPayload | StandardResponse<PurchaseOrderPayload>>(`${this.purchaseBase}/orders/createPurchaseOrder`, payload)
      .pipe(map(response => this.itemData(response) || payload));
  }

  updatePurchaseOrder(id: number, payload: PurchaseOrderPayload): Observable<PurchaseOrderPayload> {
    return this.http
      .put<PurchaseOrderPayload | StandardResponse<PurchaseOrderPayload>>(`${this.purchaseBase}/orders/updatePurchaseOrder/${id}`, payload)
      .pipe(map(response => this.itemData(response) || { ...payload, id }));
  }

  updatePurchaseOrderStatus(id: number, statusId: number): Observable<PurchaseOrderPayload> {
    return this.http
      .patch<PurchaseOrderPayload | StandardResponse<PurchaseOrderPayload>>(
        `${this.purchaseBase}/orders/updatePurchaseOrderStatus`,
        null,
        { params: { id, statusId } }
      )
      .pipe(map(response => this.itemData(response) || { id } as PurchaseOrderPayload));
  }

  deletePurchaseOrder(id: number): Observable<void> {
    return this.http
      .delete<void | StandardResponse<void>>(`${this.purchaseBase}/orders/deletePurchaseOrder/${id}`)
      .pipe(map(() => void 0));
  }

  getItemConfigs(): Observable<ItemConfigPayload[]> {
    return this.http
      .get<ItemConfigPayload[] | StandardResponse<ItemConfigPayload[]>>(`${this.inventoryBase}/item-configs/getAllItems`)
      .pipe(map(response => this.listData(response)));
  }

  getItemConfigById(id: number): Observable<ItemConfigPayload | null> {
    return this.http
      .get<ItemConfigPayload | StandardResponse<ItemConfigPayload>>(`${this.inventoryBase}/item-configs/getItemById/${id}`)
      .pipe(map(response => this.itemData(response)));
  }

  createItemConfig(payload: ItemConfigPayload): Observable<ItemConfigPayload> {
    return this.http
      .post<ItemConfigPayload | StandardResponse<ItemConfigPayload>>(`${this.inventoryBase}/item-configs/createItem`, payload)
      .pipe(map(response => this.itemData(response) || payload));
  }

  updateItemConfig(id: number, payload: ItemConfigPayload): Observable<ItemConfigPayload> {
    return this.http
      .put<ItemConfigPayload | StandardResponse<ItemConfigPayload>>(`${this.inventoryBase}/item-configs/updateItem/${id}`, payload)
      .pipe(map(response => this.itemData(response) || { ...payload, id }));
  }

  updateItemConfigStatus(id: number, statusId: number): Observable<ItemConfigPayload> {
    return this.http
      .patch<ItemConfigPayload | StandardResponse<ItemConfigPayload>>(
        `${this.inventoryBase}/item-configs/updateItemStatus/${id}`,
        null,
        { params: { statusId } }
      )
      .pipe(map(response => this.itemData(response) || { id } as ItemConfigPayload));
  }

  deleteItemConfig(id: number): Observable<void> {
    return this.http
      .delete<void | StandardResponse<void>>(`${this.inventoryBase}/item-configs/deleteItem/${id}`)
      .pipe(map(() => void 0));
  }

  getCommonMaster(category: string): Observable<PurchaseMasterOption[]> {
    const masterKey = category.trim();
    return this.http
      .get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.commonBase}/getCommonMaster/${masterKey}`)
      .pipe(map(response => this.commonListData(response).map(item => ({
        id: item.id ? Number(item.id) : undefined,
        code: String(item.code || '').trim().toUpperCase(),
        value: String(item.value || '').trim(),
        isActive: item.isActive ?? item.is_active ?? true
      })).filter(item => item.isActive)));
  }

  getDepartments(): Observable<PurchaseMasterOption[]> {
    return this.http
      .get<DepartmentPayload[] | StandardResponse<DepartmentPayload[]>>(`${this.userBase}/departments/getAllDepartments`)
      .pipe(map(response => this.listData(response).map(department => ({
        id: department.id ? Number(department.id) : undefined,
        code: String(department.name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        value: String(department.name || '').trim(),
        isActive: department.isActive ?? true
      })).filter(department => department.isActive && department.value)));
  }

  private listData<T>(response: T[] | StandardResponse<T[]> | null): T[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    return response.data || [];
  }

  private itemData<T>(response: T | StandardResponse<T> | null): T | null {
    if (!response) return null;
    if (typeof response === 'object' && 'success' in response) return response.data || null;
    return response as T;
  }

  private commonListData(response: ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]> | null): ApiCommonMaster[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    return response.data || [];
  }
}
