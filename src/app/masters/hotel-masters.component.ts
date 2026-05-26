import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HotelMastersService, Hotel, Floor, RoomType, Room, RatePlan } from './hotel-masters.service';

type MasterTab = 'hotels' | 'floors' | 'room-types' | 'rooms' | 'rate-plans';
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
  private readonly router = inject(Router);
  private routerSub?: Subscription;

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

  modalMode = signal<'create' | 'edit'>('create');

  // --- Form Bindings ---
  currentHotel = signal<Partial<Hotel>>({});
  currentFloor = signal<Partial<Floor>>({});
  currentRoomType = signal<Partial<RoomType>>({});
  currentRoom = signal<Partial<Room>>({});
  currentRatePlan = signal<Partial<RatePlan>>({});

  // Saving / deleting state
  isSaving = signal(false);
  isDeleting = signal(false);
  formSubmitted = signal(false);
  touchedFields = signal<Record<string, boolean>>({});
  formErrors = signal<ValidationErrors>({});

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
    } else if (url.includes('/masters/rate-plans')) {
      this.activeTab.set('rate-plans');
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
    this.markFieldTouched('hotelId');
    this.validateForm('rooms', false);
  }

  // --- Modal Open/Close ---
  openCreateModal() {
    this.resetValidation();
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
    } else if (tab === 'rate-plans') {
      this.currentRatePlan.set({
        name: '',
        description: '',
        priceAdjustment: 0,
        displayOrder: this.mastersService.ratePlans().length + 1,
        isActive: true
      });
      this.isRatePlanModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  openEditModal(item: any) {
    this.resetValidation();
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
    } else if (tab === 'rate-plans') {
      this.currentRatePlan.set({ ...item });
      this.isRatePlanModalOpen.set(true);
    }
    document.body.style.overflow = 'hidden';
  }

  closeModal(tab: MasterTab) {
    if (tab === 'hotels') this.isHotelModalOpen.set(false);
    if (tab === 'floors') this.isFloorModalOpen.set(false);
    if (tab === 'room-types') this.isRoomTypeModalOpen.set(false);
    if (tab === 'rooms') this.isRoomModalOpen.set(false);
    if (tab === 'rate-plans') this.isRatePlanModalOpen.set(false);
    this.resetValidation();
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
      this.validateRatePlanForm();

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private validateHotelForm(): ValidationErrors {
    const h = this.currentHotel();
    const errors: ValidationErrors = {};
    const name = (h.name || '').trim();
    const email = (h.email || '').trim();
    const phone = (h.phone || '').trim();
    const zipCode = (h.zipCode || '').trim();

    if (!name) errors['name'] = 'Hotel name is required.';
    else if (name.length < 2) errors['name'] = 'Enter a valid hotel name.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 .,'&()-]*$/.test(name)) errors['name'] = 'Use letters, numbers and common punctuation only.';
    else if (this.isDuplicateHotelName(name, h.id)) errors['name'] = 'A hotel with this name already exists.';

    if (!email) errors['email'] = 'Email address is required.';
    else if (!this.isValidEmail(email)) errors['email'] = 'Enter a valid email address.';

    if (!phone) errors['phone'] = 'Phone number is required.';
    else if (!this.isValidPhone(phone)) errors['phone'] = 'Enter a valid phone number.';

    if (!(h.address || '').trim()) errors['address'] = 'Street address is required.';
    if (!(h.city || '').trim()) errors['city'] = 'City is required.';
    else if (!this.isValidPlaceName(h.city || '')) errors['city'] = 'Enter a valid city name.';

    if (!(h.state || '').trim()) errors['state'] = 'State or region is required.';
    else if (!this.isValidPlaceName(h.state || '')) errors['state'] = 'Enter a valid state or region.';

    if (!(h.country || '').trim()) errors['country'] = 'Country is required.';
    else if (!this.isValidPlaceName(h.country || '')) errors['country'] = 'Enter a valid country.';

    if (!zipCode) errors['zipCode'] = 'Zip code is required.';
    else if (!/^[A-Za-z0-9 -]{4,10}$/.test(zipCode)) errors['zipCode'] = 'Enter a valid zip/post code.';

    if (!this.isPositiveInteger(h.totalRooms)) errors['totalRooms'] = 'Total rooms must be at least 1.';

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
    return /^[A-Za-z][A-Za-z .'-]*$/.test(value.trim());
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
    if (!this.validateForm('hotels')) return;
    const hotel = this.currentHotel();
    this.isSaving.set(true);
    this.mastersService.saveHotel(hotel).subscribe({
      next: () => { this.isSaving.set(false); this.closeModal('hotels'); },
      error: (err) => { this.isSaving.set(false); alert('Error saving hotel: ' + (err?.message || 'Unknown error')); }
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

  deleteRatePlan(id: number, name: string, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete Rate Plan "${name}"?`)) {
      this.isDeleting.set(true);
      this.mastersService.deleteRatePlan(id).subscribe({
        next: () => this.isDeleting.set(false),
        error: (err) => { this.isDeleting.set(false); alert('Error deleting rate plan: ' + (err?.message || 'Unknown error')); }
      });
    }
  }
}
