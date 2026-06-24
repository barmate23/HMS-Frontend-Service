import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
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
export class FrontOfficeDashboardComponent {
  private readonly frontOfficeApi = inject(FrontOfficeApiService);

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

  constructor() {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.frontOfficeApi.getFrontOfficeDashboard().subscribe({
      next: response => {
        if (response?.success && response.data) {
          this.dashboard.set(response.data);
          const firstFloor = response.data.floors?.[0]?.floorId ?? null;
          if (!this.selectedFloorId() && firstFloor) this.selectedFloorId.set(firstFloor);
        } else {
          this.error.set(response?.message || 'Front office dashboard is not available.');
        }
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message || err?.message || 'Unable to load front office dashboard.');
        this.isLoading.set(false);
      }
    });
  }

  selectFloor(floor: FrontOfficeFloorBoard): void {
    this.selectedFloorId.set(floor.floorId ?? null);
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
