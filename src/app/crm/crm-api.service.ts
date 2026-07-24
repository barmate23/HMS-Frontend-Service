import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Standard API response wrapper matching the backend StandardResponse<T>.
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  logId?: string;
  requestId?: string;
  timestamp?: string;
  error?: {
    code: string;
    message: string;
    details?: string;
    field?: string;
  };
  metadata?: {
    totalRecords?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
    executionTimeMs?: number;
    operation?: string;
  };
}

/**
 * Enquiry response DTO from backend.
 */
export interface EnquiryApiItem {
  id: number;
  enquiryRef: string;
  salutation?: string;
  guestName: string;
  companyName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  enquiryType?: string;
  source?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  mealPlan?: string;
  budget?: number;
  expectedRevenue?: number;
  message?: string;
  salesPerson?: string;
  priority?: string;
  status?: string;
  quoted?: string;
  lastContacted?: string;
  latestRemark?: string;
  nextFollowUp?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * Enquiry create/update request payload sent to the backend.
 */
export interface EnquiryApiRequest {
  salutation?: string;
  guestName: string;
  companyName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  enquiryType?: string;
  source?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  mealPlan?: string;
  budget?: number;
  expectedRevenue?: number;
  message?: string;
  salesPerson?: string;
  priority?: string;
  status?: string;
  nextFollowUp?: string;
  latestRemark?: string;
}

@Injectable({ providedIn: 'root' })
export class CrmApiService {
  private readonly baseUrl = '/api/crmService/v1/enquiries';

  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch all active enquiries (with optional search keyword).
   */
  getAllEnquiries(search?: string): Observable<ApiResponse<EnquiryApiItem[]>> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<ApiResponse<EnquiryApiItem[]>>(
      `${this.baseUrl}/getAllEnquiries`, { params }
    );
  }

  /**
   * Fetch a single enquiry by database ID.
   */
  getEnquiryById(id: number): Observable<ApiResponse<EnquiryApiItem>> {
    return this.http.get<ApiResponse<EnquiryApiItem>>(
      `${this.baseUrl}/getEnquiryById/${id}`
    );
  }

  /**
   * Create a new CRM enquiry.
   */
  createEnquiry(payload: EnquiryApiRequest): Observable<ApiResponse<EnquiryApiItem>> {
    return this.http.post<ApiResponse<EnquiryApiItem>>(
      `${this.baseUrl}/createEnquiry`, payload
    );
  }

  /**
   * Update an existing CRM enquiry.
   */
  updateEnquiry(id: number, payload: EnquiryApiRequest): Observable<ApiResponse<EnquiryApiItem>> {
    return this.http.put<ApiResponse<EnquiryApiItem>>(
      `${this.baseUrl}/updateEnquiry/${id}`, payload
    );
  }

  /**
   * Soft-delete an enquiry.
   */
  deleteEnquiry(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/deleteEnquiry/${id}`
    );
  }
}
