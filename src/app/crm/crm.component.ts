import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CrmApiService, EnquiryApiItem } from './crm-api.service';

export interface Enquiry {
  id: string;
  dbId?: number;
  salutation?: string;
  guestName: string;
  companyName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstNumber?: string;
  enquiryType: string;
  source: string;
  checkIn?: string;
  checkOut?: string;
  rooms: number;
  adults: number;
  children: number;
  mealPlan?: string;
  budget: number;
  expectedRevenue: number;
  salesPerson: string;
  priority: string;
  nextFollowUp?: string;
  message?: string;
  status: 'New' | 'In Progress' | 'Quotation Sent' | 'Negotiation' | 'Hold' | 'Confirmed' | 'Booked' | 'Lost';
  quoted: 'Yes' | 'No';
  lastContacted: string;
  latestRemark: string;
  showDetails?: boolean;
}

export interface Quotation {
  quotationNo: string;
  revision: number;
  date: string;
  enquiryId: string;
  guestName: string;
  companyName?: string;
  total: number;
  validTill: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined';
}

export interface SalesMember {
  name: string;
  designation: string;
  phone: string;
  email: string;
  monthlyTarget: number;
}

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './crm.component.html',
  styleUrls: ['./crm.component.css']
})
export class CrmComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly crmApi = inject(CrmApiService);
  private readonly snackBar = inject(MatSnackBar);

  currentTab = signal<'dashboard' | 'new' | 'list' | 'quotations' | 'sales'>('dashboard');
  isLoading = signal(false);
  editingEnquiryId = signal<number | null>(null);

  ngOnInit() {
    this.syncTabFromUrl(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(event => {
      this.syncTabFromUrl(event.urlAfterRedirects || event.url);
    });

    // Load enquiries from backend API
    this.loadEnquiries();
  }

  loadEnquiries(search?: string) {
    this.isLoading.set(true);
    this.crmApi.getAllEnquiries(search).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const mapped: Enquiry[] = res.data.map(item => ({
            id: item.enquiryRef,
            dbId: item.id,
            salutation: item.salutation,
            guestName: item.guestName,
            companyName: item.companyName || '',
            phone: item.phone,
            altPhone: item.altPhone,
            email: item.email || '',
            address: item.address,
            city: item.city,
            state: item.state,
            gstNumber: item.gstNumber,
            enquiryType: item.enquiryType || 'Room',
            source: item.source || 'Direct',
            checkIn: item.checkIn,
            checkOut: item.checkOut,
            rooms: item.rooms || 0,
            adults: item.adults || 1,
            children: item.children || 0,
            mealPlan: item.mealPlan,
            budget: item.budget || 0,
            expectedRevenue: item.expectedRevenue || 0,
            salesPerson: item.salesPerson || '',
            priority: item.priority || 'Medium',
            nextFollowUp: item.nextFollowUp,
            message: item.message,
            status: (item.status || 'New') as Enquiry['status'],
            quoted: (item.quoted || 'No') as Enquiry['quoted'],
            lastContacted: item.lastContacted || 'Never',
            latestRemark: item.latestRemark || 'No remarks yet',
            showDetails: false
          }));
          this.enquiries.set(mapped);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load enquiries:', err);
        this.isLoading.set(false);
      }
    });
  }

  private syncTabFromUrl(url: string) {
    if (url.includes('/crm/tasks')) this.currentTab.set('list');
    else if (url.includes('/crm/new')) this.currentTab.set('new');
    else if (url.includes('/crm/quotations')) this.currentTab.set('quotations');
    else if (url.includes('/crm/staff')) this.currentTab.set('sales');
    else if (url.includes('/crm/dashboard')) this.currentTab.set('dashboard');
  }

  setTab(tab: 'dashboard' | 'new' | 'list' | 'quotations' | 'sales') {
    this.currentTab.set(tab);
    const routeMap = {
      dashboard: '/crm/dashboard',
      list: '/crm/tasks',
      new: '/crm/new',
      quotations: '/crm/quotations',
      sales: '/crm/staff'
    };
    this.router.navigateByUrl(routeMap[tab]);
  }


  // Search and filter states
  searchText = signal('');
  statusFilter = signal('ALL');
  salesPersonFilter = signal('ALL');

  // Modal forms trigger
  isQuotationModalOpen = signal(false);
  isSalesModalOpen = signal(false);
  isQuotationViewModalOpen = signal(false);
  selectedQuotation = signal<Quotation | null>(null);
  linkedEnquiry = signal<Enquiry | null>(null);


  // Modal models
  newQuotation = {
    enquiryId: '',
    guestName: '',
    companyName: '',
    total: 0,
    validTill: ''
  };

  newSalesMemberObj = {
    name: '',
    designation: 'Front Office Executive',
    phone: '',
    email: '',
    monthlyTarget: 500000
  };

  // Form Model
  newEnquiry = {
    salutation: 'Mr.',
    guestName: '',
    companyName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    gstNumber: '',
    enquiryType: 'Room',
    source: '',
    checkIn: '',
    checkOut: '',
    rooms: 1,
    adults: 2,
    children: 0,
    mealPlan: 'CP',
    budget: 0,
    expectedRevenue: 0,
    salesPerson: '',
    priority: 'Medium',
    nextFollowUp: '',
    message: ''
  };

  // Enquiries data (loaded from API)
  enquiries = signal<Enquiry[]>([]);

  quotations = signal<Quotation[]>([
    {
      quotationNo: 'QTN-2026-0003',
      revision: 1,
      date: '10-Jul-2026',
      enquiryId: 'ENQ-2026-0014',
      guestName: 'Alok Kapoor',
      total: 2200.00,
      validTill: '17-Jul-2026',
      status: 'Draft'
    },
    {
      quotationNo: 'QTN-2026-0002',
      revision: 0,
      date: '09-Jul-2026',
      enquiryId: 'ENQ-2026-0005',
      guestName: 'somdev goyal',
      total: 3150.00,
      validTill: '16-Jul-2026',
      status: 'Draft'
    },
    {
      quotationNo: 'QTN-2026-0001',
      revision: 0,
      date: '07-Jul-2026',
      enquiryId: 'ENQ-2026-0001',
      guestName: 'Anil Sir',
      companyName: 'SUN INSTITUTE OF PHARMACEUTICAL EDUCATION & RESEARCH (SIPER)',
      total: 26250.00,
      validTill: '14-Jul-2026',
      status: 'Draft'
    }
  ]);

  salesTeam = signal<SalesMember[]>([
    { name: 'Aman Rajawat', designation: 'Front office', phone: '7489 711 220', email: '', monthlyTarget: 800000.00 },
    { name: 'Khushbu', designation: 'Front Office Executive', phone: '7389203572', email: 'hotclambiencc2015@gmail.com', monthlyTarget: 800000.00 },
    { name: 'Rishi Chauhan', designation: 'Sales Manager', phone: '7880096602', email: 'hotelambience2015@gmail.com', monthlyTarget: 1000000.00 },
    { name: 'Suraj Tomar', designation: 'Front office', phone: '96914 90829', email: '', monthlyTarget: 700000.00 }
  ]);



  // Filter enquiries
  filteredEnquiries() {
    return this.enquiries().filter(e => {
      const matchesSearch = 
        e.guestName.toLowerCase().includes(this.searchText().toLowerCase()) ||
        (e.companyName && e.companyName.toLowerCase().includes(this.searchText().toLowerCase())) ||
        e.phone.includes(this.searchText());
      
      const matchesStatus = this.statusFilter() === 'ALL' || e.status.toUpperCase() === this.statusFilter().toUpperCase();
      const matchesSales = this.salesPersonFilter() === 'ALL' || e.salesPerson.toLowerCase() === this.salesPersonFilter().toLowerCase();

      return matchesSearch && matchesStatus && matchesSales;
    });
  }

  // Set form to edit mode with existing record data
  editEnquiry(item: Enquiry) {
    if (!item.dbId) {
      this.snackBar.open('Cannot edit enquiry: missing database ID', 'Close', { duration: 3000 });
      return;
    }
    this.editingEnquiryId.set(item.dbId);
    this.newEnquiry = {
      salutation: item.salutation || 'Mr.',
      guestName: item.guestName,
      companyName: item.companyName || '',
      phone: item.phone,
      altPhone: item.altPhone || '',
      email: item.email || '',
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      gstNumber: item.gstNumber || '',
      enquiryType: item.enquiryType || 'Room',
      source: item.source || '',
      checkIn: item.checkIn || '',
      checkOut: item.checkOut || '',
      rooms: item.rooms || 1,
      adults: item.adults || 2,
      children: item.children || 0,
      mealPlan: item.mealPlan || 'CP',
      budget: item.budget || 0,
      expectedRevenue: item.expectedRevenue || 0,
      salesPerson: item.salesPerson || '',
      priority: item.priority || 'Medium',
      nextFollowUp: item.nextFollowUp || '',
      message: item.message || ''
    };
    this.setTab('new');
  }

  // Cancel form edit/creation and clear fields
  cancelEnquiryForm() {
    this.editingEnquiryId.set(null);
    this.newEnquiry = {
      salutation: 'Mr.',
      guestName: '',
      companyName: '',
      phone: '',
      altPhone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      gstNumber: '',
      enquiryType: 'Room',
      source: '',
      checkIn: '',
      checkOut: '',
      rooms: 1,
      adults: 2,
      children: 0,
      mealPlan: 'CP',
      budget: 0,
      expectedRevenue: 0,
      salesPerson: '',
      priority: 'Medium',
      nextFollowUp: '',
      message: ''
    };
    this.setTab('list');
  }

  // Toggle detail rows (fallback or for display logic if needed)
  toggleDetails(enquiry: Enquiry) {
    this.editEnquiry(enquiry);
  }

  // Delete Enquiry (calls backend API and shows SnackBar)
  deleteEnquiry(id: string) {
    const enquiry = this.enquiries().find(e => e.id === id);
    if (!enquiry) return;

    if (confirm(`Are you sure you want to delete enquiry ${id}?`)) {
      if (enquiry.dbId) {
        this.crmApi.deleteEnquiry(enquiry.dbId).subscribe({
          next: (res) => {
            if (res.success) {
              this.enquiries.update(list => list.filter(e => e.id !== id));
              this.snackBar.open('Enquiry deleted successfully', 'Close', { duration: 3000 });
            } else {
              this.snackBar.open('Failed to delete enquiry: ' + (res.message || 'Unknown error'), 'Close', { duration: 4000 });
            }
          },
          error: (err) => {
            console.error('Failed to delete enquiry:', err);
            this.snackBar.open('Failed to delete enquiry. Please try again.', 'Close', { duration: 4000 });
          }
        });
      } else {
        this.enquiries.update(list => list.filter(e => e.id !== id));
        this.snackBar.open('Local enquiry deleted successfully', 'Close', { duration: 3000 });
      }
    }
  }

  // Add or update Enquiry (calls backend API and shows SnackBar)
  onSubmitEnquiry() {
    if (!this.newEnquiry.guestName || !this.newEnquiry.phone) {
      this.snackBar.open('Please enter Guest Name and Phone Number', 'Close', { duration: 3000 });
      return;
    }

    const payload = {
      salutation: this.newEnquiry.salutation || 'Mr.',
      guestName: this.newEnquiry.guestName,
      companyName: this.newEnquiry.companyName || undefined,
      phone: this.newEnquiry.phone,
      altPhone: this.newEnquiry.altPhone || undefined,
      email: this.newEnquiry.email || undefined,
      address: this.newEnquiry.address || undefined,
      city: this.newEnquiry.city || undefined,
      state: this.newEnquiry.state || undefined,
      gstNumber: this.newEnquiry.gstNumber || undefined,
      enquiryType: this.newEnquiry.enquiryType || 'Room',
      source: this.newEnquiry.source || 'Direct',
      checkIn: this.newEnquiry.checkIn || undefined,
      checkOut: this.newEnquiry.checkOut || undefined,
      rooms: Number(this.newEnquiry.rooms) || undefined,
      adults: Number(this.newEnquiry.adults) || undefined,
      children: Number(this.newEnquiry.children) || undefined,
      mealPlan: this.newEnquiry.mealPlan || undefined,
      budget: Number(this.newEnquiry.budget) || undefined,
      expectedRevenue: Number(this.newEnquiry.expectedRevenue) || undefined,
      salesPerson: this.newEnquiry.salesPerson || undefined,
      priority: this.newEnquiry.priority || 'Medium',
      nextFollowUp: this.newEnquiry.nextFollowUp || undefined,
      message: this.newEnquiry.message || undefined
    };

    this.isLoading.set(true);

    const editId = this.editingEnquiryId();
    if (editId) {
      // Edit mode: update existing enquiry
      this.crmApi.updateEnquiry(editId, payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success) {
            this.snackBar.open(`Enquiry ${res.data?.enquiryRef || ''} successfully updated!`, 'Close', { duration: 3000 });
            this.cancelEnquiryForm(); // clears edit mode, resets form, and routes to list
            this.loadEnquiries();
          } else {
            this.snackBar.open('Failed to update enquiry: ' + (res.message || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to update enquiry:', err);
          this.snackBar.open('Failed to update enquiry. Please check your network and try again.', 'Close', { duration: 4000 });
        }
      });
    } else {
      // Create mode: create a new enquiry
      this.crmApi.createEnquiry(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success) {
            this.snackBar.open(`Enquiry ${res.data?.enquiryRef || ''} successfully created!`, 'Close', { duration: 3000 });
            this.cancelEnquiryForm(); // clears edit mode, resets form, and routes to list
            this.loadEnquiries();
          } else {
            this.snackBar.open('Failed to create enquiry: ' + (res.message || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to create enquiry:', err);
          this.snackBar.open('Failed to create enquiry. Please check your network and try again.', 'Close', { duration: 4000 });
        }
      });
    }
  }

  // Helper formatting methods
  formatCurrency(val: number): string {
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Quick stats computed
  totalEnquiriesCount() { return this.enquiries().length; }
  newEnquiriesCount() { return this.enquiries().filter(e => e.status === 'New').length; }
  inProgressCount() { return this.enquiries().filter(e => e.status === 'In Progress').length; }
  quotationSentCount() { return this.enquiries().filter(e => e.status === 'Quotation Sent').length; }
  onHoldCount() { return this.enquiries().filter(e => e.status === 'Hold').length; }
  bookedCount() { return this.enquiries().filter(e => e.status === 'Confirmed' || e.status === 'Booked').length; }
  lostCount() { return this.enquiries().filter(e => e.status === 'Lost').length; }

  calcOpenPipelineValue(): number {
    return this.enquiries()
      .filter(e => e.status !== 'Lost')
      .reduce((sum, e) => sum + (e.expectedRevenue || 0), 0);
  }

  calcBookedValue(): number {
    return this.enquiries()
      .filter(e => e.status === 'Confirmed' || e.status === 'Booked')
      .reduce((sum, e) => sum + (e.expectedRevenue || 0), 0);
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || '').toUpperCase();
  }

  // Prefill guest information when an enquiry is selected
  onSelectEnquiryForQuotation(enquiryId: string) {
    const selected = this.enquiries().find(e => e.id === enquiryId);
    if (selected) {
      this.newQuotation.guestName = selected.guestName;
      this.newQuotation.companyName = selected.companyName || '';
      this.newQuotation.total = selected.expectedRevenue;
    }
  }

  // Create Quotation Proposal
  onSubmitQuotation() {
    if (!this.newQuotation.guestName || !this.newQuotation.total) {
      alert('Please fill out all required fields');
      return;
    }

    const nextNoNum = this.quotations().length + 1;
    const newRecord: Quotation = {
      quotationNo: `QTN-2026-000${nextNoNum}`,
      revision: 0,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      enquiryId: this.newQuotation.enquiryId || 'N/A',
      guestName: this.newQuotation.guestName,
      companyName: this.newQuotation.companyName || undefined,
      total: Number(this.newQuotation.total) || 0,
      validTill: this.newQuotation.validTill || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Draft'
    };

    // Prepend to array
    this.quotations.update(list => [newRecord, ...list]);
    alert(`Quotation ${newRecord.quotationNo} successfully created!`);
    
    // Close modal
    this.isQuotationModalOpen.set(false);

    // Reset Form
    this.newQuotation = {
      enquiryId: '',
      guestName: '',
      companyName: '',
      total: 0,
      validTill: ''
    };
  }

  // Delete Quotation
  deleteQuotation(quotationNo: string) {
    if (confirm(`Are you sure you want to delete quotation ${quotationNo}?`)) {
      this.quotations.update(list => list.filter(q => q.quotationNo !== quotationNo));
    }
  }

  // Create Sales Person
  onSubmitSalesMember() {
    if (!this.newSalesMemberObj.name || !this.newSalesMemberObj.phone) {
      alert('Please enter Name and Phone number');
      return;
    }

    const newRecord: SalesMember = {
      name: this.newSalesMemberObj.name,
      designation: this.newSalesMemberObj.designation,
      phone: this.newSalesMemberObj.phone,
      email: this.newSalesMemberObj.email,
      monthlyTarget: Number(this.newSalesMemberObj.monthlyTarget) || 0
    };

    this.salesTeam.update(list => [...list, newRecord]);
    alert(`Sales Representative ${newRecord.name} successfully registered!`);

    this.isSalesModalOpen.set(false);

    // Reset Form
    this.newSalesMemberObj = {
      name: '',
      designation: 'Front Office Executive',
      phone: '',
      email: '',
      monthlyTarget: 500000
    };
  }

  // Delete Sales Representative
  deleteSalesMember(name: string) {
    if (confirm(`Are you sure you want to delete representative ${name}?`)) {
      this.salesTeam.update(list => list.filter(s => s.name !== name));
    }
  }

  // View Proposal / Quotation details preview modal
  viewQuotationDetails(q: Quotation) {
    this.selectedQuotation.set(q);
    const found = this.enquiries().find(e => e.id === q.enquiryId);
    this.linkedEnquiry.set(found || null);
    this.isQuotationViewModalOpen.set(true);
  }

  closeQuotationViewModal() {
    this.isQuotationViewModalOpen.set(false);
    this.selectedQuotation.set(null);
    this.linkedEnquiry.set(null);
  }
}

