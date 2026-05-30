import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  OrderStatus,
  PosBill,
  PosMenuItem,
  PosOrder,
  PosOrderLine,
  PosOutlet,
  PosService,
  PosTab,
  PosTable,
  TableStatus
} from './pos.service';

type ModalKind = 'outlet' | 'menu' | 'order' | 'bill' | 'table';
type ModalMode = 'create' | 'edit';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, OnDestroy {
  readonly pos = inject(PosService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  activeTab = signal<PosTab>('outlets');
  search = signal('');
  outletFilter = signal<number | 'ALL'>('ALL');
  statusFilter = signal<string>('ALL');
  modalKind = signal<ModalKind>('outlet');
  modalMode = signal<ModalMode>('create');
  isModalOpen = signal(false);

  currentOutlet = signal<Partial<PosOutlet>>({});
  currentMenuItem = signal<Partial<PosMenuItem>>({});
  currentOrder = signal<Partial<PosOrder>>({});
  currentBill = signal<Partial<PosBill>>({});
  currentTable = signal<Partial<PosTable>>({});
  selectedTable = signal<PosTable | null>(null);
  diningAction = signal<'START' | 'MERGE' | 'RESET' | null>(null);
  isDiningActionOpen = signal(false);
  diningForm = signal<{ server: string; covers: number; secondaryTableId: number | null }>({
    server: 'Arjun Menon',
    covers: 2,
    secondaryTableId: null
  });
  startOrderLines = signal<PosOrderLine[]>([]);

  stats = computed(() => {
    const bills = this.pos.bills();
    const totalSales = bills.reduce((sum, bill) => sum + this.billTotal(bill), 0);
    return {
      outlets: this.pos.outlets().filter(outlet => outlet.active).length,
      orders: this.pos.orders().filter(order => order.status !== 'BILLED' && order.status !== 'CANCELLED').length,
      kot: this.pos.orders().filter(order => order.status === 'KOT_SENT').length,
      bills: bills.filter(bill => bill.status !== 'VOID').length,
      roomPostings: bills.filter(bill => bill.postedToFolio).length,
      sales: totalSales
    };
  });

  filteredOutlets = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.pos.outlets().filter(outlet => {
      const status = this.statusFilter();
      const matchStatus = status === 'ALL' || (status === 'ACTIVE' ? outlet.active : !outlet.active);
      return matchStatus && (!q || outlet.name.toLowerCase().includes(q) || outlet.type.toLowerCase().includes(q) || outlet.location.toLowerCase().includes(q));
    });
  });

  filteredMenu = computed(() => {
    const q = this.search().toLowerCase().trim();
    const outlet = this.outletFilter();
    const status = this.statusFilter();
    return this.pos.menuItems().filter(item => {
      const matchOutlet = outlet === 'ALL' || item.outletId === Number(outlet);
      const matchStatus = status === 'ALL' || (status === 'AVAILABLE' ? item.available : !item.available);
      const matchQuery = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.subcategory.toLowerCase().includes(q);
      return matchOutlet && matchStatus && matchQuery;
    });
  });

  filteredOrders = computed(() => {
    const q = this.search().toLowerCase().trim();
    const outlet = this.outletFilter();
    const status = this.statusFilter();
    return this.pos.orders().filter(order => {
      const matchOutlet = outlet === 'ALL' || order.outletId === Number(outlet);
      const matchStatus = status === 'ALL' || order.status === status;
      const matchQuery = !q || order.orderNo.toLowerCase().includes(q) || (order.tableNo || '').toLowerCase().includes(q) || (order.roomNo || '').toLowerCase().includes(q) || (order.guestName || '').toLowerCase().includes(q) || order.server.toLowerCase().includes(q);
      return matchOutlet && matchStatus && matchQuery;
    });
  });

  filteredBills = computed(() => {
    const q = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    return this.pos.bills().filter(bill => {
      const matchStatus = status === 'ALL' || bill.status === status;
      const matchQuery = !q || bill.billNo.toLowerCase().includes(q) || (bill.roomNo || '').includes(q) || (bill.guestName || '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  });

  outletTables = computed(() => {
    const outlet = this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id : Number(this.outletFilter());
    return this.pos.tables().filter(table => table.outletId === outlet);
  });

  mergeCandidates = computed(() => {
    const selected = this.selectedTable();
    return this.outletTables().filter(table => table.id !== selected?.id);
  });

  tableMenuItems = computed(() => {
    const table = this.selectedTable();
    const outletId = table?.outletId || this.defaultOutletId();
    return this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
  });

  orderMenuItems = computed(() => {
    const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
    return this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
  });

  startOrderTotal = computed(() => this.startOrderLines().reduce((sum, line) => sum + line.qty * line.price, 0));

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  switchTab(tab: PosTab): void {
    this.router.navigate([`/pos/${tab}`]);
  }

  openCreate(kind: ModalKind): void {
    this.modalKind.set(kind);
    this.modalMode.set('create');
    if (kind === 'outlet') this.currentOutlet.set({ name: '', type: 'Restaurant', location: '', timing: '09:00 AM - 09:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Outlet Manager' });
    if (kind === 'menu') this.currentMenuItem.set({ outletId: this.defaultOutletId(), name: '', category: 'Food', subcategory: '', price: 0, taxPercent: 5, variants: [], modifiers: [], available: true, featured: false, stockItem: '', imageUrl: '' });
    if (kind === 'order') this.currentOrder.set({ outletId: this.defaultOutletId(), type: 'TABLE', tableNo: '', roomNo: '', guestName: '', server: 'Unassigned', status: 'OPEN', notes: '', lines: [] });
    if (kind === 'bill') this.currentBill.set({ orderId: this.pos.orders()[0]?.id, subtotal: 0, discount: 0, tax: 0, paid: 0, status: 'OPEN', paymentModes: ['Cash'], postedToFolio: false });
    if (kind === 'table') this.currentTable.set({ outletId: this.defaultOutletId(), number: '', section: 'Indoor', status: 'AVAILABLE', covers: 0, server: 'Unassigned', mergedWith: '' });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEdit(kind: ModalKind, item: any): void {
    this.modalKind.set(kind);
    this.modalMode.set('edit');
    if (kind === 'outlet') this.currentOutlet.set({ ...item });
    if (kind === 'menu') this.currentMenuItem.set({ ...item, variants: [...item.variants], modifiers: [...item.modifiers] });
    if (kind === 'order') this.currentOrder.set({ ...item, lines: item.lines.map((line: PosOrderLine) => ({ ...line })) });
    if (kind === 'bill') this.currentBill.set({ ...item, paymentModes: [...item.paymentModes] });
    if (kind === 'table') this.currentTable.set({ ...item });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    document.body.style.overflow = '';
  }

  saveModal(): void {
    const kind = this.modalKind();
    if (kind === 'outlet') this.pos.saveOutlet(this.currentOutlet());
    if (kind === 'menu') this.pos.saveMenuItem(this.currentMenuItem());
    if (kind === 'order') this.pos.saveOrder(this.currentOrder());
    if (kind === 'bill') this.pos.saveBill(this.currentBill());
    if (kind === 'table') this.pos.saveTable(this.currentTable() as PosTable);
    this.closeModal();
  }

  deleteOutlet(id: number): void {
    if (confirm('Delete this outlet?')) this.pos.deleteOutlet(id);
  }

  deleteMenuItem(id: number): void {
    if (confirm('Delete this menu item?')) this.pos.deleteMenuItem(id);
  }

  deleteTable(table: PosTable, event?: Event): void {
    event?.stopPropagation();
    if (confirm(`Delete table ${table.number}?`)) {
      this.pos.deleteTable(table.id);
      if (this.selectedTable()?.id === table.id) this.selectedTable.set(null);
    }
  }

  toggleOutlet(outlet: PosOutlet): void {
    this.pos.saveOutlet({ ...outlet, active: !outlet.active });
  }

  toggleMenuAvailability(item: PosMenuItem): void {
    this.pos.saveMenuItem({ ...item, available: !item.available });
  }

  updateOrderStatus(order: PosOrder, status: OrderStatus): void {
    this.pos.updateOrderStatus(order.id, status);
  }

  voidBill(bill: PosBill): void {
    this.pos.saveBill({ ...bill, status: 'VOID', compReason: bill.compReason || 'Void marked by supervisor' });
  }

  addOrderLine(): void {
    const firstItem = this.orderMenuItems()[0];
    if (firstItem) this.addMenuItemToOrder(firstItem);
  }

  removeOrderLine(index: number): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).filter((_, i) => i !== index) }));
  }

  addMenuItemToOrder(item: PosMenuItem): void {
    this.currentOrder.update(order => {
      const lines = order.lines || [];
      const existing = lines.find(line => line.itemId === item.id);
      const nextLines = existing
        ? lines.map(line => line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line)
        : [...lines, { itemId: item.id, name: item.name, qty: 1, price: item.happyHourPrice || item.price, course: item.subcategory || 'Main', notes: item.modifiers[0] || '' }];
      return { ...order, lines: nextLines };
    });
  }

  updateOrderLineQty(index: number, value: number): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).map((line, i) => i === index ? { ...line, qty: Math.max(1, Number(value) || 1) } : line) }));
  }

  updateOrderLineNotes(index: number, value: string): void {
    this.currentOrder.update(order => ({ ...order, lines: (order.lines || []).map((line, i) => i === index ? { ...line, notes: value } : line) }));
  }

  selectDiningTable(table: PosTable): void {
    this.selectedTable.set(table);
    this.diningForm.set({
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      covers: table.covers || 2,
      secondaryTableId: this.mergeCandidates()[0]?.id || null
    });
  }

  openDiningAction(action: 'START' | 'MERGE' | 'RESET'): void {
    if (action !== 'RESET' && !this.selectedTable()) {
      const first = this.outletTables()[0];
      if (first) this.selectDiningTable(first);
    }
    this.diningAction.set(action);
    if (action === 'START') this.seedStartOrderLines();
    this.isDiningActionOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDiningAction(): void {
    this.isDiningActionOpen.set(false);
    this.diningAction.set(null);
    this.startOrderLines.set([]);
    document.body.style.overflow = '';
  }

  applyDiningAction(): void {
    const form = this.diningForm();
    const action = this.diningAction();
    if (action === 'RESET') {
      const outletId = this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id : Number(this.outletFilter());
      this.pos.resetPaidTables(outletId);
      this.selectedTable.set(null);
      this.closeDiningAction();
      return;
    }

    const table = this.selectedTable();
    if (!table) return;

    if (action === 'START') {
      this.pos.startTableOrder({ ...table, server: form.server, covers: form.covers }, this.startOrderLines());
    }
    if (action === 'MERGE') {
      const secondary = this.pos.tables().find(item => item.id === Number(form.secondaryTableId));
      if (secondary) this.pos.mergeTables({ ...table, server: form.server, covers: form.covers }, secondary);
    }

    const updated = this.pos.tables().find(item => item.id === table.id);
    if (updated) this.selectedTable.set(updated);
    this.closeDiningAction();
  }

  addMenuItemToStartOrder(item: PosMenuItem): void {
    this.startOrderLines.update(lines => {
      const existing = lines.find(line => line.itemId === item.id);
      if (existing) {
        return lines.map(line => line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line);
      }
      return [...lines, { itemId: item.id, name: item.name, qty: 1, price: item.happyHourPrice || item.price, course: item.subcategory || 'Main', notes: item.modifiers[0] || '' }];
    });
  }

  updateStartLineQty(index: number, value: number): void {
    this.startOrderLines.update(lines => lines.map((line, i) => i === index ? { ...line, qty: Math.max(1, Number(value) || 1) } : line));
  }

  updateStartLineNotes(index: number, value: string): void {
    this.startOrderLines.update(lines => lines.map((line, i) => i === index ? { ...line, notes: value } : line));
  }

  removeStartLine(index: number): void {
    this.startOrderLines.update(lines => lines.filter((_, i) => i !== index));
  }

  updateMenuTokens(field: 'variants' | 'modifiers', value: string): void {
    const tokens = value.split(',').map(item => item.trim()).filter(Boolean);
    this.currentMenuItem.update(item => ({ ...item, [field]: tokens }));
  }

  updatePaymentModes(value: string): void {
    const modes = value.split(',').map(item => item.trim()).filter(Boolean) as any;
    this.currentBill.update(bill => ({ ...bill, paymentModes: modes }));
  }

  handleMenuImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.currentMenuItem.update(item => ({ ...item, imageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  }

  outletName(id?: number): string {
    return this.pos.outletMap().get(Number(id))?.name || 'Unknown Outlet';
  }

  billTotal(bill: Partial<PosBill>): number {
    return Number(bill.subtotal || 0) - Number(bill.discount || 0) + Number(bill.tax || 0);
  }

  orderTotal(order: PosOrder | Partial<PosOrder>): number {
    return (order.lines || []).reduce((sum, line) => sum + line.qty * line.price, 0);
  }

  tableStatusIcon(status: TableStatus): string {
    return status === 'AVAILABLE' ? 'check_circle' : status === 'OCCUPIED' ? 'room_service' : status === 'RESERVED' ? 'event' : 'receipt_long';
  }

  menuImage(item: Partial<PosMenuItem>): string {
    return item.imageUrl || 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=240&q=80';
  }

  diningActionTitle(): string {
    const action = this.diningAction();
    if (action === 'START') return 'Start Table Order';
    if (action === 'MERGE') return 'Merge Tables';
    if (action === 'RESET') return 'Reset Paid Tables';
    return 'Dining Action';
  }

  private defaultOutletId(): number {
    return this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id || 1 : Number(this.outletFilter());
  }

  private seedStartOrderLines(): void {
    if (this.startOrderLines().length) return;
    const featured = this.tableMenuItems().filter(item => item.featured).slice(0, 2);
    this.startOrderLines.set(featured.map(item => ({
      itemId: item.id,
      name: item.name,
      qty: 1,
      price: item.happyHourPrice || item.price,
      course: item.subcategory || 'Main',
      notes: item.modifiers[0] || ''
    })));
  }

  private updateTabFromUrl(url: string): void {
    const last = url.split('/').pop()?.split('?')[0] as PosTab;
    this.activeTab.set(['outlets', 'dining', 'orders', 'billing', 'menu'].includes(last) ? last : 'outlets');
    this.search.set('');
    this.statusFilter.set('ALL');
  }
}
