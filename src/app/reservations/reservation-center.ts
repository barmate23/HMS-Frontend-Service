import { Component, signal, computed, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
  number: string;
  type: string;
  floor: string;
  status: 'available' | 'occupied' | 'dirty' | 'booked' | 'maintenance';
  guest?: string;
  checkOutDate?: string;
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
  private readonly baseUrl = '/api/v1';

  viewMode = signal<'LIST' | 'STAY' | 'MAP'>('LIST');
  selectedFloor = signal('Floor 1');
  searchText = signal('');
  statusFilter = signal<'ALL' | 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'>('ALL');
  isLoadingReservations = signal(false);
  reservationError = signal<string | null>(null);
  reservationMessage = signal<string | null>(null);
  totalReservationRecords = signal(0);

  // Date Range Picker State
  showCalendar = signal(false);
  showYearPicker = signal(false);
  calendarMonth = signal(new Date(2026, 2, 1)); // March 2026
  rangeStart = signal<Date | null>(new Date(2026, 2, 20));
  rangeEnd = signal<Date | null>(new Date(2026, 3, 3));
  selectingMode = signal<'START' | 'END'>('START');
  hoverDate = signal<Date | null>(null);

  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  ngOnInit() {
    this.loadReservations();
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
    
    if (this.selectingMode() === 'START') {
      this.rangeStart.set(date);
      // Auto-switch to END mode for convenience
      this.selectingMode.set('END');
      
      // If start is now after end, clear end
      const end = this.rangeEnd();
      if (end && date > end) this.rangeEnd.set(null);
    } else {
      const start = this.rangeStart();
      if (start && date < start) {
        // If user picks an end date before start, treat it as new start
        this.rangeStart.set(date);
      } else {
        this.rangeEnd.set(date);
      }
      // Stay in END mode or we could switch back if desired
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
    if (val) this.rangeStart.set(new Date(val));
  }
  
  updateEnd(val: string) {
    if (val) this.rangeEnd.set(new Date(val));
  }

  clearDates() { 
    this.rangeStart.set(null); 
    this.rangeEnd.set(null); 
  }
  
  applyDates() { 
    this.showCalendar.set(false); 
    this.loadReservations();
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

    this.http.get<StandardResponse<any[]>>(`${this.baseUrl}/frontOffice/getAllReservations`, { params }).subscribe({
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

    this.http.get<StandardResponse<any>>(`${this.baseUrl}/frontOffice/getReservationById/${id}`).subscribe({
      next: (response) => {
        const reservation = this.mapReservation(response.data ?? {});
        this.reservationMessage.set(`Loaded reservation ${reservation.id} for ${reservation.guestName}.`);
      },
      error: (err) => {
        console.error('[ReservationCenter] getReservationById error:', err);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to load reservation details.');
      }
    });
  }

  cancelReservation(id: string, guestName: string) {
    if (!confirm(`Cancel reservation for ${guestName}?`)) return;

    this.reservationError.set(null);
    this.reservationMessage.set(null);

    this.http.put<StandardResponse<any>>(`${this.baseUrl}/frontOffice/cancelReservation/${id}`, {}).subscribe({
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

  deleteReservation(id: string, guestName: string) {
    if (!confirm(`Delete reservation for ${guestName}? This cannot be undone.`)) return;

    this.reservationError.set(null);
    this.reservationMessage.set(null);

    this.http.delete<StandardResponse<void>>(`${this.baseUrl}/frontOffice/deleteReservation/${id}`).subscribe({
      next: (response) => {
        this.reservationMessage.set(response.message || 'Reservation deleted.');
        this.loadReservations();
      },
      error: (err) => {
        console.error('[ReservationCenter] deleteReservation error:', err);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to delete reservation.');
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

  rooms = signal<Room[]>([
    // Floor 1 (30 Rooms)
    { number: '101', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '102', type: 'DOUBLE', floor: 'Floor 1', status: 'occupied', guest: 'John Doe' },
    { number: '103', type: 'SUITE', floor: 'Floor 1', status: 'maintenance' },
    { number: '104', type: 'DELUXE', floor: 'Floor 1', status: 'booked', guest: 'Alice Johnson' },
    { number: '105', type: 'SINGLE', floor: 'Floor 1', status: 'dirty' },
    { number: '106', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },
    { number: '107', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '108', type: 'DOUBLE', floor: 'Floor 1', status: 'occupied', guest: 'Mark Wilson' },
    { number: '109', type: 'SUITE', floor: 'Floor 1', status: 'available' },
    { number: '110', type: 'DELUXE', floor: 'Floor 1', status: 'available' },
    { number: '111', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '112', type: 'DOUBLE', floor: 'Floor 1', status: 'dirty' },
    { number: '113', type: 'SUITE', floor: 'Floor 1', status: 'available' },
    { number: '114', type: 'DELUXE', floor: 'Floor 1', status: 'available' },
    { number: '115', type: 'SINGLE', floor: 'Floor 1', status: 'maintenance' },
    { number: '116', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },
    { number: '117', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '118', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },
    { number: '119', type: 'SUITE', floor: 'Floor 1', status: 'dirty' },
    { number: '120', type: 'DELUXE', floor: 'Floor 1', status: 'available' },
    { number: '121', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '122', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },
    { number: '123', type: 'SUITE', floor: 'Floor 1', status: 'available' },
    { number: '124', type: 'DELUXE', floor: 'Floor 1', status: 'available' },
    { number: '125', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '126', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },
    { number: '127', type: 'SUITE', floor: 'Floor 1', status: 'available' },
    { number: '128', type: 'DELUXE', floor: 'Floor 1', status: 'available' },
    { number: '129', type: 'SINGLE', floor: 'Floor 1', status: 'available' },
    { number: '130', type: 'DOUBLE', floor: 'Floor 1', status: 'available' },

    // Floor 2
    { number: '201', type: 'SINGLE', floor: 'Floor 2', status: 'available' },
    { number: '202', type: 'DOUBLE', floor: 'Floor 2', status: 'occupied', guest: 'Robert Fox' },
    { number: '203', type: 'SUITE', floor: 'Floor 2', status: 'occupied', guest: 'Jane Smith' },
    
    // Floor 3
    { number: '301', type: 'DELUXE', floor: 'Floor 3', status: 'available' },
    { number: '302', type: 'SINGLE', floor: 'Floor 3', status: 'available' }
  ]);

  days = [
    { name: 'FRI', date: 20 }, { name: 'SAT', date: 21 }, { name: 'SUN', date: 22 }, { name: 'MON', date: 23 }, { name: 'TUE', date: 24 },
    { name: 'WED', date: 25 }, { name: 'THU', date: 26 }, { name: 'FRI', date: 27 }, { name: 'SAT', date: 28 }, { name: 'SUN', date: 29 }
  ];

  filteredRooms = computed(() => {
    return this.rooms().filter(r => r.floor === this.selectedFloor());
  });

  setView(mode: 'LIST' | 'STAY' | 'MAP') {
    this.viewMode.set(mode);
  }

  setFloor(floor: string) {
    this.selectedFloor.set(floor);
  }

  statusLabel(status: Reservation['status']): string {
    return status.replace('_', ' ');
  }

  statusClass(status: Reservation['status']): string {
    return status.toLowerCase().replace('_', '-');
  }

  stayInfo(res: Reservation): string {
    return `${res.nights ?? 0} NIGHTS • ${res.adults ?? 0}A, ${res.children ?? 0}C`;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }
}
