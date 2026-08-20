import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CrmApiService, EnquiryApiItem, CrmDashboardStats } from './crm-api.service';

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
  id?: number;
  quotationNo: string;
  revision: number;
  date: string;
  enquiryId: string;
  guestName: string;
  companyName?: string;
  roomRate?: number;
  taxAmount?: number;
  taxRate?: number;
  discountAmount?: number;
  total: number;
  advanceAmount?: number;
  validTill: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Rejected' | 'Expired' | 'Revised';
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
  private readonly route = inject(ActivatedRoute);

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

    // Check for query parameters for editing (handles route-switching state recreation)
    this.route.queryParams.subscribe(params => {
      const editId = params['edit'];
      if (editId) {
        this.loadEnquiryForEdit(Number(editId));
      } else {
        this.editingEnquiryId.set(null);
      }
    });

    // Load enquiries, quotations, and sales team from backend APIs
    this.loadEnquiries();
    this.loadQuotations();
    this.loadSalesTeam();
    this.loadDashboardStats();
  }

  // Load active sales team members from user management module
  loadSalesTeam() {
    this.crmApi.getUsers().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const mappedTeam: SalesMember[] = res.data.map((user: any) => ({
            name: user.fullName || user.username || 'Unknown',
            designation: user.role?.name || user.department || 'Representative',
            phone: user.phone || '',
            email: user.email || '',
            monthlyTarget: 1000000.00
          }));
          this.salesTeam.set(mappedTeam);
        }
      },
      error: (err) => {
        console.error('Failed to load sales team from users API:', err);
      }
    });
  }

  // Load a single enquiry to patch form fields during editing
  loadEnquiryForEdit(id: number) {
    this.isLoading.set(true);
    this.crmApi.getEnquiryById(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.editingEnquiryId.set(id);
          const item = res.data;
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
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load enquiry for edit:', err);
        this.snackBar.open('Failed to load enquiry details', 'Close', { duration: 3000 });
        this.isLoading.set(false);
      }
    });
  }

  loadQuotations(search?: string) {
    this.isLoading.set(true);
    this.crmApi.getAllQuotations(search, this.quotationPage() - 1, this.quotationPageSize).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const mapped: Quotation[] = res.data.map(item => ({
            id: item.id,
            quotationNo: item.quotationRef || '',
            revision: item.revision || 0,
            date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
            enquiryId: item.enquiryRef || 'N/A',
            guestName: item.guestName,
            companyName: item.companyName || '',
            roomRate: item.roomRate || 0,
            taxAmount: item.taxAmount || 0,
            taxRate: item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : (item.roomRate ? parseFloat(((item.taxAmount || 0) / item.roomRate * 100).toFixed(2)) : 18),
            discountAmount: item.discountAmount || 0,
            total: item.totalAmount || 0,
            advanceAmount: item.advanceAmount || 0,
            validTill: item.validTill ? new Date(item.validTill).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
            status: (item.status || 'Draft') as Quotation['status']
          }));
          this.quotations.set(mapped);
          if (res.metadata) {
            this.quotationTotalPages.set(res.metadata.totalPages || 1);
          }
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load quotations:', err);
        this.isLoading.set(false);
      }
    });
  }

  mapEnquiryApiToEnquiry(item: EnquiryApiItem): Enquiry {
    return {
      id: item.enquiryRef || '',
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
    };
  }

  loadDashboardStats() {
    this.crmApi.getDashboardStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.dashboardData.set(res.data);
          
          if (res.data.activeFollowUps) {
            this.dashboardFollowUps.set(res.data.activeFollowUps.map(item => this.mapEnquiryApiToEnquiry(item)));
          } else {
            this.dashboardFollowUps.set([]);
          }

          if (res.data.recentActivity) {
            this.dashboardRecentActivity.set(res.data.recentActivity.map(item => this.mapEnquiryApiToEnquiry(item)));
          } else {
            this.dashboardRecentActivity.set([]);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load dashboard stats:', err);
      }
    });
  }

  changeEnquiryPage(dir: number) {
    const next = this.enquiryPage() + dir;
    if (next >= 1 && next <= this.enquiryTotalPages()) {
      this.enquiryPage.set(next);
      this.loadEnquiries(this.searchText());
    }
  }

  changeQuotationPage(dir: number) {
    const next = this.quotationPage() + dir;
    if (next >= 1 && next <= this.quotationTotalPages()) {
      this.quotationPage.set(next);
      this.loadQuotations(this.searchText());
    }
  }

  loadEnquiries(search?: string) {
    this.isLoading.set(true);
    this.crmApi.getAllEnquiries(search, this.enquiryPage() - 1, this.enquiryPageSize).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const mapped: Enquiry[] = res.data.map(item => this.mapEnquiryApiToEnquiry(item));
          this.enquiries.set(mapped);
          if (res.metadata) {
            this.enquiryTotalPages.set(res.metadata.totalPages || 1);
          }
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
    else if (url.includes('/crm/dashboard')) this.currentTab.set('dashboard');
  }

  setTab(tab: 'dashboard' | 'new' | 'list' | 'quotations') {
    this.currentTab.set(tab);
    const routeMap = {
      dashboard: '/crm/dashboard',
      list: '/crm/tasks',
      new: '/crm/new',
      quotations: '/crm/quotations'
    };
    this.router.navigateByUrl(routeMap[tab]);
  }


  // Search and filter states
  searchText = signal('');
  statusFilter = signal('ALL');
  salesPersonFilter = signal('ALL');

  // Modal forms trigger
  isQuotationModalOpen = signal(false);
  isQuotationViewModalOpen = signal(false);
  isEnquiryViewModalOpen = signal(false);
  selectedQuotation = signal<Quotation | null>(null);
  selectedEnquiryForView = signal<Enquiry | null>(null);
  linkedEnquiry = signal<Enquiry | null>(null);
  
  // Dashboard and Pagination signals
  dashboardData = signal<CrmDashboardStats | null>(null);
  dashboardFollowUps = signal<Enquiry[]>([]);
  dashboardRecentActivity = signal<Enquiry[]>([]);
  enquiryPage = signal(1);
  enquiryTotalPages = signal(1);
  enquiryPageSize = 10;
  
  quotationPage = signal(1);
  quotationTotalPages = signal(1);
  quotationPageSize = 10;


  // Modal models
  newQuotation = {
    enquiryId: '',
    guestName: '',
    companyName: '',
    roomRate: 0,
    taxAmount: 0,
    taxRate: 18,
    discountAmount: 0,
    total: 0,
    advanceAmount: 0,
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

  // Validation Errors Model
  errors: Record<string, string> = {
    guestName: '',
    phone: '',
    altPhone: '',
    email: '',
    checkOut: '',
    rooms: '',
    adults: '',
    children: '',
    gstNumber: ''
  };

  // Enquiries data (loaded from API)
  enquiries = signal<Enquiry[]>([]);

  quotations = signal<Quotation[]>([]);

  salesTeam = signal<SalesMember[]>([]);



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

  // KPI helper calculations for CRM Tasks view
  calcHighPriorityCount(): number {
    return this.filteredEnquiries().filter(e => e.priority === 'High').length;
  }

  calcQuotedCount(): number {
    return this.filteredEnquiries().filter(e => e.quoted === 'Yes').length;
  }

  calcTotalPipelineValue(): number {
    return this.filteredEnquiries().reduce((sum, e) => sum + (e.expectedRevenue || e.budget || 0), 0);
  }

  // Helper for top-aligned MatSnackBar notifications
  private showNotification(message: string, isError = false) {
    this.snackBar.open(message, 'Close', {
      duration: isError ? 4000 : 3000,
      verticalPosition: 'top',
      horizontalPosition: 'right',
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }

  // Navigate to edit route with query parameters (triggers OnInit loading on the active tab instance)
  editEnquiry(item: Enquiry) {
    if (!item.dbId) {
      this.showNotification('Cannot edit enquiry: missing database ID', true);
      return;
    }
    this.router.navigate(['/crm/new'], { queryParams: { edit: item.dbId } });
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
    this.errors = {
      guestName: '',
      phone: '',
      altPhone: '',
      email: '',
      checkOut: '',
      rooms: '',
      adults: '',
      children: '',
      gstNumber: ''
    };
    this.router.navigate(['/crm/tasks']);
  }

  // Validate specific input fields on input/blur and update errors object
  validateField(field: string) {
    if (field === 'guestName') {
      if (!this.newEnquiry.guestName || !this.newEnquiry.guestName.trim()) {
        this.errors['guestName'] = 'Guest Full Name is required';
      } else {
        this.errors['guestName'] = '';
      }
    }

    if (field === 'phone') {
      if (!this.newEnquiry.phone || !this.newEnquiry.phone.trim()) {
        this.errors['phone'] = 'Phone Number is required';
      } else {
        const cleanPhone = this.newEnquiry.phone.replace(/[\s\-().]/g, '');
        // Indian mobile: optional +91 or 0 prefix, then 10 digits starting with 6-9
        const phoneRegex = /^(\+91|91|0)?[6-9][0-9]{9}$/;
        if (!phoneRegex.test(cleanPhone)) {
          this.errors['phone'] = 'Invalid mobile number (e.g. 9876543210 or +919876543210)';
        } else {
          this.errors['phone'] = '';
        }
      }
    }

    if (field === 'altPhone') {
      if (this.newEnquiry.altPhone && this.newEnquiry.altPhone.trim()) {
        const cleanAlt = this.newEnquiry.altPhone.replace(/[\s\-().]/g, '');
        // Indian mobile: optional +91 or 0 prefix, then 10 digits starting with 6-9
        const phoneRegex = /^(\+91|91|0)?[6-9][0-9]{9}$/;
        if (!phoneRegex.test(cleanAlt)) {
          this.errors['altPhone'] = 'Invalid mobile number (e.g. 9876543210 or +919876543210)';
        } else {
          this.errors['altPhone'] = '';
        }
      } else {
        this.errors['altPhone'] = '';
      }
    }

    if (field === 'email') {
      if (this.newEnquiry.email && this.newEnquiry.email.trim()) {
        const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(this.newEnquiry.email.trim())) {
          this.errors['email'] = 'Invalid Email Address format (e.g. guest@example.com)';
        } else {
          this.errors['email'] = '';
        }
      } else {
        this.errors['email'] = '';
      }
    }

    if (field === 'checkOut' || field === 'checkIn') {
      if (this.newEnquiry.checkIn && this.newEnquiry.checkOut) {
        const checkInDate = new Date(this.newEnquiry.checkIn);
        const checkOutDate = new Date(this.newEnquiry.checkOut);
        if (checkOutDate < checkInDate) {
          this.errors['checkOut'] = 'Check-out date cannot be earlier than check-in date';
        } else {
          this.errors['checkOut'] = '';
        }
      } else {
        this.errors['checkOut'] = '';
      }
    }

    if (field === 'rooms') {
      if (this.newEnquiry.rooms !== undefined && Number(this.newEnquiry.rooms) < 1) {
        this.errors['rooms'] = 'Rooms count must be at least 1';
      } else {
        this.errors['rooms'] = '';
      }
    }

    if (field === 'adults') {
      if (this.newEnquiry.adults !== undefined && Number(this.newEnquiry.adults) < 1) {
        this.errors['adults'] = 'Adults count must be at least 1';
      } else {
        this.errors['adults'] = '';
      }
    }

    if (field === 'children') {
      if (this.newEnquiry.children !== undefined && Number(this.newEnquiry.children) < 0) {
        this.errors['children'] = 'Children count cannot be negative';
      } else {
        this.errors['children'] = '';
      }
    }

    if (field === 'gstNumber') {
      if (this.newEnquiry.gstNumber && this.newEnquiry.gstNumber.trim()) {
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(this.newEnquiry.gstNumber.trim().toUpperCase())) {
          this.errors['gstNumber'] = 'Invalid GST format (15 Alphanumeric e.g. 22AAAAA0000A1Z5)';
        } else {
          this.errors['gstNumber'] = '';
        }
      } else {
        this.errors['gstNumber'] = '';
      }
    }
  }

  isTypeSelected(type: string): boolean {
    if (!this.newEnquiry.enquiryType) return false;
    const types = this.newEnquiry.enquiryType.split(',').map(t => t.trim());
    return types.includes(type);
  }

  toggleEnquiryType(type: string) {
    if (!this.newEnquiry.enquiryType) {
      this.newEnquiry.enquiryType = type;
      return;
    }
    let types = this.newEnquiry.enquiryType.split(',').map(t => t.trim()).filter(Boolean);
    if (types.includes(type)) {
      types = types.filter(t => t !== type);
    } else {
      types.push(type);
    }
    this.newEnquiry.enquiryType = types.join(', ');
  }

  // Toggle detail rows (fallback or for display logic if needed)
  toggleDetails(enquiry: Enquiry) {
    this.editEnquiry(enquiry);
  }

  // Delete Enquiry (calls backend API and shows SnackBar on top)
  deleteEnquiry(id: string) {
    const enquiry = this.enquiries().find(e => e.id === id);
    if (!enquiry) return;

    if (confirm(`Are you sure you want to delete enquiry ${id}?`)) {
      if (enquiry.dbId) {
        this.crmApi.deleteEnquiry(enquiry.dbId).subscribe({
          next: (res) => {
            if (res.success) {
              this.enquiries.update(list => list.filter(e => e.id !== id));
              this.showNotification('Enquiry deleted successfully');
              this.loadDashboardStats();
            } else {
              this.showNotification('Failed to delete enquiry: ' + (res.message || 'Unknown error'), true);
            }
          },
          error: (err) => {
            console.error('Failed to delete enquiry:', err);
            this.showNotification('Failed to delete enquiry. Please try again.', true);
          }
        });
      } else {
        this.enquiries.update(list => list.filter(e => e.id !== id));
        this.showNotification('Local enquiry deleted successfully');
        this.loadDashboardStats();
      }
    }
  }

  // Add or update Enquiry (calls backend API and shows SnackBar on top)
  onSubmitEnquiry() {
    // Run all validations to populate validation state
    this.validateField('guestName');
    this.validateField('phone');
    this.validateField('altPhone');
    this.validateField('email');
    this.validateField('checkOut');
    this.validateField('rooms');
    this.validateField('adults');
    this.validateField('children');
    this.validateField('gstNumber');

    // Check if there are any validation errors
    const errorList = Object.values(this.errors).filter(err => !!err);
    if (errorList.length > 0) {
      this.showNotification('Please correct validation errors on the form', true);
      return;
    }

    const cleanPhone = this.newEnquiry.phone.replace(/[\s-]/g, '');
    const payload = {
      salutation: this.newEnquiry.salutation || 'Mr.',
      guestName: this.newEnquiry.guestName.trim(),
      companyName: this.newEnquiry.companyName ? this.newEnquiry.companyName.trim() : undefined,
      phone: cleanPhone,
      altPhone: this.newEnquiry.altPhone ? this.newEnquiry.altPhone.trim() : undefined,
      email: this.newEnquiry.email ? this.newEnquiry.email.trim().toLowerCase() : undefined,
      address: this.newEnquiry.address ? this.newEnquiry.address.trim() : undefined,
      city: this.newEnquiry.city ? this.newEnquiry.city.trim() : undefined,
      state: this.newEnquiry.state ? this.newEnquiry.state.trim() : undefined,
      gstNumber: this.newEnquiry.gstNumber ? this.newEnquiry.gstNumber.trim().toUpperCase() : undefined,
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
      message: this.newEnquiry.message ? this.newEnquiry.message.trim() : undefined
    };

    this.isLoading.set(true);

    const editId = this.editingEnquiryId();
    if (editId) {
      // Edit mode: update existing enquiry
      this.crmApi.updateEnquiry(editId, payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success) {
            this.showNotification(`Enquiry ${res.data?.enquiryRef || ''} successfully updated!`);
            this.cancelEnquiryForm(); // clears edit mode, resets form, and routes to list
            this.loadEnquiries();
            this.loadDashboardStats();
          } else {
            this.showNotification('Failed to update enquiry: ' + (res.message || 'Unknown error'), true);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to update enquiry:', err);
          this.showNotification('Failed to update enquiry. Please check your network and try again.', true);
        }
      });
    } else {
      // Create mode: create a new enquiry
      this.crmApi.createEnquiry(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success) {
            this.showNotification(`Enquiry ${res.data?.enquiryRef || ''} successfully created!`);
            this.cancelEnquiryForm(); // clears edit mode, resets form, and routes to list
            this.loadEnquiries();
            this.loadDashboardStats();
          } else {
            this.showNotification('Failed to create enquiry: ' + (res.message || 'Unknown error'), true);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to create enquiry:', err);
          this.showNotification('Failed to create enquiry. Please check your network and try again.', true);
        }
      });
    }
  }

  // Helper formatting methods
  formatCurrency(val: number): string {
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Quick stats computed
  totalEnquiriesCount() {
    return this.dashboardData() 
      ? (this.dashboardData()?.newEnquiriesCount || 0) + (this.dashboardData()?.inProgressCount || 0) + (this.dashboardData()?.quotationSentCount || 0) + (this.dashboardData()?.onHoldCount || 0) + (this.dashboardData()?.bookedCount || 0) + (this.dashboardData()?.lostCount || 0)
      : this.enquiries().length;
  }
  newEnquiriesCount() { return this.dashboardData() ? this.dashboardData()?.newEnquiriesCount || 0 : this.enquiries().filter(e => e.status === 'New').length; }
  inProgressCount() { return this.dashboardData() ? this.dashboardData()?.inProgressCount || 0 : this.enquiries().filter(e => e.status === 'In Progress').length; }
  quotationSentCount() { return this.dashboardData() ? this.dashboardData()?.quotationSentCount || 0 : this.enquiries().filter(e => e.status === 'Quotation Sent').length; }
  onHoldCount() { return this.dashboardData() ? this.dashboardData()?.onHoldCount || 0 : this.enquiries().filter(e => e.status === 'Hold').length; }
  bookedCount() { return this.dashboardData() ? this.dashboardData()?.bookedCount || 0 : this.enquiries().filter(e => e.status === 'Confirmed' || e.status === 'Booked').length; }
  lostCount() { return this.dashboardData() ? this.dashboardData()?.lostCount || 0 : this.enquiries().filter(e => e.status === 'Lost').length; }

  calcOpenPipelineValue(): number {
    return this.dashboardData()
      ? this.dashboardData()?.openPipelineValue || 0
      : this.enquiries()
        .filter(e => e.status !== 'Lost')
        .reduce((sum, e) => sum + (e.expectedRevenue || 0), 0);
  }

  calcBookedValue(): number {
    return this.dashboardData()
      ? this.dashboardData()?.confirmedMonthlyRevenue || 0
      : this.enquiries()
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
      this.newQuotation.roomRate = selected.expectedRevenue || 0;
      this.newQuotation.taxAmount = 0;
      this.newQuotation.discountAmount = 0;
      this.newQuotation.advanceAmount = 0;
      this.updateQuotationTotal();
    }
  }

  // Calculate total amount dynamically: Total = Room Rate + (Room Rate * Tax% / 100) - Discount
  updateQuotationTotal() {
    const rate = Number(this.newQuotation.roomRate) || 0;
    const percent = Number(this.newQuotation.taxRate) || 0;
    const discount = Number(this.newQuotation.discountAmount) || 0;
    
    this.newQuotation.taxAmount = parseFloat((rate * (percent / 100)).toFixed(2));
    this.newQuotation.total = rate + this.newQuotation.taxAmount - discount;
  }

  // Get dynamic Rate label based on selected enquiry type (e.g. Base Event Rate, Base Room/Banquet Rate)
  getQuotationRateLabel(): string {
    if (!this.newQuotation.enquiryId) {
      return 'Base Rate';
    }
    const selected = this.enquiries().find(e => e.id === this.newQuotation.enquiryId);
    if (!selected || !selected.enquiryType) {
      return 'Base Rate';
    }
    const types = selected.enquiryType.split(',').map(t => t.trim());
    const formattedTypes = types.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return `Base ${formattedTypes.join(' / ')} Rate`;
  }

  // Get dynamic Rate label for the Proposal details preview modal
  getQuotationRateLabelForPreview(q: Quotation): string {
    if (!q.enquiryId || q.enquiryId === 'N/A') {
      return 'Base Rate';
    }
    const selected = this.enquiries().find(e => e.id === q.enquiryId);
    if (!selected || !selected.enquiryType) {
      return 'Base Rate';
    }
    const types = selected.enquiryType.split(',').map(t => t.trim());
    const formattedTypes = types.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return `Base ${formattedTypes.join(' / ')} Rate`;
  }

  // Create Quotation Proposal
  onSubmitQuotation() {
    if (!this.newQuotation.enquiryId) {
      this.showNotification('Please select a linked Enquiry Reference', true);
      return;
    }

    const selectedEnq = this.enquiries().find(e => e.id === this.newQuotation.enquiryId);
    if (!selectedEnq || !selectedEnq.dbId) {
      this.showNotification('Selected enquiry has no valid database ID', true);
      return;
    }

    if (!this.newQuotation.guestName || !this.newQuotation.total) {
      this.showNotification('Please fill out Guest Full Name and Valuation Amount', true);
      return;
    }

    const payload = {
      enquiryId: selectedEnq.dbId,
      guestName: this.newQuotation.guestName.trim(),
      companyName: this.newQuotation.companyName ? this.newQuotation.companyName.trim() : undefined,
      checkIn: selectedEnq.checkIn,
      checkOut: selectedEnq.checkOut,
      rooms: selectedEnq.rooms,
      adults: selectedEnq.adults,
      children: selectedEnq.children,
      mealPlan: selectedEnq.mealPlan,
      roomRate: Number(this.newQuotation.roomRate) || 0,
      taxAmount: Number(this.newQuotation.taxAmount) || 0,
      discountAmount: Number(this.newQuotation.discountAmount) || 0,
      totalAmount: Number(this.newQuotation.total) || 0,
      advanceAmount: Number(this.newQuotation.advanceAmount) || 0,
      validTill: this.newQuotation.validTill || undefined,
      status: 'Draft'
    };

    this.isLoading.set(true);
    this.crmApi.createQuotation(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.showNotification(`Quotation ${res.data?.quotationRef || ''} successfully created!`);
          this.loadQuotations();
          this.loadDashboardStats();
          this.isQuotationModalOpen.set(false);
          // Reset form
          this.newQuotation = {
            enquiryId: '',
            guestName: '',
            companyName: '',
            roomRate: 0,
            taxAmount: 0,
            taxRate: 18,
            discountAmount: 0,
            total: 0,
            advanceAmount: 0,
            validTill: ''
          };
        } else {
          this.showNotification('Failed to create quotation: ' + (res.message || 'Unknown error'), true);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to create quotation:', err);
        this.showNotification('Failed to create quotation. Please try again.', true);
      }
    });
  }

  // Delete Quotation
  deleteQuotation(quotationNo: string) {
    const q = this.quotations().find(item => item.quotationNo === quotationNo);
    if (!q) return;

    if (confirm(`Are you sure you want to delete quotation ${quotationNo}?`)) {
      if (q.id) {
        this.isLoading.set(true);
        this.crmApi.deleteQuotation(q.id).subscribe({
          next: (res) => {
            this.isLoading.set(false);
            if (res.success) {
              this.showNotification(`Quotation ${quotationNo} deleted successfully`);
              this.loadQuotations();
              this.loadDashboardStats();
            } else {
              this.showNotification('Failed to delete quotation: ' + (res.message || 'Unknown error'), true);
            }
          },
          error: (err) => {
            this.isLoading.set(false);
            console.error('Failed to delete quotation:', err);
            this.showNotification('Failed to delete quotation. Please try again.', true);
          }
        });
      } else {
        this.quotations.update(list => list.filter(item => item.quotationNo !== quotationNo));
        this.showNotification('Local quotation deleted');
        this.loadDashboardStats();
      }
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

  // View Enquiry / Task details preview modal
  viewEnquiry(item: Enquiry) {
    this.selectedEnquiryForView.set(item);
    this.isEnquiryViewModalOpen.set(true);
  }

  closeEnquiryViewModal() {
    this.isEnquiryViewModalOpen.set(false);
    this.selectedEnquiryForView.set(null);
  }

  editEnquiryFromView(item: Enquiry) {
    this.closeEnquiryViewModal();
    this.editEnquiry(item);
  }

  openCreateQuotationForEnquiry(item: Enquiry) {
    this.closeEnquiryViewModal();
    this.newQuotation.enquiryId = item.id;
    this.onSelectEnquiryForQuotation(item.id);
    this.isQuotationModalOpen.set(true);
  }
}

