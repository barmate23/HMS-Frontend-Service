import { Component, signal, computed, inject, OnInit } from '@angular/core';
// expose Math for template
const math = Math;
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

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
  floorId?: number;
  floorNumber?: string | null;
  floor?: number | string | { id?: number; floorId?: number; floorNumber?: string; name?: string };
  roomTypeId?: number;
  roomTypeName?: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED' | 'CLEANING';
  maxOccupancy?: number;
  isActive?: boolean;
  basePricePerNight?: number;
}

interface ApiRatePlan {
  id: number;
  name: string;
  description?: string;
  priceAdjustment?: number;
  displayOrder?: number;
  isActive?: boolean;
}

interface ApiGstRule {
  id?: number;
  serviceCategory: string;
  hsnSacCode?: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  description?: string;
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
  gstPercent: number;
  numberOfChildren: number;
  reservationStatus: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
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

export interface AccompanyingMember {
  title: string;
  fullName: string;
  gender: string;
  dob: string;
  relationship?: string;
  idProof: string;
  idNumber: string;
}

type BookingValidationField =
  'fullName' | 'phone' | 'email' | 'zip' | 'dob' | 'idNumber' |
  'checkIn' | 'checkOut' | 'adults' | 'children' | 'room' | 'plan';

@Component({
  selector: 'app-new-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './new-booking.component.html',
  styleUrls: ['./new-booking.component.css']
})
export class NewBookingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly frontOfficeBaseUrl = '/api/frontOfficeService/v1';
  private readonly masterBaseUrl = '/api/masterService/v1';
  readonly todayIso = this.toDateInputValue(new Date());

  checkIn = signal('');
  checkOut = signal('');
  checkInTime = signal('14:00');
  checkOutTime = signal('11:00');
  numberOfAdults = signal(2);
  numberOfChildren = signal(0);
  viewMode = signal<'list' | 'map'>('list');
  selectedRoomType = signal<string>('ALL');
  selectedRooms = signal<Room[]>([]);
  selectedPlan = signal<string>('EP');
  selectedFloor = signal<number>(1);
  mapModalOpen = signal(false);
  modalHoveredRoom = signal<Room | null>(null);
  isRoomInventoryLoading = signal(false);
  roomInventoryError = signal<string | null>(null);
  isAvailableRoomsLoading = signal(false);
  isRatePlanLoading = signal(false);
  ratePlanError = signal<string | null>(null);
  isCreatingReservation = signal(false);
  reservationError = signal<string | null>(null);
  reservationSuccess = signal<string | null>(null);
  editReservationId = signal<string | null>(null);
  editReservationStatus = signal<ReservationRequest['reservationStatus']>('CONFIRMED');
  editHotelId = signal<number | null>(null);
  isLoadingReservationForEdit = signal(false);
  touchedFields = signal<Partial<Record<BookingValidationField, boolean>>>({});
  formSubmitted = signal(false);
  private dataRevision = signal(0);
  private pendingEditDetails: any | null = null;

  // Guest State
  guestData = signal<GuestProfile>({
    title: 'Mr.', fullName: '', phoneCode: '+91 (India)', phone: '', email: '',
    country: 'India', address1: '', address2: '', city: '', state: '', zip: '',
    vip: false, nationality: '', gender: '', dob: '', idProof: 'Aadhar Card', idNumber: '', notes: '', visits: 0
  });

  // Companion State
  accompanyingMembers = signal<AccompanyingMember[]>([]);

  addAccompanyingMember() {
    this.accompanyingMembers.update(members => [
      ...members,
      {
        title: 'Mr.',
        fullName: '',
        gender: '',
        dob: '',
        relationship: '',
        idProof: 'Aadhar Card',
        idNumber: ''
      }
    ]);
  }

  removeAccompanyingMember(index: number) {
    this.accompanyingMembers.update(members => members.filter((_, i) => i !== index));
  }

  searchGuestModalOpen = signal(false);
  createGuestModalOpen = signal(false);
  searchQuery = signal('');
  createGuestError = signal<string | null>(null);
  createGuestSubmitted = signal(false);
  createGuestTouched = signal<Record<string, boolean>>({});
  bookingToast = signal<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false,
    type: 'success',
    title: '',
    message: ''
  });
  
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
  private availableRoomIds = new Set<string>();
  gstRules = signal<ApiGstRule[]>([]);

  isEditMode = computed(() => !!this.editReservationId());

  ngOnInit() {
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    if (reservationId) {
      this.editReservationId.set(reservationId);
      this.loadReservationForEdit(reservationId);
    }

    this.loadRoomInventory();
    this.loadRatePlans();
    this.loadGstRules();
  }

  loadGstRules() {
    this.http.get<StandardResponse<ApiGstRule[]>>(`${this.masterBaseUrl}/gstRules/getAllGstRules`).subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          this.gstRules.set(response.data);
        }
      },
      error: (err) => {
        console.error('[NewBookingComponent] failed to load gst rules:', err);
      }
    });
  }

  loadRoomInventory() {
    this.isRoomInventoryLoading.set(true);
    this.roomInventoryError.set(null);

    forkJoin({
      roomTypes: this.http.get<StandardResponse<ApiRoomType[]>>(`${this.masterBaseUrl}/roomTypes/getAllRoomTypes?page=0&size=50`),
      rooms: this.http.get<StandardResponse<ApiRoom[]>>(`${this.masterBaseUrl}/rooms/getAllRooms?page=0&size=500`)
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
        if (this.pendingEditDetails) {
          this.applyReservationForEdit(this.pendingEditDetails);
        } else {
          this.selectedRooms.set([]);
        }
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

  loadAvailableRoomsForStay() {
    if (!this.checkIn() || !this.checkOut()) return;

    this.isAvailableRoomsLoading.set(true);
    this.roomInventoryError.set(null);

    this.http.get<StandardResponse<ApiRoom[]>>(`${this.frontOfficeBaseUrl}/rooms/available?checkIn=${this.checkIn()}&checkOut=${this.checkOut()}`).subscribe({
      next: (response) => {
        const typeMap = this.buildRoomTypeMap();
        this.setAvailableRoomsForStay(response.data ?? [], typeMap);
        this.selectedRooms.set([]);
        this.dataRevision.update(value => value + 1);
        this.isAvailableRoomsLoading.set(false);
      },
      error: (err) => {
        console.error('[NewBookingComponent] loadAvailableRoomsForStay error:', err);
        this.roomInventoryError.set(err?.error?.message || err?.error?.error?.message || 'Unable to load available rooms for selected stay.');
        this.isAvailableRoomsLoading.set(false);
      }
    });
  }

  onStayDateChange(field: 'checkIn' | 'checkOut', value: string) {
    if (field === 'checkIn') {
      this.checkIn.set(value);
      if (this.checkOut() && this.compareDateInput(this.checkOut(), this.minCheckOutDate()) < 0) {
        this.checkOut.set('');
        this.selectedRooms.set([]);
      }
    } else {
      this.checkOut.set(value);
    }
    this.loadAvailableRoomsForStay();
  }

  private buildRoomTypeMap(): Map<number, ApiRoomType> {
    const map = new Map<number, ApiRoomType>();
    this.roomTypes
      .filter(rt => rt.id !== 'ALL')
      .forEach(rt => {
        const id = Number(rt.id);
        if (Number.isFinite(id)) {
          map.set(id, {
            id,
            name: rt.label
          });
        }
      });
    return map;
  }

  private setAvailableRoomsForStay(availableRooms: ApiRoom[], typeMap: Map<number, ApiRoomType>) {
    const mappedRooms = availableRooms.map(room => this.mapApiRoom({ ...room, status: 'VACANT' }, typeMap));
    this.availableRoomIds = new Set(mappedRooms.map(room => room.id));

    const roomsById = new Map(this.allRooms.map(room => [room.id, room]));
    for (const room of mappedRooms) {
      roomsById.set(room.id, {
        ...roomsById.get(room.id),
        ...room,
        status: 'Available'
      });
    }

    this.allRooms = Array.from(roomsById.values())
      .sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    this.ensureSelectedFloorExists();
  }

  loadRatePlans() {
    this.isRatePlanLoading.set(true);
    this.ratePlanError.set(null);

    this.http.get<StandardResponse<ApiRatePlan[]>>(`${this.masterBaseUrl}/ratePlans/getAllRatePlans?page=0&size=50`).subscribe({
      next: (response) => {
        const plans = (response.data ?? [])
          .filter(plan => plan.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

        this.ratePlans = plans.map(plan => this.mapApiRatePlan(plan));
        if (!this.isEditMode() && this.ratePlans.length > 0 && !this.ratePlans.some(plan => plan.id === this.selectedPlan())) {
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
    const roomTypeId = Number(room.roomTypeId ?? 0);
    const floor = this.resolveRoomFloor(room);
    const roomType = typeMap.get(roomTypeId);
    const typeName = room.roomTypeName || roomType?.name || (roomTypeId ? `Room Type ${roomTypeId}` : 'Room');

    return {
      id: String(room.id),
      number: room.roomNumber,
      type: typeName,
      typeShort: this.shortCodeForRoomType(typeName, roomTypeId || room.id),
      typeId: String(roomTypeId || typeName),
      hotelId: roomType?.hotelId,
      floor,
      status: this.mapRoomStatus(room.status),
      rate: Number(room.basePricePerNight ?? roomType?.basePricePerNight ?? 0),
      view: this.resolveFloorLabel(room, floor),
      beds: `${room.maxOccupancy || 1} Pax`
    };
  }

  private resolveRoomFloor(room: ApiRoom): number {
    const candidates = [
      room.floorId,
      typeof room.floor === 'object' ? room.floor.id : room.floor,
      typeof room.floor === 'object' ? room.floor.floorId : undefined,
      room.floorNumber,
      typeof room.floor === 'object' ? room.floor.floorNumber : undefined,
      room.roomNumber
    ];

    for (const value of candidates) {
      const parsed = this.parseFloorNumber(value);
      if (parsed) return parsed;
    }

    return 1;
  }

  private parseFloorNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    const text = String(value).trim();
    const explicitFloor = text.match(/floor\s*(\d+)/i);
    if (explicitFloor) return Number(explicitFloor[1]);
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0 && numeric < 100) return numeric;
    if (Number.isFinite(numeric) && numeric >= 100) return Math.max(1, Math.floor(numeric / 100));
    const leadingDigits = text.match(/^(\d+)/);
    return leadingDigits ? Math.max(1, Math.floor(Number(leadingDigits[1]) / 100)) : null;
  }

  private resolveFloorLabel(room: ApiRoom, floor: number): string {
    const floorNumber = typeof room.floor === 'object' ? room.floor.floorNumber : room.floorNumber;
    const text = floorNumber ? String(floorNumber).trim() : '';
    if (text && !/^null$/i.test(text)) {
      return /^floor/i.test(text) ? text : `Floor ${text}`;
    }
    return `Floor ${floor}`;
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
    const floorIds = Array.from(new Set(this.allRooms.map(room => room.floor)))
      .filter(floor => Number.isFinite(floor) && floor > 0)
      .sort((a, b) => a - b);
    if (floorIds.length > 0) {
      this.floors = floorIds.map(floor => ({ number: floor, label: `Floor ${floor}` }));
      if (!floorIds.includes(this.selectedFloor())) {
        this.selectedFloor.set(floorIds[0]);
      }
    }
  }

  private loadReservationForEdit(id: string) {
    this.isLoadingReservationForEdit.set(true);
    this.reservationError.set(null);

    this.http.get<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/getReservationById/${id}`).subscribe({
      next: (response) => {
        const details = response.data;
        this.pendingEditDetails = details;
        this.applyReservationForEdit(details);
        this.isLoadingReservationForEdit.set(false);
      },
      error: (err) => {
        console.error('[NewBookingComponent] getReservationById error:', err);
        this.isLoadingReservationForEdit.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to load reservation details.');
      }
    });
  }

  private applyReservationForEdit(details: any) {
    if (!details) return;

    const booking = this.firstReservationBooking(details);
    const room = this.upsertRoomFromReservation(details, booking);
    const guestName = details.guestFullName || details.billingName || '';
    const addressParts = this.parseBillingAddress(details.billingAddress || '');

    this.editHotelId.set(Number(details.hotelId || room?.hotelId || 1));
    this.editReservationStatus.set(this.mapReservationStatus(details.reservationStatus));

    this.guestData.update(data => ({
      ...data,
      id: details.guestId ? String(details.guestId) : data.id,
      fullName: guestName || data.fullName,
      phone: details.guestPhone || data.phone,
      email: details.guestEmail || data.email,
      address1: addressParts.address1 || data.address1,
      address2: addressParts.address2 || data.address2,
      city: addressParts.city || data.city,
      state: addressParts.state || data.state,
      zip: addressParts.zip || data.zip,
      vip: Boolean(details.guestIsVip),
      notes: details.notes || data.notes
    }));

    this.checkIn.set(details.checkInDate || booking?.checkInDate || '');
    this.checkOut.set(details.checkOutDate || booking?.checkOutDate || '');
    this.checkInTime.set(this.toInputTime(details.checkInTime || '14:00:00'));
    this.checkOutTime.set(this.toInputTime(details.checkOutTime || '11:00:00'));
    this.numberOfAdults.set(Number(details.numberOfAdults ?? 1));
    this.numberOfChildren.set(Number(details.numberOfChildren ?? 0));

    if (details.ratePlanId) {
      this.selectedPlan.set(String(details.ratePlanId));
    }

    const selected: Room[] = [];
    const bookings = Array.isArray(details?.bookings) && details.bookings.length > 0
      ? details.bookings
      : Array.isArray(details?.rooms) && details.rooms.length > 0
        ? details.rooms
        : [];

    if (bookings.length > 0) {
      for (const b of bookings) {
        const r = this.upsertRoomFromReservation(details, b);
        if (r && !selected.some(s => s.id === r.id)) selected.push(r);
      }
    } else if (Array.isArray(details?.roomIds)) {
      for (const rId of details.roomIds) {
        const r = this.upsertRoomFromReservation(details, { roomId: rId });
        if (r && !selected.some(s => s.id === r.id)) selected.push(r);
      }
    } else if (room) {
      selected.push(room);
    }

    if (selected.length > 0) {
      this.selectedRooms.set(selected);
      this.selectedFloor.set(selected[0].floor);
      this.selectedRoomType.set(selected[0].typeId);
    } else {
      this.selectedRooms.set([]);
    }

    const apiMembers = details.accompanyingGuests || [];
    if (Array.isArray(apiMembers) && apiMembers.length > 0) {
      this.accompanyingMembers.set(apiMembers.map((m: any) => ({
        title: m.title === 'MRS' ? 'Mrs.' : m.title === 'MS' ? 'Ms.' : m.title === 'DR' ? 'Dr.' : 'Mr.',
        fullName: m.fullName || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        gender: m.gender === 'MALE' ? 'Male' : m.gender === 'FEMALE' ? 'Female' : m.gender ? 'Other' : '',
        dob: m.dateOfBirth || '',
        relationship: m.relationship || '',
        idProof: m.idProofType === 'PASSPORT' ? 'Passport' : m.idProofType === 'DRIVING_LICENSE' ? 'Driving License' : m.idProofType === 'PAN' ? 'PAN Card' : m.idProofType === 'VOTER_ID' ? 'Voter ID' : 'Aadhar Card',
        idNumber: m.idProofNumber || ''
      })));
    } else {
      // Fallback: Check if notes contains the string "[Accompanying Guests: ...]" and parse it
      const notesStr = details.notes || '';
      const match = notesStr.match(/\[Accompanying Guests:\s*(.*?)\]/i);
      if (match && match[1]) {
        const parts = match[1].split(';').map((p: string) => p.trim());
        const parsedMembers: AccompanyingMember[] = [];
        parts.forEach((p: string) => {
          const nameMatch = p.match(/Member\s*#\d+:\s*(Mr\.|Mrs\.|Ms\.|Dr\.)\s*(.*?)\s*\(/i);
          const genderDobMatch = p.match(/\((.*?),?\s*DOB:\s*(.*?)\)/i);
          const idMatch = p.match(/-\s*ID:\s*(.*?):\s*(.*)/i);
          
          if (nameMatch) {
            parsedMembers.push({
              title: nameMatch[1],
              fullName: nameMatch[2],
              gender: genderDobMatch && genderDobMatch[1] !== 'N/A' ? genderDobMatch[1] : '',
              dob: genderDobMatch && genderDobMatch[2] !== 'N/A' ? genderDobMatch[2] : '',
              relationship: '',
              idProof: idMatch ? idMatch[1] : 'Aadhar Card',
              idNumber: idMatch && idMatch[2] !== 'N/A' ? idMatch[2] : ''
            });
          }
        });
        if (parsedMembers.length > 0) {
          this.accompanyingMembers.set(parsedMembers);
        } else {
          this.accompanyingMembers.set([]);
        }
      } else {
        this.accompanyingMembers.set([]);
      }
    }

    this.dataRevision.update(value => value + 1);
  }

  private firstReservationBooking(details: any): any {
    return Array.isArray(details?.bookings) && details.bookings.length > 0
      ? details.bookings[0]
      : Array.isArray(details?.rooms) && details.rooms.length > 0
        ? details.rooms[0]
        : null;
  }

  private upsertRoomFromReservation(details: any, booking: any): Room | null {
    const roomId = booking?.roomId ?? booking?.id ?? details?.roomId;
    if (!roomId) return null;

    const id = String(roomId);
    const existing = this.allRooms.find(room => room.id === id);
    if (existing) {
      const availableExisting = { ...existing, status: 'Available' as const };
      this.allRooms = this.allRooms.map(room => room.id === id ? availableExisting : room);
      return availableExisting;
    }

    const roomTypeName = booking?.roomTypeName || booking?.type || 'Room';
    const floor = Number(booking?.floorId ?? booking?.floor ?? 1);
    const room: Room = {
      id,
      number: booking?.roomNumber || booking?.number || id,
      type: roomTypeName,
      typeShort: this.shortCodeForRoomType(roomTypeName, Number(booking?.roomTypeId ?? roomId)),
      typeId: String(booking?.roomTypeId ?? roomTypeName),
      hotelId: Number(details?.hotelId || 1),
      floor,
      status: 'Available',
      rate: Number(booking?.ratePerNight ?? 0),
      view: booking?.floorNumber || `Floor ${floor}`,
      beds: `${details?.numberOfAdults ?? 1} Pax`
    };

    this.allRooms = [...this.allRooms, room];
    this.ensureSelectedFloorExists();
    return room;
  }

  private parseBillingAddress(value: string): { address1: string; address2: string; city: string; state: string; zip: string } {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 5) {
      return {
        address1: parts[0] || '',
        address2: parts.slice(1, -3).join(', '),
        city: parts[parts.length - 3] || '',
        state: parts[parts.length - 2] || '',
        zip: parts[parts.length - 1] || ''
      };
    }

    return {
      address1: parts[0] || '',
      address2: '',
      city: parts[1] || '',
      state: parts[2] || '',
      zip: parts[3] || ''
    };
  }

  private mapReservationStatus(value: string | undefined | null): ReservationRequest['reservationStatus'] {
    if (!value) return 'CONFIRMED';
    const s = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (s === 'CHECKED_IN' || s === 'CHECKEDIN' || s === 'CHECKIN') return 'CHECKED_IN';
    if (s === 'CHECKED_OUT' || s === 'CHECKEDOUT' || s === 'CHECKOUT') return 'CHECKED_OUT';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
    if (s === 'NO_SHOW' || s === 'NOSHOW') return 'NO_SHOW';
    if (s === 'PENDING') return 'PENDING';
    if (s === 'CONFIRMED') return 'CONFIRMED';
    return 'CONFIRMED';
  }

  availableCountFor(typeId: string): number {
    if (!this.hasStayDates()) return 0;
    this.dataRevision();
    if (typeId === 'ALL') return this.allRooms.filter(r => this.availableRoomIds.has(r.id)).length;
    return this.allRooms.filter(r => r.typeId === typeId && this.availableRoomIds.has(r.id)).length;
  }

  availableCountForFloor(floor: number): number {
    if (!this.hasStayDates()) return 0;
    this.dataRevision();
    return this.allRooms.filter(r => r.floor === floor && this.availableRoomIds.has(r.id)).length;
  }

  filteredRooms = computed(() => {
    if (!this.hasStayDates()) return [];
    this.dataRevision();
    const type = this.selectedRoomType();
    if (type === 'ALL') return this.allRooms.filter(r => this.availableRoomIds.has(r.id));
    return this.allRooms.filter(r => r.typeId === type && this.availableRoomIds.has(r.id));
  });

  currentFloorRooms = computed(() => {
    if (!this.hasStayDates()) return [];
    this.dataRevision();
    return this.allRooms.filter(r => r.floor === this.selectedFloor() && this.availableRoomIds.has(r.id));
  });

  nights = computed(() => {
    if (!this.checkIn() || !this.checkOut()) return 1;
    const diff = new Date(this.checkOut()).getTime() - new Date(this.checkIn()).getTime();
    return Math.max(1, Math.ceil(diff / 86400000));
  });

  isRoomSelected(room: Room | string): boolean {
    const id = typeof room === 'string' ? room : room.id;
    return this.selectedRooms().some(r => r.id === id);
  }

  toggleRoomSelection(room: Room) {
    if (room.status !== 'Available') return;
    if (this.isRoomSelected(room)) {
      this.selectedRooms.update(rooms => rooms.filter(r => r.id !== room.id));
    } else {
      this.selectedRooms.update(rooms => [...rooms, room]);
    }
  }

  totalRoomBasePrice = computed(() => {
    const rooms = this.selectedRooms();
    if (rooms.length === 0) return 5000 * this.nights();
    return rooms.reduce((sum, r) => sum + r.rate, 0) * this.nights();
  });

  planExtraPrice = computed(() => {
    const plan = this.selectedPlanDetails();
    const count = this.selectedRooms().length || 1;
    return (plan.extra * count) * this.nights();
  });

  totalPrice = computed(() => {
    const rooms = this.selectedRooms();
    const plan = this.selectedPlanDetails();
    if (rooms.length === 0) {
      return (5000 + (plan?.extra ?? 0)) * this.nights();
    }
    const baseSum = rooms.reduce((sum, r) => sum + r.rate, 0);
    const extraSum = (plan?.extra ?? 0) * rooms.length;
    return (baseSum + extraSum) * this.nights();
  });

  getSelectedRoomsText(): string {
    const rooms = this.selectedRooms();
    if (rooms.length === 0) return 'Select Room(s)';
    if (rooms.length === 1) return `${rooms[0].type} Room ${rooms[0].number}`;
    return `${rooms.length} Rooms Selected (${rooms.map(r => r.number).join(', ')})`;
  }

  getSelectedRoomsNumbersText(): string {
    return this.selectedRooms().map(r => `Room ${r.number}`).join(', ');
  }

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

  roomTaxRate = computed(() => {
    const rules = this.gstRules();
    const roomGst = rules.find(r => r.serviceCategory === 'Room' && r.isActive !== false);
    if (roomGst) {
      return Number(roomGst.igstRate !== undefined ? roomGst.igstRate : (roomGst.cgstRate + roomGst.sgstRate));
    }
    return 12; // Fallback tax rate
  });

  taxAmount  = computed(() => math.round(this.totalPrice() * (this.roomTaxRate() / 100)));
  grandTotal = computed(() => math.round(this.totalPrice() + this.taxAmount()));
  hasStayDates = computed(() => !!this.checkIn() && !!this.checkOut());
  minCheckOutDate = computed(() => this.checkIn() ? this.addDaysIso(this.checkIn(), 1) : this.todayIso);

  canConfirmBooking = computed(() =>
    !this.validationMessage('fullName') &&
    !this.validationMessage('phone') &&
    !this.validationMessage('email') &&
    !this.validationMessage('zip') &&
    !this.validationMessage('dob') &&
    !this.validationMessage('idNumber') &&
    !this.validationMessage('checkIn') &&
    !this.validationMessage('checkOut') &&
    !this.validationMessage('adults') &&
    !this.validationMessage('children') &&
    !this.validationMessage('room') &&
    !this.validationMessage('plan') &&
    !this.isCreatingReservation() &&
    !this.isLoadingReservationForEdit()
  );

  setViewMode(mode: 'list' | 'map') { this.viewMode.set(mode); }
  selectRoomType(id: string) { this.selectedRoomType.set(id); }
  selectRoom(room: Room) { this.toggleRoomSelection(room); }
  selectPlan(id: string) { this.selectedPlan.set(id); }
  selectFloor(num: number) {
    this.selectedFloor.set(num);
  }

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
    const availableRooms = rooms.filter(r => this.availableRoomIds.has(r.id));
    return {
      total:       rooms.length,
      available:   availableRooms.length,
      occupied:    rooms.filter(r => r.status === 'Occupied' && !this.availableRoomIds.has(r.id)).length,
      reserved:    rooms.filter(r => r.status === 'Reserved' && !this.availableRoomIds.has(r.id)).length,
      maintenance: rooms.filter(r => r.status === 'Maintenance' && !this.availableRoomIds.has(r.id)).length,
    };
  });

  modalActiveRoom = computed(() => this.modalHoveredRoom() ?? (this.selectedRooms().length > 0 ? this.selectedRooms()[this.selectedRooms().length - 1] : null));

  // Guest Methods
  openSearchGuest() { this.searchGuestModalOpen.set(true); document.body.style.overflow = 'hidden'; this.searchQuery.set(''); }
  closeSearchGuest() { this.searchGuestModalOpen.set(false); document.body.style.overflow = ''; }
  
  openCreateGuest() { 
    this.createGuestModalOpen.set(true); 
    document.body.style.overflow = 'hidden'; 
    this.createGuestError.set(null);
    this.createGuestSubmitted.set(false);
    this.createGuestTouched.set({});
    // Reset form for new guest
    this.guestData.set({
      title: 'Mr.', fullName: '', phoneCode: '+91 (India)', phone: '', email: '',
      country: 'India', address1: '', address2: '', city: '', state: '', zip: '',
      vip: false, nationality: '', gender: '', dob: '', idProof: 'Aadhar Card', idNumber: '', notes: '', visits: 0
    });
  }
  closeCreateGuest() { this.createGuestModalOpen.set(false); document.body.style.overflow = ''; }

  searchResults = signal<GuestProfile[]>([]);
  isSearchingGuests = signal(false);

  filteredGuests = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return [];
    const localMatches = this.mockGuests.filter(g => g.fullName.toLowerCase().includes(q) || g.phone.includes(q) || g.email.toLowerCase().includes(q));
    const remoteMatches = this.searchResults();
    const combined = [...remoteMatches, ...localMatches];
    const unique: GuestProfile[] = [];
    const keys = new Set<string>();
    for (const g of combined) {
      const key = `${g.email || ''}_${g.phone || ''}`;
      if (!keys.has(key)) {
        keys.add(key);
        unique.push(g);
      }
    }
    return unique;
  });

  searchGuests(query: string) {
    this.searchQuery.set(query);
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.isSearchingGuests.set(true);
    this.http.get<StandardResponse<any[]>>(`${this.frontOfficeBaseUrl}/guests/getAllGuests?search=${encodeURIComponent(query)}`).subscribe({
      next: (res) => {
        this.isSearchingGuests.set(false);
        if (res.success && res.data) {
          this.searchResults.set(res.data.map(g => this.mapApiGuestToProfile(g)));
        } else {
          this.searchResults.set([]);
        }
      },
      error: (err) => {
        console.error('Error fetching guests:', err);
        this.isSearchingGuests.set(false);
        this.searchResults.set([]);
      }
    });
  }

  selectGuest(guest: GuestProfile) {
    this.guestData.set({ ...guest });
    this.closeSearchGuest();
  }

  markCreateGuestFieldTouched(field: string) {
    this.createGuestTouched.update(fields => ({ ...fields, [field]: true }));
  }

  shouldShowCreateGuestError(field: string): boolean {
    return !!(this.createGuestSubmitted() || this.createGuestTouched()[field]) && !!this.createGuestValidationMessage(field);
  }

  createGuestValidationMessage(field: string): string {
    const guest = this.guestData();
    switch (field) {
      case 'fullName': {
        const name = guest.fullName.trim();
        if (!name) return 'Guest full name is required.';
        if (name.length < 2) return 'Enter a valid guest name.';
        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return 'Name must contain letters, spaces, dots or hyphens only.';
        return '';
      }
      case 'phone': {
        const phone = this.onlyDigits(guest.phone);
        if (!phone) return 'Phone number is required.';
        if (this.extractCountryCode(guest.phoneCode) === '+91') {
          if (!/^[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10 digit Indian mobile number.';
        } else if (!/^\d{7,15}$/.test(phone)) {
          return 'Enter a valid phone number (7-15 digits).';
        }
        return '';
      }
      case 'email': {
        const email = (guest.email || '').trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return 'Enter a valid email address.';
        }
        return '';
      }
      case 'idNumber': {
        const idNumber = (guest.idNumber || '').trim();
        if (idNumber) {
          if (guest.idProof === 'Aadhar Card' && !/^[2-9]\d{11}$/.test(this.onlyDigits(idNumber))) {
            return 'Enter a valid 12 digit Aadhaar number.';
          }
          if (guest.idProof === 'Passport' && !/^[A-Z][0-9]{7}$/i.test(idNumber.replace(/\s/g, ''))) {
            return 'Enter a valid passport number, e.g. A1234567.';
          }
          if (guest.idProof === 'Driving License' && idNumber.replace(/\s|-/g, '').length < 8) {
            return 'Enter a valid driving license number.';
          }
        }
        return '';
      }
      default:
        return '';
    }
  }

  validateCreateGuest(): string | null {
    const fields = ['fullName', 'phone', 'email', 'idNumber'];
    return fields.map(f => this.createGuestValidationMessage(f)).find(Boolean) || null;
  }

  saveNewGuest() {
    this.createGuestSubmitted.set(true);
    this.createGuestError.set(null);
    const validationError = this.validateCreateGuest();
    if (validationError) {
      this.createGuestError.set(validationError);
      return;
    }

    const payload = this.profileToGuestRequest(this.guestData());
    this.isCreatingReservation.set(true);
    this.http.post<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/guests/createGuest`, payload).subscribe({
      next: (res) => {
        this.isCreatingReservation.set(false);
        if (res.success && res.data) {
          const profile = this.mapApiGuestToProfile(res.data);
          this.guestData.set(profile);
          this.closeCreateGuest();
          this.showToast('success', 'Success', 'Guest profile created successfully.');
        } else {
          const errMsg = res.message || 'Unable to save guest profile.';
          this.createGuestError.set(errMsg);
          this.showToast('error', 'Error', errMsg);
        }
      },
      error: (err) => {
        console.error('Error creating guest profile:', err);
        this.isCreatingReservation.set(false);
        const errMsg = err?.error?.message || err?.error?.error?.message || 'Unable to save guest profile.';
        this.createGuestError.set(errMsg);
        this.showToast('error', 'Error', errMsg);
      }
    });
  }

  showToast(type: 'success' | 'error', title: string, message: string, duration = 4000) {
    this.bookingToast.set({ visible: true, type, title, message });
    setTimeout(() => this.dismissToast(), duration);
  }

  dismissToast() {
    this.bookingToast.update(t => ({ ...t, visible: false }));
  }

  private mapApiGuestToProfile(apiGuest: any): GuestProfile {
    const titleMap: Record<string, string> = {
      'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'DR': 'Dr.', 'PROF': 'Prof.'
    };
    const title = titleMap[apiGuest.title] || apiGuest.title || 'Mr.';
    const fullName = apiGuest.fullName || `${apiGuest.firstName || ''} ${apiGuest.lastName || ''}`.trim();
    const idProofMap: Record<string, string> = {
      'AADHAR': 'Aadhar Card',
      'PASSPORT': 'Passport',
      'DRIVING_LICENSE': 'Driving License',
      'PAN': 'PAN Card',
      'VOTER_ID': 'Voter ID'
    };
    const idProof = idProofMap[apiGuest.idProofType] || apiGuest.idProofType || 'Aadhar Card';
    const genderMap: Record<string, string> = {
      'MALE': 'Male', 'FEMALE': 'Female', 'OTHER': 'Other'
    };
    const gender = genderMap[apiGuest.gender] || apiGuest.gender || '';

    return {
      id: String(apiGuest.id),
      title,
      fullName,
      phoneCode: apiGuest.countryCode ? `${apiGuest.countryCode}` : '+91 (India)',
      phone: apiGuest.phone || '',
      email: apiGuest.email || '',
      country: apiGuest.country || 'India',
      address1: apiGuest.addressLine1 || '',
      address2: apiGuest.addressLine2 || '',
      city: apiGuest.city || '',
      state: apiGuest.state || '',
      zip: apiGuest.postCode || '',
      vip: !!apiGuest.isVip,
      nationality: apiGuest.nationality || '',
      gender,
      dob: apiGuest.dateOfBirth || '',
      idProof,
      idNumber: apiGuest.idProofNumber || '',
      notes: apiGuest.guestNotes || apiGuest.preference || '',
      visits: 0
    };
  }

  private profileToGuestRequest(profile: GuestProfile): any {
    const revTitleMap: Record<string, string> = {
      'Mr.': 'MR', 'Mrs.': 'MRS', 'Ms.': 'MS', 'Miss': 'MISS', 'Dr.': 'DR', 'Prof.': 'PROF'
    };
    const title = revTitleMap[profile.title] || 'MR';
    const nameParts = profile.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '.';
    const revIdProofMap: Record<string, string> = {
      'Aadhar Card': 'AADHAR',
      'Passport': 'PASSPORT',
      'Driving License': 'DRIVING_LICENSE',
      'PAN Card': 'PAN',
      'Voter ID': 'VOTER_ID'
    };
    const idProofType = revIdProofMap[profile.idProof] || 'AADHAR';
    const revGenderMap: Record<string, string> = {
      'Male': 'MALE', 'Female': 'FEMALE', 'Other': 'OTHER'
    };
    const gender = revGenderMap[profile.gender] || 'MALE';

    return {
      title,
      firstName,
      lastName,
      countryCode: profile.phoneCode ? profile.phoneCode.split(' ')[0] : '+91',
      phone: profile.phone || '',
      email: profile.email || '',
      addressLine1: profile.address1 || '',
      addressLine2: profile.address2 || '',
      city: profile.city || '',
      state: profile.state || '',
      postCode: profile.zip || '',
      country: profile.country || 'India',
      nationality: profile.nationality || '',
      gender,
      dateOfBirth: profile.dob || null,
      idProofType,
      idProofNumber: profile.idNumber || '',
      guestNotes: profile.notes || '',
      preference: '',
      isVip: !!profile.vip
    };
  }

  updateGuestField(field: keyof GuestProfile, value: any) {
    this.guestData.update(data => ({ ...data, [field]: value }));
    if (this.createGuestModalOpen()) {
      this.markCreateGuestFieldTouched(field);
    }
  }

  markFieldTouched(field: BookingValidationField) {
    this.touchedFields.update(fields => ({ ...fields, [field]: true }));
  }

  shouldShowError(field: BookingValidationField): boolean {
    return !!(this.formSubmitted() || this.touchedFields()[field]) && !!this.validationMessage(field);
  }

  validationMessage(field: BookingValidationField): string {
    const guest = this.guestData();

    switch (field) {
      case 'fullName': {
        const name = guest.fullName.trim();
        if (!name) return 'Guest full name is required.';
        if (name.length < 2) return 'Enter a valid guest name.';
        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return 'Use letters, spaces, dots, apostrophes or hyphens only.';
        return '';
      }
      case 'phone': {
        const phone = this.onlyDigits(guest.phone);
        if (!phone) return 'Phone number is required.';
        if (this.extractCountryCode(guest.phoneCode) === '+91') {
          if (!/^[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10 digit Indian mobile number.';
        } else if (!/^\d{7,15}$/.test(phone)) {
          return 'Enter a valid phone number.';
        }
        return '';
      }
      case 'email': {
        const email = guest.email.trim();
        if (this.isEditMode() && !email) return '';
        if (!email) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';
        return '';
      }
      case 'zip': {
        const zip = guest.zip.trim();
        if (this.isEditMode() && !zip) return '';
        if (!zip) return 'Post code is required.';
        if (guest.country === 'India' && !/^\d{6}$/.test(zip)) return 'Enter a valid 6 digit Indian post code.';
        if (guest.country === 'USA' && !/^\d{5}(-\d{4})?$/.test(zip)) return 'Enter a valid US ZIP code.';
        if (!/^[A-Za-z0-9 -]{4,10}$/.test(zip)) return 'Enter a valid post code.';
        return '';
      }
      case 'dob': {
        if (!guest.dob) return '';
        const dob = new Date(guest.dob);
        if (Number.isNaN(dob.getTime())) return 'Enter a valid date of birth.';
        if (dob >= new Date()) return 'Date of birth must be in the past.';
        return '';
      }
      case 'idNumber': {
        const idNumber = guest.idNumber.trim();
        if (this.isEditMode() && !idNumber) return '';
        if (!idNumber) return 'ID number is required.';
        if (guest.idProof === 'Aadhar Card' && !/^[2-9]\d{11}$/.test(this.onlyDigits(idNumber))) {
          return 'Enter a valid 12 digit Aadhaar number.';
        }
        if (guest.idProof === 'Passport' && !/^[A-Z][0-9]{7}$/i.test(idNumber.replace(/\s/g, ''))) {
          return 'Enter a valid passport number, e.g. A1234567.';
        }
        if (guest.idProof === 'Driving License' && idNumber.replace(/\s|-/g, '').length < 8) {
          return 'Enter a valid driving license number.';
        }
        return '';
      }
      case 'checkIn':
        if (!this.checkIn()) return 'Arrival date is required.';
        if (!this.isEditMode() && this.compareDateInput(this.checkIn(), this.todayIso) < 0) return 'Arrival date cannot be in the past.';
        return '';
      case 'checkOut':
        if (!this.checkOut()) return 'Departure date is required.';
        if (this.checkIn() && this.compareDateInput(this.checkOut(), this.checkIn()) <= 0) {
          return 'Departure must be after arrival.';
        }
        return '';
      case 'adults':
        return this.numberOfAdults() >= 1 ? '' : 'At least one adult is required.';
      case 'children':
        return this.numberOfChildren() >= 0 ? '' : 'Children cannot be negative.';
      case 'room':
        return this.selectedRooms().length > 0 ? '' : 'Please select at least one available room.';
      case 'plan':
        return this.selectedPlan() ? '' : 'Please select a rate plan.';
      default:
        return '';
    }
  }

  confirmBooking() {
    this.reservationError.set(null);
    this.reservationSuccess.set(null);

    const validationError = this.validateReservation();
    if (validationError) {
      this.reservationError.set(validationError);
      return;
    }

    const payload = this.buildReservationPayload(this.isEditMode() ? this.editReservationStatus() : 'CONFIRMED');
    this.isCreatingReservation.set(true);

    const reservationId = this.editReservationId();
    const request$ = reservationId
      ? this.http.put<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/updateReservation/${reservationId}`, payload)
      : this.http.post<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/createReservation`, payload);

    request$.subscribe({
      next: (response) => {
        this.isCreatingReservation.set(false);
        if (response && response.success === false) {
          const errMsg = response.message || 'Unable to save reservation.';
          this.reservationError.set(errMsg);
          this.showToast('error', 'Error', errMsg);
          return;
        }
        this.reservationSuccess.set(response.message || (reservationId ? 'Reservation updated successfully.' : 'Reservation created successfully.'));
        this.showToast('success', 'Success', response.message || (reservationId ? 'Reservation updated successfully.' : 'Reservation created successfully.'));
        this.router.navigate(['/reservations']);
      },
      error: (err) => {
        console.error('[NewBookingComponent] save reservation error:', err);
        this.isCreatingReservation.set(false);
        const errMsg = err?.error?.message || err?.error?.error?.message || (reservationId ? 'Unable to update reservation.' : 'Unable to create reservation.');
        this.reservationError.set(errMsg);
        this.showToast('error', 'Error', errMsg);
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

    this.http.post<StandardResponse<any>>(`${this.frontOfficeBaseUrl}/frontOffice/createReservation`, payload).subscribe({
      next: (response) => {
        this.isCreatingReservation.set(false);
        if (response && response.success === false) {
          const errMsg = response.message || 'Unable to save reservation draft.';
          this.reservationError.set(errMsg);
          this.showToast('error', 'Error', errMsg);
          return;
        }
        this.reservationSuccess.set(response.message || 'Reservation draft saved.');
        this.showToast('success', 'Success', response.message || 'Reservation draft saved.');
        this.router.navigate(['/reservations']);
      },
      error: (err) => {
        console.error('[NewBookingComponent] saveDraft reservation error:', err);
        this.isCreatingReservation.set(false);
        const errMsg = err?.error?.message || err?.error?.error?.message || 'Unable to save reservation draft.';
        this.reservationError.set(errMsg);
        this.showToast('error', 'Error', errMsg);
      }
    });
  }

  private validateReservation(): string | null {
    this.markReservationFieldsTouched();
    const fields: BookingValidationField[] = [
      'fullName', 'phone', 'email', 'zip', 'dob', 'idNumber',
      'checkIn', 'checkOut', 'adults', 'children', 'room', 'plan'
    ];
    return fields.map(field => this.validationMessage(field)).find(Boolean) || null;
  }

  private markReservationFieldsTouched() {
    this.formSubmitted.set(true);
    this.touchedFields.set({
      fullName: true,
      phone: true,
      email: true,
      zip: true,
      dob: true,
      idNumber: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      room: true,
      plan: true
    });
  }

  private buildReservationPayload(status: ReservationRequest['reservationStatus']): ReservationRequest {
    const rooms = this.selectedRooms();
    const firstRoom = rooms[0];
    const roomIds = rooms.map(r => Number(r.id));
    
    // Format accompanying members text to append to notes
    let baseNotes = this.guestData().notes || '';
    // Strip any previous [Accompanying Guests: ...] text from baseNotes if editing
    baseNotes = baseNotes.replace(/\n\n\[Accompanying Guests:.*?\]/gis, '').replace(/\[Accompanying Guests:.*?\]/gis, '').trim();

    const members = this.accompanyingMembers().filter(m => m.fullName.trim() !== '');
    let finalNotes = baseNotes;
    if (members.length > 0) {
      const membersText = members.map((m, index) => 
        `Member #${index + 1}: ${m.title} ${m.fullName} (${m.gender || 'N/A'}, DOB: ${m.dob || 'N/A'}) - ID: ${m.idProof}: ${m.idNumber || 'N/A'}`
      ).join('; ');
      finalNotes = finalNotes ? `${finalNotes}\n\n[Accompanying Guests: ${membersText}]` : `[Accompanying Guests: ${membersText}]`;
    }

    const payload: any = {
      hotelId: firstRoom?.hotelId ?? this.editHotelId() ?? 1,
      checkInDate: this.checkIn(),
      checkInTime: this.toApiTime(this.checkInTime()),
      checkOutDate: this.checkOut(),
      checkOutTime: this.toApiTime(this.checkOutTime()),
      numberOfAdults: this.numberOfAdults(),
      gstPercent: Number(this.roomTaxRate() || 0),
      numberOfChildren: this.numberOfChildren(),
      reservationStatus: status,
      roomIds: roomIds,
      ratePlanId: Number(this.selectedPlan()),
      billingName: this.guestData().fullName,
      billingAddress: [this.guestData().address1, this.guestData().address2, this.guestData().city, this.guestData().state, this.guestData().zip]
        .filter(Boolean)
        .join(', '),
      notes: finalNotes,
      guestDetails: this.buildGuestDetailsPayload(),
      accompanyingGuests: members.map(m => ({
        title: this.mapGuestTitle(m.title) || 'MR',
        fullName: m.fullName.trim(),
        gender: this.mapGender(m.gender) || 'MALE',
        dateOfBirth: m.dob || null,
        relationship: m.relationship || '',
        idProofType: this.mapIdProof(m.idProof) || 'AADHAR',
        idNumber: m.idNumber || ''
      }))
    };

    return payload;
  }

  private buildGuestDetailsPayload(): GuestRequest {
    const guest = this.guestData();
    const { firstName, lastName } = this.splitGuestName(guest.fullName);

    const guestDetails: any = {
      title: this.mapGuestTitle(guest.title),
      firstName,
      lastName,
      countryCode: this.extractCountryCode(guest.phoneCode),
      phone: this.onlyDigits(guest.phone)
    };

    if (guest.email && guest.email.trim()) guestDetails.email = guest.email.trim();
    if (guest.address1 && guest.address1.trim()) guestDetails.addressLine1 = guest.address1.trim();
    if (guest.address2 && guest.address2.trim()) guestDetails.addressLine2 = guest.address2.trim();
    if (guest.city && guest.city.trim()) guestDetails.city = guest.city.trim();
    if (guest.state && guest.state.trim()) guestDetails.state = guest.state.trim();
    if (guest.zip && guest.zip.trim()) guestDetails.postCode = guest.zip.trim();
    if (guest.country && guest.country.trim()) guestDetails.country = guest.country.trim();
    if (guest.nationality && guest.nationality.trim()) guestDetails.nationality = guest.nationality.trim();

    const genderMapped = this.mapGender(guest.gender);
    if (genderMapped) guestDetails.gender = genderMapped;

    if (guest.dob) guestDetails.dateOfBirth = guest.dob;

    const idProofMapped = this.mapIdProof(guest.idProof);
    if (idProofMapped) guestDetails.idProofType = idProofMapped;

    if (guest.idNumber && guest.idNumber.trim()) {
      guestDetails.idProofNumber = guest.idProof === 'Aadhar Card' ? this.onlyDigits(guest.idNumber) : guest.idNumber.trim();
    }

    if (guest.notes && guest.notes.trim()) guestDetails.guestNotes = guest.notes.trim();
    if (guest.vip !== undefined) guestDetails.isVip = guest.vip;

    return guestDetails;
  }

  private onlyDigits(value: string): string {
    return (value || '').replace(/\D/g, '');
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

  private toInputTime(value: string): string {
    const [hour = '00', minute = '00'] = (value || '').split(':');
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDaysIso(value: string, days: number): string {
    const date = this.parseDateInput(value);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private compareDateInput(a: string, b: string): number {
    return this.parseDateInput(a).getTime() - this.parseDateInput(b).getTime();
  }

  private parseDateInput(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
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
    if (value === 'PAN Card' || value === 'PAN') return 'PAN';
    if (value === 'Voter ID' || value === 'VOTER_ID') return 'VOTER_ID';
    return 'AADHAR';
  }

  goBack() { window.history.back(); }

  formatINR(val: number): string {
    return '₹' + val.toLocaleString('en-IN');
  }
}
