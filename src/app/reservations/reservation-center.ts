import { Component, signal, computed, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface Reservation {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  plan: string;
  checkIn: string;
  checkOut: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'NO_SHOW';
  billingAmount: number;
  paidAmount: number;
  gstPercent: number;
  taxAmount: number;
  totalWithTax: number;
  bookingSource?: string;
  nights?: number;
  adults?: number;
  children?: number;
  vip?: boolean;
  repeat?: boolean;
  new?: boolean;
}

interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
  metadata?: {
    totalRecords?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

interface Room {
  id?: number;
  number: string;
  floorId?: number;
  type: string;
  floor: string;
  status: 'available' | 'occupied' | 'dirty' | 'booked' | 'maintenance';
  guest?: string;
  checkOutDate?: string;
  reservationRef?: string;
}

interface ApiFloor {
  id: number;
  floorNumber: string;
  isActive: boolean;
}

interface ApiRoomStatus {
  id: number;
  roomNumber: string;
  floorId: number;
  floorNumber?: string | null;
  roomTypeId?: number;
  roomTypeName?: string | null;
  status: string;
  guestName?: string | null;
  reservationRef?: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-reservation-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  templateUrl: './reservation-center.html',
  styleUrls: ['./reservation-center.css']
})
export class ReservationCenter implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';
  private routerSub?: Subscription;

  viewMode = signal<'LIST' | 'STAY' | 'MAP'>('LIST');
  selectedFloor = signal('Floor 1');
  searchText = signal('');
  statusFilter = signal<string>('ALL');
  statuses = signal<{code: string; value: string}[]>([
    { code: 'ALL', value: 'All Status' },
    { code: 'PENDING', value: 'Pending' },
    { code: 'CONFIRMED', value: 'Confirmed' },
    { code: 'CHECKED_IN', value: 'Checked In' },
    { code: 'CHECKED_OUT', value: 'Checked Out' },
    { code: 'CANCELLED', value: 'Cancelled' },
    { code: 'NO_SHOW', value: 'No Show' }
  ]);
  isLoadingReservations = signal(false);
  reservationError = signal<string | null>(null);
  reservationMessage = signal<string | null>(null);
  totalReservationRecords = signal(0);
  currentPage = signal(0);
  pageSize = signal(10);
  selectedReservationDetails = signal<any | null>(null);
  isReservationDetailsOpen = signal(false);
  isLoadingReservationDetails = signal(false);

  get totalPages(): number {
    return Math.ceil(this.totalReservationRecords() / this.pageSize());
  }

  nextPage() {
    if (this.currentPage() + 1 < this.totalPages) {
      this.currentPage.update(p => p + 1);
      this.loadReservations();
    }
  }

  prevPage() {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadReservations();
    }
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage.set(page);
      this.loadReservations();
    }
  }

  get paginationRangeLabel(): string {
    const total = this.totalReservationRecords();
    if (total === 0) return '0 - 0 of 0';
    const start = this.currentPage() * this.pageSize() + 1;
    const end = Math.min(start + this.pageSize() - 1, total);
    return `${start} - ${end} of ${total}`;
  }

  // Date Range Picker State
  showCalendar = signal(false);
  showYearPicker = signal(false);
  calendarMonth = signal(new Date());
  rangeStart = signal<Date | null>(null);
  rangeEnd = signal<Date | null>(null);
  selectingMode = signal<'START' | 'END'>('START');
  hoverDate = signal<Date | null>(null);

  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  mapFloors = signal<ApiFloor[]>([]);
  mapSelectedFloorId = signal<number | null>(null);
  mapSelectedDate = signal(this.toApiDate(new Date()));
  mapIsLoading = signal(false);
  mapError = signal<string | null>(null);

  ngOnInit() {
    this.loadStatuses();
    this.loadReservations();
    this.loadRoomWiseStatus();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.includes('/reservations'))
    ).subscribe(() => {
      this.loadReservations();
      this.loadRoomWiseStatus();
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  get dateRangeLabel(): string {
    const s = this.rangeStart();
    const e = this.rangeEnd();
    if (!s) return 'Select dates';
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
  }

  currentMonthName(): string {
    return this.calendarMonth().toLocaleDateString('en-US', { month: 'long' });
  }

  currentMonthYear(): number {
    return this.calendarMonth().getFullYear();
  }

  formatRangeDate(date: Date | null): string {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  nextMonthName(): string {
    const m = this.calendarMonth();
    return new Date(m.getFullYear(), m.getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }

  nextMonthYear(): number {
    const m = this.calendarMonth();
    return new Date(m.getFullYear(), m.getMonth() + 1, 1).getFullYear();
  }

  yearRange(): number[] {
    const cur = this.calendarMonth().getFullYear();
    return Array.from({ length: 12 }, (_, i) => cur - 5 + i);
  }

  selectYear(year: number) {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(year, m.getMonth(), 1));
    this.showYearPicker.set(false);
  }

  get calendarDays(): (Date | null)[][] {
    const month = this.calendarMonth();
    const year = month.getFullYear();
    const mon = month.getMonth();
    const firstDay = new Date(year, mon, 1).getDay();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, mon, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  get nextCalendarDays(): (Date | null)[][] {
    const month = this.calendarMonth();
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const firstDay = next.getDay();
    const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(next.getFullYear(), next.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  toggleCalendar(e: Event) {
    e.stopPropagation();
    this.showCalendar.update(v => !v);
    if (!this.showCalendar()) this.showYearPicker.set(false);
  }

  @HostListener('document:click')
  closeCalendar() {
    this.showCalendar.set(false);
    this.showYearPicker.set(false);
  }

  prevMonth() { const m = this.calendarMonth(); this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  nextMonth() { const m = this.calendarMonth(); this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  onDayClick(date: Date | null, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!date) return;
    
    if (this.selectingMode() === 'START' || !this.rangeStart()) {
      this.rangeStart.set(date);
      this.rangeEnd.set(null);
      this.selectingMode.set('END');
    } else {
      const start = this.rangeStart();
      if (start && date < start) {
        this.rangeStart.set(date);
        this.rangeEnd.set(null);
        this.selectingMode.set('END');
      } else {
        this.rangeEnd.set(date);
        this.selectingMode.set('START');
      }
    }
  }

  setSelectingMode(mode: 'START' | 'END', e: Event) {
    e.stopPropagation();
    this.selectingMode.set(mode);
  }

  isInRange(date: Date | null): boolean {
    if (!date) return false;
    const s = this.rangeStart(), e = this.rangeEnd() || this.hoverDate();
    if (!s || !e) return false;
    const lo = s < e ? s : e, hi = s < e ? e : s;
    return date > lo && date < hi;
  }

  isRangeStart(date: Date | null): boolean {
    if (!date || !this.rangeStart()) return false;
    return date.toDateString() === this.rangeStart()!.toDateString();
  }

  isRangeEnd(date: Date | null): boolean {
    if (!date || !this.rangeEnd()) return false;
    return date.toDateString() === this.rangeEnd()!.toDateString();
  }

  isToday(date: Date | null): boolean {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  }

  updateStart(val: string) {
    this.rangeStart.set(val ? this.parseDateInput(val) : null);
    this.currentPage.set(0);
    this.loadReservations();
  }
  
  updateEnd(val: string) {
    this.rangeEnd.set(val ? this.parseDateInput(val) : null);
    this.currentPage.set(0);
    this.loadReservations();
  }

  clearDates() { 
    this.rangeStart.set(null); 
    this.rangeEnd.set(null); 
    this.selectingMode.set('START');
    this.currentPage.set(0);
    this.loadReservations();
  }
  
  applyDates() { 
    this.showCalendar.set(false); 
    this.currentPage.set(0);
    this.loadReservations();
  }

  dateInputValue(date: Date | null): string {
    return date ? this.toApiDate(date) : '';
  }

  private parseDateInput(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }


  floors = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'];

  reservations = signal<Reservation[]>([]);

  loadStatuses() {
    this.http.get<any>('/api/hmsService/v1/common/getCommonMaster/RESERVATION_STATUS').subscribe({
      next: (res) => {
        let rawList: any[] = [];
        if (res && res.data && Array.isArray(res.data)) {
          rawList = res.data;
        } else if (Array.isArray(res)) {
          rawList = res;
        }
        
        if (rawList && rawList.length > 0) {
          const mapped = rawList
            .filter(item => item.isActive !== false && item.is_active !== false)
            .map(item => ({
              code: item.id ? item.id.toString() : (item.code || item.value),
              value: item.value || item.code
            }));
          
          if (mapped.length > 0) {
            this.statuses.set([
              { code: 'ALL', value: 'All Status' },
              ...mapped
            ]);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load reservation statuses', err);
      }
    });
  }

  loadReservations() {
    this.isLoadingReservations.set(true);
    this.reservationError.set(null);
    this.reservationMessage.set(null);

    let params = new HttpParams()
      .set('page', this.currentPage().toString())
      .set('size', this.pageSize().toString());

    const search = this.searchText().trim();
    if (search) params = params.set('searchText', search);
    
    if (this.statusFilter() !== 'ALL') {
      const matchedStatus = this.statuses().find(s => 
        s.code === this.statusFilter() || 
        (s.value && s.value.toUpperCase() === this.statusFilter().toUpperCase())
      );
      const statusValue = matchedStatus ? matchedStatus.code : this.statusFilter();
      params = params.set('statusId', statusValue);
    }
    if (this.rangeStart()) params = params.set('fromDate', this.toApiDate(this.rangeStart()!));
    if (this.rangeEnd()) params = params.set('toDate', this.toApiDate(this.rangeEnd()!));

    this.http.get<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/getAllReservations`, { params }).subscribe({
      next: (response) => {
        try {
          let rawList: any[] = [];
          if (response && Array.isArray(response.data)) {
            rawList = response.data;
          } else if (response && response.data && Array.isArray(response.data.content)) {
            rawList = response.data.content;
          } else if (Array.isArray(response)) {
            rawList = response as any;
          }

          const mapped = rawList.map(item => this.mapReservation(item));
          this.reservations.set(mapped);
          this.totalReservationRecords.set(response?.metadata?.totalRecords ?? (response?.data as any)?.totalElements ?? rawList.length);
        } catch (err) {
          console.error('[ReservationCenter] mapReservation error:', err);
          this.reservationError.set('Failed to parse reservation records.');
        } finally {
          this.isLoadingReservations.set(false);
        }
      },
      error: (err) => {
        console.error('[ReservationCenter] loadReservations error:', err);
        const errMsg = err?.error?.message || err?.error?.error?.message || (err?.status === 401 ? 'Session expired or unauthorized. Please re-login.' : 'Unable to load reservations.');
        this.reservationError.set(errMsg);
        this.isLoadingReservations.set(false);
      }
    });
  }

  onSearchChange(value: string) {
    this.searchText.set(value);
    this.currentPage.set(0);
    this.loadReservations();
  }

  onStatusChange(value: string) {
    this.statusFilter.set(value as any);
    this.currentPage.set(0);
    this.loadReservations();
  }

  viewReservationDetails(id: string) {
    this.reservationError.set(null);
    this.reservationMessage.set(null);
    this.selectedReservationDetails.set(null);
    this.isLoadingReservationDetails.set(true);
    this.isReservationDetailsOpen.set(true);

    this.http.get<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/getReservationById/${id}`).subscribe({
      next: (response) => {
        this.selectedReservationDetails.set(response.data ?? {});
        this.isLoadingReservationDetails.set(false);
      },
      error: (err) => {
        console.error('[ReservationCenter] getReservationById error:', err);
        this.isLoadingReservationDetails.set(false);
        this.isReservationDetailsOpen.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to load reservation details.');
      }
    });
  }

  closeReservationDetails() {
    this.isReservationDetailsOpen.set(false);
    this.selectedReservationDetails.set(null);
  }

  openEditReservation(id: string) {
    this.router.navigate(['/new-booking'], { queryParams: { reservationId: id } });
  }

  cancelReservation(id: string, guestName: string) {
    if (!confirm(`Cancel reservation for ${guestName}?`)) return;

    this.reservationError.set(null);
    this.reservationMessage.set(null);

    this.http.put<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/cancelReservation/${id}`, {}).subscribe({
      next: (response) => {
        this.reservationMessage.set(response.message || 'Reservation cancelled.');
        this.loadReservations();
      },
      error: (err) => {
        console.error('[ReservationCenter] cancelReservation error:', err);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to cancel reservation.');
      }
    });
  }

  private mapReservation(item: any): Reservation {
    if (!item) {
      return {
        id: '',
        guestName: 'Guest',
        guestEmail: '',
        guestPhone: '',
        roomNumber: '-',
        roomType: '-',
        plan: '-',
        checkIn: '-',
        checkOut: '-',
        status: 'CONFIRMED',
        billingAmount: 0,
        paidAmount: 0,
        gstPercent: 0,
        taxAmount: 0,
        totalWithTax: 0
      };
    }

    const guest = item.guest || item.guestDetails || {};
    const rooms = Array.isArray(item.rooms) ? item.rooms : [];
    const room = rooms.length > 0 ? rooms[0] : (item.room || {});
    const roomIds = Array.isArray(item.roomIds) ? item.roomIds : [];
    const ratePlan = item.ratePlan || {};
    
    const roomNumbersStr = rooms.length > 0
      ? rooms.map((r: any) => r.roomNumber || r.number).filter(Boolean).join(', ')
      : (room.roomNumber || item.roomNumber || (roomIds.length ? roomIds.join(', ') : '-'));

    const roomTypesStr = rooms.length > 0
      ? Array.from(new Set(rooms.map((r: any) => r.roomTypeName || r.type).filter(Boolean))).join(', ')
      : (room.roomTypeName || item.roomTypeName || item.roomType || '-');

    const firstName = guest.firstName || item.firstName || '';
    const lastName = guest.lastName || item.lastName || '';
    const guestName = item.guestFullName || item.guestName || `${firstName} ${lastName}`.trim() || item.billingName || 'Guest';
    const checkIn = item.checkInDate || item.arrivalDate || item.checkIn || '';
    const checkOut = item.checkOutDate || item.departureDate || item.checkOut || '';
    
    const billingAmount = Number(item.billingAmount ?? item.baseRate ?? item.grandTotal ?? item.totalAmount ?? 0);
    const paidAmount = Number(item.paidAmount ?? item.amountPaid ?? 0);
    const gstPercent = Number(item.gstPercent ?? 0);
    const taxAmount = Number(item.taxAmount ?? item.taxationAmount ?? item.gstAmount ?? Math.round((billingAmount * gstPercent) / 100));
    const totalWithTax = billingAmount + taxAmount;
    const rawSource = item.bookingSource || item.channelName || item.otaName || item.source || item.bookingFrom || item.sourceName || item.segmentName || item.channel;
    let bookingSource = rawSource;
    if (!bookingSource || String(bookingSource).trim() === '') {
      if (item.channexBookingId || item.channexId || item.isChannex) {
        bookingSource = 'Channex';
      } else if (guestName.toLowerCase().includes('ota')) {
        bookingSource = 'Booking.com';
      } else if (guestName.toLowerCase().includes('channex')) {
        bookingSource = 'MakeMyTrip';
      } else {
        bookingSource = 'Direct Walk-in';
      }
    }

    return {
      id: String(item.id ?? item.bookingId ?? item.reservationId ?? ''),
      guestName,
      guestEmail: guest.email || item.guestEmail || item.email || '',
      guestPhone: guest.phone || item.guestPhone || item.phone || item.guestContact || '',
      roomNumber: roomNumbersStr || '-',
      roomType: roomTypesStr || '-',
      plan: room.ratePlanName || ratePlan.shortLabel || ratePlan.name || item.ratePlanName || String(item.ratePlanId ?? '-'),
      checkIn: this.formatDateLabel(checkIn),
      checkOut: this.formatDateLabel(checkOut),
      status: this.normalizeStatus(item.reservationStatus || item.status),
      billingAmount,
      paidAmount,
      gstPercent,
      taxAmount,
      totalWithTax,
      bookingSource,
      nights: Number(item.numberOfNights ?? item.nights ?? 0),
      adults: Number(item.numberOfAdults ?? item.adults ?? 0),
      children: Number(item.numberOfChildren ?? item.children ?? 0),
      vip: Boolean(guest.isVip || item.isVip || item.guestBadge === 'VIP'),
      new: this.normalizeStatus(item.reservationStatus || item.status) === 'PENDING'
    };
  }

  getSourceBadgeClass(source?: string): string {
    if (!source) return 'source-badge--direct';
    const s = source.toLowerCase();
    if (s.includes('booking')) return 'source-badge--booking';
    if (s.includes('makemytrip') || s.includes('mmt')) return 'source-badge--mmt';
    if (s.includes('agoda')) return 'source-badge--agoda';
    if (s.includes('channex')) return 'source-badge--channex';
    if (s.includes('expedia')) return 'source-badge--expedia';
    if (s.includes('air')) return 'source-badge--airbnb';
    if (s.includes('web') || s.includes('site')) return 'source-badge--website';
    return 'source-badge--direct';
  }

  getSourceIcon(source?: string): string {
    if (!source) return 'directions_walk';
    const s = source.toLowerCase();
    if (s.includes('booking') || s.includes('makemytrip') || s.includes('mmt') || s.includes('agoda') || s.includes('expedia') || s.includes('channex') || s.includes('air')) {
      return 'travel_explore';
    }
    if (s.includes('web') || s.includes('site')) return 'language';
    return 'directions_walk';
  }

  private normalizeStatus(status: any): Reservation['status'] {
    if (!status) return 'CONFIRMED';
    if (typeof status === 'object') {
      status = status.code || status.value || status.name || status.status || 'CONFIRMED';
    }
    const s = String(status).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (s === 'CHECKED_IN' || s === 'CHECKEDIN' || s === 'CHECKIN') return 'CHECKED_IN';
    if (s === 'CHECKED_OUT' || s === 'CHECKEDOUT' || s === 'CHECKOUT') return 'CHECKED_OUT';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
    if (s === 'NO_SHOW' || s === 'NOSHOW') return 'NO_SHOW';
    if (s === 'PENDING') return 'PENDING';
    if (s === 'CONFIRMED') return 'CONFIRMED';
    return 'CONFIRMED';
  }

  private toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateLabel(value: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  rooms = signal<Room[]>([]);

  days = [
    { name: 'FRI', date: 20 }, { name: 'SAT', date: 21 }, { name: 'SUN', date: 22 }, { name: 'MON', date: 23 }, { name: 'TUE', date: 24 },
    { name: 'WED', date: 25 }, { name: 'THU', date: 26 }, { name: 'FRI', date: 27 }, { name: 'SAT', date: 28 }, { name: 'SUN', date: 29 }
  ];

  filteredRooms = computed(() => {
    const floorId = this.mapSelectedFloorId();
    if (!floorId) return this.rooms();
    return this.rooms().filter(r => r.floorId === floorId);
  });

  setView(mode: 'LIST' | 'STAY' | 'MAP') {
    this.viewMode.set(mode);
    if (mode === 'MAP') {
      this.loadRoomWiseStatus();
    } else if (mode === 'LIST') {
      this.loadReservations();
    }
  }

  setFloor(floor: string) {
    this.selectedFloor.set(floor);
  }

  onMapFloorChange(value: string) {
    this.mapSelectedFloorId.set(value ? Number(value) : null);
  }

  onMapDateChange(value: string) {
    this.mapSelectedDate.set(value);
    this.loadRoomWiseStatus();
  }

  loadRoomWiseStatus() {
    this.mapIsLoading.set(true);
    this.mapError.set(null);
    const date = this.mapSelectedDate() || this.toApiDate(new Date());
    const params = new HttpParams().set('date', date);

    this.http.get<StandardResponse<ApiRoomStatus[]>>(`${this.frontOfficeBaseUrl}/rooms/getRoomStatusByDate`, { params }).subscribe({
      next: (response) => {
        const activeRooms = (response.data || []).filter(r => r.isActive !== false);
        const floors = this.deriveMapFloors(activeRooms);
        this.mapFloors.set(floors);

        const currentFloorId = this.mapSelectedFloorId();
        if (!currentFloorId && floors.length) {
          this.mapSelectedFloorId.set(floors[0].id);
        } else if (currentFloorId && !floors.some(f => f.id === currentFloorId)) {
          this.mapSelectedFloorId.set(floors[0]?.id ?? null);
        }

        const floorById = new Map(floors.map(f => [f.id, f.floorNumber]));
        const mapped = activeRooms.map(r => ({
          id: r.id,
          number: r.roomNumber,
          floorId: r.floorId,
          floor: floorById.get(r.floorId) || this.floorLabel(r),
          type: r.roomTypeName || 'Room',
          status: this.normalizeRoomStatus(r.status),
          guest: r.guestName || undefined,
          reservationRef: r.reservationRef || undefined
        } as Room));

        this.rooms.set(mapped);
        this.mapIsLoading.set(false);
      },
      error: (err) => {
        console.error('[ReservationCenter] loadRoomWiseStatus error:', err);
        this.mapError.set('Unable to fetch room wise status.');
        this.mapIsLoading.set(false);
      }
    });
  }

  private deriveMapFloors(rooms: ApiRoomStatus[]): ApiFloor[] {
    const byId = new Map<number, ApiFloor>();
    rooms.forEach(room => {
      if (!byId.has(room.floorId)) {
        byId.set(room.floorId, {
          id: room.floorId,
          floorNumber: this.floorLabel(room),
          isActive: true
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }

  private floorLabel(room: ApiRoomStatus): string {
    return room.floorNumber || `Floor ${room.floorId}`;
  }

  statusLabel(status: Reservation['status']): string {
    return status.replace('_', ' ');
  }

  statusClass(status: Reservation['status']): string {
    return status.toLowerCase().replace('_', '-');
  }

  detailGuestName(details: any): string {
    return details?.guestFullName || details?.guestName || details?.billingName || 'Guest';
  }

  detailRooms(details: any): any[] {
    if (Array.isArray(details?.bookings)) return details.bookings;
    if (Array.isArray(details?.rooms)) return details.rooms;
    return [];
  }

  detailStatus(details: any): Reservation['status'] {
    return this.normalizeStatus(details?.reservationStatus || details?.status);
  }

  detailPrimaryRoom(details: any): string {
    const room = this.detailRooms(details)[0];
    return room?.roomNumber ? `Room ${room.roomNumber}` : 'No room assigned';
  }

  getAccompanyingMembers(details: any): any[] {
    if (!details) return [];
    
    // 1. Check if the response contains accompanyingGuests natively
    if (details.accompanyingGuests && Array.isArray(details.accompanyingGuests) && details.accompanyingGuests.length > 0) {
      return details.accompanyingGuests.map((m: any) => ({
        fullName: m.fullName || `${m.title || ''} ${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Companion',
        gender: m.gender || '-',
        dob: m.dateOfBirth || '-',
        relationship: m.relationship || '-',
        idProofType: m.idProofType || m.idProof || '-',
        idProofNumber: m.idProofNumber || m.idNumber || '-'
      }));
    }
    
    // 2. Otherwise parse it from the notes field
    const notesStr = details.notes || '';
    const match = notesStr.match(/\[Accompanying Guests:\s*(.*?)\]/i);
    if (match && match[1]) {
      const parts = match[1].split(';').map((p: string) => p.trim());
      const parsedMembers: any[] = [];
      parts.forEach((p: string) => {
        // e.g. "Member #1: Mr. John Doe (Male, DOB: 1990-01-01) - ID: Passport: P12345"
        const nameMatch = p.match(/Member\s*#\d+:\s*(Mr\.|Mrs\.|Ms\.|Dr\.)?\s*(.*?)\s*\(/i);
        const genderDobMatch = p.match(/\((.*?),?\s*DOB:\s*(.*?)\)/i);
        const idMatch = p.match(/-\s*ID:\s*(.*?):\s*(.*)/i);
        
        if (nameMatch) {
          parsedMembers.push({
            fullName: `${nameMatch[1] || ''} ${nameMatch[2] || ''}`.trim(),
            gender: genderDobMatch ? genderDobMatch[1] : '-',
            dob: genderDobMatch && genderDobMatch[2] !== 'N/A' ? genderDobMatch[2] : '-',
            relationship: '-',
            idProofType: idMatch ? idMatch[1] : '-',
            idProofNumber: idMatch && idMatch[2] !== 'N/A' ? idMatch[2] : '-'
          });
        }
      });
      return parsedMembers;
    }
    
    return [];
  }

  detailRoomMeta(room: any): string {
    return [
      room.roomTypeName,
      room.ratePlanName || detailsSafe(room, 'ratePlan.name'),
      room.bookingStatus
    ].filter(Boolean).join(' • ') || '-';
  }

  detailMoney(value: any): string {
    return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
  }

  stayInfo(res: Reservation): string {
    return `${res.nights ?? 0} NIGHTS • ${res.adults ?? 0}A, ${res.children ?? 0}C`;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }

  private normalizeRoomStatus(status: string): Room['status'] {
    const normalized = (status || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (normalized === 'CHECKEDIN' || normalized === 'OCCUPIED') return 'occupied';
    if (normalized === 'CHECKEDOUT' || normalized === 'VACANT' || normalized === 'AVAILABLE') return 'available';
    if (normalized === 'DIRTY' || normalized === 'CLEANING') return 'dirty';
    if (normalized === 'MAINTENANCE' || normalized === 'SERVICE') return 'maintenance';
    if (normalized === 'CONFIRMED' || normalized === 'PENDING' || normalized === 'RESERVED' || normalized === 'BOOKED') return 'booked';
    return 'available';
  }
}

function detailsSafe(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
