import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FrontOfficeApiService, GanttChartItem } from '../../front-office-api.service';
import { HotelMastersService, Floor, Room } from '../../masters/hotel-masters.service';

interface GanttRow extends GanttChartItem {
  barLeftPx: number;
  barWidthPx: number;
  nights: number;
}

interface RoomLane {
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  roomStatus: string;
  bookings: GanttRow[];
}

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gantt-chart.component.html',
  styleUrls: ['./gantt-chart.component.css']
})
export class GanttChartComponent implements OnInit, AfterViewInit {
  readonly dayColWidthPx = 110;
  startDate = '';
  endDate = '';
  selectedFloorId: number | null = null;
  isLoading = false;
  errorMessage = '';
  bookings: GanttRow[] = [];
  roomLanes: RoomLane[] = [];
  dateColumns: Date[] = [];
  showTodayFocus = false;
  todayLinePct: number | null = null;
  hoveredRoomId: number | null = null;
  pinnedRoomId: number | null = null;
  private syncingScroll = false;

  @ViewChild('timelineHeaderEl') timelineHeaderEl?: ElementRef<HTMLDivElement>;
  @ViewChild('timelineBodyEl') timelineBodyEl?: ElementRef<HTMLDivElement>;

  constructor(
    private readonly api: FrontOfficeApiService,
    private readonly masters: HotelMastersService
  ) {}

  ngOnInit() {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
    this.startDate = this.toInputDate(today);
    this.endDate = this.toInputDate(end);
    this.ensureFloorSelected();
    this.loadGanttData();
    setTimeout(() => {
      this.ensureFloorSelected();
      this.rebuildLanes();
    }, 1200);
  }

  ngAfterViewInit() {
    this.syncTimelineScrollFromBody();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const insideRow = !!target.closest('.row-meta');
    if (!insideRow) {
      this.pinnedRoomId = null;
    }
  }

  get totalBookings(): number {
    return this.bookings.length;
  }

  get occupiedRooms(): number {
    return this.roomLanes.filter(l => l.bookings.length > 0).length;
  }

  get checkedInBookings(): number {
    return this.bookings.filter(r => this.normalizeStatus(r.status) === 'CHECKEDIN').length;
  }

  get timelineWidthPx(): number {
    return Math.max(this.dateColumns.length * this.dayColWidthPx, this.dayColWidthPx);
  }

  get floors(): Floor[] {
    return this.masters.floors().filter(f => f.isActive);
  }

  loadGanttData() {
    if (!this.startDate || !this.endDate || this.startDate > this.endDate) {
      this.errorMessage = 'Please select a valid date range.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.api.getGanttChartData(this.startDate, this.endDate).subscribe({
      next: response => {
        this.dateColumns = this.buildDateColumns(this.startDate, this.endDate);
        this.bookings = (response.data || []).map(item => this.toGanttRow(item));
        this.rebuildLanes();
        this.updateTodayFocusPosition();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load Gantt chart data.';
        this.bookings = [];
        this.dateColumns = this.buildDateColumns(this.startDate, this.endDate);
        this.rebuildLanes();
        this.updateTodayFocusPosition();
        this.isLoading = false;
      }
    });
  }

  onFloorChange() {
    this.rebuildLanes();
  }

  toggleTodayFocus() {
    this.showTodayFocus = !this.showTodayFocus;
    this.updateTodayFocusPosition();
  }

  onHeaderScroll() {
    if (this.syncingScroll) return;
    this.syncingScroll = true;
    const left = this.timelineHeaderEl?.nativeElement.scrollLeft ?? 0;
    if (this.timelineBodyEl) {
      this.timelineBodyEl.nativeElement.scrollLeft = left;
    }
    this.syncingScroll = false;
  }

  onBodyScroll() {
    this.syncTimelineScrollFromBody();
  }

  labelForDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  dayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  normalizeStatus(status: string): string {
    return (status || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  }

  statusClass(status: string): string {
    const normalized = this.normalizeStatus(status);
    if (normalized === 'CHECKEDIN') return 'checked-in';
    if (normalized === 'CHECKEDOUT') return 'checked-out';
    if (normalized === 'CONFIRMED') return 'confirmed';
    return 'pending';
  }

  onRoomHover(roomId: number | null) {
    this.hoveredRoomId = roomId;
  }

  togglePinnedRoom(roomId: number) {
    this.pinnedRoomId = this.pinnedRoomId === roomId ? null : roomId;
  }

  isGuestListVisible(roomId: number): boolean {
    return this.pinnedRoomId === roomId || this.hoveredRoomId === roomId;
  }

  formatRange(start: string, end: string): string {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    const sd = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ed = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${sd} - ${ed}`;
  }

  private toInputDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildDateColumns(start: string, end: string): Date[] {
    const out: Date[] = [];
    const cursor = new Date(`${start}T00:00:00`);
    const finish = new Date(`${end}T00:00:00`);
    while (cursor <= finish) {
      out.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  private toGanttRow(item: GanttChartItem): GanttRow {
    const start = new Date(`${this.startDate}T00:00:00`).getTime();
    const end = new Date(`${this.endDate}T00:00:00`).getTime();
    const checkIn = new Date(`${item.checkInDate}T00:00:00`).getTime();
    const checkOut = new Date(`${item.checkOutDate}T00:00:00`).getTime();

    const dayMs = 24 * 60 * 60 * 1000;
    const rangeDays = Math.max(1, Math.round((end - start) / dayMs) + 1);
    const clampedStart = Math.max(start, checkIn);
    const clampedEnd = Math.min(end + dayMs, checkOut);
    const startOffsetDays = Math.max(0, Math.round((clampedStart - start) / dayMs));
    const spanDays = Math.max(1, Math.round((clampedEnd - clampedStart) / dayMs));

    return {
      ...item,
      barLeftPx: startOffsetDays * this.dayColWidthPx,
      barWidthPx: Math.max(spanDays * this.dayColWidthPx, 28),
      nights: Math.max(1, Math.round((checkOut - checkIn) / dayMs))
    };
  }

  private ensureFloorSelected() {
    if (this.selectedFloorId) return;
    const first = this.floors[0];
    if (first) this.selectedFloorId = first.id;
  }

  private rebuildLanes() {
    this.ensureFloorSelected();
    const rooms = this.masters.rooms()
      .filter(r => r.isActive)
      .filter(r => !this.selectedFloorId || r.floorId === this.selectedFloorId)
      .sort((a, b) => this.roomSort(a, b));

    const roomTypes = this.masters.roomTypesMap();
    this.roomLanes = rooms.map(room => ({
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomTypeName: roomTypes.get(room.typeId)?.name || 'Room',
      roomStatus: room.status,
      bookings: this.bookings.filter(b => b.roomId === room.id)
    }));
  }

  private updateTodayFocusPosition() {
    if (!this.showTodayFocus || !this.startDate || !this.endDate) {
      this.todayLinePct = null;
      return;
    }

    const today = new Date();
    const start = new Date(`${this.startDate}T00:00:00`);
    const end = new Date(`${this.endDate}T00:00:00`);
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (todayOnly < start || todayOnly > end) {
      this.todayLinePct = null;
      return;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
    const offsetDays = Math.round((todayOnly.getTime() - start.getTime()) / dayMs);
    this.todayLinePct = ((offsetDays + 0.5) / totalDays) * 100;
  }

  private roomSort(a: Room, b: Room): number {
    const aNum = Number(a.roomNumber);
    const bNum = Number(b.roomNumber);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.roomNumber.localeCompare(b.roomNumber);
  }

  private syncTimelineScrollFromBody() {
    if (this.syncingScroll) return;
    this.syncingScroll = true;
    const left = this.timelineBodyEl?.nativeElement.scrollLeft ?? 0;
    if (this.timelineHeaderEl) {
      this.timelineHeaderEl.nativeElement.scrollLeft = left;
    }
    this.syncingScroll = false;
  }
}
