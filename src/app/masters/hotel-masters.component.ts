import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HotelMastersService, Hotel, Floor, RoomType, Room } from './hotel-masters.service';

@Component({
  selector: 'app-hotel-masters',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  templateUrl: './hotel-masters.component.html',
  styleUrls: ['./hotel-masters.component.css']
})
export class HotelMastersComponent implements OnInit, OnDestroy {
  public readonly mastersService = inject(HotelMastersService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  // Active tab state: 'hotels' | 'floors' | 'room-types' | 'rooms'
  activeTab = signal<'hotels' | 'floors' | 'room-types' | 'rooms'>('hotels');
  
  // Search query
  searchQuery = signal<string>('');

  // --- Modals State ---
  isHotelModalOpen = signal(false);
  isFloorModalOpen = signal(false);
  isRoomTypeModalOpen = signal(false);
  isRoomModalOpen = signal(false);

  modalMode = signal<'create' | 'edit'>('create');

  // --- Form Bindings ---
  currentHotel = signal<Partial<Hotel>>({});
  currentFloor = signal<Partial<Floor>>({});
  currentRoomType = signal<Partial<RoomType>>({});
  currentRoom = signal<Partial<Room>>({});

  // Saving / deleting state
  isSaving = signal(false);
  isDeleting = signal(false);

  // Helper form state for Rooms tab: selected Hotel to filter Floor & RoomType
  selectedHotelIdForRoomForm = signal<number | null>(null);

  ngOnInit() {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy() {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private updateTabFromUrl(url: string) {
    if (url.includes('/masters/hotels')) {
      this.activeTab.set('hotels');
    } else if (url.includes('/masters/floors')) {
      this.activeTab.set('floors');
    } else if (url.includes('/masters/room-types')) {
      this.activeTab.set('room-types');
    } else if (url.includes('/masters/rooms')) {
      this.activeTab.set('rooms');
    }
    // Clear search query when changing tabs
    this.searchQuery.set('');
  }

  switchTab(tab: 'hotels' | 'floors' | 'room-types' | 'rooms') {
    this.router.navigate([`/masters/${tab}`]);
  }

  // --- Filtered Lists ---
  filteredHotels = computed(() => {
    const list = this.mastersService.hotels();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(h => 
      h.name.toLowerCase().includes(query) ||
      h.city.toLowerCase().includes(query) ||
      h.email.toLowerCase().includes(query) ||
      h.phone.includes(query)
    );
  });

  filteredFloors = computed(() => {
    const list = this.mastersService.floors();
    const query = this.searchQuery().toLowerCase().trim();
    const hotels = this.mastersService.hotelsMap();
    return list.filter(f => {
      const hotel = hotels.get(f.hotelId);
      const hotelName = hotel ? hotel.name.toLowerCase() : '';
      const matchesQuery = !query || 
        f.floorNumber.toLowerCase().includes(query) ||
        f.telephone.includes(query) ||
        hotelName.includes(query);
      return matchesQuery;
    });
  });

  filteredRoomTypes = computed(() => {
    const list = this.mastersService.roomTypes();
    const query = this.searchQuery().toLowerCase().trim();
    const hotels = this.mastersService.hotelsMap();
    return list.filter(rt => {
      const hotel = hotels.get(rt.hotelId);
      const hotelName = hotel ? hotel.name.toLowerCase() : '';
      const matchesQuery = !query || 
        rt.name.toLowerCase().includes(query) ||
        rt.description.toLowerCase().includes(query) ||
        hotelName.includes(query);
      return matchesQuery;
    });
  });

  filteredRooms = computed(() => {
    const list = this.mastersService.rooms();
    const query = this.searchQuery().toLowerCase().trim();
    const floors = this.mastersService.floorsMap();
    const roomTypes = this.mastersService.roomTypesMap();
    const hotels = this.mastersService.hotelsMap();

    return list.filter(r => {
      const floor = floors.get(r.floorId);
      const roomType = roomTypes.get(r.typeId);
      const floorNum = floor ? floor.floorNumber.toLowerCase() : '';
      const typeName = roomType ? roomType.name.toLowerCase() : '';
      
      let hotelName = '';
      if (floor) {
        const hotel = hotels.get(floor.hotelId);
        if (hotel) hotelName = hotel.name.toLowerCase();
      }

      const matchesQuery = !query || 
        r.roomNumber.toLowerCase().includes(query) ||
        r.status.toLowerCase().includes(query) ||
        r.telephone.includes(query) ||
        floorNum.includes(query) ||
        typeName.includes(query) ||
        hotelName.includes(query);
      return matchesQuery;
    });
  });

  // --- Dynamic Mappings ---
  getHotelName(hotelId?: number): string {
    if (!hotelId) return 'N/A';
    return this.mastersService.hotelsMap().get(hotelId)?.name || `Hotel #${hotelId}`;
  }

  getFloorNumber(floorId?: number): string {
    if (!floorId) return 'N/A';
    return this.mastersService.floorsMap().get(floorId)?.floorNumber || `Floor #${floorId}`;
  }

  getRoomTypeName(typeId?: number): string {
    if (!typeId) return 'N/A';
    return this.mastersService.roomTypesMap().get(typeId)?.name || `Type #${typeId}`;
  }

  getHotelCurrency(): string {
    return '₹';
  }

  getHotelForFloor(floorId?: number): string {
    if (!floorId) return 'N/A';
    const floor = this.mastersService.floorsMap().get(floorId);
    if (!floor) return 'N/A';
    return this.getHotelName(floor.hotelId);
  }

  // --- Dropdown Filtering for Room Form ---
  floorsForSelectedHotel = computed(() => {
    const hotelId = this.selectedHotelIdForRoomForm();
    if (hotelId === null) return [];
    return this.mastersService.floors().filter(f => f.hotelId === hotelId && f.isActive);
  });

  roomTypesForSelectedHotel = computed(() => {
    const hotelId = this.selectedHotelIdForRoomForm();
    if (hotelId === null) return [];
    return this.mastersService.roomTypes().filter(rt => rt.hotelId === hotelId && rt.isActive);
  });

  onHotelChangeInRoomForm(hotelIdStr: string) {
    const hotelId = hotelIdStr ? Number(hotelIdStr) : null;
    this.selectedHotelIdForRoomForm.set(hotelId);
    // Reset Floor & RoomType selections when hotel changes
    this.currentRoom.update(r => ({ ...r, floorId: undefined, typeId: undefined }));
  }

  // --- Modal Open/Close ---
  openCreateModal() {
    this.modalMode.set('create');
    const tab = this.activeTab();
    if (tab === 'hotels') {
      this.currentHotel.set({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        totalRooms: 10,
        isActive: true
      });
      this.isHotelModalOpen.set(true);
    } else if (tab === 'floors') {
      const activeHotels = this.mastersService.hotels().filter(h => h.isActive);
      this.currentFloor.set({
        hotelId: activeHotels.length > 0 ? activeHotels[0].id : undefined,
        floorNumber: '',
        noOfRooms: 10,
        telephone: '',
        isActive: true
      });
      this.isFloorModalOpen.set(true);
    } else if (tab === 'room-types') {
      const activeHotels = this.mastersService.hotels().filter(h => h.isActive);
      this.currentRoomType.set({
        hotelId: activeHotels.length > 0 ? activeHotels[0].id : undefined,
        name: '',
        capacity: 2,
        basePricePerNight: 100.0,
        area: 300.0,
        description: '',
        isActive: true
      });
      this.isRoomTypeModalOpen.set(true);
    } else if (tab === 'rooms') {
      const activeHotels = this.mastersService.hotels().filter(h => h.isActive);
      const defaultHotelId = activeHotels.length > 0 ? activeHotels[0].id : null;
      this.selectedHotelIdForRoomForm.set(defaultHotelId);
      
      const floors = defaultHotelId ? this.mastersService.floors().filter(f => f.hotelId === defaultHotelId && f.isActive) : [];
      const types = defaultHotelId ? this.mastersService.roomTypes().filter(rt => rt.hotelId === defaultHotelId && rt.isActive) : [];

      this.currentRoom.set({
        roomNumber: '',
        floorId: floors.length > 0 ? floors[0].id : undefined,
        typeId: types.length > 0 ? types[0].id : undefined,
        status: 'VACANT',
        maxOccupancy: 2,
        telephone: '',
        isActive: true
      });
      this.isRoomModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  openEditModal(item: any) {
    this.modalMode.set('edit');
    const tab = this.activeTab();
    if (tab === 'hotels') {
      this.currentHotel.set({ ...item });
      this.isHotelModalOpen.set(true);
    } else if (tab === 'floors') {
      this.currentFloor.set({ ...item });
      this.isFloorModalOpen.set(true);
    } else if (tab === 'room-types') {
      this.currentRoomType.set({ ...item });
      this.isRoomTypeModalOpen.set(true);
    } else if (tab === 'rooms') {
      const room = item as Room;
      this.currentRoom.set({ ...room });
      
      // Determine hotelId from the floor
      const floor = this.mastersService.floorsMap().get(room.floorId);
      if (floor) {
        this.selectedHotelIdForRoomForm.set(floor.hotelId);
      }
      this.isRoomModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  closeModal(tab: 'hotels' | 'floors' | 'room-types' | 'rooms') {
    if (tab === 'hotels') this.isHotelModalOpen.set(false);
    if (tab === 'floors') this.isFloorModalOpen.set(false);
    if (tab === 'room-types') this.isRoomTypeModalOpen.set(false);
    if (tab === 'rooms') this.isRoomModalOpen.set(false);
    document.body.style.overflow = '';
  }

  // --- Save Operations ---
  saveHotel() {
    const hotel = this.currentHotel();
    if (!hotel.name || !hotel.email) {
      alert('Please fill out all required fields (Name, Email).');
      return;
    }
    this.isSaving.set(true);
    this.mastersService.saveHotel(hotel).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('hotels'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving hotel: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveFloor() {
    const floor = this.currentFloor();
    if (!floor.hotelId || !floor.floorNumber) {
      alert('Please select a hotel and specify a floor number.');
      return;
    }
    this.isSaving.set(true);
    this.mastersService.saveFloor(floor).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('floors'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving floor: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveRoomType() {
    const rt = this.currentRoomType();
    if (!rt.hotelId || !rt.name || rt.basePricePerNight === undefined) {
      alert('Please fill out all required fields.');
      return;
    }
    this.isSaving.set(true);
    this.mastersService.saveRoomType(rt).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('room-types'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving room type: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveRoom() {
    const room = this.currentRoom();
    if (!room.roomNumber || !room.floorId || !room.typeId) {
      alert('Please specify a room number, floor, and room type.');
      return;
    }
    this.isSaving.set(true);
    this.mastersService.saveRoom(room).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('rooms'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving room: ' + (err?.message || 'Unknown error')); }
    });
  }

  // --- Toggle Active States ---
  toggleHotelActive(hotel: Hotel, event: Event) {
    event.stopPropagation();
    this.mastersService.saveHotel({ ...hotel, isActive: !hotel.isActive }).subscribe();
  }

  toggleFloorActive(floor: Floor, event: Event) {
    event.stopPropagation();
    this.mastersService.saveFloor({ ...floor, isActive: !floor.isActive }).subscribe();
  }

  toggleRoomTypeActive(rt: RoomType, event: Event) {
    event.stopPropagation();
    this.mastersService.saveRoomType({ ...rt, isActive: !rt.isActive }).subscribe();
  }

  toggleRoomActive(room: Room, event: Event) {
    event.stopPropagation();
    this.mastersService.saveRoom({ ...room, isActive: !room.isActive }).subscribe();
  }

  // --- Delete Operations ---
  deleteHotel(id: number, name: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete Hotel "${name}"? This could leave associated floors and rooms orphaned.`)) {
      this.isDeleting.set(true);
      this.mastersService.deleteHotel(id).subscribe({
        next: () => this.isDeleting.set(false),
        error: (err) => { this.isDeleting.set(false); alert('Error deleting hotel: ' + (err?.message || 'Unknown error')); }
      });
    }
  }

  deleteFloor(id: number, floorNumber: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${floorNumber}"?`)) {
      this.isDeleting.set(true);
      this.mastersService.deleteFloor(id).subscribe({
        next: () => this.isDeleting.set(false),
        error: (err) => { this.isDeleting.set(false); alert('Error deleting floor: ' + (err?.message || 'Unknown error')); }
      });
    }
  }

  deleteRoomType(id: number, name: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete Room Type "${name}"?`)) {
      this.isDeleting.set(true);
      this.mastersService.deleteRoomType(id).subscribe({
        next: () => this.isDeleting.set(false),
        error: (err) => { this.isDeleting.set(false); alert('Error deleting room type: ' + (err?.message || 'Unknown error')); }
      });
    }
  }

  deleteRoom(id: number, roomNumber: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete Room #${roomNumber}?`)) {
      this.isDeleting.set(true);
      this.mastersService.deleteRoom(id).subscribe({
        next: () => this.isDeleting.set(false),
        error: (err) => { this.isDeleting.set(false); alert('Error deleting room: ' + (err?.message || 'Unknown error')); }
      });
    }
  }
}
