import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription, forkJoin } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  ArrivalApiData,
  ArrivalApiItem,
  ArrivalBookingItem,
  ArrivalReservationItem,
  CheckInBookingItem,
  CheckInRequest,
  FrontOfficeApiService
} from '../../front-office-api.service';

export interface ArrivalRoomBooking {
  bookingId: number;
  roomId?: number;
  bookingRef: string;
  guestName: string;
  guestIsVip: boolean;
  numberOfNights: number;
  roomTypeName: string;
  eta: string;
  balance: number;
  gstPercent: number;
  taxAmount: number;
  totalWithTax: number;
  bookingStatus: 'Pending' | 'Checked In';
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
  selected?: boolean;
}

export interface ArrivalReservationGroup {
  reservationId: number;
  reservationRef: string;
  guestName: string;
  guestIsVip: boolean;
  numberOfNights: number;
  checkInDate: string;
  checkOutDate: string;
  eta: string;
  totalBalance: number;
  gstPercent: number;
  taxAmount: number;
  totalAmount: number;
  overallStatus: 'Pending' | 'Partially Checked In' | 'Checked In';
  numberOfRooms: number;
  bookings: ArrivalRoomBooking[];
}

@Component({
  selector: 'app-arrivals',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './arrivals.component.html',
  styleUrls: ['./arrivals.component.css']
})
export class ArrivalsComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  searchQuery = '';
  statusFilter: 'ALL' | 'Pending' | 'Partially Checked In' | 'Checked In' = 'ALL';

  reservations: ArrivalReservationGroup[] = [];
  pendingCount = 0;
  checkedInCount = 0;
  totalExpectedCount = 0;
  isLoading = false;
  errorMessage = '';

  // Pagination state
  currentPage = 0;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 1;

  // View Room-wise Modal
  viewModalOpen = false;
  selectedReservation: ArrivalReservationGroup | null = null;

  // Check-In Modal
  checkInModalOpen = false;
  isBulkCheckIn = false;
  selectedBookingsForCheckIn: ArrivalRoomBooking[] = [];
  assignedRoomNumber = '';
  paymentMethod = 'Credit Card';
  idVerification = 'Passport Verified';
  amountToSettle = 0;
  isCheckingIn = false;

  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private routerSub?: Subscription;

  constructor(private readonly api: FrontOfficeApiService) {}

  private extractErrorMessage(err: any): string {
    if (!err) return 'Unable to complete check-in.';
    const body = err.error || err;
    const detail = body.error?.details || body.details;
    const mainMsg = body.error?.message || body.message;

    if (detail && mainMsg && detail !== mainMsg) {
      return `${mainMsg}: ${detail}`;
    }
    return detail || mainMsg || (typeof err === 'string' ? err : 'Unable to complete check-in.');
  }

  private showSnackBar(message: string, isError = true): void {
    this.snackBar.open(message, 'Close', {
      duration: isError ? 6000 : 3000,
      verticalPosition: 'top',
      horizontalPosition: 'right',
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }

  ngOnInit() {
    this.loadArrivals();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url.includes('/arrivals'))
    ).subscribe(() => {
      this.loadArrivals();
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  get pendingArrivals() { return this.pendingCount; }
  get checkedIn() { return this.checkedInCount; }
  get totalArrivals() { return this.totalExpectedCount || this.totalRecords; }

  get filteredReservations(): ArrivalReservationGroup[] {
    if (this.statusFilter === 'ALL') return this.reservations;
    return this.reservations.filter(res => res.overallStatus === this.statusFilter);
  }

  loadArrivals(page = this.currentPage) {
    this.isLoading = true;
    this.errorMessage = '';
    this.currentPage = page;

    this.api.getArrivals(this.searchQuery, false, this.currentPage, this.pageSize).subscribe({
      next: response => {
        const data = response.data;
        const meta = response.metadata;

        this.pendingCount = data?.pendingArrivalsCount ?? 0;
        this.checkedInCount = data?.checkedInCount ?? 0;
        this.totalExpectedCount = data?.totalExpectedCount ?? 0;

        if (meta) {
          this.totalRecords = meta.totalRecords ?? 0;
          this.currentPage = meta.currentPage ?? this.currentPage;
          this.pageSize = meta.pageSize ?? this.pageSize;
        }

        if (data?.reservations && data.reservations.length > 0) {
          this.reservations = data.reservations.map(res => this.mapReservationGroup(res));
          if (!meta || meta.totalRecords === undefined) {
            this.totalRecords = this.reservations.length;
          }
        } else if (data?.arrivals && data.arrivals.length > 0) {
          this.reservations = this.groupFlatArrivals(data.arrivals);
          if (!meta || meta.totalRecords === undefined) {
            this.totalRecords = this.reservations.length;
          }
        } else {
          this.reservations = [];
          if (!meta || meta.totalRecords === undefined) {
            this.totalRecords = 0;
          }
        }

        this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
        this.isLoading = false;

        // Keep view modal reference updated if open
        if (this.selectedReservation) {
          const updated = this.reservations.find(r => r.reservationId === this.selectedReservation!.reservationId || r.reservationRef === this.selectedReservation!.reservationRef);
          if (updated) this.selectedReservation = updated;
        }
      },
      error: () => {
        this.errorMessage = 'Unable to load arrivals.';
        this.isLoading = false;
      }
    });
  }

  onPageChange(page: number) {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) return;
    this.loadArrivals(page);
  }

  onPageSizeChange(size: number) {
    this.pageSize = Number(size);
    this.currentPage = 0;
    this.loadArrivals(0);
  }

  // Room View Modal
  openViewModal(res: ArrivalReservationGroup) {
    this.selectedReservation = res;
    // reset selection state
    this.selectedReservation.bookings.forEach(b => b.selected = false);
    this.viewModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeViewModal() {
    this.viewModalOpen = false;
    this.selectedReservation = null;
    document.body.style.overflow = '';
  }

  getSelectedPendingRooms(): ArrivalRoomBooking[] {
    if (!this.selectedReservation) return [];
    return this.selectedReservation.bookings.filter(b => b.bookingStatus !== 'Checked In' && b.selected);
  }

  toggleSelectAllPending(checked: boolean) {
    if (!this.selectedReservation) return;
    this.selectedReservation.bookings.forEach(b => {
      if (b.bookingStatus !== 'Checked In') {
        b.selected = checked;
      }
    });
  }

  isAllPendingSelected(): boolean {
    if (!this.selectedReservation) return false;
    const pending = this.selectedReservation.bookings.filter(b => b.bookingStatus !== 'Checked In');
    return pending.length > 0 && pending.every(b => b.selected);
  }

  openCheckInModalForBooking(room: ArrivalRoomBooking) {
    this.errorMessage = '';
    this.isBulkCheckIn = false;
    this.selectedBookingsForCheckIn = [room];
    this.assignedRoomNumber = room.roomNumber !== '-' ? room.roomNumber : '';
    this.paymentMethod = 'Credit Card';
    this.idVerification = 'Passport Verified';
    this.amountToSettle = room.totalWithTax || room.balance || 0;
    this.checkInModalOpen = true;
  }

  openBulkCheckInModal() {
    this.errorMessage = '';
    const selected = this.getSelectedPendingRooms();
    if (!selected.length) return;
    this.isBulkCheckIn = true;
    this.selectedBookingsForCheckIn = selected;
    this.assignedRoomNumber = selected.length === 1 && selected[0].roomNumber !== '-' ? selected[0].roomNumber : '';
    this.paymentMethod = 'Credit Card';
    this.idVerification = 'Passport Verified';
    this.amountToSettle = selected.reduce((sum: number, b: ArrivalRoomBooking) => sum + (b.totalWithTax || b.balance), 0);
    this.checkInModalOpen = true;
  }

  closeCheckInModal() {
    this.checkInModalOpen = false;
    this.selectedBookingsForCheckIn = [];
    this.isCheckingIn = false;
    this.errorMessage = '';
  }

  confirmCheckIn() {
    if (!this.selectedBookingsForCheckIn.length) return;

    this.errorMessage = '';
    this.isCheckingIn = true;
    const reservationId = this.selectedReservation?.reservationId;

    const bookingsArr: CheckInBookingItem[] = this.selectedBookingsForCheckIn.map(b => {
      const roomNum = !this.isBulkCheckIn && this.assignedRoomNumber ? this.assignedRoomNumber : b.roomNumber;
      // Use numeric roomId from backend if present, else fallback to numeric roomNum or bookingId
      const targetRoomId = b.roomId ? Number(b.roomId) : (Number(roomNum) || b.bookingId);
      return {
        bookingId: b.bookingId,
        roomId: targetRoomId
      };
    });

    const payload: CheckInRequest = {
      reservationId: reservationId,
      bookings: bookingsArr,
      idVerification: this.idVerification,
      paymentMethod: this.paymentMethod,
      amountToSettle: Number(this.amountToSettle) || 0
    };

    this.api.checkIn(payload).subscribe({
      next: (res: any) => {
        this.isCheckingIn = false;
        if (res && res.success === false) {
          const detailMsg = this.extractErrorMessage(res);
          this.errorMessage = detailMsg;
          this.showSnackBar(detailMsg, true);
        } else {
          this.closeCheckInModal();
          this.loadArrivals();
          this.showSnackBar('Check-in completed successfully!', false);
        }
      },
      error: (err) => {
        this.isCheckingIn = false;
        const detailMsg = this.extractErrorMessage(err);
        this.errorMessage = detailMsg;
        this.showSnackBar(detailMsg, true);
        this.loadArrivals();
      }
    });
  }

  private mapReservationGroup(res: ArrivalReservationItem): ArrivalReservationGroup {
    const bookings: ArrivalRoomBooking[] = (res.bookings || []).map(b => {
      const isCheckedIn = (b.bookingStatus || '').replace(/[^A-Za-z]/g, '').toUpperCase() === 'CHECKEDIN';
      const bAmounts = parseAmountDetails(
        b.balance ?? b.totalAmount,
        b.amountExcludingGst ?? b.baseAmount,
        b.gstPercent ?? res.gstPercent,
        b.taxAmount ?? b.gstAmount
      );
      return {
        bookingId: b.bookingId,
        roomId: b.roomId,
        bookingRef: b.confirmationNumber || b.bookingRef || `BK-${b.bookingId}`,
        guestName: b.guestName || res.guestName || 'Guest',
        guestIsVip: b.guestIsVip ?? res.guestIsVip ?? false,
        numberOfNights: b.numberOfNights || res.numberOfNights || 0,
        roomTypeName: b.roomTypeName || 'Room',
        eta: b.eta || res.eta || '14:00:00',
        balance: bAmounts.baseAmount,
        gstPercent: bAmounts.gstPercent,
        taxAmount: bAmounts.taxAmount,
        totalWithTax: bAmounts.totalAmount,
        bookingStatus: isCheckedIn ? 'Checked In' : 'Pending',
        checkInDate: b.checkInDate || res.checkInDate,
        checkOutDate: b.checkOutDate || res.checkOutDate,
        roomNumber: b.roomNumber || '-',
        selected: false
      };
    });

    const checkedInBookings = bookings.filter(b => b.bookingStatus === 'Checked In').length;
    const overallStatus: 'Pending' | 'Partially Checked In' | 'Checked In' =
      checkedInBookings === bookings.length && bookings.length > 0
        ? 'Checked In'
        : checkedInBookings > 0
          ? 'Partially Checked In'
          : 'Pending';

    const resAmounts = parseAmountDetails(
      res.totalBalance ?? res.totalAmount ?? (bookings.length ? bookings.reduce((sum, b) => sum + b.totalWithTax, 0) : 0),
      res.amountExcludingGst ?? res.totalBaseAmount ?? res.baseAmount ?? (bookings.length ? bookings.reduce((sum, b) => sum + b.balance, 0) : 0),
      res.gstPercent ?? 18,
      res.taxAmount ?? res.gstAmount
    );

    return {
      reservationId: res.reservationId,
      reservationRef: res.reservationRef || `RES-${res.reservationId}`,
      guestName: res.guestName || 'Guest',
      guestIsVip: !!res.guestIsVip,
      numberOfNights: res.numberOfNights || (bookings[0]?.numberOfNights || 0),
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      eta: res.eta || '14:00:00',
      totalBalance: resAmounts.baseAmount,
      gstPercent: resAmounts.gstPercent,
      taxAmount: resAmounts.taxAmount,
      totalAmount: resAmounts.totalAmount,
      overallStatus: (res.overallStatus as any) || overallStatus,
      numberOfRooms: res.numberOfRooms || bookings.length,
      bookings
    };
  }

  private groupFlatArrivals(items: ArrivalApiItem[]): ArrivalReservationGroup[] {
    const map = new Map<string, ArrivalApiItem[]>();
    items.forEach(item => {
      const key = item.confirmationNumber || item.bookingRef || `REF-${item.bookingId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    const groups: ArrivalReservationGroup[] = [];
    map.forEach((flatItems, key) => {
      const first = flatItems[0];
      const bookings: ArrivalRoomBooking[] = flatItems.map(item => {
        const isCheckedIn = (item.bookingStatus || '').replace(/[^A-Za-z]/g, '').toUpperCase() === 'CHECKEDIN';
        const bAmounts = parseAmountDetails(
          item.balance ?? item.totalAmount,
          item.amountExcludingGst ?? item.baseAmount ?? item.totalBaseAmount,
          item.gstPercent,
          item.taxAmount ?? item.taxationAmount ?? item.gstAmount
        );
        return {
          bookingId: item.bookingId,
          roomId: item.roomId,
          bookingRef: item.confirmationNumber || item.bookingRef,
          guestName: item.guestName || 'Guest',
          guestIsVip: !!item.guestIsVip,
          numberOfNights: item.numberOfNights || 0,
          roomTypeName: item.roomTypeName || 'Room',
          eta: item.eta || '-',
          balance: bAmounts.baseAmount,
          gstPercent: bAmounts.gstPercent,
          taxAmount: bAmounts.taxAmount,
          totalWithTax: bAmounts.totalAmount,
          bookingStatus: isCheckedIn ? 'Checked In' : 'Pending',
          checkInDate: item.checkInDate,
          checkOutDate: item.checkOutDate,
          roomNumber: item.roomNumber || '-',
          selected: false
        };
      });

      const totalBalance = bookings.reduce((sum, b) => sum + b.balance, 0);
      const taxAmount = bookings.reduce((sum, b) => sum + b.taxAmount, 0);
      const totalAmount = bookings.reduce((sum, b) => sum + b.totalWithTax, 0);
      const checkedInCount = bookings.filter(b => b.bookingStatus === 'Checked In').length;

      const overallStatus: 'Pending' | 'Partially Checked In' | 'Checked In' =
        checkedInCount === bookings.length
          ? 'Checked In'
          : checkedInCount > 0
            ? 'Partially Checked In'
            : 'Pending';

      groups.push({
        reservationId: first.bookingId,
        reservationRef: key,
        guestName: first.guestName || 'Guest',
        guestIsVip: !!first.guestIsVip,
        numberOfNights: first.numberOfNights || 0,
        checkInDate: first.checkInDate,
        checkOutDate: first.checkOutDate,
        eta: first.eta || '-',
        totalBalance: Math.round(totalBalance * 100) / 100,
        gstPercent: first.gstPercent ?? 18,
        taxAmount: Math.round(taxAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        overallStatus,
        numberOfRooms: bookings.length,
        bookings
      });
    });

    return groups;
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
