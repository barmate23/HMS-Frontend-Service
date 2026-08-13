import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HotelMastersService, Hotel, Floor, RoomType, Room, RatePlan, GstConfig } from './hotel-masters.service';
import { AddressService } from '../address.service';

type MasterTab = 'hotels' | 'floors' | 'room-types' | 'rooms' | 'rate-plans' | 'gst-config';
type ValidationErrors = Partial<Record<string, string>>;

@Component({
  selector: 'app-hotel-masters',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  templateUrl: './hotel-masters.component.html',
  styleUrls: ['./hotel-masters.component.css']
})
export class HotelMastersComponent implements OnInit, OnDestroy {
  public readonly mastersService = inject(HotelMastersService);
  public readonly addressService = inject(AddressService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;
  private searchDebounceTimer: any;

  // Active tab state: 'hotels' | 'floors' | 'room-types' | 'rooms' | 'rate-plans'
  activeTab = signal<MasterTab>('hotels');
  
  // Search query
  searchQuery = signal<string>('');

  // --- Modals State ---
  isHotelModalOpen = signal(false);
  isFloorModalOpen = signal(false);
  isRoomTypeModalOpen = signal(false);
  isRoomModalOpen = signal(false);
  isRatePlanModalOpen = signal(false);
  isGstModalOpen = signal(false);
  isDeleteConfirmOpen = signal(false);
  deleteConfirmTitle = signal('Confirm Deletion');
  deleteConfirmMessage = signal('');
  pendingDeleteAction: (() => void) | null = null;

  modalMode = signal<'create' | 'edit'>('create');

  // --- Form Bindings ---
  currentHotel = signal<Partial<Hotel>>({});
  currentFloor = signal<Partial<Floor>>({});
  currentRoomType = signal<Partial<RoomType>>({});
  currentRoom = signal<Partial<Room>>({});
  currentRatePlan = signal<Partial<RatePlan>>({});
  currentGst = signal<Partial<GstConfig>>({});

  // Saving / deleting state
  isSaving = signal(false);
  isDeleting = signal(false);
  formSubmitted = signal(false);
  touchedFields = signal<Record<string, boolean>>({});
  formErrors = signal<ValidationErrors>({});
  modalErrorMessage = signal<string | null>(null);

  // Gallery loading state for Edit Room modal
  roomPhotosLoading = signal(false);

  // Helper form state for Rooms tab: selected Hotel to filter Floor & RoomType
  selectedHotelIdForRoomForm = signal<number | null>(null);

  // Address Dropdown Signals & Cascade Helpers
  addressCountries = computed(() => this.addressService.countries());
  addressStates = computed(() => {
    const selectedCountryName = this.currentHotel().country;
    const country = this.addressService.countries().find(c => (c.name || '').toLowerCase() === (selectedCountryName || '').toLowerCase());
    if (country && country.id) {
      const filtered = this.addressService.states().filter(s => Number(s.countryId) === Number(country.id));
      if (filtered.length > 0) return filtered;
    }
    return this.addressService.states();
  });
  addressCities = computed(() => {
    const selectedStateName = this.currentHotel().state;
    const state = this.addressService.states().find(s => (s.name || '').toLowerCase() === (selectedStateName || '').toLowerCase());
    if (state && state.id) {
      const filtered = this.addressService.cities().filter(c => Number(c.stateId) === Number(state.id));
      if (filtered.length > 0) return filtered;
    }
    return this.addressService.cities();
  });

  onHotelCountryChange(countryName: string) {
    this.currentHotel.update(h => ({ ...h, country: countryName }));
    const country = this.addressService.countries().find(c => (c.name || '').toLowerCase() === (countryName || '').toLowerCase());
    if (country && country.id) {
      this.addressService.loadStates(country.id).subscribe();
    } else {
      this.addressService.loadStates().subscribe();
    }
  }

  onHotelStateChange(stateName: string) {
    this.currentHotel.update(h => ({ ...h, state: stateName }));
    const state = this.addressService.states().find(s => (s.name || '').toLowerCase() === (stateName || '').toLowerCase());
    if (state && state.id) {
      this.addressService.loadCities(state.id).subscribe();
    } else {
      this.addressService.loadCities().subscribe();
    }
  }

  onHotelCityChange(cityName: string) {
    this.currentHotel.update(h => ({ ...h, city: cityName }));
  }

  ngOnInit() {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });

    // Load Address API dropdown data
    this.addressService.loadCountries().subscribe();
    this.addressService.loadStates().subscribe();
    this.addressService.loadCities().subscribe();
  }

  ngOnDestroy() {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.mastersService.loadAll(value);
    }, 400);
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
    } else if (url.includes('/masters/rate-plans')) {
      this.activeTab.set('rate-plans');
    } else if (url.includes('/masters/gst-config')) {
      this.activeTab.set('gst-config');
    }
    // Clear search query when changing tabs
    this.searchQuery.set('');
  }

  switchTab(tab: MasterTab) {
    this.router.navigate([`/masters/${tab}`]);
  }

  // --- Filtered Lists ---
  filteredHotels = computed(() => {
    const list = this.mastersService.hotels();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(h => 
      (h.name || '').toLowerCase().includes(query) ||
      (h.city || '').toLowerCase().includes(query) ||
      (h.email || '').toLowerCase().includes(query) ||
      (h.phone || '').includes(query)
    );
  });

  filteredFloors = computed(() => {
    const list = this.mastersService.floors();
    const query = this.searchQuery().toLowerCase().trim();
    const hotels = this.mastersService.hotelsMap();
    return list.filter(f => {
      const hotel = hotels.get(f.hotelId);
      const hotelName = hotel ? (hotel.name || '').toLowerCase() : '';
      const matchesQuery = !query || 
        (f.floorNumber || '').toLowerCase().includes(query) ||
        (f.telephone || '').includes(query) ||
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
      const hotelName = hotel ? (hotel.name || '').toLowerCase() : '';
      const matchesQuery = !query || 
        (rt.name || '').toLowerCase().includes(query) ||
        (rt.description || '').toLowerCase().includes(query) ||
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
      const floorNum = floor ? (floor.floorNumber || '').toLowerCase() : '';
      const typeName = roomType ? (roomType.name || '').toLowerCase() : '';
      
      let hotelName = '';
      if (floor) {
        const hotel = hotels.get(floor.hotelId);
        if (hotel) hotelName = (hotel.name || '').toLowerCase();
      }

      const matchesQuery = !query || 
        (r.roomNumber || '').toLowerCase().includes(query) ||
        (r.status || '').toLowerCase().includes(query) ||
        (r.telephone || '').includes(query) ||
        floorNum.includes(query) ||
        typeName.includes(query) ||
        hotelName.includes(query);
      return matchesQuery;
    });
  });

  filteredRatePlans = computed(() => {
    const list = this.mastersService.ratePlans();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(rp =>
      rp.name.toLowerCase().includes(query) ||
      (rp.description || '').toLowerCase().includes(query) ||
      String(rp.priceAdjustment ?? '').includes(query) ||
      String(rp.displayOrder ?? '').includes(query)
    );
  });

  filteredGstConfigs = computed(() => {
    const list = this.mastersService.gstConfigs();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(g =>
      g.serviceCategory.toLowerCase().includes(query) ||
      (g.hsnSacCode || '').toLowerCase().includes(query) ||
      (g.description || '').toLowerCase().includes(query) ||
      String(g.cgstRate).includes(query) ||
      String(g.sgstRate).includes(query) ||
      String(g.igstRate).includes(query)
    );
  });

  // --- Pagination Helpers for Rooms ---
  get roomsPageArray(): number[] {
    const total = this.mastersService.roomsTotalPages();
    return Array.from({ length: total }, (_, i) => i);
  }

  nextRoomsPage() {
    const current = this.mastersService.roomsPage();
    const total = this.mastersService.roomsTotalPages();
    if (current < total - 1) {
      this.mastersService.loadRooms(current + 1, 5, this.searchQuery());
    }
  }

  prevRoomsPage() {
    const current = this.mastersService.roomsPage();
    if (current > 0) {
      this.mastersService.loadRooms(current - 1, 5, this.searchQuery());
    }
  }

  goToRoomsPage(page: number) {
    this.mastersService.loadRooms(page, 5, this.searchQuery());
  }

  get roomsRangeMin(): number {
    if (this.mastersService.roomsTotalElements() === 0) return 0;
    return (this.mastersService.roomsPage() * 5) + 1;
  }

  get roomsRangeMax(): number {
    const max = (this.mastersService.roomsPage() + 1) * 5;
    const total = this.mastersService.roomsTotalElements();
    return Math.min(max, total || max);
  }

  // --- Dynamic Mappings ---
  getHotelLogoSrc(hotel: Hotel): string {
    if (!hotel) return '';
    if (hotel.logoUrl) {
      if (hotel.logoUrl.startsWith('http') || hotel.logoUrl.startsWith('data:')) {
        return hotel.logoUrl;
      }
      return `data:image/png;base64,${hotel.logoUrl}`;
    }
    if (hotel.logo) {
      if (hotel.logo.startsWith('http') || hotel.logo.startsWith('data:')) {
        return hotel.logo;
      }
      return `data:image/png;base64,${hotel.logo}`;
    }
    return '';
  }

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

  formatRateAdjustment(value?: number): string {
    const amount = value ?? 0;
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return amount > 0 ? `+${formatted}` : formatted;
  }

  // --- Dropdown Filtering for Room Form ---
  floorsForSelectedHotel = computed(() => {
    const hotelId = this.selectedHotelIdForRoomForm();
    if (hotelId === null || hotelId === undefined) return [];
    return this.mastersService.floors().filter(f => Number(f.hotelId) === Number(hotelId) && (f.isActive === undefined || f.isActive || (f.isActive as any) === 'true'));
  });

  roomTypesForSelectedHotel = computed(() => {
    const hotelId = this.selectedHotelIdForRoomForm();
    if (hotelId === null || hotelId === undefined) return [];
    return this.mastersService.roomTypes().filter(rt => Number(rt.hotelId) === Number(hotelId) && (rt.isActive === undefined || rt.isActive || (rt.isActive as any) === 'true'));
  });

  onHotelChangeInRoomForm(hotelIdInput: any) {
    const hotelId = hotelIdInput !== null && hotelIdInput !== undefined ? Number(hotelIdInput) : null;
    this.selectedHotelIdForRoomForm.set(hotelId);
    // Reset Floor & RoomType selections when hotel changes
    this.currentRoom.update(r => ({ ...r, floorId: undefined, typeId: undefined }));
    this.markFieldTouched('hotelId');
    this.validateForm('rooms', false);
  }

  get modalTitle(): string {
    const isCreate = this.modalMode() === 'create';
    const tab = this.activeTab();
    if (tab === 'hotels') return isCreate ? 'Add New Property' : 'Edit Hotel Property';
    if (tab === 'floors') return isCreate ? 'Create Building Floor' : 'Edit Floor';
    if (tab === 'room-types') return isCreate ? 'Create Room Type' : 'Edit Room Type';
    if (tab === 'rooms') return isCreate ? 'Create Room' : 'Edit Room';
    if (tab === 'rate-plans') return isCreate ? 'Create Rate Plan' : 'Edit Rate Plan';
    if (tab === 'gst-config') return isCreate ? 'Create GST Config' : 'Edit GST Config';
    return isCreate ? 'Create Entity' : 'Edit Entity';
  }

  get modalSubtitle(): string {
    const isCreate = this.modalMode() === 'create';
    const tab = this.activeTab();
    if (tab === 'hotels') return isCreate ? 'Register a new hotel unit' : `Update settings for H-${this.currentHotel().id || ''}`;
    if (tab === 'floors') return isCreate ? 'Define a new floor level' : `Update settings for F-${this.currentFloor().id || ''}`;
    if (tab === 'room-types') return isCreate ? 'Define a new room category' : `Update category RT-${this.currentRoomType().id || ''}`;
    if (tab === 'rooms') return isCreate ? 'Define a new room unit' : `Update room R-${this.currentRoom().id || ''}`;
    if (tab === 'rate-plans') return isCreate ? 'Define a reusable pricing rule' : `Update pricing rule RP-${this.currentRatePlan().id || ''}`;
    if (tab === 'gst-config') return isCreate ? 'Configure tax rule' : `Update GST rule GST-${this.currentGst().id || ''}`;
    return '';
  }

  get modalSubmitText(): string {
    if (this.isSaving()) return 'Saving...';
    const isCreate = this.modalMode() === 'create';
    const tab = this.activeTab();
    if (tab === 'hotels') return isCreate ? 'Create Property' : 'Save Changes';
    if (tab === 'floors') return isCreate ? 'Create Floor' : 'Save Changes';
    if (tab === 'room-types') return isCreate ? 'Create Room Type' : 'Save Changes';
    if (tab === 'rooms') return isCreate ? 'Create Room' : 'Save Changes';
    if (tab === 'rate-plans') return isCreate ? 'Create Rate Plan' : 'Save Changes';
    if (tab === 'gst-config') return isCreate ? 'Create GST Rule' : 'Save Changes';
    return isCreate ? 'Create' : 'Save Changes';
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result as string;
        const base64Bytes = result.includes(',') ? result.split(',')[1] : result;
        this.currentHotel.update(h => ({ ...h, logoUrl: result, logo: base64Bytes }));
      };
      reader.readAsDataURL(file);
    }
  }

  removeLogo(): void {
    this.currentHotel.update(h => ({ ...h, logoUrl: '', logo: '' }));
  }

  onRoomPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const readPromises = files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readPromises).then(newImages => {
        this.currentRoom.update(r => {
          const currentList = r.imageUrls || (r.imageUrl ? [r.imageUrl] : []);
          const updatedList = [...currentList, ...newImages];
          return {
            ...r,
            imageUrls: updatedList,
            imageUrl: updatedList[0] || ''
          };
        });
      });
    }
  }

  removeRoomPhotoAtIndex(index: number): void {
    this.currentRoom.update(r => {
      const currentList = [...(r.imageUrls || (r.imageUrl ? [r.imageUrl] : []))];
      if (index >= 0 && index < currentList.length) {
        currentList.splice(index, 1);
      }
      return {
        ...r,
        imageUrls: currentList,
        imageUrl: currentList.length > 0 ? currentList[0] : ''
      };
    });
  }

  // --- Modal Open/Close ---
  openCreateModal() {
    this.resetValidation();
    this.modalErrorMessage.set(null);
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
        country: 'India',
        zipCode: '400001',
        totalRooms: 10,
        currency: 'INR',
        logoUrl: '',
        starRating: 3,
        checkInTime: '12:00',
        checkOutTime: '11:00',
        gstin: '',
        fssaiNo: '',
        tagline: '',
        websiteUrl: '',
        receptionPhone: '',
        isActive: true
      });
      this.isHotelModalOpen.set(true);
    } else if (tab === 'floors') {
      const activeHotels = this.mastersService.hotels().filter(h => h.isActive === undefined || h.isActive || (h.isActive as any) === 'true');
      this.currentFloor.set({
        hotelId: activeHotels.length > 0 ? Number(activeHotels[0].id) : undefined,
        floorNumber: '',
        noOfRooms: 10,
        telephone: '',
        isActive: true
      });
      this.isFloorModalOpen.set(true);
    } else if (tab === 'room-types') {
      const activeHotels = this.mastersService.hotels().filter(h => h.isActive === undefined || h.isActive || (h.isActive as any) === 'true');
      this.currentRoomType.set({
        hotelId: activeHotels.length > 0 ? Number(activeHotels[0].id) : undefined,
        name: '',
        capacity: 2,
        basePricePerNight: 100.0,
        area: 300.0,
        description: '',
        isActive: true
      });
      this.isRoomTypeModalOpen.set(true);
    } else if (tab === 'rooms') {
      const activeHotels = this.mastersService.hotels();
      const defaultHotelId = activeHotels.length > 0 ? Number(activeHotels[0].id) : null;
      this.selectedHotelIdForRoomForm.set(defaultHotelId);
      
      const floors = defaultHotelId !== null 
        ? this.mastersService.floors().filter(f => Number(f.hotelId) === defaultHotelId) 
        : [];
      const types = defaultHotelId !== null 
        ? this.mastersService.roomTypes().filter(rt => Number(rt.hotelId) === defaultHotelId) 
        : [];

      this.currentRoom.set({
        roomNumber: '',
        floorId: floors.length > 0 ? Number(floors[0].id) : undefined,
        typeId: types.length > 0 ? Number(types[0].id) : undefined,
        status: 'VACANT',
        maxOccupancy: 2,
        telephone: '',
        imageUrl: '',
        imageUrls: [],
        isActive: true
      });
      this.isRoomModalOpen.set(true);
    } else if (tab === 'rate-plans') {
      this.currentRatePlan.set({
        name: '',
        description: '',
        priceAdjustment: 0,
        displayOrder: this.mastersService.ratePlans().length + 1,
        isActive: true
      });
      this.isRatePlanModalOpen.set(true);
    } else if (tab === 'gst-config') {
      this.currentGst.set({
        serviceCategory: 'Room',
        hsnSacCode: '',
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 18,
        description: '',
        isActive: true
      });
      this.isGstModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  openEditModal(item: any) {
    this.resetValidation();
    this.modalErrorMessage.set(null);
    this.modalMode.set('edit');
    const tab = this.activeTab();
    if (tab === 'hotels') {
      this.currentHotel.set({
        country: 'India',
        zipCode: '400001',
        totalRooms: 10,
        currency: 'INR',
        starRating: item.starRating || 3,
        starRatingCategory: item.starRatingCategory || `${item.starRating || 3} Star`,
        checkInTime: item.checkInTime || '12:00',
        checkOutTime: item.checkOutTime || '11:00',
        logoUrl: item.logoUrl || (item.logo ? `data:image/png;base64,${item.logo}` : ''),
        logo: item.logo || '',
        gstin: item.gstin || '',
        fssaiNo: item.fssaiNo || '',
        tagline: item.tagline || '',
        websiteUrl: item.websiteUrl || '',
        receptionPhone: item.receptionPhone || item.receptionDeskPhone || '',
        receptionDeskPhone: item.receptionDeskPhone || item.receptionPhone || '',
        ...item
      });
      this.isHotelModalOpen.set(true);
    } else if (tab === 'floors') {
      this.currentFloor.set({ ...item, hotelId: item.hotelId ? Number(item.hotelId) : undefined });
      this.isFloorModalOpen.set(true);
    } else if (tab === 'room-types') {
      this.currentRoomType.set({ ...item, hotelId: item.hotelId ? Number(item.hotelId) : undefined });
      this.isRoomTypeModalOpen.set(true);
    } else if (tab === 'rooms') {
      const room = item as Room;
      const floorId = room.floorId ? Number(room.floorId) : undefined;
      const typeId = room.typeId ? Number(room.typeId) : (room.roomTypeId ? Number(room.roomTypeId) : undefined);
      
      const imageUrls = room.imageUrls || (room.imageUrl ? [room.imageUrl] : []);
      this.currentRoom.set({
        ...room,
        floorId,
        typeId,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : '',
        imageUrls: imageUrls
      });
      
      // Determine hotelId from the floor
      const floor = this.mastersService.floors().find(f => Number(f.id) === Number(floorId));
      if (floor) {
        this.selectedHotelIdForRoomForm.set(Number(floor.hotelId));
      } else {
        const activeHotels = this.mastersService.hotels();
        this.selectedHotelIdForRoomForm.set(activeHotels.length > 0 ? Number(activeHotels[0].id) : null);
      }
      this.isRoomModalOpen.set(true);

      // Fetch fresh room details & photos from getRoomById API
      if (room.id) {
        this.roomPhotosLoading.set(true);
        this.mastersService.getRoomById(Number(room.id)).subscribe({
          next: (freshRoom) => {
            if (freshRoom) {
              const freshFloorId = freshRoom.floorId ? Number(freshRoom.floorId) : floorId;
              const freshTypeId = freshRoom.typeId ? Number(freshRoom.typeId) : typeId;
              
              this.currentRoom.set({
                ...this.currentRoom(),
                ...freshRoom,
                floorId: freshFloorId,
                typeId: freshTypeId
              });

              const freshFloor = this.mastersService.floors().find(f => Number(f.id) === Number(freshFloorId));
              if (freshFloor) {
                this.selectedHotelIdForRoomForm.set(Number(freshFloor.hotelId));
              }
            }
            this.roomPhotosLoading.set(false);
          },
          error: (err) => {
            console.error('Error fetching room details:', err);
            this.roomPhotosLoading.set(false);
          }
        });
      }
    } else if (tab === 'rate-plans') {
      this.currentRatePlan.set({ ...item });
      this.isRatePlanModalOpen.set(true);
    } else if (tab === 'gst-config') {
      this.currentGst.set({ ...item });
      this.isGstModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  closeModal(tab: MasterTab) {
    if (tab === 'hotels') this.isHotelModalOpen.set(false);
    if (tab === 'floors') this.isFloorModalOpen.set(false);
    if (tab === 'room-types') this.isRoomTypeModalOpen.set(false);
    if (tab === 'rooms') this.isRoomModalOpen.set(false);
    if (tab === 'rate-plans') this.isRatePlanModalOpen.set(false);
    if (tab === 'gst-config') this.isGstModalOpen.set(false);
    this.resetValidation();
    this.modalErrorMessage.set(null);
    document.body.style.overflow = '';
  }

  markFieldTouched(field: string) {
    this.touchedFields.update(fields => ({ ...fields, [field]: true }));
    this.validateForm(this.activeTab(), false);
  }

  shouldShowError(field: string): boolean {
    return !!(this.formSubmitted() || this.touchedFields()[field]) && !!this.formErrors()[field];
  }

  validationMessage(field: string): string {
    return this.formErrors()[field] || '';
  }

  private resetValidation() {
    this.formSubmitted.set(false);
    this.touchedFields.set({});
    this.formErrors.set({});
  }

  private validateForm(tab: MasterTab, submit = true): boolean {
    if (submit) this.formSubmitted.set(true);
    const errors =
      tab === 'hotels' ? this.validateHotelForm() :
      tab === 'floors' ? this.validateFloorForm() :
      tab === 'room-types' ? this.validateRoomTypeForm() :
      tab === 'rooms' ? this.validateRoomForm() :
      tab === 'gst-config' ? this.validateGstForm() :
      this.validateRatePlanForm();

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private validateGstForm(): ValidationErrors {
    const g = this.currentGst();
    const errors: ValidationErrors = {};
    const sac = (g.hsnSacCode || '').trim();

    if (!(g.serviceCategory || '').trim()) {
      errors['serviceCategory'] = 'Service category is required.';
    }

    if (!sac) {
      errors['hsnSacCode'] = 'HSN/SAC code is required.';
    } else if (!/^[0-9A-Za-z-]{2,12}$/.test(sac)) {
      errors['hsnSacCode'] = 'Enter a valid HSN/SAC code (alphanumeric, 2-12 chars).';
    }

    if (g.cgstRate === undefined || g.cgstRate === null || isNaN(g.cgstRate)) {
      errors['cgstRate'] = 'CGST rate is required.';
    } else if (g.cgstRate < 0 || g.cgstRate > 100) {
      errors['cgstRate'] = 'CGST rate must be between 0 and 100.';
    }

    if (g.sgstRate === undefined || g.sgstRate === null || isNaN(g.sgstRate)) {
      errors['sgstRate'] = 'SGST rate is required.';
    } else if (g.sgstRate < 0 || g.sgstRate > 100) {
      errors['sgstRate'] = 'SGST rate must be between 0 and 100.';
    }

    return errors;
  }

  private validateHotelForm(): ValidationErrors {
    const h = this.currentHotel();
    const errors: ValidationErrors = {};
    const name = (h.name || '').trim();
    const email = (h.email || '').trim();
    const phone = (h.phone || '').trim();
    const address = (h.address || '').trim();
    const city = (h.city || '').trim();
    const state = (h.state || '').trim();
    const country = (h.country || 'India').trim();
    const zipCode = (h.zipCode || '400001').trim();
    const totalRooms = h.totalRooms ?? 10;

    if (!name) errors['name'] = 'Hotel name is required.';
    else if (name.length < 2) errors['name'] = 'Enter a valid hotel name.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 .,'&()-]*$/.test(name)) errors['name'] = 'Use letters, numbers and common punctuation only.';
    else if (this.isDuplicateHotelName(name, h.id)) errors['name'] = 'A hotel with this name already exists.';

    if (!email) errors['email'] = 'Email address is required.';
    else if (!this.isValidEmail(email)) errors['email'] = 'Enter a valid email address.';

    if (!phone) errors['phone'] = 'Phone number is required.';
    else if (!this.isValidPhone(phone)) errors['phone'] = 'Enter a valid phone number.';

    if (!address) errors['address'] = 'Street address is required.';
    if (!city) errors['city'] = 'City is required.';
    else if (!this.isValidPlaceName(city)) errors['city'] = 'Enter a valid city name.';

    if (!state) errors['state'] = 'State or region is required.';
    else if (!this.isValidPlaceName(state)) errors['state'] = 'Enter a valid state or region.';

    if (!country) errors['country'] = 'Country is required.';
    else if (!this.isValidPlaceName(country)) errors['country'] = 'Enter a valid country.';

    if (!zipCode) errors['zipCode'] = 'Zip code is required.';

    if (!this.isPositiveInteger(totalRooms)) errors['totalRooms'] = 'Total rooms must be at least 1.';

    return errors;
  }

  private validateFloorForm(): ValidationErrors {
    const f = this.currentFloor();
    const errors: ValidationErrors = {};
    const floorNumber = (f.floorNumber || '').trim();

    if (!f.hotelId) errors['hotelId'] = 'Hotel property is required.';
    if (!floorNumber) errors['floorNumber'] = 'Floor number or name is required.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(floorNumber)) errors['floorNumber'] = 'Use letters, numbers, spaces, hyphen or underscore only.';
    else if (this.isDuplicateFloor(floorNumber, f.hotelId, f.id)) errors['floorNumber'] = 'This floor already exists for the selected hotel.';

    if (!this.isPositiveInteger(f.noOfRooms)) errors['noOfRooms'] = 'Capacity must be at least 1.';
    if ((f.telephone || '').trim() && !this.isValidExtension(f.telephone || '')) errors['telephone'] = 'Enter a valid phone or extension.';

    return errors;
  }

  private validateRoomTypeForm(): ValidationErrors {
    const rt = this.currentRoomType();
    const errors: ValidationErrors = {};
    const name = (rt.name || '').trim();

    if (!rt.hotelId) errors['hotelId'] = 'Hotel property is required.';
    if (!name) errors['name'] = 'Room category name is required.';
    else if (name.length < 2) errors['name'] = 'Enter a valid category name.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 .,'&()-]*$/.test(name)) errors['name'] = 'Use letters, numbers and common punctuation only.';
    else if (this.isDuplicateRoomType(name, rt.hotelId, rt.id)) errors['name'] = 'This room category already exists for the selected hotel.';

    if (!this.isPositiveInteger(rt.capacity)) errors['capacity'] = 'Capacity must be at least 1.';
    if (!this.isNonNegativeNumber(rt.basePricePerNight)) errors['basePricePerNight'] = 'Base rate must be 0 or more.';
    if (!this.isPositiveNumber(rt.area)) errors['area'] = 'Area must be greater than 0.';
    if ((rt.description || '').length > 250) errors['description'] = 'Description must be 250 characters or fewer.';

    return errors;
  }

  private validateRoomForm(): ValidationErrors {
    const room = this.currentRoom();
    const errors: ValidationErrors = {};
    const roomNumber = (room.roomNumber || '').trim();
    const hotelId = this.selectedHotelIdForRoomForm();

    if (!hotelId) errors['hotelId'] = 'Hotel property is required.';
    if (!room.floorId) errors['floorId'] = 'Floor is required.';
    if (!room.typeId) errors['typeId'] = 'Room category is required.';

    if (!roomNumber) errors['roomNumber'] = 'Room number is required.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(roomNumber)) errors['roomNumber'] = 'Use letters, numbers, spaces or hyphens only.';
    else if (this.isDuplicateRoom(roomNumber, room.floorId, room.id)) errors['roomNumber'] = 'This room number already exists on the selected floor.';

    if (!this.isPositiveInteger(room.maxOccupancy)) errors['maxOccupancy'] = 'Max occupancy must be at least 1.';
    if ((room.telephone || '').trim() && !this.isValidExtension(room.telephone || '')) errors['telephone'] = 'Enter a valid phone or extension.';

    return errors;
  }

  private validateRatePlanForm(): ValidationErrors {
    const rp = this.currentRatePlan();
    const errors: ValidationErrors = {};
    const name = (rp.name || '').trim();

    if (!name) errors['name'] = 'Rate plan name is required.';
    else if (name.length < 2) errors['name'] = 'Enter a valid rate plan name.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 .,'&()+/-]*$/.test(name)) errors['name'] = 'Use letters, numbers and common punctuation only.';
    else if (this.isDuplicateRatePlan(name, rp.id)) errors['name'] = 'A rate plan with this name already exists.';

    if ((rp.description || '').length > 250) errors['description'] = 'Description must be 250 characters or fewer.';
    if (!this.isFiniteNumber(rp.priceAdjustment)) errors['priceAdjustment'] = 'Price adjustment must be a valid number.';
    else if (Math.abs(Number(rp.priceAdjustment)) > 999999) errors['priceAdjustment'] = 'Price adjustment is too large.';
    if (!this.isNonNegativeInteger(rp.displayOrder)) errors['displayOrder'] = 'Display order must be 0 or more.';

    return errors;
  }

  private isDuplicateHotelName(name: string, id?: number): boolean {
    return this.mastersService.hotels().some(h => h.id !== id && h.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  private isDuplicateFloor(floorNumber: string, hotelId?: number, id?: number): boolean {
    return this.mastersService.floors().some(f => f.id !== id && Number(f.hotelId) === Number(hotelId) && f.floorNumber.trim().toLowerCase() === floorNumber.trim().toLowerCase());
  }

  private isDuplicateRoomType(name: string, hotelId?: number, id?: number): boolean {
    return this.mastersService.roomTypes().some(rt => rt.id !== id && Number(rt.hotelId) === Number(hotelId) && rt.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  private isDuplicateRoom(roomNumber: string, floorId?: number, id?: number): boolean {
    return this.mastersService.rooms().some(room => room.id !== id && Number(room.floorId) === Number(floorId) && room.roomNumber.trim().toLowerCase() === roomNumber.trim().toLowerCase());
  }

  private isDuplicateRatePlan(name: string, id?: number): boolean {
    return this.mastersService.ratePlans().some(rp => rp.id !== id && rp.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  private isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  private isValidExtension(value: string): boolean {
    return /^[A-Za-z0-9 +()-]{2,20}$/.test(value.trim());
  }

  private isValidPlaceName(value: string): boolean {
    if (!value || !value.trim()) return false;
    return /^[A-Za-z0-9][A-Za-z0-9 .,'-]*$/.test(value.trim());
  }

  private isPositiveInteger(value: any): boolean {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1;
  }

  private isNonNegativeInteger(value: any): boolean {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0;
  }

  private isPositiveNumber(value: any): boolean {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  }

  private isNonNegativeNumber(value: any): boolean {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
  }

  private isFiniteNumber(value: any): boolean {
    return Number.isFinite(Number(value));
  }

  // --- Save Operations ---
  saveHotel() {
    this.modalErrorMessage.set(null);
    this.markHotelFieldsTouched();
    if (!this.validateForm('hotels')) {
      const firstError = Object.values(this.formErrors())[0];
      this.modalErrorMessage.set(firstError || 'Please fill in all required fields.');
      return;
    }
    const hotel = {
      ...this.currentHotel(),
      country: (this.currentHotel().country || 'India').trim(),
      zipCode: (this.currentHotel().zipCode || '400001').trim(),
      totalRooms: Number(this.currentHotel().totalRooms || 10)
    };
    this.isSaving.set(true);
    this.mastersService.saveHotel(hotel).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.modalErrorMessage.set(null);
        this.closeModal('hotels');
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err?.error?.message || err?.error?.error?.message || err?.message || 'Error saving hotel property.';
        this.modalErrorMessage.set(msg);
      }
    });
  }

  private markHotelFieldsTouched() {
    this.formSubmitted.set(true);
    this.touchedFields.set({
      name: true, email: true, phone: true, address: true,
      city: true, state: true, country: true, zipCode: true, totalRooms: true
    });
  }

  saveFloor() {
    if (!this.validateForm('floors')) return;
    const floor = this.currentFloor();
    this.isSaving.set(true);
    this.mastersService.saveFloor(floor).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('floors'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving floor: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveRoomType() {
    if (!this.validateForm('room-types')) return;
    const rt = this.currentRoomType();
    this.isSaving.set(true);
    this.mastersService.saveRoomType(rt).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('room-types'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving room type: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveRoom() {
    if (!this.validateForm('rooms')) return;
    const room = this.currentRoom();
    this.isSaving.set(true);
    this.mastersService.saveRoom(room).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('rooms'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving room: ' + (err?.message || 'Unknown error')); }
    });
  }

  saveRatePlan() {
    if (!this.validateForm('rate-plans')) return;
    const ratePlan = this.currentRatePlan();
    this.isSaving.set(true);
    this.mastersService.saveRatePlan(ratePlan).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('rate-plans'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving rate plan: ' + (err?.message || 'Unknown error')); }
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

  // --- Custom Deletion Confirmation Dialog Helpers ---
  triggerDeleteConfirm(title: string, message: string, action: () => void) {
    this.deleteConfirmTitle.set(title);
    this.deleteConfirmMessage.set(message);
    this.pendingDeleteAction = action;
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete() {
    this.isDeleteConfirmOpen.set(false);
    this.pendingDeleteAction = null;
  }

  executeDelete() {
    if (this.pendingDeleteAction) {
      this.pendingDeleteAction();
    }
    this.cancelDelete();
  }

  // --- Delete Operations ---
  deleteHotel(id: number, name: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete Hotel',
      `Are you sure you want to delete Hotel "${name}"? This could leave associated floors and rooms orphaned.`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteHotel(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting hotel: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  deleteFloor(id: number, floorNumber: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete Floor',
      `Are you sure you want to delete Floor "${floorNumber}"?`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteFloor(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting floor: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  deleteRoomType(id: number, name: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete Room Type',
      `Are you sure you want to delete Room Type "${name}"?`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteRoomType(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting room type: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  deleteRoom(id: number, roomNumber: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete Room',
      `Are you sure you want to delete Room #${roomNumber}?`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteRoom(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting room: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  deleteRatePlan(id: number, name: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete Rate Plan',
      `Are you sure you want to delete Rate Plan "${name}"?`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteRatePlan(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting rate plan: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  saveGst() {
    if (!this.validateForm('gst-config')) return;
    const gst = this.currentGst();
    this.isSaving.set(true);
    this.mastersService.saveGst(gst).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('gst-config'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving GST config: ' + (err?.message || 'Unknown error')); }
    });
  }

  toggleGstActive(gst: GstConfig, event: Event) {
    event.stopPropagation();
    this.mastersService.saveGst({ ...gst, isActive: !gst.isActive }).subscribe();
  }

  deleteGst(id: number, serviceCategory: string, event: Event) {
    event.stopPropagation();
    this.triggerDeleteConfirm(
      'Delete GST Configuration',
      `Are you sure you want to delete GST Configuration for "${serviceCategory}"?`,
      () => {
        this.isDeleting.set(true);
        this.mastersService.deleteGst(id).subscribe({
          next: () => this.isDeleting.set(false),
          error: (err) => { this.isDeleting.set(false); alert('Error deleting GST config: ' + (err?.message || 'Unknown error')); }
        });
      }
    );
  }

  onGstRateChange() {
    const cgst = Number(this.currentGst().cgstRate || 0);
    const sgst = Number(this.currentGst().sgstRate || 0);
    this.currentGst.update((g: Partial<GstConfig>) => ({ ...g, igstRate: cgst + sgst }));
  }
}
