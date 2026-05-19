import { Component, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  status: 'CHECKEDIN' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  billingAmount: number;
  paidAmount: number;
  vip?: boolean;
  repeat?: boolean;
  new?: boolean;
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
export class ReservationCenter {
  viewMode = signal<'LIST' | 'STAY' | 'MAP'>('LIST');
  selectedFloor = signal('Floor 1');

  // Date Range Picker State
  showCalendar = signal(false);
  showYearPicker = signal(false);
  calendarMonth = signal(new Date(2026, 2, 1)); // March 2026
  rangeStart = signal<Date | null>(new Date(2026, 2, 20));
  rangeEnd = signal<Date | null>(new Date(2026, 3, 3));
  selectingMode = signal<'START' | 'END'>('START');
  hoverDate = signal<Date | null>(null);

  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  }


  floors = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'];

  reservations = signal<Reservation[]>([
    { id: '1', guestName: 'John Doe', guestEmail: 'john@example.com', guestPhone: '+1 555-0101', roomNumber: '102', roomType: 'DOUBLE', plan: 'CP', checkIn: 'Mar 24', checkOut: 'Mar 27', status: 'CHECKEDIN', billingAmount: 495, paidAmount: 100, repeat: true },
    { id: '2', guestName: 'Jane Smith', guestEmail: 'jane@example.com', guestPhone: '+1 555-0102', roomNumber: '203', roomType: 'SUITE', plan: 'MAP', checkIn: 'Mar 25', checkOut: 'Mar 28', status: 'CHECKEDIN', billingAmount: 990, paidAmount: 200, vip: true },
    { id: '3', guestName: 'Alice Johnson', guestEmail: 'alice@example.com', guestPhone: '+1 555-0103', roomNumber: '104', roomType: 'DELUXE', plan: 'EP', checkIn: 'Mar 26', checkOut: 'Mar 29', status: 'CONFIRMED', billingAmount: 660, paidAmount: 0, new: true }
  ]);

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

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }
}
