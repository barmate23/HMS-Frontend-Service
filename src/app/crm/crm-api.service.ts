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

/**
 * Quotation response DTO from backend.
 */
export interface QuotationApiItem {
  id?: number;
  quotationRef?: string;
  revision?: number;
  enquiryId: number;
  enquiryRef?: string;
  guestName: string;
  companyName?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  mealPlan?: string;
  roomRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  advanceAmount?: number;
  terms?: string;
  specialInstructions?: string;
  validTill?: string;
  status?: string;
  sentAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * Quotation create/update request payload.
 */
export interface QuotationApiRequest {
  enquiryId: number;
  guestName: string;
  companyName?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;
  children?: number;
  mealPlan?: string;
  roomRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  advanceAmount?: number;
  terms?: string;
  specialInstructions?: string;
  validTill?: string;
  status?: string;
  createdBy?: string;
  updatedBy?: string;
}

@Injectable({ providedIn: 'root' })
export class CrmApiService {
  private readonly baseUrl = '/api/crmService/v1/enquiries';
  private readonly quotationBaseUrl = '/api/crmService/v1/quotations';

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

  /**
   * Fetch all users from the User Management module.
   */
  getUsers(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/api/hmsUserService/v1/users/getAllUsers');
  }

  // ── Quotation APIs ────────────────────────────────────────────────────────

  /**
   * Fetch all quotations (with optional search filter).
   */
  getAllQuotations(search?: string): Observable<ApiResponse<QuotationApiItem[]>> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<ApiResponse<QuotationApiItem[]>>(
      `${this.quotationBaseUrl}/getAllQuotations`, { params }
    );
  }

  /**
   * Fetch a quotation by database ID.
   */
  getQuotationById(id: number): Observable<ApiResponse<QuotationApiItem>> {
    return this.http.get<ApiResponse<QuotationApiItem>>(
      `${this.quotationBaseUrl}/getQuotationById/${id}`
    );
  }

  /**
   * Fetch quotations linked to a specific enquiry.
   */
  getQuotationsByEnquiry(enquiryId: number): Observable<ApiResponse<QuotationApiItem[]>> {
    return this.http.get<ApiResponse<QuotationApiItem[]>>(
      `${this.quotationBaseUrl}/getByEnquiry/${enquiryId}`
    );
  }

  /**
   * Create a new CRM Quotation.
   */
  createQuotation(payload: QuotationApiRequest): Observable<ApiResponse<QuotationApiItem>> {
    return this.http.post<ApiResponse<QuotationApiItem>>(
      `${this.quotationBaseUrl}/createQuotation`, payload
    );
  }

  /**
   * Update an existing Quotation (automatically increments revision).
   */
  updateQuotation(id: number, payload: QuotationApiRequest): Observable<ApiResponse<QuotationApiItem>> {
    return this.http.put<ApiResponse<QuotationApiItem>>(
      `${this.quotationBaseUrl}/updateQuotation/${id}`, payload
    );
  }

  /**
   * Mark a quotation as Sent.
   */
  markQuotationAsSent(id: number): Observable<ApiResponse<string>> {
    return this.http.put<ApiResponse<string>>(
      `${this.quotationBaseUrl}/markAsSent/${id}`, {}
    );
  }

  /**
   * Soft delete a quotation.
   */
  deleteQuotation(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.quotationBaseUrl}/deleteQuotation/${id}`
    );
  }
}
