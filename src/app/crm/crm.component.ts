import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Enquiry {
  id: string;
  salutation?: string;
  guestName: string;
  companyName?: string;
  phone: string;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './crm.component.html',
  styleUrls: ['./crm.component.css']
})
export class CrmComponent {
  currentTab = signal<'dashboard' | 'new' | 'list' | 'quotations' | 'sales'>('dashboard');

  // Search and filter states
  searchText = signal('');
  statusFilter = signal('ALL');
  salesPersonFilter = signal('ALL');

  // Modal forms trigger
  isQuotationModalOpen = signal(false);
  isSalesModalOpen = signal(false);

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

  // Mock Data
  enquiries = signal<Enquiry[]>([
    {
      id: 'ENQ-2026-0017',
      guestName: 'Rashmi Thakur',
      companyName: '',
      phone: '6260331979',
      email: 'rashmi.thakur@example.com',
      enquiryType: 'Room',
      source: 'Direct',
      rooms: 0,
      adults: 1,
      children: 0,
      budget: 0,
      expectedRevenue: 0,
      salesPerson: 'Khushbu',
      priority: 'Medium',
      status: 'New',
      quoted: 'No',
      lastContacted: 'Never',
      latestRemark: 'No remarks yet',
      showDetails: false
    },
    {
      id: 'ENQ-2026-0016',
      guestName: 'Priyank jain',
      companyName: 'Jain Tech',
      phone: '9977959911',
      email: 'priyank.jain@example.com',
      enquiryType: 'Room',
      source: 'OTA',
      rooms: 1,
      adults: 2,
      children: 0,
      budget: 25000,
      expectedRevenue: 28000,
      salesPerson: 'Khushbu',
      priority: 'High',
      status: 'Confirmed',
      quoted: 'No',
      lastContacted: 'Today',
      latestRemark: 'Status changed to Confirmed',
      showDetails: false
    },
    {
      id: 'ENQ-2026-0015',
      guestName: 'Bhawna chandwani',
      companyName: '',
      phone: '7694973039',
      email: 'bhawna@example.com',
      enquiryType: 'Room',
      source: 'Booking.com',
      rooms: 1,
      adults: 2,
      children: 1,
      budget: 15000,
      expectedRevenue: 15000,
      salesPerson: 'Khushbu',
      priority: 'Medium',
      status: 'Booked',
      quoted: 'No',
      lastContacted: 'Today',
      latestRemark: 'Status changed to Booked',
      showDetails: false
    },
    {
      id: 'ENQ-2026-0014',
      guestName: 'Alok Kapoor',
      companyName: '',
      phone: '7415 305 006',
      email: 'alok.kapoor@example.com',
      enquiryType: 'Room',
      source: 'Walk-in',
      rooms: 1,
      adults: 2,
      children: 0,
      budget: 12000,
      expectedRevenue: 12200,
      salesPerson: 'Khushbu',
      priority: 'Low',
      status: 'Confirmed',
      quoted: 'Yes',
      lastContacted: 'Today',
      latestRemark: 'Sent proposal, waiting on final confirmation',
      showDetails: false
    },
    {
      id: 'ENQ-2026-0013',
      guestName: 'Somdev Goyal',
      companyName: 'Goyal Agri Pvt',
      phone: '9827211022',
      email: 'somdev.g@example.com',
      enquiryType: 'Event',
      source: 'Direct',
      rooms: 4,
      adults: 8,
      children: 2,
      budget: 85000,
      expectedRevenue: 95000,
      salesPerson: 'Rishi Chauhan',
      priority: 'High',
      status: 'In Progress',
      quoted: 'Yes',
      lastContacted: 'Yesterday',
      latestRemark: 'Quotation sent, following up on proposal detail corrections.',
      showDetails: false
    }
  ]);

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

  // Tab switcher
  setTab(tab: 'dashboard' | 'new' | 'list' | 'quotations' | 'sales') {
    this.currentTab.set(tab);
  }

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

  // Toggle detail rows
  toggleDetails(enquiry: Enquiry) {
    enquiry.showDetails = !enquiry.showDetails;
  }

  // Delete Enquiry
  deleteEnquiry(id: string) {
    if (confirm(`Are you sure you want to delete enquiry ${id}?`)) {
      this.enquiries.update(list => list.filter(e => e.id !== id));
    }
  }

  // Add new Enquiry
  onSubmitEnquiry() {
    if (!this.newEnquiry.guestName || !this.newEnquiry.phone) {
      alert('Please enter Guest Name and Phone Number');
      return;
    }

    const nextIdNum = this.enquiries().length + 18;
    const newRecord: Enquiry = {
      id: `ENQ-2026-00${nextIdNum}`,
      guestName: this.newEnquiry.guestName,
      companyName: this.newEnquiry.companyName || '',
      phone: this.newEnquiry.phone,
      email: this.newEnquiry.email || '',
      address: this.newEnquiry.address,
      city: this.newEnquiry.city,
      state: this.newEnquiry.state,
      gstNumber: this.newEnquiry.gstNumber,
      enquiryType: this.newEnquiry.enquiryType,
      source: this.newEnquiry.source || 'Direct',
      checkIn: this.newEnquiry.checkIn,
      checkOut: this.newEnquiry.checkOut,
      rooms: Number(this.newEnquiry.rooms) || 0,
      adults: Number(this.newEnquiry.adults) || 1,
      children: Number(this.newEnquiry.children) || 0,
      mealPlan: this.newEnquiry.mealPlan,
      budget: Number(this.newEnquiry.budget) || 0,
      expectedRevenue: Number(this.newEnquiry.expectedRevenue) || 0,
      salesPerson: this.newEnquiry.salesPerson || 'Khushbu',
      priority: this.newEnquiry.priority,
      nextFollowUp: this.newEnquiry.nextFollowUp,
      message: this.newEnquiry.message,
      status: 'New',
      quoted: 'No',
      lastContacted: 'Today',
      latestRemark: 'Enquiry created via portal',
      showDetails: false
    };

    // Prepend to show immediately
    this.enquiries.update(list => [newRecord, ...list]);
    alert(`Enquiry ${newRecord.id} successfully created!`);
    
    // Reset form
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

    // Redirect to list
    this.setTab('list');
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
}
