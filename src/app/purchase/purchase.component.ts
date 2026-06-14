import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

type PurchaseTab = 'dashboard' | 'suppliers' | 'orders' | 'inward' | 'bills';
type SupplierStatus = 'Active' | 'On Hold';
type PoStatus = 'Draft' | 'Approved' | 'Partially Received' | 'Closed';
type BillStatus = 'Pending' | 'Approved' | 'Paid' | 'Disputed';

interface Supplier {
  id: number;
  code: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstin: string;
  pan: string;
  paymentTerms: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  creditLimit: number;
  outstanding: number;
  status: SupplierStatus;
}

interface PurchaseOrder {
  id: string;
  supplier: string;
  department: string;
  items: number;
  orderedOn: string;
  expectedOn: string;
  amount: number;
  status: PoStatus;
}

interface InwardReceipt {
  id: string;
  poNo: string;
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
}

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css']
})
export class PurchaseComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;

  activeTab = signal<PurchaseTab>('dashboard');
  search = signal('');
  poStatusFilter = signal<'ALL' | PoStatus>('ALL');
  billStatusFilter = signal<'ALL' | BillStatus>('ALL');
  createModal = signal<'supplier' | 'po' | 'grn' | 'bill' | null>(null);
  selectedSupplier = signal<Supplier | null>(null);
  supplierDetail = signal<Supplier | null>(null);
  selectedPurchaseOrder = signal<PurchaseOrder | null>(null);
  selectedVendorBill = signal<VendorBill | null>(null);

  readonly suppliers = signal<Supplier[]>([
    { id: 1, code: 'SUP-001', name: 'CleanPro Hospitality Supplies', category: 'Housekeeping Supplies', contact: 'Vikas Menon', phone: '+91 98765 11001', email: 'orders@cleanpro.in', address: 'Unit 14, Service Lane, MIDC Andheri East', city: 'Mumbai', state: 'Maharashtra', pinCode: '400093', gstin: '27AAACC1101P1Z4', pan: 'AAACC1101P', paymentTerms: '15 Days', bankName: 'HDFC Bank', accountNo: '50200011884211', ifsc: 'HDFC0000123', creditLimit: 150000, outstanding: 48200, status: 'Active' },
    { id: 2, code: 'SUP-002', name: 'Fresh Linen Co.', category: 'Linen & Laundry', contact: 'Anjali Shah', phone: '+91 98765 11002', email: 'billing@freshlinen.co', address: 'Plot 7, Textile Market Road, Kalher', city: 'Thane', state: 'Maharashtra', pinCode: '421302', gstin: '27AAACF2202P1Z2', pan: 'AAACF2202P', paymentTerms: '30 Days', bankName: 'ICICI Bank', accountNo: '019905001244', ifsc: 'ICIC0000199', creditLimit: 250000, outstanding: 127800, status: 'Active' },
    { id: 3, code: 'SUP-003', name: 'MiniBar Traders', category: 'Minibar', contact: 'Rohit Jain', phone: '+91 98765 11003', email: 'sales@minibartraders.in', address: 'Shop 8, Hospitality Arcade, Camp', city: 'Pune', state: 'Maharashtra', pinCode: '411001', gstin: '27AAACM3303P1Z6', pan: 'AAACM3303P', paymentTerms: '7 Days', bankName: 'Axis Bank', accountNo: '921020045553321', ifsc: 'UTIB0000444', creditLimit: 50000, outstanding: 15850, status: 'On Hold' }
  ]);

  readonly purchaseOrders = signal<PurchaseOrder[]>([
    { id: 'PO-2409', supplier: 'Fresh Linen Co.', department: 'Housekeeping', items: 5, orderedOn: '2026-06-14', expectedOn: '2026-06-18', amount: 86400, status: 'Approved' },
    { id: 'PO-2410', supplier: 'CleanPro Hospitality Supplies', department: 'Laundry', items: 3, orderedOn: '2026-06-15', expectedOn: '2026-06-17', amount: 28600, status: 'Partially Received' },
    { id: 'PO-2411', supplier: 'MiniBar Traders', department: 'Minibar', items: 8, orderedOn: '2026-06-15', expectedOn: '2026-06-20', amount: 41250, status: 'Draft' }
  ]);

  readonly inwardReceipts = signal<InwardReceipt[]>([
    { id: 'GRN-3301', poNo: 'PO-2410', supplier: 'CleanPro Hospitality Supplies', receivedBy: 'Store Keeper', receivedOn: '2026-06-15 11:20', items: 2, acceptedValue: 18400, variance: '1 item pending' },
    { id: 'GRN-3300', poNo: 'PO-2408', supplier: 'Fresh Linen Co.', receivedBy: 'Store Keeper', receivedOn: '2026-06-14 15:10', items: 4, acceptedValue: 55200, variance: 'No variance' }
  ]);

  readonly vendorBills = signal<VendorBill[]>([
    { id: 'VB-5101', supplier: 'Fresh Linen Co.', poNo: 'PO-2408', billDate: '2026-06-14', dueDate: '2026-07-14', amount: 55200, tax: 9936, status: 'Approved' },
    { id: 'VB-5102', supplier: 'CleanPro Hospitality Supplies', poNo: 'PO-2410', billDate: '2026-06-15', dueDate: '2026-06-30', amount: 18400, tax: 3312, status: 'Pending' },
    { id: 'VB-5103', supplier: 'MiniBar Traders', poNo: 'PO-2407', billDate: '2026-06-12', dueDate: '2026-06-19', amount: 15850, tax: 2853, status: 'Disputed' }
  ]);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => this.updateTabFromUrl((event as NavigationEnd).urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  readonly filteredSuppliers = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.suppliers().filter(supplier => !q || [supplier.code, supplier.name, supplier.category, supplier.contact, supplier.phone, supplier.email, supplier.gstin].some(value => value.toLowerCase().includes(q)));
  });

  readonly filteredOrders = computed(() => {
    const status = this.poStatusFilter();
    return this.purchaseOrders().filter(order => status === 'ALL' || order.status === status);
  });

  readonly filteredBills = computed(() => {
    const status = this.billStatusFilter();
    return this.vendorBills().filter(bill => status === 'ALL' || bill.status === status);
  });

  readonly summary = computed(() => {
    const openPo = this.purchaseOrders().filter(order => order.status !== 'Closed').length;
    const poValue = this.purchaseOrders().reduce((sum, order) => sum + order.amount, 0);
    const inwardValue = this.inwardReceipts().reduce((sum, receipt) => sum + receipt.acceptedValue, 0);
    const payable = this.vendorBills().filter(bill => bill.status !== 'Paid').reduce((sum, bill) => sum + bill.amount + bill.tax, 0);
    return { suppliers: this.suppliers().length, openPo, poValue, inwardValue, payable };
  });

  setTab(tab: PurchaseTab): void {
    this.activeTab.set(tab);
    this.router.navigate([`/purchase/${tab}`]);
  }

  openCreateModal(type: 'supplier' | 'po' | 'grn' | 'bill'): void {
    if (type === 'supplier') this.selectedSupplier.set(null);
    if (type === 'po') this.selectedPurchaseOrder.set(null);
    if (type === 'bill') this.selectedVendorBill.set(null);
    this.createModal.set(type);
  }

  closeCreateModal(): void {
    this.createModal.set(null);
    this.selectedSupplier.set(null);
    this.selectedPurchaseOrder.set(null);
    this.selectedVendorBill.set(null);
  }

  createModalTitle(): string {
    const type = this.createModal();
    if (type === 'supplier') return this.selectedSupplier() ? 'Edit Supplier' : 'Add Supplier';
    if (type === 'po') return this.selectedPurchaseOrder() ? 'Edit Purchase Order' : 'Create Purchase Order';
    if (type === 'grn') return 'Create Inward / GRN';
    if (type === 'bill') return this.selectedVendorBill() ? 'Edit Vendor Bill' : 'Enter Vendor Bill';
    return '';
  }

  viewSupplier(supplier: Supplier): void {
    this.supplierDetail.set(supplier);
  }

  editSupplier(supplier: Supplier): void {
    this.supplierDetail.set(null);
    this.selectedSupplier.set(supplier);
    this.createModal.set('supplier');
  }

  deleteSupplier(id: number): void {
    this.suppliers.update(suppliers => suppliers.filter(supplier => supplier.id !== id));
  }

  closeSupplierDetail(): void {
    this.supplierDetail.set(null);
  }

  editPurchaseOrder(order: PurchaseOrder): void {
    this.selectedPurchaseOrder.set(order);
    this.createModal.set('po');
  }

  deletePurchaseOrder(id: string): void {
    this.purchaseOrders.update(orders => orders.filter(order => order.id !== id));
  }

  editVendorBill(bill: VendorBill): void {
    this.selectedVendorBill.set(bill);
    this.createModal.set('bill');
  }

  deleteVendorBill(id: string): void {
    this.vendorBills.update(bills => bills.filter(bill => bill.id !== id));
  }

  formatINR(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  downloadPurchaseOrder(order: PurchaseOrder): void {
    const content = this.purchaseOrderDocument(order);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${order.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  printPurchaseOrder(order: PurchaseOrder): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #123; }
            h1 { font-size: 22px; margin: 0 0 6px; }
            h2 { font-size: 16px; margin: 20px 0 8px; }
            .muted { color: #666; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 18px; }
            .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; }
            .total { text-align: right; font-weight: 700; font-size: 16px; margin-top: 14px; }
          </style>
        </head>
        <body>
          <h1>Purchase Order</h1>
          <div class="muted">HMS Cloud • ${order.id}</div>
          <div class="grid">
            <div class="box"><strong>Vendor</strong><br>${order.supplier}</div>
            <div class="box"><strong>Department</strong><br>${order.department}</div>
            <div class="box"><strong>Ordered On</strong><br>${order.orderedOn}</div>
            <div class="box"><strong>Expected On</strong><br>${order.expectedOn}</div>
          </div>
          <h2>Order Summary</h2>
          <table>
            <thead><tr><th>Items</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody><tr><td>${order.items}</td><td>${order.status}</td><td>${this.formatINR(order.amount)}</td></tr></tbody>
          </table>
          <div class="total">Total: ${this.formatINR(order.amount)}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  private purchaseOrderDocument(order: PurchaseOrder): string {
    return [
      'HMS Cloud Purchase Order',
      `PO Number: ${order.id}`,
      `Supplier: ${order.supplier}`,
      `Department: ${order.department}`,
      `Ordered On: ${order.orderedOn}`,
      `Expected On: ${order.expectedOn}`,
      `Items: ${order.items}`,
      `Status: ${order.status}`,
      `Amount: ${this.formatINR(order.amount)}`,
    ].join('\n');
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/purchase/suppliers')) this.activeTab.set('suppliers');
    else if (url.includes('/purchase/orders')) this.activeTab.set('orders');
    else if (url.includes('/purchase/inward')) this.activeTab.set('inward');
    else if (url.includes('/purchase/bills')) this.activeTab.set('bills');
    else this.activeTab.set('dashboard');
  }
}
