import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
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
  gstPercent: number;
  taxAmount: number;
  totalWithTax: number;
  totalAmount: number;
}

@Component({
  selector: 'app-departures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departures.component.html',
  styleUrls: ['./departures.component.css']
})
export class DeparturesComponent implements OnInit, OnDestroy {
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

  checkoutToastVisible = false;
  checkoutToastSuccess = false;
  checkoutToastMessage = '';

  private routerSub?: Subscription;

  constructor(
    private readonly api: FrontOfficeApiService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    this.loadDepartures();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.includes('/departures'))
    ).subscribe(() => {
      this.loadDepartures();
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  statusFilter = 'ALL';

  get pendingDepartures() { return this.pendingCount; }
  get checkedOut() { return this.checkedOutCount; }
  get totalDepartures() { return this.totalCount || this.departures.length; }

  get filteredDepartures(): DepartureGuest[] {
    if (this.statusFilter === 'ALL') return this.departures;
    return this.departures.filter(d => d.status === this.statusFilter);
  }

  get totalOutstanding(): number {
    if (!this.selectedGuestForCheckOut) return 0;
    return this.selectedGuestForCheckOut.totalWithTax + Number(this.minibarCharge || 0) + Number(this.damageCharge || 0);
  }

  loadDepartures() {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.getArrivals(this.searchQuery, true).subscribe({
      next: response => {
        const data = response.data;
        const items = this.extractDepartureItems(data);
        this.departures = items.map(item => this.mapDeparture(item));
        this.pendingCount = data?.pendingArrivalsCount ?? data?.pendingDeparturesCount ?? this.departures.filter(d => d.status === 'Pending').length;
        this.checkedOutCount = data?.checkedInCount ?? data?.checkedOutCount ?? this.departures.filter(d => d.status === 'Checked Out').length;
        this.totalCount = data?.totalExpectedCount ?? data?.totalDeparturesCount ?? this.departures.length;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load departures.';
        this.isLoading = false;
      }
    });
  }

  private extractDepartureItems(data: any): any[] {
    if (!data) return [];

    if (Array.isArray(data.reservations) && data.reservations.length > 0) {
      const flattened: any[] = [];
      data.reservations.forEach((res: any) => {
        const bookings = Array.isArray(res.bookings) ? res.bookings : [];
        if (bookings.length > 0) {
          bookings.forEach((b: any) => {
            flattened.push({
              ...b,
              reservationId: res.reservationId,
              reservationRef: res.reservationRef,
              confirmationNumber: res.confirmationNumber || b.bookingRef,
              guestName: b.guestName || res.guestName || 'Guest',
              guestIsVip: b.guestIsVip ?? res.guestIsVip ?? false,
              eta: b.eta || res.eta || '11:00:00',
              numberOfNights: b.numberOfNights || res.numberOfNights || 0
            });
          });
        } else {
          flattened.push({
            bookingId: res.reservationId,
            bookingRef: res.confirmationNumber || res.reservationRef,
            guestName: res.guestName || 'Guest',
            guestIsVip: !!res.guestIsVip,
            numberOfNights: res.numberOfNights || 0,
            roomTypeName: 'Room',
            eta: res.eta || '11:00:00',
            balance: Number(res.totalBalance || 0),
            gstPercent: Number(res.gstPercent ?? 18),
            bookingStatus: res.overallStatus || 'Pending',
            checkInDate: res.checkInDate,
            checkOutDate: res.checkOutDate,
            roomNumber: '-'
          });
        }
      });
      return flattened;
    }

    if (Array.isArray(data.departures)) return data.departures;
    if (Array.isArray(data.arrivals)) return data.arrivals;

    return [];
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
    if (this.checkoutStep < 2) this.checkoutStep++;
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
      lateCheckOutFee: 0,
      minibarCharges: Number(this.minibarCharge || 0),
      roomDamageReported: this.roomDamageReported,
      damagePenaltyCharge: Number(this.damageCharge || 0),
      damageDescription: this.damageDescription,
      paymentMethod: this.paymentMethod,
      amountToCollect: this.totalOutstanding,
      transportationRequested: this.transportRequested,
      guestFeedback: this.guestFeedback
    }).subscribe({
      next: (res) => {
        const msg = res.message || 'Guest checked out successfully.';
        this.checkoutToastSuccess = true;
        this.checkoutToastMessage = msg;
        this.checkoutToastVisible = true;
        setTimeout(() => {
          this.checkoutToastVisible = false;
          this.closeCheckOutModal();
          this.loadDepartures();
          this.router.navigate(['/billing/folios']);
        }, 2000);
      },
      error: (err) => {
        const apiMsg = err?.error?.message || err?.error?.error?.message || 'Unable to finalize check-out.';
        this.checkoutToastSuccess = false;
        this.checkoutToastMessage = apiMsg;
        this.checkoutToastVisible = true;
        setTimeout(() => { this.checkoutToastVisible = false; }, 5000);
      }
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

  private mapDeparture(item: any): DepartureGuest {
    const normalizedStatus = (item.bookingStatus || item.status || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const checkedOut = normalizedStatus === 'CHECKEDOUT';

    const amounts = parseAmountDetails(
      item.balance ?? item.totalBalance ?? item.totalAmount,
      item.amountExcludingGst ?? item.baseAmount ?? item.totalBaseAmount,
      item.gstPercent,
      item.taxAmount ?? item.taxationAmount ?? item.gstAmount
    );

    return {
      id: String(item.bookingId || item.id || ''),
      bookingId: Number(item.bookingId || item.id || 0),
      name: item.guestName || item.name || 'Guest',
      phone: item.guestPhone || item.phone || '',
      bookingRef: item.confirmationNumber || item.bookingRef || item.reservationRef || `BK-${item.bookingId || item.id}`,
      roomType: item.roomTypeName || item.roomType || 'Room',
      roomNumber: item.roomNumber || '-',
      roomTypeId: item.roomTypeName || '-',
      plan: item.ratePlanName || '-',
      pax: '-',
      checkInDate: item.checkInDate || '',
      checkOutDate: item.checkOutDate || '',
      nights: item.numberOfNights || 0,
      expectedTime: item.eta || '11:00:00',
      source: '-',
      status: checkedOut ? 'Checked Out' : 'Pending',
      isVip: !!item.guestIsVip,
      balance: amounts.baseAmount,
      gstPercent: amounts.gstPercent,
      taxAmount: amounts.taxAmount,
      totalWithTax: amounts.totalAmount,
      totalAmount: amounts.totalAmount
    };
  }
}

function parseAmountDetails(totalOrBalance?: number, amountExcludingGst?: number, gstPct = 18, rawTaxAmount?: number) {
  const totalInput = Number(totalOrBalance || 0);
  const baseInput = (amountExcludingGst !== undefined && amountExcludingGst !== null) ? Number(amountExcludingGst) : undefined;
  const gstPercent = Number(gstPct ?? 18);

  let baseAmount: number;
  let taxAmount: number;
  let totalAmount: number;

  if (baseInput !== undefined && baseInput > 0) {
    baseAmount = baseInput;
    if (totalInput > 0) {
      totalAmount = totalInput;
      taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
    } else {
      taxAmount = Math.round((baseAmount * (gstPercent / 100)) * 100) / 100;
      totalAmount = Math.round((baseAmount + taxAmount) * 100) / 100;
    }
  } else if (rawTaxAmount !== undefined && rawTaxAmount !== null && rawTaxAmount > 0) {
    taxAmount = Number(rawTaxAmount);
    totalAmount = totalInput > 0 ? totalInput : Math.round((taxAmount / (gstPercent / 100)) * 100) / 100 + taxAmount;
    baseAmount = Math.round((totalAmount - taxAmount) * 100) / 100;
  } else {
    totalAmount = totalInput;
    baseAmount = Math.round((totalAmount / (1 + gstPercent / 100)) * 100) / 100;
    taxAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  }

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    gstPercent
  };
}
