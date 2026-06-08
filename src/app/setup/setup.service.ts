import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface CommonMaster {
  id?: number;
  category: string;
  code: string;
  value: string;
  description: string;
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
  category?: string;
  code?: string;
  value?: string;
  description?: string;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class SetupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/hmsService/v1/housekeeping/audit';
  private tempId = -1;

  getCommonMasters(category: string): Observable<CommonMaster[]> {
    return this.http
      .get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.baseUrl}/getCommonMaster/${category}`)
      .pipe(map(response => this.listData(response).map(item => this.mapCommonMaster(item, category))));
  }

  createCommonMaster(input: CommonMaster): Observable<CommonMaster> {
    return this.http
      .post<ApiCommonMaster | StandardResponse<ApiCommonMaster>>(`${this.baseUrl}/createCommonMaster`, this.toPayload(input))
      .pipe(
        map(response => this.mapCommonMaster(this.itemData(response) || this.toPayload(input), input.category)),
        catchError(error => {
          console.warn('[Setup] createCommonMaster API unavailable, using local record fallback.', error);
          return of({ ...input, id: this.tempId--, updatedAt: 'Local draft' });
        })
      );
  }

  updateCommonMaster(input: CommonMaster): Observable<CommonMaster> {
    return this.http
      .put<ApiCommonMaster | StandardResponse<ApiCommonMaster>>(`${this.baseUrl}/updateCommonMaster/${input.id}`, this.toPayload(input))
      .pipe(
        map(response => this.mapCommonMaster(this.itemData(response) || this.toPayload(input), input.category)),
        catchError(error => {
          console.warn('[Setup] updateCommonMaster API unavailable, using local record fallback.', error);
          return of({ ...input, updatedAt: 'Local draft' });
        })
      );
  }

  deleteCommonMaster(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/deleteCommonMaster/${id}`).pipe(
      catchError(error => {
        console.warn('[Setup] deleteCommonMaster API unavailable, using local delete fallback.', error);
        return of(void 0);
      })
    );
  }

  private mapCommonMaster(item: ApiCommonMaster, fallbackCategory: string): CommonMaster {
    return {
      id: item.id ? Number(item.id) : undefined,
      category: String(item.category || fallbackCategory || '').trim().toUpperCase(),
      code: String(item.code || '').trim().toUpperCase(),
      value: String(item.value || '').trim(),
      description: String(item.description || '').trim(),
      isActive: item.isActive ?? item.is_active ?? true,
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at
    };
  }

  private toPayload(input: CommonMaster): ApiCommonMaster {
    return {
      id: input.id,
      category: input.category.trim().toUpperCase(),
      code: input.code.trim().toUpperCase(),
      value: input.value.trim(),
      description: input.description.trim(),
      isActive: input.isActive,
      is_active: input.isActive
    };
  }

  private listData(response: ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]> | null): ApiCommonMaster[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    return response.data || [];
  }

  private itemData(response: ApiCommonMaster | StandardResponse<ApiCommonMaster> | null): ApiCommonMaster | null {
    if (!response) return null;
    if ('success' in response) return response.data || null;
    return response;
  }
}
