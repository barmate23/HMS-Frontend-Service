import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArrivalApiItem, FrontOfficeApiService } from '../../front-office-api.service';

interface ArrivalGuest {
  id: string;
  bookingId: number;
  name: string;
  phone: string;
  bookingRef: string;
  roomType: string;
  roomTypeId: string;
  plan: string;
  pax: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  expectedTime: string;
  source: string;
  status: 'Pending' | 'Checked In';
  isVip: boolean;
  amountDue: number;
  totalAmount: number;
  roomNumber?: string;
  roomId?: number;
}

@Component({
  selector: 'app-arrivals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css']
})
export class ArrivalsComponent implements OnInit {
  currentDate = new Date();
  searchQuery = '';
  arrivals: ArrivalGuest[] = [];
  pendingCount = 0;
  checkedInCount = 0;
  totalExpectedCount = 0;
  isLoading = false;
  errorMessage = '';

  checkInModalOpen = false;
  selectedGuestForCheckIn: ArrivalGuest | null = null;
  assignedRoomNumber = '';
  paymentMethod = 'Credit Card';
  idVerification = 'Passport Verified';

  folioModalOpen = false;
  selectedGuestForFolio: ArrivalGuest | null = null;

  constructor(private readonly api: FrontOfficeApiService) {}

  ngOnInit() {
    this.loadArrivals();
  }

  get pendingArrivals() { return this.pendingCount; }
  get checkedIn() { return this.checkedInCount; }
  get totalArrivals() { return this.totalExpectedCount || this.arrivals.length; }

  loadArrivals() {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.getArrivals(this.searchQuery, false).subscribe({
      next: response => {
        const data = response.data;
        this.arrivals = (data?.arrivals || []).map(item => this.mapArrival(item));
        this.pendingCount = data?.pendingArrivalsCount ?? this.arrivals.filter(a => a.status === 'Pending').length;
        this.checkedInCount = data?.checkedInCount ?? this.arrivals.filter(a => a.status === 'Checked In').length;
        this.totalExpectedCount = data?.totalExpectedCount ?? this.arrivals.length;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load arrivals.';
        this.isLoading = false;
      }
    });
  }

  openCheckInModal(guest: ArrivalGuest) {
    this.selectedGuestForCheckIn = guest;
    this.assignedRoomNumber = guest.roomNumber || '';
    this.paymentMethod = 'Credit Card';
    this.idVerification = 'Passport Verified';
    this.checkInModalOpen = true;
    document.body.style.overflow = 'hidden';

    this.api.getCheckInDetails(guest.bookingId).subscribe({
      next: response => {
        const details = response.data;
        if (!this.selectedGuestForCheckIn || this.selectedGuestForCheckIn.bookingId !== guest.bookingId) return;
        this.selectedGuestForCheckIn.phone = details.guestPhone || this.selectedGuestForCheckIn.phone;
        this.selectedGuestForCheckIn.pax = details.occupancy || this.selectedGuestForCheckIn.pax;
        this.selectedGuestForCheckIn.plan = details.ratePlan || this.selectedGuestForCheckIn.plan;
        this.selectedGuestForCheckIn.source = details.source || this.selectedGuestForCheckIn.source;
        this.selectedGuestForCheckIn.totalAmount = Number(details.totalEstBill ?? this.selectedGuestForCheckIn.totalAmount);
        this.selectedGuestForCheckIn.amountDue = Number(details.balanceDue ?? this.selectedGuestForCheckIn.amountDue);
        this.selectedGuestForCheckIn.roomId = details.assignedRoomId;
        this.assignedRoomNumber = details.assignedRoomNumber || this.assignedRoomNumber;
      }
    });
  }

  closeCheckInModal() {
    this.checkInModalOpen = false;
    this.selectedGuestForCheckIn = null;
    document.body.style.overflow = '';
  }

  confirmCheckIn() {
    if (!this.selectedGuestForCheckIn) return;

    this.api.checkIn({
      bookingId: this.selectedGuestForCheckIn.bookingId,
      roomId: this.selectedGuestForCheckIn.roomId || Number(this.assignedRoomNumber),
      idVerification: this.idVerification,
      paymentMethod: this.paymentMethod,
      amountToSettle: this.selectedGuestForCheckIn.amountDue
    }).subscribe({
      next: () => {
        this.closeCheckInModal();
        this.loadArrivals();
      },
      error: () => this.errorMessage = 'Unable to complete check-in.'
    });
  }

  checkIn(guest: ArrivalGuest) {
    this.openCheckInModal(guest);
  }

  openFolio(guest: ArrivalGuest) {
    this.selectedGuestForFolio = guest;
    this.folioModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeFolio() {
    this.folioModalOpen = false;
    this.selectedGuestForFolio = null;
    document.body.style.overflow = '';
  }

  private mapArrival(item: ArrivalApiItem): ArrivalGuest {
    const normalizedStatus = (item.bookingStatus || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const isCheckedIn = normalizedStatus === 'CHECKEDIN';

    return {
      id: String(item.bookingId),
      bookingId: item.bookingId,
      name: item.guestName || 'Guest',
      phone: '',
      bookingRef: item.bookingRef,
      roomType: item.roomTypeName || 'Room',
      roomTypeId: item.roomTypeName || '-',
      plan: '-',
      pax: '-',
      checkInDate: item.checkInDate,
      checkOutDate: item.checkOutDate,
      nights: item.numberOfNights || 0,
      expectedTime: item.eta || '-',
      source: '-',
      status: isCheckedIn ? 'Checked In' : 'Pending',
      isVip: !!item.guestIsVip,
      amountDue: Number(item.balance || 0),
      totalAmount: Number(item.balance || 0),
      roomNumber: item.roomNumber
    };
  }
}
