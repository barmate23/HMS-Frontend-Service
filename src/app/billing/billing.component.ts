import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

type BillingTab = 'folios' | 'payments' | 'invoices' | 'refunds';
type FolioStatus = 'Open' | 'Due Out' | 'Settled' | 'Hold';
type ChargeType = 'Room' | 'POS' | 'Laundry' | 'Discount' | 'Service Charge' | 'Adjustment';
type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Company Credit';
type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Void';

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
    { id: 1, invoiceNo: 'INV-2026-1001', folioNo: 'FOL-1003', guest: 'Rahul Mehta', issuedDate: '2026-06-14', amount: 9204, netAmount: 7800, gstAmount: 1404, paidAmount: 9204, balanceAmount: 0, status: 'Paid', issuedAt: '2026-06-14 10:35' },
    { id: 2, invoiceNo: 'INV-DRAFT-1001', folioNo: 'FOL-1001', guest: 'Akshay Barmate', issuedDate: '', amount: 7571, netAmount: 6910, gstAmount: 661, paidAmount: 5000, balanceAmount: 2571, status: 'Draft', issuedAt: 'Not issued' }
  ]);

  refunds = signal<Refund[]>([
    { id: 1, folioNo: 'FOL-0998', guest: 'Nisha Rao', amount: 1200, mode: 'UPI', reason: 'Duplicate advance', status: 'Processed' },
    { id: 2, folioNo: 'FOL-1001', guest: 'Akshay Barmate', amount: 500, mode: 'Card', reason: 'Service recovery', status: 'Pending Approval' }
  ]);

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
}
