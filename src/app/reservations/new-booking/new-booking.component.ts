import { Component, signal, computed } from '@angular/core';
// expose Math for template
const math = Math;
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

export interface Room {
  id: string; number: string; type: string; typeShort: string; typeId: string;
  floor: number; status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';
  rate: number; view: string; beds: string;
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
export class NewBookingComponent {
  checkIn = signal('');
  checkOut = signal('');
  viewMode = signal<'list' | 'map'>('list');
  selectedRoomType = signal<string>('ALL');
  selectedRoom = signal<Room | null>(null);
  selectedPlan = signal<string>('EP');
  selectedFloor = signal<number>(1);
  mapModalOpen = signal(false);
  modalHoveredRoom = signal<Room | null>(null);

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

  availableCountFor(typeId: string): number {
    if (typeId === 'ALL') return this.allRooms.filter(r => r.status === 'Available').length;
    return this.allRooms.filter(r => r.typeId === typeId && r.status === 'Available').length;
  }

  filteredRooms = computed(() => {
    const type = this.selectedRoomType();
    if (type === 'ALL') return this.allRooms.filter(r => r.status === 'Available');
    return this.allRooms.filter(r => r.typeId === type && r.status === 'Available');
  });

  currentFloorRooms = computed(() => this.allRooms.filter(r => r.floor === this.selectedFloor()));

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

  selectedPlanDetails = computed(() => this.ratePlans.find(p => p.id === this.selectedPlan()) ?? this.ratePlans[0]);

  taxAmount  = computed(() => math.round(this.totalPrice() * 0.12));
  grandTotal = computed(() => math.round(this.totalPrice() * 1.12));

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

  saveDraft() { console.log('Draft saved'); }

  formatINR(val: number): string {
    return '₹' + val.toLocaleString('en-IN');
  }
}
