import { Component, signal, computed, inject, OnInit } from '@angular/core';
// expose Math for template
const math = Math;
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

export interface Room {
  id: string; number: string; type: string; typeShort: string; typeId: string;
  hotelId?: number;
  floor: number; status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';
  rate: number; view: string; beds: string;
}

interface ApiRoomType {
  id: number;
  hotelId?: number;
  name: string;
  capacity?: number;
  basePricePerNight?: number;
  description?: string;
  isActive?: boolean;
}

interface ApiRoom {
  id: number;
  roomNumber: string;
  floorId: number;
  floorNumber?: string;
  roomTypeId: number;
  roomTypeName?: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED' | 'CLEANING';
  maxOccupancy?: number;
  isActive?: boolean;
}

interface ApiRatePlan {
  id: number;
  name: string;
  description?: string;
  priceAdjustment?: number;
  displayOrder?: number;
  isActive?: boolean;
}

interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface GuestRequest {
  title?: 'MR' | 'MRS' | 'MS' | 'MISS' | 'DR' | 'PROF';
  firstName: string;
  lastName: string;
  countryCode?: string;
  phone: string;
  email: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postCode?: string;
  country?: string;
  nationality?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  idProofType?: 'PASSPORT' | 'AADHAR' | 'DRIVING_LICENSE' | 'PAN' | 'VOTER_ID';
  idProofNumber?: string;
  guestNotes?: string;
  preference?: string;
  isVip?: boolean;
}

interface ReservationRequest {
  guestId?: number;
  guestDetails?: GuestRequest;
  hotelId: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  numberOfAdults: number;
  numberOfChildren: number;
  reservationStatus: 'PENDING' | 'CONFIRMED';
  roomIds: number[];
  ratePlanId: number;
  billingName?: string;
  billingAddress?: string;
  specialRequests?: string;
  notes?: string;
}

export interface GuestProfile {
  id?: string;
  title: string;
  fullName: string;
  phoneCode: string;
  phone: string;
  email: string;
  country: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  vip: boolean;
  nationality: string;
  gender: string;
  dob: string;
  idProof: string;
  idNumber: string;
  notes: string;
  visits: number;
  lastVisit?: string;
}

@Component({
  selector: 'app-new-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './new-booking.component.html',
  styleUrls: ['./new-booking.component.css']
})
export class NewBookingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  checkIn = signal('');
  checkOut = signal('');
  checkInTime = signal('14:00');
  checkOutTime = signal('11:00');
  numberOfAdults = signal(2);
  numberOfChildren = signal(0);
  viewMode = signal<'list' | 'map'>('list');
  selectedRoomType = signal<string>('ALL');
  selectedRoom = signal<Room | null>(null);
  selectedPlan = signal<string>('EP');
  selectedFloor = signal<number>(1);
  mapModalOpen = signal(false);
  modalHoveredRoom = signal<Room | null>(null);
  isRoomInventoryLoading = signal(false);
  roomInventoryError = signal<string | null>(null);
  isRatePlanLoading = signal(false);
  ratePlanError = signal<string | null>(null);
  isCreatingReservation = signal(false);
  reservationError = signal<string | null>(null);
  reservationSuccess = signal<string | null>(null);
  private dataRevision = signal(0);

  // Guest State
  guestData = signal<GuestProfile>({
    title: 'Mr.', fullName: '', phoneCode: '+91 (India)', phone: '', email: '',
    country: 'India', address1: '', address2: '', city: '', state: '', zip: '',
    vip: false, nationality: '', gender: '', dob: '', idProof: 'Aadhar Card', idNumber: '', notes: '', visits: 0
  });

  searchGuestModalOpen = signal(false);
  createGuestModalOpen = signal(false);
  searchQuery = signal('');
  
  mockGuests: GuestProfile[] = [
    { id: 'G1001', title: 'Mr.', fullName: 'Rajesh Kumar', phoneCode: '+91 (India)', phone: '9876543210', email: 'rajesh.k@example.com', country: 'India', address1: '123 Park Street', address2: '', city: 'Mumbai', state: 'MH', zip: '400001', vip: true, nationality: 'Indian', gender: 'Male', dob: '1985-06-15', idProof: 'Aadhar Card', idNumber: '1234 5678 9012', notes: 'Prefers quiet rooms.', visits: 5, lastVisit: '2026-03-10' },
    { id: 'G1002', title: 'Ms.', fullName: 'Sarah Jenkins', phoneCode: '+1 (USA)', phone: '555-0198', email: 's.jenkins@example.com', country: 'USA', address1: '456 Oak Lane', address2: 'Apt 4B', city: 'New York', state: 'NY', zip: '10001', vip: false, nationality: 'American', gender: 'Female', dob: '1990-11-20', idProof: 'Passport', idNumber: 'P1234567', notes: 'Allergic to peanuts.', visits: 1, lastVisit: '2025-12-05' },
    { id: 'G1003', title: 'Dr.', fullName: 'Amitabh Sharma', phoneCode: '+91 (India)', phone: '9123456789', email: 'dr.sharma@example.com', country: 'India', address1: '789 Clinic Road', address2: '', city: 'Delhi', state: 'DL', zip: '110001', vip: true, nationality: 'Indian', gender: 'Male', dob: '1975-02-28', idProof: 'Aadhar Card', idNumber: '9876 5432 1098', notes: 'Requires early check-in.', visits: 12, lastVisit: '2026-05-01' }
  ];

  roomTypes = [
    { id: 'ALL', label: 'All Types', icon: 'meeting_room' },
    { id: 'STD', label: 'Standard', icon: 'single_bed' },
    { id: 'DLX', label: 'Deluxe', icon: 'hotel' },
    { id: 'SUP', label: 'Superior', icon: 'king_bed' },
    { id: 'STE', label: 'Suite', icon: 'villa' },
    { id: 'PNT', label: 'Penthouse', icon: 'apartment' },
  ];

  ratePlans = [
    { id: 'EP',  shortLabel: 'EP',  label: 'European Plan',        desc: 'Room Only',                    extra: 0,    icon: 'bed' },
    { id: 'CP',  shortLabel: 'CP',  label: 'Continental Plan',     desc: 'Room + Breakfast',             extra: 500,  icon: 'free_breakfast' },
    { id: 'MAP', shortLabel: 'MAP', label: 'Modified American',    desc: 'Room + Breakfast + Dinner',    extra: 900,  icon: 'restaurant' },
    { id: 'AP',  shortLabel: 'AP',  label: 'American Plan',        desc: 'All Meals Included',           extra: 1400, icon: 'restaurant_menu' },
  ];

  floors = [
    { number: 1, label: 'Floor 1' }, { number: 2, label: 'Floor 2' },
    { number: 3, label: 'Floor 3' }, { number: 4, label: 'Floor 4' },
  ];

  allRooms: Room[] = [
    // Floor 1
    { id:'101', number:'101', type:'Standard',  typeShort:'STD', typeId:'STD', floor:1, status:'Available',   rate:3500, view:'Garden',    beds:'Twin' },
    { id:'102', number:'102', type:'Standard',  typeShort:'STD', typeId:'STD', floor:1, status:'Occupied',    rate:3500, view:'Garden',    beds:'Twin' },
    { id:'103', number:'103', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:1, status:'Available',   rate:5000, view:'Pool',      beds:'King' },
    { id:'104', number:'104', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:1, status:'Reserved',    rate:5000, view:'Pool',      beds:'King' },
    { id:'105', number:'105', type:'Standard',  typeShort:'STD', typeId:'STD', floor:1, status:'Available',   rate:3500, view:'Garden',    beds:'Twin' },
    { id:'106', number:'106', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:1, status:'Maintenance', rate:7000, view:'Sea',       beds:'King' },
    { id:'107', number:'107', type:'Standard',  typeShort:'STD', typeId:'STD', floor:1, status:'Occupied',    rate:3500, view:'Garden',    beds:'Twin' },
    { id:'108', number:'108', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:1, status:'Available',   rate:5000, view:'Garden',    beds:'Queen' },
    { id:'109', number:'109', type:'Standard',  typeShort:'STD', typeId:'STD', floor:1, status:'Available',   rate:3500, view:'Garden',    beds:'Twin' },
    { id:'110', number:'110', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:1, status:'Occupied',    rate:5000, view:'Pool',      beds:'King' },
    // Floor 2
    { id:'201', number:'201', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:2, status:'Available',   rate:5200, view:'Sea',       beds:'King' },
    { id:'202', number:'202', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:2, status:'Available',   rate:7200, view:'Sea',       beds:'King' },
    { id:'203', number:'203', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:2, status:'Reserved',    rate:7200, view:'Pool',      beds:'King' },
    { id:'204', number:'204', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:2, status:'Occupied',    rate:5200, view:'Sea',       beds:'Queen' },
    { id:'205', number:'205', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:2, status:'Available',   rate:5200, view:'Pool',      beds:'Queen' },
    { id:'206', number:'206', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:2, status:'Available',   rate:7200, view:'Sea',       beds:'King' },
    { id:'207', number:'207', type:'Standard',  typeShort:'STD', typeId:'STD', floor:2, status:'Available',   rate:3700, view:'Garden',    beds:'Twin' },
    { id:'208', number:'208', type:'Suite',     typeShort:'STE', typeId:'STE', floor:2, status:'Available',   rate:12000,view:'Sea',       beds:'King' },
    { id:'209', number:'209', type:'Suite',     typeShort:'STE', typeId:'STE', floor:2, status:'Occupied',    rate:12000,view:'Sea',       beds:'King' },
    { id:'210', number:'210', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:2, status:'Available',   rate:5200, view:'Pool',      beds:'King' },
    // Floor 3
    { id:'301', number:'301', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:3, status:'Available',   rate:7500, view:'Sea',       beds:'King' },
    { id:'302', number:'302', type:'Suite',     typeShort:'STE', typeId:'STE', floor:3, status:'Available',   rate:12500,view:'Sea',       beds:'King' },
    { id:'303', number:'303', type:'Suite',     typeShort:'STE', typeId:'STE', floor:3, status:'Reserved',    rate:12500,view:'Pool',      beds:'King' },
    { id:'304', number:'304', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:3, status:'Occupied',    rate:7500, view:'Sea',       beds:'Queen' },
    { id:'305', number:'305', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:3, status:'Available',   rate:5500, view:'Sea',       beds:'King' },
    { id:'306', number:'306', type:'Suite',     typeShort:'STE', typeId:'STE', floor:3, status:'Available',   rate:12500,view:'Ocean',     beds:'King' },
    { id:'307', number:'307', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:3, status:'Available',   rate:7500, view:'Sea',       beds:'King' },
    { id:'308', number:'308', type:'Deluxe',    typeShort:'DLX', typeId:'DLX', floor:3, status:'Maintenance', rate:5500, view:'Pool',      beds:'Queen' },
    { id:'309', number:'309', type:'Suite',     typeShort:'STE', typeId:'STE', floor:3, status:'Available',   rate:12500,view:'Sea',       beds:'King' },
    { id:'310', number:'310', type:'Superior',  typeShort:'SUP', typeId:'SUP', floor:3, status:'Occupied',    rate:7500, view:'Sea',       beds:'King' },
    // Floor 4
    { id:'401', number:'401', type:'Suite',      typeShort:'STE', typeId:'STE', floor:4, status:'Available',  rate:15000,view:'Panoramic', beds:'King' },
    { id:'402', number:'402', type:'Suite',      typeShort:'STE', typeId:'STE', floor:4, status:'Occupied',   rate:15000,view:'Panoramic', beds:'King' },
    { id:'403', number:'403', type:'Penthouse',  typeShort:'PNT', typeId:'PNT', floor:4, status:'Available',  rate:25000,view:'Panoramic', beds:'King' },
    { id:'404', number:'404', type:'Suite',      typeShort:'STE', typeId:'STE', floor:4, status:'Available',  rate:15000,view:'Panoramic', beds:'King' },
    { id:'405', number:'405', type:'Penthouse',  typeShort:'PNT', typeId:'PNT', floor:4, status:'Reserved',   rate:25000,view:'Panoramic', beds:'King' },
    { id:'406', number:'406', type:'Suite',      typeShort:'STE', typeId:'STE', floor:4, status:'Available',  rate:15000,view:'Sea',       beds:'King' },
    { id:'407', number:'407', type:'Suite',      typeShort:'STE', typeId:'STE', floor:4, status:'Occupied',   rate:15000,view:'Sea',       beds:'King' },
    { id:'408', number:'408', type:'Penthouse',  typeShort:'PNT', typeId:'PNT', floor:4, status:'Available',  rate:25000,view:'Panoramic', beds:'King' },
  ];

  ngOnInit() {
    this.loadRoomInventory();
    this.loadRatePlans();
  }

  loadRoomInventory() {
    this.isRoomInventoryLoading.set(true);
    this.roomInventoryError.set(null);

    forkJoin({
      roomTypes: this.http.get<StandardResponse<ApiRoomType[]>>(`${this.baseUrl}/roomTypes/getAllRoomTypes?page=0&size=50`),
      rooms: this.http.get<StandardResponse<ApiRoom[]>>(`${this.baseUrl}/rooms/getAllRooms?page=0&size=10`)
    }).subscribe({
      next: ({ roomTypes, rooms }) => {
        const activeTypes = (roomTypes.data ?? []).filter(rt => rt.isActive !== false);
        const typeMap = new Map(activeTypes.map(rt => [rt.id, rt]));

        this.roomTypes = [
          { id: 'ALL', label: 'All Types', icon: 'meeting_room' },
          ...activeTypes.map(rt => ({
            id: String(rt.id),
            label: rt.name,
            icon: this.iconForRoomType(rt.name)
          }))
        ];

        this.allRooms = (rooms.data ?? [])
          .filter(room => room.isActive !== false)
          .map(room => this.mapApiRoom(room, typeMap));

        this.ensureSelectedFloorExists();
        this.selectedRoom.set(null);
        this.dataRevision.update(value => value + 1);
        this.isRoomInventoryLoading.set(false);
      },
      error: (err) => {
        console.error('[NewBookingComponent] loadRoomInventory error:', err);
        this.roomInventoryError.set('Unable to load room inventory.');
        this.isRoomInventoryLoading.set(false);
      }
    });
  }

  loadRatePlans() {
    this.isRatePlanLoading.set(true);
    this.ratePlanError.set(null);

    this.http.get<StandardResponse<ApiRatePlan[]>>(`${this.baseUrl}/ratePlans/getAllRatePlans?page=0&size=50`).subscribe({
      next: (response) => {
        const plans = (response.data ?? [])
          .filter(plan => plan.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

        this.ratePlans = plans.map(plan => this.mapApiRatePlan(plan));
        if (this.ratePlans.length > 0 && !this.ratePlans.some(plan => plan.id === this.selectedPlan())) {
          this.selectedPlan.set(this.ratePlans[0].id);
        }

        this.dataRevision.update(value => value + 1);
        this.isRatePlanLoading.set(false);
      },
      error: (err) => {
        console.error('[NewBookingComponent] loadRatePlans error:', err);
        this.ratePlanError.set('Unable to load rate plans.');
        this.isRatePlanLoading.set(false);
      }
    });
  }

  private mapApiRatePlan(plan: ApiRatePlan) {
    return {
      id: String(plan.id),
      shortLabel: this.shortCodeForRatePlan(plan.name, plan.id),
      label: plan.name,
      desc: plan.description || 'Room Rate Only',
      extra: Number(plan.priceAdjustment ?? 0),
      icon: this.iconForRatePlan(plan.name, plan.description)
    };
  }

  private shortCodeForRatePlan(name: string, id: number): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const code = words.length > 1
      ? words.map(word => word[0]).join('')
      : name.slice(0, 3);
    return (code || `RP${id}`).toUpperCase();
  }

  private iconForRatePlan(name: string, description?: string): string {
    const text = `${name} ${description || ''}`.toLowerCase();
    if (text.includes('breakfast')) return 'free_breakfast';
    if (text.includes('dinner') || text.includes('meal')) return 'restaurant';
    if (text.includes('american')) return 'restaurant_menu';
    return 'bed';
  }

  private mapApiRoom(room: ApiRoom, typeMap: Map<number, ApiRoomType>): Room {
    const roomType = typeMap.get(room.roomTypeId);
    const typeName = room.roomTypeName || roomType?.name || `Room Type ${room.roomTypeId}`;

    return {
      id: String(room.id),
      number: room.roomNumber,
      type: typeName,
      typeShort: this.shortCodeForRoomType(typeName, room.roomTypeId),
      typeId: String(room.roomTypeId),
      hotelId: roomType?.hotelId,
      floor: room.floorId,
      status: this.mapRoomStatus(room.status),
      rate: Number(roomType?.basePricePerNight ?? 0),
      view: room.floorNumber || `Floor ${room.floorId}`,
      beds: `${room.maxOccupancy || 1} Pax`
    };
  }

  private mapRoomStatus(status: ApiRoom['status']): Room['status'] {
    if (status === 'VACANT') return 'Available';
    if (status === 'OCCUPIED') return 'Occupied';
    if (status === 'RESERVED') return 'Reserved';
    return 'Maintenance';
  }

  private iconForRoomType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('suite')) return 'villa';
    if (lower.includes('pent')) return 'apartment';
    if (lower.includes('lux') || lower.includes('delux')) return 'hotel';
    if (lower.includes('superior')) return 'king_bed';
    if (lower.includes('standard')) return 'single_bed';
    return 'bed';
  }

  private shortCodeForRoomType(name: string, id: number): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const code = words.length > 1
      ? words.map(word => word[0]).join('')
      : name.slice(0, 3);
    return (code || `RT${id}`).toUpperCase();
  }

  private ensureSelectedFloorExists() {
    const floorIds = Array.from(new Set(this.allRooms.map(room => room.floor))).sort((a, b) => a - b);
    if (floorIds.length > 0) {
      this.floors = floorIds.map(floor => ({ number: floor, label: `Floor ${floor}` }));
      if (!floorIds.includes(this.selectedFloor())) {
        this.selectedFloor.set(floorIds[0]);
      }
    }
  }

  availableCountFor(typeId: string): number {
    this.dataRevision();
    if (typeId === 'ALL') return this.allRooms.filter(r => r.status === 'Available').length;
    return this.allRooms.filter(r => r.typeId === typeId && r.status === 'Available').length;
  }

  filteredRooms = computed(() => {
    this.dataRevision();
    const type = this.selectedRoomType();
    if (type === 'ALL') return this.allRooms.filter(r => r.status === 'Available');
    return this.allRooms.filter(r => r.typeId === type && r.status === 'Available');
  });

  currentFloorRooms = computed(() => {
    this.dataRevision();
    return this.allRooms.filter(r => r.floor === this.selectedFloor());
  });

  nights = computed(() => {
    if (!this.checkIn() || !this.checkOut()) return 1;
    const diff = new Date(this.checkOut()).getTime() - new Date(this.checkIn()).getTime();
    return Math.max(1, Math.ceil(diff / 86400000));
  });

  totalPrice = computed(() => {
    const room = this.selectedRoom();
    const plan = this.ratePlans.find(p => p.id === this.selectedPlan());
    return ((room?.rate ?? 5000) + (plan?.extra ?? 0)) * this.nights();
  });

  selectedPlanDetails = computed(() => {
    this.dataRevision();
    return this.ratePlans.find(p => p.id === this.selectedPlan()) ?? this.ratePlans[0] ?? {
      id: '',
      shortLabel: '',
      label: 'Rate Plan',
      desc: 'Room Rate Only',
      extra: 0,
      icon: 'bed'
    };
  });

  taxAmount  = computed(() => math.round(this.totalPrice() * 0.12));
  grandTotal = computed(() => math.round(this.totalPrice() * 1.12));

  canConfirmBooking = computed(() =>
    !!this.selectedRoom() &&
    !!this.selectedPlan() &&
    !!this.checkIn() &&
    !!this.checkOut() &&
    !!this.guestData().fullName &&
    !!this.guestData().phone &&
    !!this.guestData().email &&
    !this.isCreatingReservation()
  );

  setViewMode(mode: 'list' | 'map') { this.viewMode.set(mode); }
  selectRoomType(id: string) { this.selectedRoomType.set(id); this.selectedRoom.set(null); }
  selectRoom(room: Room) { if (room.status === 'Available') this.selectedRoom.set(room); }
  selectPlan(id: string) { this.selectedPlan.set(id); }
  selectFloor(num: number) { this.selectedFloor.set(num); }

  openMapModal()  { this.mapModalOpen.set(true);  document.body.style.overflow = 'hidden'; }
  closeMapModal() { this.mapModalOpen.set(false); document.body.style.overflow = ''; }

  confirmModalRoom() {
    this.closeMapModal();
    this.viewMode.set('map');
  }

  hoverRoom(room: Room | null) { this.modalHoveredRoom.set(room); }

  floorStats = computed(() => {
    this.dataRevision();
    const fl = this.selectedFloor();
    const rooms = this.allRooms.filter(r => r.floor === fl);
    return {
      total:       rooms.length,
      available:   rooms.filter(r => r.status === 'Available').length,
      occupied:    rooms.filter(r => r.status === 'Occupied').length,
      reserved:    rooms.filter(r => r.status === 'Reserved').length,
      maintenance: rooms.filter(r => r.status === 'Maintenance').length,
    };
  });

  modalActiveRoom = computed(() => this.modalHoveredRoom() ?? this.selectedRoom());

  // Guest Methods
  openSearchGuest() { this.searchGuestModalOpen.set(true); document.body.style.overflow = 'hidden'; this.searchQuery.set(''); }
  closeSearchGuest() { this.searchGuestModalOpen.set(false); document.body.style.overflow = ''; }
  
  openCreateGuest() { 
    this.createGuestModalOpen.set(true); 
    document.body.style.overflow = 'hidden'; 
    // Reset form for new guest
    this.guestData.set({
      title: 'Mr.', fullName: '', phoneCode: '+91 (India)', phone: '', email: '',
      country: 'India', address1: '', address2: '', city: '', state: '', zip: '',
      vip: false, nationality: '', gender: '', dob: '', idProof: 'Aadhar Card', idNumber: '', notes: '', visits: 0
    });
  }
  closeCreateGuest() { this.createGuestModalOpen.set(false); document.body.style.overflow = ''; }

  filteredGuests = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return [];
    return this.mockGuests.filter(g => g.fullName.toLowerCase().includes(q) || g.phone.includes(q) || g.email.toLowerCase().includes(q));
  });

  selectGuest(guest: GuestProfile) {
    this.guestData.set({ ...guest });
    this.closeSearchGuest();
  }

  saveNewGuest() {
    // In a real app, this would save to backend.
    const newGuest = { ...this.guestData(), id: 'G' + Math.floor(Math.random() * 10000), visits: 0 };
    this.mockGuests.push(newGuest);
    this.guestData.set(newGuest); // Set as selected
    this.closeCreateGuest();
    console.log('Guest created:', newGuest);
  }

  updateGuestField(field: keyof GuestProfile, value: any) {
    this.guestData.update(data => ({ ...data, [field]: value }));
  }

  confirmBooking() {
    this.reservationError.set(null);
    this.reservationSuccess.set(null);

    const validationError = this.validateReservation();
    if (validationError) {
      this.reservationError.set(validationError);
      return;
    }

    const payload = this.buildReservationPayload('CONFIRMED');
    this.isCreatingReservation.set(true);

    this.http.post<StandardResponse<any>>(`${this.baseUrl}/frontOffice/createReservation`, payload).subscribe({
      next: (response) => {
        this.isCreatingReservation.set(false);
        this.reservationSuccess.set(response.message || 'Reservation created successfully.');
      },
      error: (err) => {
        console.error('[NewBookingComponent] createReservation error:', err);
        this.isCreatingReservation.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to create reservation.');
      }
    });
  }

  saveDraft() {
    this.reservationError.set(null);
    this.reservationSuccess.set(null);

    const validationError = this.validateReservation();
    if (validationError) {
      this.reservationError.set(validationError);
      return;
    }

    const payload = this.buildReservationPayload('PENDING');
    this.isCreatingReservation.set(true);

    this.http.post<StandardResponse<any>>(`${this.baseUrl}/frontOffice/createReservation`, payload).subscribe({
      next: (response) => {
        this.isCreatingReservation.set(false);
        this.reservationSuccess.set(response.message || 'Reservation draft saved.');
      },
      error: (err) => {
        console.error('[NewBookingComponent] saveDraft reservation error:', err);
        this.isCreatingReservation.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to save reservation draft.');
      }
    });
  }

  private validateReservation(): string | null {
    if (!this.guestData().fullName.trim()) return 'Please enter guest full name.';
    if (!this.guestData().phone.trim()) return 'Please enter guest phone number.';
    if (!this.guestData().email.trim()) return 'Please enter guest email address.';
    if (!this.checkIn()) return 'Please select arrival date.';
    if (!this.checkOut()) return 'Please select departure date.';
    if (!this.selectedRoom()) return 'Please select an available room.';
    if (!this.selectedPlan()) return 'Please select a rate plan.';
    if (this.numberOfAdults() < 1) return 'At least one adult is required.';
    return null;
  }

  private buildReservationPayload(status: 'PENDING' | 'CONFIRMED'): ReservationRequest {
    const room = this.selectedRoom()!;
    const guestId = this.getNumericGuestId();
    const payload: ReservationRequest = {
      hotelId: room.hotelId ?? 1,
      checkInDate: this.checkIn(),
      checkInTime: this.toApiTime(this.checkInTime()),
      checkOutDate: this.checkOut(),
      checkOutTime: this.toApiTime(this.checkOutTime()),
      numberOfAdults: this.numberOfAdults(),
      numberOfChildren: this.numberOfChildren(),
      reservationStatus: status,
      roomIds: [Number(room.id)],
      ratePlanId: Number(this.selectedPlan()),
      billingName: this.guestData().fullName,
      billingAddress: [this.guestData().address1, this.guestData().address2, this.guestData().city, this.guestData().state, this.guestData().zip]
        .filter(Boolean)
        .join(', '),
      notes: this.guestData().notes
    };

    if (guestId) {
      payload.guestId = guestId;
    } else {
      payload.guestDetails = this.buildGuestDetailsPayload();
    }

    return payload;
  }

  private buildGuestDetailsPayload(): GuestRequest {
    const guest = this.guestData();
    const { firstName, lastName } = this.splitGuestName(guest.fullName);

    return {
      title: this.mapGuestTitle(guest.title),
      firstName,
      lastName,
      countryCode: this.extractCountryCode(guest.phoneCode),
      phone: guest.phone,
      email: guest.email,
      addressLine1: guest.address1,
      addressLine2: guest.address2,
      city: guest.city,
      state: guest.state,
      postCode: guest.zip,
      country: guest.country,
      nationality: guest.nationality,
      gender: this.mapGender(guest.gender),
      dateOfBirth: guest.dob || undefined,
      idProofType: this.mapIdProof(guest.idProof),
      idProofNumber: guest.idNumber,
      guestNotes: guest.notes,
      isVip: guest.vip
    };
  }

  private getNumericGuestId(): number | undefined {
    const id = this.guestData().id;
    if (!id) return undefined;
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private splitGuestName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || fullName.trim();
    const lastName = parts.join(' ') || firstName;
    return { firstName, lastName };
  }

  private toApiTime(value: string): string {
    const [hour = '00', minute = '00'] = value.split(':');
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
  }

  private extractCountryCode(value: string): string {
    return value.split(' ')[0] || value;
  }

  private mapGuestTitle(value: string): GuestRequest['title'] {
    if (value === 'Mrs.') return 'MRS';
    if (value === 'Ms.') return 'MS';
    if (value === 'Dr.') return 'DR';
    return 'MR';
  }

  private mapGender(value: string): GuestRequest['gender'] | undefined {
    if (value === 'Male') return 'MALE';
    if (value === 'Female') return 'FEMALE';
    if (value) return 'OTHER';
    return undefined;
  }

  private mapIdProof(value: string): GuestRequest['idProofType'] {
    if (value === 'Passport') return 'PASSPORT';
    if (value === 'Driving License') return 'DRIVING_LICENSE';
    return 'AADHAR';
  }

  goBack() { window.history.back(); }

  formatINR(val: number): string {
    return '₹' + val.toLocaleString('en-IN');
  }
}
