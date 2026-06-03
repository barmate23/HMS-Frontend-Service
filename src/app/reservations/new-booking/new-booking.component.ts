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
  selectedRoom = signal<Room | null>(null);
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

  isEditMode = computed(() => !!this.editReservationId());

  ngOnInit() {
    const reservationId = this.route.snapshot.queryParamMap.get('reservationId');
    if (reservationId) {
      this.editReservationId.set(reservationId);
      this.loadReservationForEdit(reservationId);
    }

    this.loadRoomInventory();
    this.loadRatePlans();
  }

  loadRoomInventory() {
    this.isRoomInventoryLoading.set(true);
    this.roomInventoryError.set(null);

    forkJoin({
      roomTypes: this.http.get<StandardResponse<ApiRoomType[]>>(`${this.masterBaseUrl}/roomTypes/getAllRoomTypes?page=0&size=50`),
      rooms: this.http.get<StandardResponse<ApiRoom[]>>(`${this.masterBaseUrl}/rooms/getAllRooms?page=0&size=10`)
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
          this.selectedRoom.set(null);
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

    const floorId = this.selectedFloor();
    this.http.get<StandardResponse<ApiRoom[]>>(`${this.frontOfficeBaseUrl}/rooms/available?checkIn=${this.checkIn()}&checkOut=${this.checkOut()}`).subscribe({
      next: (response) => {
        const typeMap = this.buildRoomTypeMap();
        this.mergeAvailableRoomsForFloor(response.data ?? [], typeMap, floorId);
        this.selectedRoom.set(null);
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
        this.selectedRoom.set(null);
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

  private mergeAvailableRoomsForFloor(availableRooms: ApiRoom[], typeMap: Map<number, ApiRoomType>, floorId: number) {
    const mappedRooms = availableRooms.map(room => this.mapApiRoom({ ...room, status: 'VACANT' }, typeMap));
    this.allRooms = [
      ...this.allRooms.filter(room => room.floor !== floorId),
      ...mappedRooms
    ];
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

    if (room) {
      this.selectedRoom.set(room);
      this.selectedFloor.set(room.floor);
      this.selectedRoomType.set(room.typeId);
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

  private mapReservationStatus(value: string): ReservationRequest['reservationStatus'] {
    const allowed: ReservationRequest['reservationStatus'][] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'];
    return allowed.includes(value as ReservationRequest['reservationStatus'])
      ? value as ReservationRequest['reservationStatus']
      : 'CONFIRMED';
  }

  availableCountFor(typeId: string): number {
    if (!this.hasStayDates()) return 0;
    this.dataRevision();
    if (typeId === 'ALL') return this.allRooms.filter(r => r.status === 'Available').length;
    return this.allRooms.filter(r => r.typeId === typeId && r.status === 'Available').length;
  }

  filteredRooms = computed(() => {
    if (!this.hasStayDates()) return [];
    this.dataRevision();
    const type = this.selectedRoomType();
    if (type === 'ALL') return this.allRooms.filter(r => r.status === 'Available');
    return this.allRooms.filter(r => r.typeId === type && r.status === 'Available');
  });

  currentFloorRooms = computed(() => {
    if (!this.hasStayDates()) return [];
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
  selectRoomType(id: string) { this.selectedRoomType.set(id); this.selectedRoom.set(null); }
  selectRoom(room: Room) { if (room.status === 'Available') this.selectedRoom.set(room); }
  selectPlan(id: string) { this.selectedPlan.set(id); }
  selectFloor(num: number) {
    this.selectedFloor.set(num);
    this.loadAvailableRoomsForStay();
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
        return this.selectedRoom() ? '' : 'Please select an available room.';
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
        this.reservationSuccess.set(response.message || (reservationId ? 'Reservation updated successfully.' : 'Reservation created successfully.'));
        this.router.navigate(['/reservations']);
      },
      error: (err) => {
        console.error('[NewBookingComponent] save reservation error:', err);
        this.isCreatingReservation.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || (reservationId ? 'Unable to update reservation.' : 'Unable to create reservation.'));
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
        this.reservationSuccess.set(response.message || 'Reservation draft saved.');
        this.router.navigate(['/reservations']);
      },
      error: (err) => {
        console.error('[NewBookingComponent] saveDraft reservation error:', err);
        this.isCreatingReservation.set(false);
        this.reservationError.set(err?.error?.message || err?.error?.error?.message || 'Unable to save reservation draft.');
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
    const room = this.selectedRoom()!;
    const guestId = this.getNumericGuestId();
    const payload: ReservationRequest = {
      hotelId: room.hotelId ?? this.editHotelId() ?? 1,
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
      phone: this.onlyDigits(guest.phone),
      email: guest.email.trim(),
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
      idProofNumber: guest.idProof === 'Aadhar Card' ? this.onlyDigits(guest.idNumber) : guest.idNumber.trim(),
      guestNotes: guest.notes,
      isVip: guest.vip
    };
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
    return 'AADHAR';
  }

  goBack() { window.history.back(); }

  formatINR(val: number): string {
    return '₹' + val.toLocaleString('en-IN');
  }
}
