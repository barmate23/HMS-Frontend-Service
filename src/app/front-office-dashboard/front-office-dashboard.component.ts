import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import {
  FrontOfficeApiService,
  FrontOfficeDashboardData,
  FrontOfficeFloorBoard,
  FrontOfficeRoomCard
} from '../front-office-api.service';

export interface CategoryMetric {
  name: string;
  total: number;
  available: number;
  occupied: number;
  booked: number;
  blocked: number;
  maintenance: number;
  occupancyPct: number;
  theme: string;
  icon: string;
}

export interface CategoryRoomGroup {
  categoryName: string;
  theme: string;
  icon: string;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  occupiedRooms: number;
  rooms: FrontOfficeRoomCard[];
}

@Component({
  selector: 'app-front-office-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './front-office-dashboard.component.html',
  styleUrls: ['./front-office-dashboard.component.css']
})
export class FrontOfficeDashboardComponent implements OnInit, OnDestroy {
  private readonly frontOfficeApi = inject(FrontOfficeApiService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  dashboard = signal<FrontOfficeDashboardData | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Filters & View Controls
  selectedFloorId = signal<number | null>(null); // null = All Floors
  selectedCategory = signal<string>('ALL');
  statusFilter = signal<string>('ALL'); // 'ALL' | 'AVAILABLE' | 'BOOKED' | 'OCCUPIED' | 'MAINTENANCE' | 'BLOCKED'
  viewGrouping = signal<'category' | 'floor'>('category');
  searchQuery = signal<string>('');

  selectedRoom = signal<FrontOfficeRoomCard | null>(null);
  isMapExpanded = signal(false);

  // ─── Computed Signals ─────────────────────────────────────────

  readonly floors = computed(() => this.dashboard()?.floors ?? []);

  readonly allRooms = computed<FrontOfficeRoomCard[]>(() => {
    return this.floors().flatMap(f => f.rooms ?? []);
  });

  readonly summary = computed(() => this.dashboard()?.summary ?? {
    totalRooms: 0,
    totalBookings: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    bookedRooms: 0,
    blockedRooms: 0,
    underMaintenanceRooms: 0
  });

  readonly statusCounts = computed(() => {
    const rooms = this.selectedFloorId() !== null
      ? (this.activeFloor()?.rooms ?? [])
      : this.allRooms();

    const total = rooms.length;
    const available = rooms.filter(r => r.displayStatus === 'AVAILABLE').length;
    const booked = rooms.filter(r => r.displayStatus === 'BOOKED').length;
    const occupied = rooms.filter(r => r.displayStatus === 'OCCUPIED').length;
    const blocked = rooms.filter(r => r.displayStatus === 'BLOCKED').length;
    const maintenance = rooms.filter(r => r.displayStatus === 'MAINTENANCE').length;
    const occupiedOrBooked = booked + occupied;
    const occupancyPct = total > 0 ? Math.round((occupiedOrBooked / total) * 100) : 0;

    return { total, available, booked, occupied, blocked, maintenance, occupancyPct };
  });

  readonly categories = computed<CategoryMetric[]>(() => {
    const rooms = this.allRooms();
    const map = new Map<string, FrontOfficeRoomCard[]>();

    for (const r of rooms) {
      const type = r.roomType || 'Standard';
      if (!map.has(type)) {
        map.set(type, []);
      }
      map.get(type)!.push(r);
    }

    return Array.from(map.entries()).map(([name, catRooms]) => {
      const total = catRooms.length;
      const available = catRooms.filter(r => r.displayStatus === 'AVAILABLE').length;
      const booked = catRooms.filter(r => r.displayStatus === 'BOOKED').length;
      const occupied = catRooms.filter(r => r.displayStatus === 'OCCUPIED').length;
      const blocked = catRooms.filter(r => r.displayStatus === 'BLOCKED').length;
      const maintenance = catRooms.filter(r => r.displayStatus === 'MAINTENANCE').length;
      const busy = booked + occupied;
      const occupancyPct = total > 0 ? Math.round((busy / total) * 100) : 0;
      const themeInfo = this.getCategoryThemeInfo(name);

      return {
        name,
        total,
        available,
        booked,
        occupied,
        blocked,
        maintenance,
        occupancyPct,
        theme: themeInfo.theme,
        icon: themeInfo.icon
      };
    }).sort((a, b) => b.total - a.total);
  });

  readonly availableCategoryNames = computed<string[]>(() => {
    return this.categories().map(c => c.name);
  });

  readonly activeFloor = computed<FrontOfficeFloorBoard | null>(() => {
    const floors = this.floors();
    if (!floors.length) return null;
    const selected = this.selectedFloorId();
    if (selected === null) return null;
    return floors.find(floor => floor.floorId === selected) ?? null;
  });

  // Base rooms respecting Floor selection
  readonly floorRooms = computed<FrontOfficeRoomCard[]>(() => {
    if (this.selectedFloorId() === null) {
      return this.allRooms();
    }
    return this.activeFloor()?.rooms ?? [];
  });

  // Filtered rooms after applying Floor, Category, Status, and Search
  readonly filteredRooms = computed<FrontOfficeRoomCard[]>(() => {
    let list = this.floorRooms();

    // Category filter
    const cat = this.selectedCategory();
    if (cat !== 'ALL') {
      list = list.filter(r => (r.roomType || '').toLowerCase() === cat.toLowerCase());
    }

    // Status filter
    const status = this.statusFilter();
    if (status !== 'ALL') {
      list = list.filter(r => (r.displayStatus || '').toUpperCase() === status.toUpperCase());
    }

    // Search query
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.roomNumber.toLowerCase().includes(q) ||
        (r.roomType || '').toLowerCase().includes(q) ||
        (r.floorName || '').toLowerCase().includes(q) ||
        (r.booking?.guestName || '').toLowerCase().includes(q) ||
        (r.booking?.reservationRef || '').toLowerCase().includes(q) ||
        (r.booking?.guestPhone || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => this.roomNumberSort(a.roomNumber, b.roomNumber));
  });

  // Grouped by Category for display
  readonly categoryGroups = computed<CategoryRoomGroup[]>(() => {
    const rooms = this.filteredRooms();
    const map = new Map<string, FrontOfficeRoomCard[]>();

    for (const r of rooms) {
      const type = r.roomType || 'Standard';
      if (!map.has(type)) {
        map.set(type, []);
      }
      map.get(type)!.push(r);
    }

    return Array.from(map.entries()).map(([name, groupRooms]) => {
      const themeInfo = this.getCategoryThemeInfo(name);
      return {
        categoryName: name,
        theme: themeInfo.theme,
        icon: themeInfo.icon,
        totalRooms: groupRooms.length,
        availableRooms: groupRooms.filter(r => r.displayStatus === 'AVAILABLE').length,
        bookedRooms: groupRooms.filter(r => r.displayStatus === 'BOOKED').length,
        occupiedRooms: groupRooms.filter(r => r.displayStatus === 'OCCUPIED').length,
        rooms: groupRooms
      };
    });
  });

  constructor() {}

  ngOnInit(): void {
    this.loadDashboard();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.includes('/front-office/dashboard'))
    ).subscribe(() => {
      this.loadDashboard(true);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  loadDashboard(background = false): void {
    if (!background) {
      this.isLoading.set(true);
    }
    this.error.set(null);
    this.frontOfficeApi.getFrontOfficeDashboard().subscribe({
      next: response => {
        if (response?.success && response.data) {
          this.dashboard.set(response.data);
        } else {
          this.dashboard.set(null);
          this.error.set('No dashboard data available.');
        }
        this.isLoading.set(false);
      },
      error: err => {
        console.warn('[FrontOfficeDashboard] API unavailable:', err);
        this.dashboard.set(null);
        this.error.set('Unable to load dashboard. Please check your connection.');
        this.isLoading.set(false);
      }
    });
  }

  selectFloor(floorId: number | null | undefined): void {
    this.selectedFloorId.set(floorId ?? null);
  }

  selectCategory(categoryName: string): void {
    this.selectedCategory.set(categoryName);
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  setViewGrouping(mode: 'category' | 'floor'): void {
    this.viewGrouping.set(mode);
  }

  viewRoom(room: FrontOfficeRoomCard): void {
    this.selectedRoom.set(room);
  }

  closeRoomDetails(): void {
    this.selectedRoom.set(null);
  }

  openExpandedMap(): void {
    this.isMapExpanded.set(true);
  }

  closeExpandedMap(): void {
    this.isMapExpanded.set(false);
  }

  // ─── Folio Navigation ─────────────────────────────────────────

  openFolio(room: FrontOfficeRoomCard, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const booking = room.booking;
    const targetRef = booking?.reservationRef || room.roomNumber;

    this.router.navigate(['/billing/folios'], {
      queryParams: {
        search: targetRef,
        room: room.roomNumber,
        bookingId: booking?.bookingId
      }
    });
  }

  // ─── Presentation Helpers ─────────────────────────────────────

  statusClass(status: string | undefined): string {
    return (status || 'AVAILABLE').toLowerCase().replace(/_/g, '-');
  }

  formatMoney(value: number | undefined | null): string {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  formatDateShort(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  guestCount(room: FrontOfficeRoomCard): string {
    const booking = room.booking;
    if (!booking) return `${room.maxOccupancy || 2} Pax Max`;
    return `${booking.adults || 1} Adult${(booking.adults || 1) > 1 ? 's' : ''}${booking.children ? ', ' + booking.children + ' Child' : ''}`;
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

  private roomNumberSort(a: string, b: string): number {
    const aNum = Number(a);
    const bNum = Number(b);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  }
}
