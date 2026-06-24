import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

type BillingTab = 'folios' | 'payments' | 'invoices' | 'refunds' | 'inward' | 'bills';
type FolioStatus = 'Open' | 'Due Out' | 'Settled' | 'Hold';
type ChargeType = 'Room' | 'POS' | 'Laundry' | 'Discount' | 'Service Charge' | 'Adjustment';
type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Company Credit';
type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Void';
type BillStatus = 'Pending' | 'Approved' | 'Paid' | 'Disputed';

interface VendorBillDraft {
  id: string;
  supplier: string;
  poNo: string;
  billDate: string;
  dueDate: string;
  amount: number | null;
  tax: number | null;
  status: BillStatus;
  grnNo?: string;
}

interface GrnDraft {
  id: string;
  billNo: string;
  poNo: string;
  supplier: string;
  receivedBy: string;
  receivedOn: string;
  items: number | null;
  acceptedValue: number | null;
  variance: string;
}

interface InwardReceipt {
  id: string;
  poNo: string;
  billNo?: string;
  supplier: string;
  receivedBy: string;
  receivedOn: string;
  items: number;
  acceptedValue: number;
  variance: string;
}

interface VendorBill {
  id: string;
  supplier: string;
  poNo: string;
  billDate: string;
  dueDate: string;
  amount: number;
  tax: number;
  status: BillStatus;
  grnNo?: string;
}

interface MiniSupplier {
  id: number;
  name: string;
}

interface MiniPurchaseOrder {
  id: string;
  supplier: string;
  items: number;
  subtotal: number;
  taxTotal: number;
}

interface FolioLine {
  id: number;
  date: string;
  source: ChargeType;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  gst: number;
  taxCode?: string;
  user: string;
}

interface Folio {
  id: number;
  folioNo: string;
  reservationNo: string;
  room: string;
  guest: string;
  company?: string;
  checkIn: string;
  checkOut: string;
  status: FolioStatus;
  creditLimit: number;
  lines: FolioLine[];
}

interface Invoice {
  id: number;
  invoiceNo: string;
  folioNo: string;
  guest: string;
  issuedDate: string;
  amount: number;
  netAmount: number;
  gstAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  grnNo?: string;
}

interface Refund {
  id: number;
  folioNo: string;
  guest: string;
  amount: number;
  mode: PaymentMode;
  reason: string;
  status: 'Pending Approval' | 'Approved' | 'Processed';
}

interface PostingDraft {
  source: ChargeType;
  description: string;
  amount: number;
  taxCode: string;
}

interface PaymentDraft {
  mode: PaymentMode;
  amount: number;
  reference: string;
  note: string;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.css']
})
export class BillingComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  activeTab = signal<BillingTab>('folios');
  folioAction = signal<'ledger' | 'charge' | 'payment'>('ledger');
  search = signal('');
  statusFilter = signal<'ALL' | FolioStatus>('ALL');
  selectedFolioId = signal(1001);
  splitBill = signal(false);
  companyBilling = signal(false);
  postingDraft = signal<PostingDraft>({
    source: 'Room',
    description: 'Room rent',
    amount: 4500,
    taxCode: 'GST 12%'
  });
  paymentDraft = signal<PaymentDraft>({
    mode: 'UPI',
    amount: 0,
    reference: '',
    note: ''
  });
  refundReason = signal('Advance reversal');
  selectedInvoiceId = signal<number | null>(null);
  invoiceSearch = signal('');
  invoiceStatusFilter = signal<'ALL' | InvoiceStatus>('ALL');
  invoiceFromDate = signal('');
  invoiceToDate = signal('');
  invoicePage = signal(1);
  readonly invoicePageSize = 6;

  readonly chargeTypes: ChargeType[] = ['Room', 'POS', 'Laundry', 'Discount', 'Service Charge', 'Adjustment'];
  readonly paymentModes: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Company Credit'];
  readonly taxCodes = ['GST 0%', 'GST 5%', 'GST 12%', 'GST 18%'];

  folios = signal<Folio[]>([
    {
      id: 1001,
      folioNo: 'FOL-1001',
      reservationNo: 'RES-2407',
      room: '101',
      guest: 'Akshay Barmate',
      company: 'Helixion Technologies',
      checkIn: '2026-06-12',
      checkOut: '2026-06-16',
      status: 'Due Out',
      creditLimit: 25000,
      lines: [
        { id: 1, date: '2026-06-12', source: 'Room', reference: 'NIGHT-01', description: 'Deluxe room rent', debit: 4500, credit: 0, gst: 540, taxCode: 'GST 12%', user: 'Front Desk' },
        { id: 3, date: '2026-06-13', source: 'POS', reference: 'POS-883', description: 'Restaurant dinner posting', debit: 1860, credit: 0, gst: 93, taxCode: 'GST 5%', user: 'POS Outlet' },
        { id: 4, date: '2026-06-13', source: 'Laundry', reference: 'LND-1002', description: 'Laundry guest order', debit: 550, credit: 0, gst: 28, taxCode: 'GST 5%', user: 'Laundry Desk' },
        { id: 5, date: '2026-06-13', source: 'Room', reference: 'ADV-001', description: 'Advance received', debit: 0, credit: 5000, gst: 0, user: 'Cashier' }
      ]
    },
    {
      id: 1002,
      folioNo: 'FOL-1002',
      reservationNo: 'RES-2408',
      room: '205',
      guest: 'Priya Shah',
      checkIn: '2026-06-14',
      checkOut: '2026-06-17',
      status: 'Open',
      creditLimit: 18000,
      lines: [
        { id: 1, date: '2026-06-14', source: 'Room', reference: 'NIGHT-01', description: 'Luxury room rent', debit: 5200, credit: 0, gst: 624, taxCode: 'GST 12%', user: 'System' }
      ]
    },
    {
      id: 1003,
      folioNo: 'FOL-1003',
      reservationNo: 'RES-2398',
      room: '304',
      guest: 'Rahul Mehta',
      checkIn: '2026-06-10',
      checkOut: '2026-06-14',
      status: 'Settled',
      creditLimit: 20000,
      lines: [
        { id: 1, date: '2026-06-10', source: 'Room', reference: 'NIGHT-01', description: 'Suite room rent', debit: 7800, credit: 0, gst: 1404, taxCode: 'GST 18%', user: 'System' },
        { id: 2, date: '2026-06-14', source: 'Room', reference: 'PAY-118', description: 'Card settlement', debit: 0, credit: 9204, gst: 0, user: 'Cashier' }
      ]
    }
  ]);

  invoices = signal<Invoice[]>([
    { id: 1, invoiceNo: 'INV-2026-1001', folioNo: 'FOL-1003', guest: 'Rahul Mehta', issuedDate: '2026-06-14', amount: 9204, netAmount: 7800, gstAmount: 1404, paidAmount: 9204, balanceAmount: 0, status: 'Paid', issuedAt: '2026-06-14 10:35', grnNo: 'GRN-3301' },
    { id: 2, invoiceNo: 'INV-DRAFT-1001', folioNo: 'FOL-1001', guest: 'Akshay Barmate', issuedDate: '', amount: 7571, netAmount: 6910, gstAmount: 661, paidAmount: 5000, balanceAmount: 2571, status: 'Draft', issuedAt: 'Not issued' }
  ]);

  refunds = signal<Refund[]>([
    { id: 1, folioNo: 'FOL-0998', guest: 'Nisha Rao', amount: 1200, mode: 'UPI', reason: 'Duplicate advance', status: 'Processed' },
    { id: 2, folioNo: 'FOL-1001', guest: 'Akshay Barmate', amount: 500, mode: 'Card', reason: 'Service recovery', status: 'Pending Approval' }
  ]);

  inwardReceipts = signal<InwardReceipt[]>([
    { id: 'GRN-3301', poNo: 'PO-2410', billNo: 'VB-5102', supplier: 'CleanPro Hospitality Supplies', receivedBy: 'Store Keeper', receivedOn: '2026-06-15 11:20', items: 2, acceptedValue: 18400, variance: '1 item pending' },
    { id: 'GRN-3302', poNo: 'PO-2411', billNo: 'VB-5103', supplier: 'FreshFoods Wholesale', receivedBy: 'Kitchen Mgr', receivedOn: '2026-06-15 09:30', items: 12, acceptedValue: 4250, variance: 'No variance' }
  ]);

  vendorBills = signal<VendorBill[]>([
    { id: 'VB-5102', supplier: 'CleanPro Hospitality Supplies', poNo: 'PO-2410', billDate: '2026-06-14', dueDate: '2026-07-14', amount: 16000, tax: 2880, status: 'Pending', grnNo: 'GRN-3301' },
    { id: 'VB-5103', supplier: 'FreshFoods Wholesale', poNo: 'PO-2411', billDate: '2026-06-15', dueDate: '2026-06-22', amount: 4000, tax: 250, status: 'Approved', grnNo: 'GRN-3302' }
  ]);

  mockSuppliers = signal<MiniSupplier[]>([
    { id: 1, name: 'CleanPro Hospitality Supplies' },
    { id: 2, name: 'FreshFoods Wholesale' }
  ]);

  mockPurchaseOrders = signal<MiniPurchaseOrder[]>([
    { id: 'PO-2410', supplier: 'CleanPro Hospitality Supplies', items: 3, subtotal: 16000, taxTotal: 2880 },
    { id: 'PO-2411', supplier: 'FreshFoods Wholesale', items: 12, subtotal: 4000, taxTotal: 250 }
  ]);

  billDraft = signal<VendorBillDraft>(this.emptyBillDraft());
  billFormSubmitted = signal(false);
  billTouchedFields = signal<Record<string, boolean>>({});

  grnDraft = signal<GrnDraft>(this.emptyGrnDraft());
  grnFormSubmitted = signal(false);
  grnTouchedFields = signal<Record<string, boolean>>({});

  selectedVendorBill = signal<VendorBill | null>(null);
  selectedGrn = signal<InwardReceipt | null>(null);
  vendorBillPendingDelete = signal<VendorBill | null>(null);
  grnPendingDelete = signal<InwardReceipt | null>(null);

  billingModal = signal<'grn' | 'bill' | null>(null);
  billStatusFilter = signal<'ALL' | BillStatus>('ALL');

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => this.updateTabFromUrl((event as NavigationEnd).urlAfterRedirects));
    this.syncPaymentAmount();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  readonly filteredFolios = computed(() => {
    const q = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    return this.folios().filter(folio => {
      const matchesStatus = status === 'ALL' || folio.status === status;
      const matchesQuery = !q || [
        folio.folioNo,
        folio.reservationNo,
        folio.room,
        folio.guest,
        folio.company || ''
      ].some(value => value.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  });

  readonly selectedFolio = computed(() => {
    return this.folios().find(folio => folio.id === this.selectedFolioId()) || this.folios()[0];
  });

  readonly selectedLines = computed(() => this.selectedFolio()?.lines || []);

  readonly selectedBalance = computed(() => this.balanceFor(this.selectedFolio()));
  readonly selectedCharges = computed(() => this.debitFor(this.selectedFolio()));
  readonly selectedCredits = computed(() => this.creditFor(this.selectedFolio()));
  readonly selectedTax = computed(() => this.selectedLines().reduce((sum, line) => sum + line.gst, 0));
  readonly selectedNetAmount = computed(() => this.selectedLines()
    .reduce((sum, line) => sum + line.debit, 0));
  readonly selectedTotalAmount = computed(() => this.selectedNetAmount() + this.selectedTax());

  readonly summary = computed(() => {
    const folios = this.folios();
    const totalDue = folios.reduce((sum, folio) => sum + Math.max(0, this.balanceFor(folio)), 0);
    const advance = folios.reduce((sum, folio) => sum + this.creditFor(folio), 0);
    const open = folios.filter(folio => folio.status !== 'Settled').length;
    const overdue = folios.filter(folio => folio.status === 'Due Out' && this.balanceFor(folio) > 0).length;
    return { totalDue, advance, open, overdue };
  });

  readonly paymentRows = computed(() => {
    return this.folios()
      .flatMap(folio => folio.lines
        .filter(line => line.credit > 0)
        .map(line => ({ ...line, folioNo: folio.folioNo, guest: folio.guest, room: folio.room })))
      .sort((a, b) => b.id - a.id);
  });

  readonly selectedInvoice = computed(() => {
    const id = this.selectedInvoiceId();
    return this.invoices().find(invoice => invoice.id === id) || null;
  });

  readonly filteredInvoices = computed(() => {
    const q = this.invoiceSearch().toLowerCase().trim();
    const status = this.invoiceStatusFilter();
    const from = this.invoiceFromDate();
    const to = this.invoiceToDate();

    return this.invoices().filter(invoice => {
      const folio = this.folioForInvoice(invoice);
      const room = folio?.room || '';
      const issuedDate = invoice.issuedDate || '';
      const matchesStatus = status === 'ALL' || invoice.status === status;
      const matchesDate = (!from || (issuedDate && issuedDate >= from)) && (!to || (issuedDate && issuedDate <= to));
      const matchesSearch = !q || [
        invoice.invoiceNo,
        invoice.folioNo,
        invoice.guest,
        room
      ].some(value => value.toLowerCase().includes(q));
      return matchesStatus && matchesDate && matchesSearch;
    });
  });

  readonly invoiceTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredInvoices().length / this.invoicePageSize)));

  readonly pagedInvoices = computed(() => {
    const page = Math.min(this.invoicePage(), this.invoiceTotalPages());
    const start = (page - 1) * this.invoicePageSize;
    return this.filteredInvoices().slice(start, start + this.invoicePageSize);
  });

  readonly selectedInvoiceFolio = computed(() => {
    const invoice = this.selectedInvoice();
    return invoice ? this.folios().find(folio => folio.folioNo === invoice.folioNo) || null : null;
  });

  selectFolio(id: number): void {
    this.selectedFolioId.set(id);
    this.syncPaymentAmount();
  }

  setTab(tab: BillingTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/billing/${tab}`]);
  }

  openFolioAction(action: 'ledger' | 'charge' | 'payment'): void {
    this.activeTab.set('folios');
    this.folioAction.set(action);
    this.router.navigate(['/billing/folios']);
    if (action === 'payment') this.syncPaymentAmount();
  }

  updatePosting(field: keyof PostingDraft, value: string | number): void {
    this.postingDraft.update(draft => ({ ...draft, [field]: field === 'amount' ? Number(value) : value }));
  }

  updatePayment(field: keyof PaymentDraft, value: string | number): void {
    this.paymentDraft.update(draft => ({ ...draft, [field]: field === 'amount' ? Number(value) : value }));
  }

  addPosting(): void {
    const folio = this.selectedFolio();
    const draft = this.postingDraft();
    if (!folio || !draft.amount) return;

    const isCredit = draft.source === 'Discount';
    const line: FolioLine = {
      id: Date.now(),
      date: this.today(),
      source: draft.source,
      reference: `${draft.source.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      description: draft.description || draft.source,
      debit: isCredit ? 0 : Number(draft.amount),
      credit: isCredit ? Number(draft.amount) : 0,
      gst: isCredit ? 0 : this.calculateGst(Number(draft.amount), draft.taxCode),
      taxCode: isCredit ? undefined : draft.taxCode,
      user: 'Cashier'
    };

    this.folios.update(items => items.map(item => item.id === folio.id ? { ...item, lines: [line, ...item.lines] } : item));
    this.syncPaymentAmount();
  }

  postPayment(): void {
    const folio = this.selectedFolio();
    const draft = this.paymentDraft();
    if (!folio || !draft.amount) return;

    const line: FolioLine = {
      id: Date.now(),
      date: this.today(),
      source: 'Room',
      reference: draft.reference || `PAY-${Math.floor(Math.random() * 900 + 100)}`,
      description: `${draft.mode} payment${draft.note ? ` - ${draft.note}` : ''}`,
      debit: 0,
      credit: Number(draft.amount),
      gst: 0,
      user: 'Cashier'
    };

    this.folios.update(items => items.map(item => item.id === folio.id ? { ...item, lines: [line, ...item.lines] } : item));
    this.paymentDraft.set({ mode: draft.mode, amount: Math.max(0, this.balanceFor(this.selectedFolio())), reference: '', note: '' });
    const updatedFolio = this.folios().find(item => item.id === folio.id);
    if (updatedFolio && this.balanceFor(updatedFolio) <= 0) {
      this.folios.update(items => items.map(item => item.id === folio.id ? { ...item, status: 'Settled' } : item));
      this.createInvoiceForFolio(updatedFolio, true);
      this.setTab('invoices');
    }
  }

  issueInvoice(): void {
    const folio = this.selectedFolio();
    if (!folio) return;
    const invoice = this.createInvoiceForFolio(folio, this.balanceFor(folio) <= 0);
    this.viewInvoice(invoice);
  }

  requestRefund(): void {
    const folio = this.selectedFolio();
    const amount = Math.abs(Math.min(0, this.balanceFor(folio)));
    if (!folio || amount === 0) return;
    const refund: Refund = {
      id: Date.now(),
      folioNo: folio.folioNo,
      guest: folio.guest,
      amount,
      mode: this.paymentDraft().mode,
      reason: this.refundReason(),
      status: 'Pending Approval'
    };
    this.refunds.update(items => [refund, ...items]);
  }

  markSettled(): void {
    const folio = this.selectedFolio();
    if (!folio || this.balanceFor(folio) !== 0) return;
    this.folios.update(items => items.map(item => item.id === folio.id ? { ...item, status: 'Settled' } : item));
    this.createInvoiceForFolio(folio, true);
    this.setTab('invoices');
  }

  viewInvoice(invoice: Invoice): void {
    this.selectedInvoiceId.set(invoice.id);
  }

  closeInvoicePreview(): void {
    this.selectedInvoiceId.set(null);
  }

  folioForInvoice(invoice: Invoice): Folio | undefined {
    return this.folios().find(folio => folio.folioNo === invoice.folioNo);
  }

  invoiceRoom(invoice: Invoice): string {
    return this.folioForInvoice(invoice)?.room || '-';
  }

  invoiceRangeLabel(): string {
    const total = this.filteredInvoices().length;
    if (!total) return '0 of 0';
    const start = (Math.min(this.invoicePage(), this.invoiceTotalPages()) - 1) * this.invoicePageSize + 1;
    const end = Math.min(start + this.invoicePageSize - 1, total);
    return `${start}-${end} of ${total}`;
  }

  previousInvoicePage(): void {
    this.invoicePage.update(page => Math.max(1, page - 1));
  }

  nextInvoicePage(): void {
    this.invoicePage.update(page => Math.min(this.invoiceTotalPages(), page + 1));
  }

  printInvoice(invoice: Invoice): void {
    this.viewInvoice(invoice);
    setTimeout(() => window.print(), 0);
  }

  downloadInvoice(invoice: Invoice): void {
    const folio = this.folios().find(item => item.folioNo === invoice.folioNo);
    const lines = (folio?.lines || [])
      .filter(line => line.debit || line.gst)
      .map(line => `${line.date},${line.source},${line.description},${line.debit},${line.gst},${line.debit + line.gst}`)
      .join('\n');
    const content = [
      'HMS Cloud Invoice',
      `Invoice,${invoice.invoiceNo}`,
      `Guest,${invoice.guest}`,
      `Folio,${invoice.folioNo}`,
      `Room,${folio?.room || '-'}`,
      `Net,${invoice.netAmount}`,
      `GST,${invoice.gstAmount}`,
      `Total,${invoice.amount}`,
      `Paid,${invoice.paidAmount}`,
      `Balance,${invoice.balanceAmount}`,
      '',
      'Date,Source,Description,Net,GST,Total',
      lines
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${invoice.invoiceNo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  debitFor(folio?: Folio): number {
    return (folio?.lines || []).reduce((sum, line) => sum + line.debit, 0);
  }

  creditFor(folio?: Folio): number {
    return (folio?.lines || []).reduce((sum, line) => sum + line.credit, 0);
  }

  balanceFor(folio?: Folio): number {
    return this.debitFor(folio) + this.gstFor(folio) - this.creditFor(folio);
  }

  gstFor(folio?: Folio): number {
    return (folio?.lines || []).reduce((sum, line) => sum + line.gst, 0);
  }

  formatINR(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/billing/payments')) this.activeTab.set('payments');
    else if (url.includes('/billing/invoices')) this.activeTab.set('invoices');
    else if (url.includes('/billing/refunds')) this.activeTab.set('refunds');
    else if (url.includes('/billing/inward')) this.activeTab.set('inward');
    else if (url.includes('/billing/bills')) this.activeTab.set('bills');
    else this.activeTab.set('folios');
  }

  private syncPaymentAmount(): void {
    this.paymentDraft.update(draft => ({ ...draft, amount: Math.max(0, this.selectedBalance()) }));
  }

  private createInvoiceForFolio(folio: Folio, settled: boolean): Invoice {
    const netAmount = this.debitFor(folio);
    const gstAmount = this.gstFor(folio);
    const amount = netAmount + gstAmount;
    const paidAmount = this.creditFor(folio);
    const balanceAmount = Math.max(0, amount - paidAmount);
    const invoice: Invoice = {
      id: Date.now(),
      invoiceNo: `INV-2026-${folio.id}`,
      folioNo: folio.folioNo,
      guest: folio.guest,
      issuedDate: this.today(),
      amount,
      netAmount,
      gstAmount,
      paidAmount,
      balanceAmount,
      status: settled ? 'Paid' : 'Issued',
      issuedAt: new Date().toLocaleString('en-IN')
    };
    this.invoices.update(items => [invoice, ...items.filter(item => item.folioNo !== folio.folioNo)]);
    this.selectedInvoiceId.set(invoice.id);
    return invoice;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private calculateGst(amount: number, taxCode: string): number {
    const rate = Number(taxCode.match(/\d+/)?.[0] || 0);
    return Math.round((amount * rate) / 100);
  }

  readonly filteredBills = computed(() => {
    const status = this.billStatusFilter();
    return this.vendorBills().filter(bill => status === 'ALL' || bill.status === status);
  });

  billingModalTitle(): string {
    const type = this.billingModal();
    if (type === 'grn') return this.selectedGrn() ? 'Edit Inward / GRN' : 'Create Inward / GRN';
    if (type === 'bill') return this.selectedVendorBill() ? 'Edit Vendor Bill' : 'Enter Vendor Bill';
    return '';
  }

  closeBillingModal(): void {
    this.billingModal.set(null);
    this.selectedVendorBill.set(null);
    this.billDraft.set(this.emptyBillDraft());
    this.billFormSubmitted.set(false);
    this.billTouchedFields.set({});
    this.selectedGrn.set(null);
    this.grnDraft.set(this.emptyGrnDraft());
    this.grnFormSubmitted.set(false);
    this.grnTouchedFields.set({});
  }

  openBillingModal(type: 'grn' | 'bill'): void {
    this.closeBillingModal();
    this.billingModal.set(type);
  }

  editVendorBill(bill: VendorBill): void {
    this.selectedVendorBill.set(bill);
    this.billDraft.set(this.draftFromBill(bill));
    this.billFormSubmitted.set(false);
    this.billTouchedFields.set({});
    this.billingModal.set('bill');
  }

  createGrnForBill(bill: VendorBill): void {
    this.openBillingModal('grn');
    this.updateGrnDraft('billNo', bill.id);
  }

  deleteVendorBill(id: string): void {
    this.vendorBills.update(bills => bills.filter(bill => bill.id !== id));
    this.inwardReceipts.update(grns => grns.map(g => {
      if (g.billNo === id) {
        const { billNo, ...rest } = g;
        return rest as InwardReceipt;
      }
      return g;
    }));
  }

  editGrn(grn: InwardReceipt): void {
    this.selectedGrn.set(grn);
    this.grnDraft.set(this.draftFromGrn(grn));
    this.grnFormSubmitted.set(false);
    this.grnTouchedFields.set({});
    this.billingModal.set('grn');
  }

  deleteGrn(id: string): void {
    const grn = this.inwardReceipts().find(g => g.id === id);
    if (grn && grn.billNo) {
      this.vendorBills.update(bills => bills.map(b => {
        if (b.id === grn.billNo) {
          const { grnNo, ...rest } = b;
          return rest as VendorBill;
        }
        return b;
      }));
      this.invoices.update(invs => invs.map(i => {
        if (i.invoiceNo === grn.billNo || i.grnNo === id) {
          const { grnNo, ...rest } = i;
          return rest as Invoice;
        }
        return i;
      }));
    }
    this.inwardReceipts.update(grns => grns.filter(g => g.id !== id));
  }

  linkGrnToInvoice(invoice: Invoice) {
    this.grnDraft.set({
      id: 'GRN-' + Math.floor(1000 + Math.random() * 9000),
      billNo: invoice.invoiceNo,
      poNo: '',
      supplier: invoice.guest,
      receivedBy: 'Front Desk',
      receivedOn: new Date().toISOString().split('T')[0],
      items: 1,
      acceptedValue: invoice.amount,
      variance: 'No variance'
    });
    this.selectedGrn.set(null);
    this.grnFormSubmitted.set(false);
    this.grnTouchedFields.set({});
    this.billingModal.set('grn');
  }

  viewGrn(grnNo: string) {
    const receipt = this.inwardReceipts().find(r => r.id === grnNo);
    if (receipt) {
      this.editGrn(receipt);
    } else {
      this.activeTab.set('inward');
    }
  }

  closeDeleteVendorBill(): void { this.vendorBillPendingDelete.set(null); }
  confirmDeleteVendorBill(): void {
    const bill = this.vendorBillPendingDelete();
    if (bill) { this.deleteVendorBill(bill.id); this.closeDeleteVendorBill(); }
  }

  closeDeleteGrn(): void { this.grnPendingDelete.set(null); }
  confirmDeleteGrn(): void {
    const grn = this.grnPendingDelete();
    if (grn) { this.deleteGrn(grn.id); this.closeDeleteGrn(); }
  }

  emptyBillDraft(): VendorBillDraft {
    return { id: '', supplier: '', poNo: '', billDate: new Date().toISOString().split('T')[0], dueDate: '', amount: null, tax: null, status: 'Pending', grnNo: '' };
  }

  draftFromBill(bill: VendorBill): VendorBillDraft {
    return { id: bill.id, supplier: bill.supplier, poNo: bill.poNo || '', billDate: bill.billDate, dueDate: bill.dueDate, amount: bill.amount, tax: bill.tax, status: bill.status, grnNo: bill.grnNo || '' };
  }

  updateBillDraft<K extends keyof VendorBillDraft>(field: K, value: VendorBillDraft[K]): void {
    this.billDraft.update(draft => ({ ...draft, [field]: value }));
    this.billTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  markBillFieldAsTouched(field: string): void { this.billTouchedFields.update(touched => ({ ...touched, [field]: true })); }

  validateBillDraft(draft: VendorBillDraft): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    if (!draft.id.trim()) errors.push({ field: 'id', message: 'Bill / Invoice number is required.' });
    else if (!this.selectedVendorBill() && this.vendorBills().some(b => b.id.trim().toLowerCase() === draft.id.trim().toLowerCase())) errors.push({ field: 'id', message: 'Bill number already exists.' });
    if (!draft.supplier.trim()) errors.push({ field: 'supplier', message: 'Supplier is required.' });
    if (!draft.billDate) errors.push({ field: 'billDate', message: 'Bill date is required.' });
    if (!draft.dueDate) errors.push({ field: 'dueDate', message: 'Due date is required.' });
    if (draft.amount === null || draft.amount === undefined || Number(draft.amount) <= 0) errors.push({ field: 'amount', message: 'Enter a valid amount (> 0).' });
    if (draft.tax === null || draft.tax === undefined || Number(draft.tax) < 0) errors.push({ field: 'tax', message: 'Enter a valid tax amount (>= 0).' });
    return errors;
  }

  readonly billValidationErrors = computed(() => this.validateBillDraft(this.billDraft()));

  billFieldError(field: string): string {
    if (!this.billFormSubmitted() && !this.billTouchedFields()[field]) return '';
    return this.billValidationErrors().find(e => e.field === field)?.message || '';
  }

  saveVendorBill(): void {
    this.billFormSubmitted.set(true);
    if (this.billValidationErrors().length > 0) return;
    const draft = this.billDraft();
    const existing = this.selectedVendorBill();
    const savedBill: VendorBill = {
      id: draft.id.trim(), supplier: draft.supplier.trim(), poNo: draft.poNo.trim(), billDate: draft.billDate, dueDate: draft.dueDate, amount: Number(draft.amount), tax: Number(draft.tax), status: draft.status, grnNo: (draft.grnNo || '').trim()
    };
    this.vendorBills.update(bills => {
      if (existing) { const index = bills.findIndex(b => b.id === existing.id); if (index > -1) { const next = [...bills]; next[index] = savedBill; return next; } }
      return [savedBill, ...bills];
    });
    this.closeBillingModal();
  }

  emptyGrnDraft(): GrnDraft {
    return { id: '', supplier: '', poNo: '', billNo: '', receivedBy: '', receivedOn: new Date().toISOString().split('T')[0], items: null, acceptedValue: null, variance: 'No variance' };
  }

  draftFromGrn(grn: InwardReceipt): GrnDraft {
    return { id: grn.id, supplier: grn.supplier, poNo: grn.poNo || '', billNo: grn.billNo || '', receivedBy: grn.receivedBy, receivedOn: grn.receivedOn, items: grn.items, acceptedValue: grn.acceptedValue, variance: grn.variance || 'No variance' };
  }

  updateGrnDraft<K extends keyof GrnDraft>(field: K, value: GrnDraft[K]): void {
    this.grnDraft.update(draft => {
      const next = { ...draft, [field]: value };
      if (field === 'billNo' && value) {
        const bill = this.vendorBills().find(b => b.id === value);
        if (bill) {
          next.poNo = bill.poNo || ''; next.supplier = bill.supplier; next.acceptedValue = bill.amount + bill.tax;
          const po = this.mockPurchaseOrders().find(p => p.id === bill.poNo);
          if (po) next.items = po.items;
        } else {
          const inv = this.invoices().find(i => i.invoiceNo === value);
          if (inv) {
            next.poNo = ''; next.supplier = inv.guest; next.acceptedValue = inv.amount; next.items = 1;
          }
        }
      }
      return next;
    });
    this.grnTouchedFields.update(touched => ({ ...touched, [field]: true }));
  }

  markGrnFieldAsTouched(field: string): void { this.grnTouchedFields.update(touched => ({ ...touched, [field]: true })); }

  validateGrnDraft(draft: GrnDraft): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    if (!draft.id.trim()) errors.push({ field: 'id', message: 'GRN number is required.' });
    else if (!this.selectedGrn() && this.inwardReceipts().some(g => g.id.trim().toLowerCase() === draft.id.trim().toLowerCase())) errors.push({ field: 'id', message: 'GRN number already exists.' });
    if (!draft.billNo.trim()) errors.push({ field: 'billNo', message: 'Vendor Bill reference is required.' });
    if (!draft.receivedBy.trim()) errors.push({ field: 'receivedBy', message: 'Received by name is required.' });
    if (!draft.receivedOn) errors.push({ field: 'receivedOn', message: 'Received date is required.' });
    if (draft.items === null || draft.items === undefined || Number(draft.items) <= 0) errors.push({ field: 'items', message: 'Enter a valid number of items (> 0).' });
    if (draft.acceptedValue === null || draft.acceptedValue === undefined || Number(draft.acceptedValue) < 0) errors.push({ field: 'acceptedValue', message: 'Enter a valid value (>= 0).' });
    return errors;
  }

  readonly grnValidationErrors = computed(() => this.validateGrnDraft(this.grnDraft()));

  grnFieldError(field: string): string {
    if (!this.grnFormSubmitted() && !this.grnTouchedFields()[field]) return '';
    return this.grnValidationErrors().find(e => e.field === field)?.message || '';
  }

  saveGrn(): void {
    this.grnFormSubmitted.set(true);
    if (this.grnValidationErrors().length > 0) return;
    const draft = this.grnDraft();
    const existing = this.selectedGrn();
    const bill = this.vendorBills().find(b => b.id === draft.billNo);
    const inv = this.invoices().find(i => i.invoiceNo === draft.billNo);
    const savedGrn: InwardReceipt = {
      id: draft.id.trim(), poNo: draft.poNo.trim() || bill?.poNo || '', billNo: draft.billNo.trim(), supplier: draft.supplier.trim() || bill?.supplier || inv?.guest || '', receivedBy: draft.receivedBy.trim(), receivedOn: draft.receivedOn, items: Number(draft.items), acceptedValue: Number(draft.acceptedValue), variance: draft.variance.trim()
    };
    if (existing && existing.billNo && existing.billNo !== savedGrn.billNo) {
      this.vendorBills.update(bills => bills.map(b => { if (b.id === existing.billNo) { const { grnNo, ...rest } = b; return rest as VendorBill; } return b; }));
      this.invoices.update(invs => invs.map(i => { if (i.invoiceNo === existing.billNo) { const { grnNo, ...rest } = i; return rest as Invoice; } return i; }));
    }
    this.inwardReceipts.update(grns => {
      if (existing) { const index = grns.findIndex(g => g.id === existing.id); if (index > -1) { const next = [...grns]; next[index] = savedGrn; return next; } }
      return [savedGrn, ...grns];
    });
    this.vendorBills.update(bills => bills.map(b => { if (b.id === savedGrn.billNo) return { ...b, grnNo: savedGrn.id }; return b; }));
    this.invoices.update(invs => invs.map(i => { if (i.invoiceNo === savedGrn.billNo) return { ...i, grnNo: savedGrn.id }; return i; }));
    this.closeBillingModal();
  }
}
