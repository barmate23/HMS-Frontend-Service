import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import {
  FrontOfficeApiService,
  FrontOfficeDashboardData,
  FrontOfficeFloorBoard,
  FrontOfficeRoomCard
} from '../front-office-api.service';

@Component({
  selector: 'app-front-office-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  selectedFloorId = signal<number | null>(null);
  selectedRoom = signal<FrontOfficeRoomCard | null>(null);
  isMapExpanded = signal(false);

  readonly floors = computed(() => this.dashboard()?.floors ?? []);
  readonly summary = computed(() => this.dashboard()?.summary ?? {
    totalRooms: 0,
    totalBookings: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    bookedRooms: 0,
    blockedRooms: 0,
    underMaintenanceRooms: 0
  });

  readonly activeFloor = computed<FrontOfficeFloorBoard | null>(() => {
    const floors = this.floors();
    if (!floors.length) return null;
    const selected = this.selectedFloorId();
    return floors.find(floor => floor.floorId === selected) ?? floors[0];
  });

  readonly roomCards = computed(() => this.activeFloor()?.rooms ?? []);

  constructor() {}

  ngOnInit(): void {
    this.loadDashboard();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url === '/front-office/dashboard')
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
          const firstFloor = response.data.floors?.[0]?.floorId ?? null;
          if (!this.selectedFloorId() && firstFloor) this.selectedFloorId.set(firstFloor);
        } else {
          this.setFallbackDashboard();
        }
        this.isLoading.set(false);
      },
      error: err => {
        console.warn('[FrontOfficeDashboard] API unavailable, showing fallback dashboard data:', err);
        this.setFallbackDashboard();
        this.isLoading.set(false);
      }
    });
  }

  private setFallbackDashboard(): void {
    const fallback: FrontOfficeDashboardData = {
      businessDate: new Date().toISOString().split('T')[0],
      summary: {
        totalRooms: 30,
        totalBookings: 15,
        availableRooms: 15,
        occupiedRooms: 10,
        bookedRooms: 3,
        blockedRooms: 1,
        underMaintenanceRooms: 1
      },
      floors: [
        {
          floorId: 1,
          floorName: 'Floor 1',
          totalRooms: 10,
          availableRooms: 5,
          occupiedRooms: 3,
          bookedRooms: 1,
          blockedRooms: 0,
          underMaintenanceRooms: 1,
          rooms: [
            { roomId: 101, roomNumber: '101', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 102, roomNumber: '102', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Rajesh Kumar', guestPhone: '+91 9876543210', vip: true, adults: 2, children: 0, checkInDate: '2026-07-26', checkOutDate: '2026-07-28', reservationStatus: 'CHECKED_IN', ratePlanName: 'Continental Plan', totalAmount: 11200, paidAmount: 11200 } },
            { roomId: 103, roomNumber: '103', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 104, roomNumber: '104', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'BOOKED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Amit Sharma', guestPhone: '+91 9123456789', vip: false, adults: 2, children: 1, checkInDate: '2026-07-27', checkOutDate: '2026-07-29', reservationStatus: 'CONFIRMED', ratePlanName: 'European Plan', totalAmount: 10000, paidAmount: 5000 } },
            { roomId: 105, roomNumber: '105', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 106, roomNumber: '106', roomType: 'Superior', maxOccupancy: 4, displayStatus: 'MAINTENANCE', housekeepingStatus: 'INSPECT' },
            { roomId: 107, roomNumber: '107', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Suresh Patel', guestPhone: '+91 9988776655', vip: false, adults: 1, children: 0, checkInDate: '2026-07-25', checkOutDate: '2026-07-28', reservationStatus: 'CHECKED_IN', ratePlanName: 'MAP Plan', totalAmount: 14500, paidAmount: 14500 } },
            { roomId: 108, roomNumber: '108', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 109, roomNumber: '109', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 110, roomNumber: '110', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Ananya Verma', guestPhone: '+91 9811223344', vip: true, adults: 2, children: 0, checkInDate: '2026-07-27', checkOutDate: '2026-07-30', reservationStatus: 'CHECKED_IN', ratePlanName: 'American Plan', totalAmount: 22500, paidAmount: 22500 } }
          ]
        },
        {
          floorId: 2,
          floorName: 'Floor 2',
          totalRooms: 10,
          availableRooms: 6,
          occupiedRooms: 3,
          bookedRooms: 1,
          blockedRooms: 0,
          underMaintenanceRooms: 0,
          rooms: [
            { roomId: 201, roomNumber: '201', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 202, roomNumber: '202', roomType: 'Superior', maxOccupancy: 4, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Priya Mehta', guestPhone: '+91 9776655443', vip: false, adults: 2, children: 1, checkInDate: '2026-07-26', checkOutDate: '2026-07-29', reservationStatus: 'CHECKED_IN', ratePlanName: 'Continental Plan', totalAmount: 21600, paidAmount: 21600 } },
            { roomId: 203, roomNumber: '203', roomType: 'Superior', maxOccupancy: 4, displayStatus: 'BOOKED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Vikram Singh', guestPhone: '+91 9665544332', vip: false, adults: 2, children: 0, checkInDate: '2026-07-28', checkOutDate: '2026-07-31', reservationStatus: 'CONFIRMED', ratePlanName: 'European Plan', totalAmount: 21600, paidAmount: 10000 } },
            { roomId: 204, roomNumber: '204', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 205, roomNumber: '205', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 206, roomNumber: '206', roomType: 'Superior', maxOccupancy: 4, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Rohan Gupta', guestPhone: '+91 9554433221', vip: true, adults: 2, children: 2, checkInDate: '2026-07-27', checkOutDate: '2026-07-30', reservationStatus: 'CHECKED_IN', ratePlanName: 'American Plan', totalAmount: 25800, paidAmount: 25800 } },
            { roomId: 207, roomNumber: '207', roomType: 'Standard', maxOccupancy: 2, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 208, roomNumber: '208', roomType: 'Suite', maxOccupancy: 4, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' },
            { roomId: 209, roomNumber: '209', roomType: 'Suite', maxOccupancy: 4, displayStatus: 'OCCUPIED', housekeepingStatus: 'CLEAN', booking: { guestName: 'Karan Johar', guestPhone: '+91 9443322110', vip: true, adults: 2, children: 0, checkInDate: '2026-07-25', checkOutDate: '2026-07-28', reservationStatus: 'CHECKED_IN', ratePlanName: 'MAP Plan', totalAmount: 36000, paidAmount: 36000 } },
            { roomId: 210, roomNumber: '210', roomType: 'Deluxe', maxOccupancy: 3, displayStatus: 'AVAILABLE', housekeepingStatus: 'CLEAN' }
          ]
        }
      ]
    };
    this.dashboard.set(fallback);
    if (!this.selectedFloorId()) {
      this.selectedFloorId.set(1);
    }
  }

  selectFloor(floor: FrontOfficeFloorBoard): void {
    this.selectedFloorId.set(floor.floorId ?? null);
    this.loadDashboard(true);
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

  statusClass(status: string | undefined): string {
    return (status || 'AVAILABLE').toLowerCase().replace(/_/g, '-');
  }

  formatMoney(value: number | undefined | null): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  guestCount(room: FrontOfficeRoomCard): string {
    const booking = room.booking;
    if (!booking) return `${room.maxOccupancy || 0} pax`;
    return `${booking.adults || 0}A, ${booking.children || 0}C`;
  }
}
