import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface PurchaseMasterOption {
  id?: number;
  code: string;
  value: string;
  isActive: boolean;
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
  private readonly commonBase = '/api/hmsService/v1/common';

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

  getCommonMaster(category: string): Observable<PurchaseMasterOption[]> {
    return this.http
      .get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.commonBase}/getCommonMaster/${category}`)
      .pipe(map(response => this.commonListData(response).map(item => ({
        id: item.id ? Number(item.id) : undefined,
        code: String(item.code || '').trim().toUpperCase(),
        value: String(item.value || '').trim(),
        isActive: item.isActive ?? item.is_active ?? true
      })).filter(item => item.isActive)));
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
