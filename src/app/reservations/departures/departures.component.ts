import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArrivalApiItem, FrontOfficeApiService } from '../../front-office-api.service';

interface DepartureGuest {
  id: string;
  bookingId: number;
  name: string;
  phone: string;
  bookingRef: string;
  roomType: string;
  roomNumber: string;
  roomTypeId: string;
  plan: string;
  pax: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  expectedTime: string;
  source: string;
  status: 'Pending' | 'Checked Out';
  isVip: boolean;
  balance: number;
  totalAmount: number;
}

@Component({
  selector: 'app-departures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departures.component.html',
  styleUrls: ['./departures.component.css']
})
export class DeparturesComponent implements OnInit {
  currentDate = new Date();
  searchQuery = '';
  departures: DepartureGuest[] = [];
  pendingCount = 0;
  checkedOutCount = 0;
  totalCount = 0;
  isLoading = false;
  errorMessage = '';

  checkOutModalOpen = false;
  selectedGuestForCheckOut: DepartureGuest | null = null;
  checkoutStep = 1;

  minibarCharge = 0;
  lateCheckoutFee = 0;
  keysReturned = false;
  roomDamageReported = false;
  damageCharge = 0;
  damageDescription = '';
  paymentMethod = 'Credit Card';
  transportRequested = 'None';
  guestFeedback = 'Positive';

  folioModalOpen = false;
  selectedGuestForFolio: DepartureGuest | null = null;

  constructor(private readonly api: FrontOfficeApiService) {}

  ngOnInit() {
    this.loadDepartures();
  }

  get pendingDepartures() { return this.pendingCount; }
  get checkedOut() { return this.checkedOutCount; }
  get totalDepartures() { return this.totalCount || this.departures.length; }

  get totalOutstanding(): number {
    if (!this.selectedGuestForCheckOut) return 0;
    return this.selectedGuestForCheckOut.balance + Number(this.minibarCharge || 0) + Number(this.lateCheckoutFee || 0) + Number(this.damageCharge || 0);
  }

  loadDepartures() {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.getArrivals(this.searchQuery, true).subscribe({
      next: response => {
        const data = response.data;
        this.departures = (data?.arrivals || []).map(item => this.mapDeparture(item));
        this.pendingCount = data?.pendingArrivalsCount ?? this.departures.filter(d => d.status === 'Pending').length;
        this.checkedOutCount = data?.checkedInCount ?? this.departures.filter(d => d.status === 'Checked Out').length;
        this.totalCount = data?.totalExpectedCount ?? this.departures.length;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load departures.';
        this.isLoading = false;
      }
    });
  }

  openCheckOutModal(guest: DepartureGuest) {
    this.selectedGuestForCheckOut = guest;
    this.checkoutStep = 1;
    this.minibarCharge = 0;
    this.lateCheckoutFee = 0;
    this.keysReturned = false;
    this.roomDamageReported = false;
    this.damageCharge = 0;
    this.damageDescription = '';
    this.transportRequested = 'None';
    this.guestFeedback = 'Positive';
    this.paymentMethod = 'Credit Card';
    this.checkOutModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  nextStep() {
    if (this.checkoutStep < 3) this.checkoutStep++;
  }

  prevStep() {
    if (this.checkoutStep > 1) this.checkoutStep--;
  }

  closeCheckOutModal() {
    this.checkOutModalOpen = false;
    this.selectedGuestForCheckOut = null;
    document.body.style.overflow = '';
  }

  confirmCheckOut() {
    if (!this.selectedGuestForCheckOut) return;

    this.api.checkOut({
      bookingId: this.selectedGuestForCheckOut.bookingId,
      keysReturned: this.keysReturned,
      lateCheckOutFee: Number(this.lateCheckoutFee || 0),
      minibarCharges: Number(this.minibarCharge || 0),
      roomDamageReported: this.roomDamageReported,
      damagePenaltyCharge: Number(this.damageCharge || 0),
      damageDescription: this.damageDescription,
      paymentMethod: this.paymentMethod,
      amountToCollect: this.totalOutstanding,
      transportationRequested: this.transportRequested,
      guestFeedback: this.guestFeedback
    }).subscribe({
      next: () => {
        this.closeCheckOutModal();
        this.loadDepartures();
      },
      error: () => this.errorMessage = 'Unable to finalize check-out.'
    });
  }

  checkOut(guest: DepartureGuest) {
    this.openCheckOutModal(guest);
  }

  openFolio(guest: DepartureGuest) {
    this.selectedGuestForFolio = guest;
    this.folioModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeFolio() {
    this.folioModalOpen = false;
    this.selectedGuestForFolio = null;
    document.body.style.overflow = '';
  }

  private mapDeparture(item: ArrivalApiItem): DepartureGuest {
    const normalizedStatus = (item.bookingStatus || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const checkedOut = normalizedStatus === 'CHECKEDOUT';
    return {
      id: String(item.bookingId),
      bookingId: item.bookingId,
      name: item.guestName || 'Guest',
      phone: '',
      bookingRef: item.bookingRef,
      roomType: item.roomTypeName || 'Room',
      roomNumber: item.roomNumber || '-',
      roomTypeId: item.roomTypeName || '-',
      plan: '-',
      pax: '-',
      checkInDate: item.checkInDate,
      checkOutDate: item.checkOutDate,
      nights: item.numberOfNights || 0,
      expectedTime: item.eta || '-',
      source: '-',
      status: checkedOut ? 'Checked Out' : 'Pending',
      isVip: !!item.guestIsVip,
      balance: Number(item.balance || 0),
      totalAmount: Number(item.balance || 0)
    };
  }
}
