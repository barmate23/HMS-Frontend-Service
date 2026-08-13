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

export interface ArrivalBookingItem {
  bookingId: number;
  bookingRef: string;
  confirmationNumber?: string;
  guestName: string;
  guestIsVip?: boolean;
  numberOfNights?: number;
  roomTypeName?: string;
  eta?: string;
  balance?: number;
  baseAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  gstPercent?: number;
  amountExcludingGst?: number;
  taxAmount?: number;
  gstAmount?: number;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber?: string;
  roomId?: number;
}

export interface ArrivalReservationItem {
  reservationId: number;
  reservationRef: string;
  confirmationNumber?: string;
  guestName: string;
  guestIsVip?: boolean;
  numberOfNights?: number;
  checkInDate: string;
  checkOutDate: string;
  eta?: string;
  totalBalance?: number;
  totalBaseAmount?: number;
  baseAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  gstPercent?: number;
  amountExcludingGst?: number;
  gstAmount?: number;
  taxAmount?: number;
  overallStatus?: string;
  numberOfRooms?: number;
  bookings: ArrivalBookingItem[];
}

export interface ArrivalApiItem {
  bookingId: number;
  bookingRef: string;
  confirmationNumber?: string;
  guestName: string;
  guestIsVip: boolean;
  numberOfNights: number;
  roomTypeName: string;
  eta: string;
  balance: number;
  baseAmount?: number;
  totalAmount?: number;
  totalBaseAmount?: number;
  paidAmount?: number;
  gstPercent?: number;
  amountExcludingGst?: number;
  taxAmount?: number;
  gstAmount?: number;
  taxationAmount?: number;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber?: string;
  roomId?: number;
}

export interface ArrivalApiData {
  reservations?: ArrivalReservationItem[];
  arrivals?: ArrivalApiItem[];
  pendingArrivalsCount?: number;
  checkedInCount?: number;
  totalExpectedCount?: number;
  pendingDeparturesCount?: number;
  checkedOutCount?: number;
  totalDeparturesCount?: number;
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
  isVip?: boolean | null;
  numberOfStays?: number;
  totalSpent?: number;
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

export interface CheckInBookingItem {
  bookingId: number;
  roomId?: number;
}

export interface CheckInRequest {
  reservationId?: number;
  bookings: CheckInBookingItem[];
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

export interface GanttSummary {
  totalBookings: number;
  occupiedRooms: number;
  checkedIn: number;
}

export interface GanttChartData {
  summary: GanttSummary;
  bookings: GanttChartItem[];
}

export interface FrontOfficeDashboardSummary {
  totalRooms: number;
  totalBookings: number;
  availableRooms: number;
  occupiedRooms: number;
  bookedRooms: number;
  blockedRooms: number;
  underMaintenanceRooms: number;
}

export interface FrontOfficeBookingSnapshot {
  bookingId?: number;
  reservationId?: number;
  reservationRef?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  vip?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  adults?: number;
  children?: number;
  reservationStatus?: string;
  bookingStatus?: string;
  ratePlanName?: string;
  ratePerNight?: number;
  totalAmount?: number;
  paidAmount?: number;
  billingName?: string;
  billingMode?: string;
  businessSource?: string;
  marketSegment?: string;
  specialRequests?: string;
  notes?: string;
}

export interface FrontOfficeRoomCard {
  roomId: number;
  roomNumber: string;
  floorId?: number;
  floorName?: string;
  roomType?: string;
  maxOccupancy?: number;
  roomStatus?: string;
  housekeepingStatus?: string;
  displayStatus: 'AVAILABLE' | 'OCCUPIED' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE' | string;
  booking?: FrontOfficeBookingSnapshot | null;
}

export interface FrontOfficeFloorBoard {
  floorId?: number;
  floorName: string;
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  bookedRooms: number;
  blockedRooms: number;
  underMaintenanceRooms: number;
  rooms: FrontOfficeRoomCard[];
}

export interface FrontOfficeDashboardData {
  businessDate: string;
  summary: FrontOfficeDashboardSummary;
  floors: FrontOfficeFloorBoard[];
}

@Injectable({ providedIn: 'root' })
export class FrontOfficeApiService {
  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';

  constructor(private readonly http: HttpClient) {}

  getArrivals(date?: string, searchText = '', checkout = false, page = 0, size = 10): Observable<ApiResponse<ArrivalApiData>> {
    let params = new HttpParams()
      .set('checkout', String(checkout))
      .set('page', String(page))
      .set('size', String(size));

    if (date && date.trim()) {
      params = params.set('date', date.trim());
    }
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

  getGanttChartData(startDate: string, endDate: string): Observable<ApiResponse<GanttChartData>> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<ApiResponse<GanttChartData>>(`${this.frontOfficeBaseUrl}/frontOffice/getGanttChartData`, { params });
  }

  getFrontOfficeDashboard(date?: string): Observable<ApiResponse<FrontOfficeDashboardData>> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<ApiResponse<FrontOfficeDashboardData>>(`${this.frontOfficeBaseUrl}/frontOffice/dashboard/getDashboardData`, { params });
  }

  getGuests(search = ''): Observable<ApiResponse<GuestApiItem[]>> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<GuestApiItem[]>>(`${this.frontOfficeBaseUrl}/guests/getAllGuests`, { params });
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
