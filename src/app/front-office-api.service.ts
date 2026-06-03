import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  metadata?: {
    totalRecords?: number;
    currentPage?: number;
    pageSize?: number;
  };
}

export interface ArrivalApiItem {
  bookingId: number;
  bookingRef: string;
  guestName: string;
  guestIsVip: boolean;
  numberOfNights: number;
  roomTypeName: string;
  eta: string;
  balance: number;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber?: string;
}

export interface ArrivalApiData {
  arrivals: ArrivalApiItem[];
  pendingArrivalsCount: number;
  checkedInCount: number;
  totalExpectedCount: number;
}

export interface GuestApiItem {
  id: number;
  firstName: string;
  lastName: string;
  fullName?: string;
  countryCode?: string;
  phone: string;
  email: string;
  country?: string;
  nationality?: string;
  guestNotes?: string;
  preference?: string;
  isVip?: boolean;
}

export interface GuestRequest {
  title?: string;
  firstName: string;
  lastName: string;
  countryCode?: string;
  phone: string;
  email: string;
  country?: string;
  nationality?: string;
  guestNotes?: string;
  preference?: string;
  isVip?: boolean;
}

export interface CheckInRequest {
  bookingId: number;
  roomId: number;
  idVerification: string;
  paymentMethod: string;
  amountToSettle: number;
}

export interface CheckInDetails {
  bookingId: number;
  guestPhone?: string;
  occupancy?: string;
  ratePlan?: string;
  source?: string;
  totalEstBill?: number;
  balanceDue?: number;
  assignedRoomNumber?: string;
  assignedRoomId?: number;
}

export interface CheckOutRequest {
  bookingId: number;
  keysReturned: boolean;
  lateCheckOutFee: number;
  minibarCharges: number;
  roomDamageReported: boolean;
  damagePenaltyCharge: number;
  damageDescription: string;
  paymentMethod: string;
  amountToCollect: number;
  transportationRequested: string;
  guestFeedback: string;
}

export interface GanttChartItem {
  bookingId: number;
  reservationId: number;
  reservationRef: string;
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class FrontOfficeApiService {
  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';

  constructor(private readonly http: HttpClient) {}

  getArrivals(searchText = '', checkout = false): Observable<ApiResponse<ArrivalApiData>> {
    let params = new HttpParams()
      .set('checkout', String(checkout))
      .set('page', '0')
      .set('size', '50');

    if (searchText.trim()) {
      params = params.set('searchText', searchText.trim());
    }

    return this.http.get<ApiResponse<ArrivalApiData>>(`${this.frontOfficeBaseUrl}/frontOffice/arrivals`, { params });
  }

  checkIn(payload: CheckInRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.frontOfficeBaseUrl}/frontOffice/checkin`, payload);
  }

  getCheckInDetails(bookingId: number): Observable<ApiResponse<CheckInDetails>> {
    return this.http.get<ApiResponse<CheckInDetails>>(`${this.frontOfficeBaseUrl}/frontOffice/checkin-details/${bookingId}`);
  }

  checkOut(payload: CheckOutRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.frontOfficeBaseUrl}/frontOffice/checkout`, payload);
  }

  getGanttChartData(startDate: string, endDate: string): Observable<ApiResponse<GanttChartItem[]>> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<ApiResponse<GanttChartItem[]>>(`${this.frontOfficeBaseUrl}/frontOffice/getGanttChartData`, { params });
  }

  getGuests(): Observable<ApiResponse<GuestApiItem[]>> {
    return this.http.get<ApiResponse<GuestApiItem[]>>(`${this.frontOfficeBaseUrl}/guests/getAllGuests`);
  }

  createGuest(payload: GuestRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.frontOfficeBaseUrl}/guests/createGuest`, payload);
  }

  updateGuest(id: number, payload: GuestRequest): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.frontOfficeBaseUrl}/guests/updateGuest/${id}`, payload);
  }

  deleteGuest(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.frontOfficeBaseUrl}/guests/deleteGuest/${id}`);
  }
}
