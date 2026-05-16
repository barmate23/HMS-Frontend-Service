import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface GuestProfile {
  id: string;
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
export class GuestProfilesComponent {
  searchQuery = '';
  
  guests: GuestProfile[] = [
    { id: 'G-1001', firstName: 'Jacob', lastName: 'Jones', email: 'jacob.j@example.com', phone: '+1 202-555-0188', nationality: 'USA', vipStatus: true, totalStays: 12, totalSpent: 45000, lastVisit: 'May 10, 2026', notes: 'Prefers high floor' },
    { id: 'G-1002', firstName: 'Jane', lastName: 'Cooper', email: 'jane.c@example.com', phone: '+44 7700 900111', nationality: 'UK', vipStatus: false, totalStays: 2, totalSpent: 8500, lastVisit: 'Apr 15, 2026', notes: 'Allergic to peanuts' },
    { id: 'G-1003', firstName: 'Wade', lastName: 'Warren', email: 'wade.w@example.com', phone: '+91 9876500000', nationality: 'India', vipStatus: false, totalStays: 5, totalSpent: 22000, lastVisit: 'Mar 22, 2026', notes: 'Early check-in usually required' },
    { id: 'G-1004', firstName: 'Esther', lastName: 'Howard', email: 'esther.h@example.com', phone: '+1 555-0199', nationality: 'Canada', vipStatus: true, totalStays: 8, totalSpent: 34000, lastVisit: 'Feb 05, 2026', notes: 'Corporate rate applied' },
    { id: 'G-1005', firstName: 'Cameron', lastName: 'Williamson', email: 'cam.w@example.com', phone: '+61 1900 654 321', nationality: 'Australia', vipStatus: true, totalStays: 15, totalSpent: 62000, lastVisit: 'Jan 12, 2026', notes: 'Wine bottle in room' }
  ];

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

  // Modal State
  isModalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  
  // Form State
  currentGuest: Partial<GuestProfile> = {};

  openCreateModal() {
    this.modalMode = 'create';
    this.currentGuest = {
      id: 'G-' + Math.floor(1000 + Math.random() * 9000),
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
    this.currentGuest = { ...guest }; // clone
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.isModalOpen = false;
    document.body.style.overflow = '';
  }

  saveGuest() {
    if (this.modalMode === 'create') {
      this.guests.unshift(this.currentGuest as GuestProfile);
    } else {
      const idx = this.guests.findIndex(g => g.id === this.currentGuest.id);
      if (idx !== -1) {
        this.guests[idx] = this.currentGuest as GuestProfile;
      }
    }
    this.closeModal();
  }

  deleteGuest(id: string) {
    if (confirm('Are you sure you want to delete this guest profile?')) {
      this.guests = this.guests.filter(g => g.id !== id);
    }
  }
}
