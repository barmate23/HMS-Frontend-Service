import { Component, signal, computed, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

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
export class ReservationCenter implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';

  viewMode = signal<'LIST' | 'STAY' | 'MAP'>('LIST');
  selectedFloor = signal('Floor 1');
  searchText = signal('');
  statusFilter = signal<'ALL' | 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'>('ALL');
  isLoadingReservations = signal(false);
  reservationError = signal<string | null>(null);
  reservationMessage = signal<string | null>(null);
  totalReservationRecords = signal(0);
  selectedReservationDetails = signal<any | null>(null);
  isReservationDetailsOpen = signal(false);
  isLoadingReservationDetails = signal(false);

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
    this.loadReservations();
    this.loadRoomWiseStatus();
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
    this.loadReservations();
  }
  
  updateEnd(val: string) {
    this.rangeEnd.set(val ? this.parseDateInput(val) : null);
    this.loadReservations();
  }

  clearDates() { 
    this.rangeStart.set(null); 
    this.rangeEnd.set(null); 
    this.selectingMode.set('START');
    this.loadReservations();
  }
  
  applyDates() { 
    this.showCalendar.set(false); 
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

  loadReservations() {
    this.isLoadingReservations.set(true);
    this.reservationError.set(null);
    this.reservationMessage.set(null);

    let params = new HttpParams()
      .set('page', '0')
      .set('size', '10');

    const search = this.searchText().trim();
    if (search) params = params.set('searchText', search);
    if (this.statusFilter() !== 'ALL') params = params.set('status', this.statusFilter());
    if (this.rangeStart()) params = params.set('fromDate', this.toApiDate(this.rangeStart()!));
    if (this.rangeEnd()) params = params.set('toDate', this.toApiDate(this.rangeEnd()!));

    this.http.get<StandardResponse<any[]>>(`${this.frontOfficeBaseUrl}/frontOffice/getAllReservations`, { params }).subscribe({
      next: (response) => {
        this.reservations.set((response.data ?? []).map(item => this.mapReservation(item)));
        this.totalReservationRecords.set(response.metadata?.totalRecords ?? response.data?.length ?? 0);
        this.isLoadingReservations.set(false);
      },
      error: (err) => {
        console.error('[ReservationCenter] loadReservations error:', err);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to load reservations.');
        this.isLoadingReservations.set(false);
      }
    });
  }

  onSearchChange(value: string) {
    this.searchText.set(value);
    this.loadReservations();
  }

  onStatusChange(value: string) {
    this.statusFilter.set(value as any);
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
    const guest = item.guest || item.guestDetails || {};
    const room = Array.isArray(item.rooms) ? item.rooms[0] : (item.room || {});
    const roomIds = Array.isArray(item.roomIds) ? item.roomIds : [];
    const ratePlan = item.ratePlan || {};
    const firstName = guest.firstName || item.firstName || '';
    const lastName = guest.lastName || item.lastName || '';
    const guestName = item.guestFullName || item.guestName || `${firstName} ${lastName}`.trim() || item.billingName || 'Guest';
    const checkIn = item.checkInDate || item.arrivalDate || item.checkIn || '';
    const checkOut = item.checkOutDate || item.departureDate || item.checkOut || '';

    return {
      id: String(item.id ?? item.bookingId ?? item.reservationId ?? ''),
      guestName,
      guestEmail: guest.email || item.guestEmail || item.email || '',
      guestPhone: guest.phone || item.guestPhone || item.phone || '',
      roomNumber: room.roomNumber || item.roomNumber || (roomIds.length ? String(roomIds[0]) : '-'),
      roomType: room.roomTypeName || item.roomTypeName || item.roomType || '-',
      plan: room.ratePlanName || ratePlan.shortLabel || ratePlan.name || item.ratePlanName || String(item.ratePlanId ?? '-'),
      checkIn: this.formatDateLabel(checkIn),
      checkOut: this.formatDateLabel(checkOut),
      status: this.normalizeStatus(item.reservationStatus || item.status),
      billingAmount: Number(item.billingAmount ?? item.totalAmount ?? item.grandTotal ?? 0),
      paidAmount: Number(item.paidAmount ?? item.amountPaid ?? 0),
      nights: Number(item.numberOfNights ?? item.nights ?? 0),
      adults: Number(item.numberOfAdults ?? item.adults ?? 0),
      children: Number(item.numberOfChildren ?? item.children ?? 0),
      vip: Boolean(guest.isVip || item.isVip),
      new: this.normalizeStatus(item.reservationStatus || item.status) === 'PENDING'
    };
  }

  private normalizeStatus(status: string): Reservation['status'] {
    if (status === 'CHECKEDIN') return 'CHECKED_IN';
    if (status === 'CHECKED_OUT') return 'CHECKED_OUT';
    if (status === 'CANCELLED') return 'CANCELLED';
    if (status === 'NO_SHOW') return 'NO_SHOW';
    if (status === 'PENDING') return 'PENDING';
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
    if (mode === 'MAP' && this.rooms().length === 0 && !this.mapIsLoading()) {
      this.loadRoomWiseStatus();
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

  detailStatus(details: any): string {
    return details?.reservationStatus || details?.status || '-';
  }

  detailPrimaryRoom(details: any): string {
    const room = this.detailRooms(details)[0];
    return room?.roomNumber ? `Room ${room.roomNumber}` : 'No room assigned';
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
