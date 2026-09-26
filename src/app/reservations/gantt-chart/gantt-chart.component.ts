import { AfterViewInit, Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { FrontOfficeApiService, GanttChartItem, GanttChartData, GanttSummary } from '../../front-office-api.service';
import { HotelMastersService, Floor, Room } from '../../masters/hotel-masters.service';

export interface GanttRow extends GanttChartItem {
  barLeftPx: number;
  barWidthPx: number;
  nights: number;
}

export interface RoomLane {
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  roomStatus: string;
  bookings: GanttRow[];
}

export interface RoomCategoryGroup {
  categoryName: string;
  categoryIcon: string;
  categoryTheme: string;
  roomCount: number;
  lanes: RoomLane[];
  collapsed: boolean;
  rangeOccupancyPct: number;
}

@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gantt-chart.component.html',
  styleUrls: ['./gantt-chart.component.css']
})
export class GanttChartComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly dayColWidthPx = 115;
  startDate = '';
  endDate = '';
  selectedFloorId: number | null = null;
  selectedCategory = 'ALL';
  searchFilter = '';

  isLoading = false;
  errorMessage = '';
  bookings: GanttRow[] = [];
  roomLanes: RoomLane[] = [];
  categoryGroups: RoomCategoryGroup[] = [];
  dateColumns: Date[] = [];
  showTodayFocus = false;
  todayLinePct: number | null = null;
  hoveredRoomId: number | null = null;
  pinnedRoomId: number | null = null;

  // Active tooltip booking
  activeTooltipBooking: GanttRow | null = null;
  tooltipPos = { x: 0, y: 0 };

  // Summary stats from API
  summaryTotalBookings = 0;
  summaryOccupiedRooms = 0;
  summaryCheckedIn = 0;

  // Precomputed Occupancy Caches
  dailyOccupancyMap = new Map<string, { occupied: number; total: number; pct: number }>();
  categoryDailyOccupancyMap = new Map<string, Map<string, { occupied: number; total: number; pct: number }>>();

  private syncingScroll = false;
  private syncingVerticalScroll = false;

  @ViewChild('timelineHeaderEl') timelineHeaderEl?: ElementRef<HTMLDivElement>;
  @ViewChild('timelineBodyEl') timelineBodyEl?: ElementRef<HTMLDivElement>;
  @ViewChild('leftBodyEl') leftBodyEl?: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private routerSub?: Subscription;

  constructor(
    private readonly api: FrontOfficeApiService,
    private readonly masters: HotelMastersService
  ) {
    // Automatically rebuild lanes whenever master data completes loading
    effect(() => {
      const rooms = this.masters.rooms();
      const types = this.masters.roomTypes();
      if (rooms.length > 0) {
        this.rebuildLanes();
      }
    });
  }

  ngOnInit() {
    this.masters.loadAll();
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
    this.startDate = this.toInputDate(today);
    this.endDate = this.toInputDate(end);
    this.loadGanttData();
    setTimeout(() => {
      this.rebuildLanes();
    }, 600);

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.includes('/gantt-chart'))
    ).subscribe(() => {
      this.loadGanttData();
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
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
    return this.summaryTotalBookings;
  }

  get occupiedRooms(): number {
    return this.summaryOccupiedRooms;
  }

  get checkedInBookings(): number {
    return this.summaryCheckedIn;
  }

  get avgRangeOccupancy(): number {
    if (this.dateColumns.length === 0) return 0;
    let sum = 0;
    for (const d of this.dateColumns) {
      sum += this.getDailyOccupancy(d).pct;
    }
    return Math.round(sum / this.dateColumns.length);
  }

  get totalActiveRoomsCount(): number {
    return this.roomLanes.length;
  }

  get timelineWidthPx(): number {
    return Math.max(this.dateColumns.length * this.dayColWidthPx, this.dayColWidthPx);
  }

  get floors(): Floor[] {
    return this.masters.floors().filter(f => f.isActive);
  }

  get availableCategoryNames(): string[] {
    const set = new Set<string>();
    for (const r of this.masters.rooms()) {
      const type = this.masters.roomTypesMap().get(r.typeId || r.roomTypeId)?.name;
      if (type) set.add(type);
    }
    for (const b of this.bookings) {
      if (b.roomTypeName) set.add(b.roomTypeName);
    }
    return Array.from(set).sort();
  }

  getFloorLabel(f: any): string {
    if (!f) return '';
    const raw = (f.floorNumber || '').trim();
    if (!raw) return `Floor ${f.id || ''}`.trim();
    if (/^floor\b/i.test(raw)) {
      return raw;
    }
    if (/^\d+$/.test(raw)) {
      return `Floor ${raw}`;
    }
    return raw;
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
        const ganttData = response.data as GanttChartData;
        const bookingsArr: GanttChartItem[] = ganttData?.bookings || (response.data as any) || [];
        const summary: GanttSummary | undefined = ganttData?.summary;

        this.dateColumns = this.buildDateColumns(this.startDate, this.endDate);
        this.bookings = bookingsArr.map(item => this.toGanttRow(item));
        this.rebuildLanes();
        this.updateTodayFocusPosition();

        // Patch summary stats from API
        if (summary) {
          this.summaryTotalBookings = summary.totalBookings ?? this.bookings.length;
          this.summaryOccupiedRooms = summary.occupiedRooms ?? this.roomLanes.filter(l => l.bookings.length > 0).length;
          this.summaryCheckedIn = summary.checkedIn ?? 0;
        } else {
          this.summaryTotalBookings = this.bookings.length;
          this.summaryOccupiedRooms = this.roomLanes.filter(l => l.bookings.length > 0).length;
          this.summaryCheckedIn = 0;
        }

        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load Gantt chart data.';
        this.bookings = [];
        this.summaryTotalBookings = 0;
        this.summaryOccupiedRooms = 0;
        this.summaryCheckedIn = 0;
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

  onCategoryChange() {
    this.rebuildLanes();
  }

  onSearchChange() {
    this.rebuildLanes();
  }

  toggleTodayFocus() {
    this.showTodayFocus = !this.showTodayFocus;
    this.updateTodayFocusPosition();
  }

  toggleCategoryCollapse(group: RoomCategoryGroup) {
    group.collapsed = !group.collapsed;
  }

  expandAllCategories() {
    this.categoryGroups.forEach(g => g.collapsed = false);
  }

  collapseAllCategories() {
    this.categoryGroups.forEach(g => g.collapsed = true);
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

  onLeftBodyScroll() {
    if (this.syncingVerticalScroll) return;
    this.syncingVerticalScroll = true;
    const top = this.leftBodyEl?.nativeElement.scrollTop ?? 0;
    if (this.timelineBodyEl) {
      this.timelineBodyEl.nativeElement.scrollTop = top;
    }
    this.syncingVerticalScroll = false;
  }

  onTimelineBodyScroll() {
    this.syncTimelineScrollFromBody();
    if (this.syncingVerticalScroll) return;
    this.syncingVerticalScroll = true;
    const top = this.timelineBodyEl?.nativeElement.scrollTop ?? 0;
    if (this.leftBodyEl) {
      this.leftBodyEl.nativeElement.scrollTop = top;
    }
    this.syncingVerticalScroll = false;
  }

  labelForDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  dayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  isDateToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
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

  // ─── Occupancy Calculations ───────────────────────────────────

  isBookingActiveOnDate(b: GanttRow | GanttChartItem, dateStr: string): boolean {
    if (b.checkInDate === b.checkOutDate) {
      return dateStr === b.checkInDate;
    }
    return dateStr >= b.checkInDate && dateStr < b.checkOutDate;
  }

  getDailyOccupancy(date: Date): { occupied: number; total: number; pct: number } {
    const dateStr = this.toInputDate(date);
    return this.dailyOccupancyMap.get(dateStr) || { occupied: 0, total: this.roomLanes.length, pct: 0 };
  }

  getCategoryOccupancy(group: RoomCategoryGroup, date: Date): { occupied: number; total: number; pct: number } {
    const dateStr = this.toInputDate(date);
    const catMap = this.categoryDailyOccupancyMap.get(group.categoryName);
    return catMap?.get(dateStr) || { occupied: 0, total: group.roomCount, pct: 0 };
  }

  getOccupancyLevelClass(pct: number): string {
    if (pct === 0) return 'occ-zero';
    if (pct < 30) return 'occ-low';
    if (pct < 65) return 'occ-mid';
    if (pct < 85) return 'occ-high';
    return 'occ-peak';
  }

  getCatOccLevel(group: RoomCategoryGroup, date: Date): string {
    const occ = this.getCategoryOccupancy(group, date);
    return this.getOccupancyLevelClass(occ.pct);
  }

  // ─── Booking Color & Presentation ─────────────────────────────

  getBookingBackground(row: GanttRow): string {
    const status = (row.status || '').toLowerCase();
    if (status.includes('checkin') || status.includes('checked in')) {
      return 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)';
    }
    if (status.includes('checkout') || status.includes('checked out')) {
      return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
    }
    if (status.includes('confirm')) {
      return 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
    }
    if (status.includes('reserve') || status.includes('pend')) {
      return 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
    }
    if (row.color) {
      return `linear-gradient(135deg, ${row.color} 0%, ${this.adjustColorBrightness(row.color, -30)} 100%)`;
    }
    return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
  }

  onBookingHover(row: GanttRow, event: MouseEvent) {
    this.activeTooltipBooking = row;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.tooltipPos = {
      x: Math.min(window.innerWidth - 290, Math.max(16, rect.left + rect.width / 2 - 130)),
      y: rect.top - 125 > 10 ? rect.top - 130 : rect.bottom + 12
    };
  }

  onBookingLeave() {
    this.activeTooltipBooking = null;
  }

  // ─── Private Helpers ──────────────────────────────────────────

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
    const clampedStart = Math.max(start, checkIn);
    const clampedEnd = Math.min(end + dayMs, checkOut);
    const startOffsetDays = Math.max(0, Math.round((clampedStart - start) / dayMs));
    const spanDays = Math.max(1, Math.round((clampedEnd - clampedStart) / dayMs));

    return {
      ...item,
      barLeftPx: startOffsetDays * this.dayColWidthPx,
      barWidthPx: Math.max(spanDays * this.dayColWidthPx - 6, 32),
      nights: Math.max(1, Math.round((checkOut - checkIn) / dayMs))
    };
  }

  rebuildLanes() {
    const rawRooms = this.masters.rooms()
      .filter(r => r.isActive)
      .filter(r => !this.selectedFloorId || Number(r.floorId) === Number(this.selectedFloorId));

    const roomTypes = this.masters.roomTypesMap();
    const roomMap = new Map<number, RoomLane>();

    for (const room of rawRooms) {
      const typeName = roomTypes.get(room.typeId || room.roomTypeId)?.name ||
                       this.bookings.find(b => b.roomId === room.id)?.roomTypeName ||
                       'Standard';
      roomMap.set(room.id, {
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomTypeName: typeName,
        roomStatus: room.status || 'AVAILABLE',
        bookings: this.bookings.filter(b => b.roomId === room.id)
      });
    }

    // Incorporate any rooms present in bookings that are not in room master
    for (const b of this.bookings) {
      if (b.roomId && !roomMap.has(b.roomId)) {
        roomMap.set(b.roomId, {
          roomId: b.roomId,
          roomNumber: b.roomNumber,
          roomTypeName: b.roomTypeName || 'Deluxe',
          roomStatus: 'OCCUPIED',
          bookings: this.bookings.filter(x => x.roomId === b.roomId)
        });
      }
    }

    let lanes = Array.from(roomMap.values());

    // Apply search filter
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.trim().toLowerCase();
      lanes = lanes.filter(l =>
        l.roomNumber.toLowerCase().includes(q) ||
        l.roomTypeName.toLowerCase().includes(q) ||
        l.bookings.some(b => b.guestName.toLowerCase().includes(q) || (b.confirmationNumber || '').toLowerCase().includes(q))
      );
    }

    // Apply category filter
    if (this.selectedCategory && this.selectedCategory !== 'ALL') {
      lanes = lanes.filter(l => l.roomTypeName.toLowerCase() === this.selectedCategory.toLowerCase());
    }

    lanes.sort((a, b) => this.laneSort(a, b));
    this.roomLanes = lanes;

    // Group lanes by category
    const groupMap = new Map<string, RoomLane[]>();
    for (const lane of lanes) {
      const cat = lane.roomTypeName || 'Standard';
      if (!groupMap.has(cat)) {
        groupMap.set(cat, []);
      }
      groupMap.get(cat)!.push(lane);
    }

    const prevCollapsed = new Map(this.categoryGroups.map(g => [g.categoryName, g.collapsed]));

    this.categoryGroups = Array.from(groupMap.entries()).map(([catName, catLanes]) => {
      const themeInfo = this.getCategoryThemeInfo(catName);
      const totalNightsPossible = catLanes.length * Math.max(1, this.dateColumns.length);
      const occupiedNights = catLanes.reduce((sum, lane) => {
        return sum + lane.bookings.reduce((bSum, b) => bSum + Math.min(b.nights, this.dateColumns.length), 0);
      }, 0);
      const rangeOccupancyPct = totalNightsPossible > 0 ? Math.min(100, Math.round((occupiedNights / totalNightsPossible) * 100)) : 0;

      return {
        categoryName: catName,
        categoryIcon: themeInfo.icon,
        categoryTheme: themeInfo.theme,
        roomCount: catLanes.length,
        lanes: catLanes,
        collapsed: prevCollapsed.get(catName) ?? false,
        rangeOccupancyPct
      };
    });

    // Compute occupancies across all dates
    this.computeDailyOccupancies();
  }

  private computeDailyOccupancies() {
    this.dailyOccupancyMap.clear();
    this.categoryDailyOccupancyMap.clear();

    const totalRooms = this.roomLanes.length;

    for (const d of this.dateColumns) {
      const dateStr = this.toInputDate(d);
      const occupiedRoomIds = new Set<number>();

      for (const b of this.bookings) {
        if (this.isBookingActiveOnDate(b, dateStr)) {
          if (this.roomLanes.some(l => l.roomId === b.roomId)) {
            occupiedRoomIds.add(b.roomId);
          }
        }
      }

      const occupied = occupiedRoomIds.size;
      const pct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
      this.dailyOccupancyMap.set(dateStr, { occupied, total: totalRooms, pct });

      // Compute per category
      for (const group of this.categoryGroups) {
        if (!this.categoryDailyOccupancyMap.has(group.categoryName)) {
          this.categoryDailyOccupancyMap.set(group.categoryName, new Map());
        }
        const catOccupied = group.lanes.filter(l =>
          l.bookings.some(b => this.isBookingActiveOnDate(b, dateStr))
        ).length;
        const catTotal = group.roomCount;
        const catPct = catTotal > 0 ? Math.round((catOccupied / catTotal) * 100) : 0;
        this.categoryDailyOccupancyMap.get(group.categoryName)!.set(dateStr, {
          occupied: catOccupied,
          total: catTotal,
          pct: catPct
        });
      }
    }
  }

  private getCategoryThemeInfo(category: string): { icon: string; theme: string } {
    const c = (category || '').toLowerCase();
    if (c.includes('deluxe')) return { icon: 'hotel', theme: 'deluxe' };
    if (c.includes('lux')) return { icon: 'stars', theme: 'luxury' };
    if (c.includes('suite') || c.includes('exec')) return { icon: 'king_bed', theme: 'suite' };
    if (c.includes('standard') || c.includes('classic')) return { icon: 'single_bed', theme: 'standard' };
    if (c.includes('villa') || c.includes('cottage')) return { icon: 'villa', theme: 'villa' };
    return { icon: 'meeting_room', theme: 'default' };
  }

  private laneSort(a: RoomLane, b: RoomLane): number {
    const aNum = Number(a.roomNumber);
    const bNum = Number(b.roomNumber);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.roomNumber.localeCompare(b.roomNumber);
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

  private adjustColorBrightness(hex: string, percent: number): string {
    let cleanHex = hex.replace(/^#/, '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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
