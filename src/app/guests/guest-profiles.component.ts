import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FrontOfficeApiService, GuestApiItem, GuestRequest } from '../front-office-api.service';

export interface GuestProfile {
  id: string;
  apiId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  vipStatus: boolean;
  totalStays: number;
  totalSpent: number;
  lastVisit: string;
  notes: string;
}

@Component({
  selector: 'app-guest-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guest-profiles.component.html',
  styleUrls: ['./guest-profiles.component.css']
})
export class GuestProfilesComponent implements OnInit {
  searchQuery = '';
  guests: GuestProfile[] = [];
  isLoading = false;
  errorMessage = '';
  isModalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  currentGuest: Partial<GuestProfile> = {};

  constructor(private readonly api: FrontOfficeApiService) {}

  ngOnInit() {
    this.loadGuests();
  }

  get filteredGuests() {
    if (!this.searchQuery) return this.guests;
    const lowerQ = this.searchQuery.toLowerCase();
    return this.guests.filter(g =>
      g.firstName.toLowerCase().includes(lowerQ) ||
      g.lastName.toLowerCase().includes(lowerQ) ||
      g.email.toLowerCase().includes(lowerQ) ||
      g.phone.includes(lowerQ) ||
      g.id.toLowerCase().includes(lowerQ)
    );
  }

  loadGuests() {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.getGuests().subscribe({
      next: response => {
        this.guests = (response.data || []).map(guest => this.mapGuest(guest));
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load guests.';
        this.isLoading = false;
      }
    });
  }

  openCreateModal() {
    this.modalMode = 'create';
    this.currentGuest = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      nationality: '',
      vipStatus: false,
      totalStays: 0,
      totalSpent: 0,
      lastVisit: '-',
      notes: ''
    };
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openEditModal(guest: GuestProfile) {
    this.modalMode = 'edit';
    this.currentGuest = { ...guest };
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.isModalOpen = false;
    document.body.style.overflow = '';
  }

  saveGuest() {
    const payload = this.toGuestRequest(this.currentGuest);
    const request = this.modalMode === 'create' || !this.currentGuest.apiId
      ? this.api.createGuest(payload)
      : this.api.updateGuest(this.currentGuest.apiId, payload);

    request.subscribe({
      next: () => {
        this.closeModal();
        this.loadGuests();
      },
      error: () => this.errorMessage = 'Unable to save guest.'
    });
  }

  deleteGuest(id: string) {
    const guest = this.guests.find(g => g.id === id);
    if (!guest?.apiId || !confirm('Are you sure you want to delete this guest profile?')) return;

    this.api.deleteGuest(guest.apiId).subscribe({
      next: () => this.loadGuests(),
      error: () => this.errorMessage = 'Unable to delete guest.'
    });
  }

  private mapGuest(guest: GuestApiItem): GuestProfile {
    return {
      id: `G-${guest.id}`,
      apiId: guest.id,
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      email: guest.email || '',
      phone: `${guest.countryCode || ''} ${guest.phone || ''}`.trim(),
      nationality: guest.nationality || guest.country || '',
      vipStatus: !!guest.isVip,
      totalStays: 0,
      totalSpent: 0,
      lastVisit: '-',
      notes: guest.guestNotes || guest.preference || ''
    };
  }

  private toGuestRequest(guest: Partial<GuestProfile>): GuestRequest {
    const phone = guest.phone || '';
    return {
      title: 'MR',
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      countryCode: phone.startsWith('+') ? phone.split(' ')[0] : '',
      phone: phone.startsWith('+') ? phone.split(' ').slice(1).join(' ') || phone : phone,
      email: guest.email || '',
      nationality: guest.nationality || '',
      guestNotes: guest.notes || '',
      isVip: !!guest.vipStatus
    };
  }
}
