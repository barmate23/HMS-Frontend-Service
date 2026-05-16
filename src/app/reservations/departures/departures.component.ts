import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DepartureGuest {
  id: string;
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
export class DeparturesComponent {
  currentDate = new Date();

  // Mock data for today's departures
  departures: DepartureGuest[] = [
    { id: '101', name: 'Jacob Jones', phone: '+1 202-555-0188', bookingRef: 'BK-10280', roomType: 'Deluxe Ocean View', roomNumber: '402', roomTypeId: 'DLX', plan: 'Breakfast Included (CP)', pax: '2 Adults', checkInDate: 'May 10, 2026', checkOutDate: 'May 14, 2026', nights: 4, expectedTime: '11:00', source: 'Booking.com', status: 'Pending', isVip: true, balance: 4500, totalAmount: 24000 },
    { id: '102', name: 'Jane Cooper', phone: '+44 7700 900111', bookingRef: 'BK-10281', roomType: 'Standard Room', roomNumber: '215', roomTypeId: 'STD', plan: 'Room Only (EP)', pax: '1 Adult', checkInDate: 'May 12, 2026', checkOutDate: 'May 14, 2026', nights: 2, expectedTime: '10:30', source: 'Direct Booking', status: 'Checked Out', isVip: false, balance: 0, totalAmount: 8000 },
    { id: '103', name: 'Wade Warren', phone: '+91 9876500000', bookingRef: 'BK-10282', roomType: 'Executive Suite', roomNumber: '501', roomTypeId: 'STE', plan: 'Half Board (MAP)', pax: '2 Adults, 1 Child', checkInDate: 'May 13, 2026', checkOutDate: 'May 14, 2026', nights: 1, expectedTime: '12:00', source: 'Agoda', status: 'Pending', isVip: false, balance: 12000, totalAmount: 12000 },
    { id: '104', name: 'Esther Howard', phone: '+1 555-0199', bookingRef: 'BK-10283', roomType: 'Standard Room', roomNumber: '112', roomTypeId: 'STD', plan: 'Room Only (EP)', pax: '2 Adults', checkInDate: 'May 09, 2026', checkOutDate: 'May 14, 2026', nights: 5, expectedTime: '09:00', source: 'Expedia', status: 'Checked Out', isVip: false, balance: 0, totalAmount: 20000 },
    { id: '105', name: 'Cameron Williamson', phone: '+61 1900 654 321', bookingRef: 'BK-10284', roomType: 'Deluxe Ocean View', roomNumber: '308', roomTypeId: 'DLX', plan: 'Breakfast Included (CP)', pax: '2 Adults', checkInDate: 'May 11, 2026', checkOutDate: 'May 14, 2026', nights: 3, expectedTime: '11:30', source: 'Direct Booking', status: 'Pending', isVip: true, balance: 0, totalAmount: 18000 }
  ];

  get pendingDepartures() { return this.departures.filter(a => a.status === 'Pending').length; }
  get checkedOut() { return this.departures.filter(a => a.status === 'Checked Out').length; }
  get totalDepartures() { return this.departures.length; }

  // Check-Out Flow State
  checkOutModalOpen = false;
  selectedGuestForCheckOut: DepartureGuest | null = null;
  checkoutStep = 1; // 1: Clearance, 2: Settlement, 3: Services

  // Phase 1: Clearance
  minibarCharge = 0;
  lateCheckoutFee = 0;
  keysReturned = false;
  roomDamageReported = false;
  damageCharge = 0;
  damageDescription = '';

  // Phase 2: Billing
  paymentMethod = 'Credit Card';

  // Phase 3: Departure
  transportRequested = 'None';
  guestFeedback = 'Positive';

  get totalOutstanding(): number {
    if (!this.selectedGuestForCheckOut) return 0;
    return this.selectedGuestForCheckOut.balance + this.minibarCharge + this.lateCheckoutFee + this.damageCharge;
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
    if (this.selectedGuestForCheckOut) {
      this.selectedGuestForCheckOut.status = 'Checked Out';
      this.selectedGuestForCheckOut.balance = 0;
      this.selectedGuestForCheckOut.totalAmount += (this.minibarCharge + this.lateCheckoutFee + this.damageCharge);
    }
    this.closeCheckOutModal();
  }

  checkOut(guest: DepartureGuest) {
    this.openCheckOutModal(guest);
  }

  // Folio Flow State
  folioModalOpen = false;
  selectedGuestForFolio: DepartureGuest | null = null;

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
}
