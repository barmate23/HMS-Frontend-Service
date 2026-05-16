import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ArrivalGuest {
  id: string;
  name: string;
  phone: string;
  bookingRef: string;
  roomType: string;
  roomTypeId: string;
  plan: string;
  pax: string; // e.g. "2 Adults, 1 Child"
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  expectedTime: string;
  source: string; // e.g. "Direct", "Booking.com"
  status: 'Pending' | 'Checked In';
  isVip: boolean;
  amountDue: number;
  totalAmount: number;
}

@Component({
  selector: 'app-arrivals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css']
})
export class ArrivalsComponent {
  currentDate = new Date();

  // Mock data for today's arrivals
  arrivals: ArrivalGuest[] = [
    { id: '1', name: 'Robert Fox', phone: '+91 9876543210', bookingRef: 'BK-10293', roomType: 'Deluxe Ocean View', roomTypeId: 'DLX', plan: 'Breakfast Included (CP)', pax: '2 Adults', checkInDate: 'May 14, 2026', checkOutDate: 'May 17, 2026', nights: 3, expectedTime: '14:00', source: 'Direct Booking', status: 'Pending', isVip: true, amountDue: 15600, totalAmount: 15600 },
    { id: '2', name: 'Kristin Watson', phone: '+1 555-0198', bookingRef: 'BK-10294', roomType: 'Standard Room', roomTypeId: 'STD', plan: 'Room Only (EP)', pax: '1 Adult', checkInDate: 'May 14, 2026', checkOutDate: 'May 15, 2026', nights: 1, expectedTime: '15:30', source: 'Booking.com', status: 'Checked In', isVip: false, amountDue: 0, totalAmount: 4500 },
    { id: '3', name: 'Guy Hawkins', phone: '+44 7700 900077', bookingRef: 'BK-10295', roomType: 'Executive Suite', roomTypeId: 'STE', plan: 'Half Board (MAP)', pax: '2 Adults, 2 Children', checkInDate: 'May 14, 2026', checkOutDate: 'May 16, 2026', nights: 2, expectedTime: '18:00', source: 'Agoda', status: 'Pending', isVip: false, amountDue: 24000, totalAmount: 24000 },
    { id: '4', name: 'Eleanor Pena', phone: '+91 9123456789', bookingRef: 'BK-10296', roomType: 'Deluxe Ocean View', roomTypeId: 'DLX', plan: 'Breakfast Included (CP)', pax: '2 Adults', checkInDate: 'May 14, 2026', checkOutDate: 'May 19, 2026', nights: 5, expectedTime: '12:00', source: 'Direct Booking', status: 'Pending', isVip: true, amountDue: 4500, totalAmount: 26000 },
    { id: '5', name: 'Marvin McKinney', phone: '+1 555-0123', bookingRef: 'BK-10297', roomType: 'Standard Room', roomTypeId: 'STD', plan: 'Room Only (EP)', pax: '1 Adult', checkInDate: 'May 14, 2026', checkOutDate: 'May 16, 2026', nights: 2, expectedTime: '10:00', source: 'Expedia', status: 'Checked In', isVip: false, amountDue: 0, totalAmount: 9000 }
  ];

  get pendingArrivals() { return this.arrivals.filter(a => a.status === 'Pending').length; }
  get checkedIn() { return this.arrivals.filter(a => a.status === 'Checked In').length; }
  get totalArrivals() { return this.arrivals.length; }

  // Check-In Flow State
  checkInModalOpen = false;
  selectedGuestForCheckIn: ArrivalGuest | null = null;
  assignedRoomNumber = '';
  paymentMethod = 'Credit Card';

  openCheckInModal(guest: ArrivalGuest) {
    this.selectedGuestForCheckIn = guest;
    // Auto-assign a random mock room number for the demo
    this.assignedRoomNumber = Math.floor(100 + Math.random() * 900).toString();
    this.checkInModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeCheckInModal() {
    this.checkInModalOpen = false;
    this.selectedGuestForCheckIn = null;
    document.body.style.overflow = '';
  }

  confirmCheckIn() {
    if (this.selectedGuestForCheckIn) {
      this.selectedGuestForCheckIn.status = 'Checked In';
      this.selectedGuestForCheckIn.amountDue = 0; // Mark as paid
    }
    this.closeCheckInModal();
  }

  checkIn(guest: ArrivalGuest) {
    this.openCheckInModal(guest);
  }

  // Folio Flow State
  folioModalOpen = false;
  selectedGuestForFolio: ArrivalGuest | null = null;

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
}
