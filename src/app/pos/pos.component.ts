import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { HotelMastersService } from '../masters/hotel-masters.service';
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
type DiningAction = 'START' | 'ROOM' | 'BOOK' | 'MERGE' | 'RESET';
type DeleteTarget = { kind: 'outlet' | 'menu' | 'table'; id: number; title: string; message: string };

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css']
})
export class PosComponent implements OnInit, OnDestroy {
  readonly pos = inject(PosService);
  readonly masters = inject(HotelMastersService);
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
  diningAction = signal<DiningAction | null>(null);
  isDiningActionOpen = signal(false);
  deleteTarget = signal<DeleteTarget | null>(null);
  diningForm = signal<{ server: string; covers: number; secondaryTableId: number | null; floorId: number | null; roomId: number | null; roomNo: string; guestName: string; bookingTime: string; notes: string }>({
    server: 'Arjun Menon',
    covers: 2,
    secondaryTableId: null,
    floorId: null,
    roomId: null,
    roomNo: '102',
    guestName: 'Rajan Mehta',
    bookingTime: 'Today, 08:00 PM',
    notes: ''
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

  diningMenuItems = computed(() => {
    const action = this.diningAction();
    const outletId = action === 'ROOM' ? this.roomServiceOutletId() : (this.selectedTable()?.outletId || this.defaultOutletId());
    return this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
  });

  roomServiceFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  roomServiceRooms = computed(() => {
    const floorId = Number(this.diningForm().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  });

  selectedRoomServiceRoom = computed(() => {
    const roomId = Number(this.diningForm().roomId || 0);
    return this.masters.rooms().find(room => room.id === roomId) || this.roomServiceRooms()[0] || null;
  });

  orderTables = computed(() => {
    const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
    return this.pos.tables()
      .filter(table => table.outletId === outletId)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  });

  orderRoomFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  orderRooms = computed(() => {
    const floorId = Number(this.currentOrder().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  });

  orderMenuItems = computed(() => {
    const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
    return this.pos.menuItems().filter(item => item.outletId === outletId && item.available);
  });

  billOrders = computed(() => {
    const type = this.currentBill().orderType;
    return this.pos.orders().filter(order => !type || order.type === type);
  });

  billTables = computed(() => {
    const order = this.pos.orders().find(item => item.id === Number(this.currentBill().orderId));
    const outletId = Number(order?.outletId || this.defaultOutletId());
    return this.pos.tables()
      .filter(table => table.outletId === outletId)
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  });

  billRoomFloors = computed(() => this.masters.floors().filter(floor => floor.isActive));

  billRooms = computed(() => {
    const floorId = Number(this.currentBill().floorId || 0);
    return this.masters.rooms()
      .filter(room => room.isActive)
      .filter(room => !floorId || room.floorId === floorId)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
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
    if (kind === 'outlet') this.currentOutlet.set({ name: '', type: this.pos.outletTypes()[0] || 'Restaurant', location: '', timing: this.pos.shiftSchedules()[0] || '09:00 AM - 09:00 PM', taxProfile: 'GST 5%', active: true, manager: 'Outlet Manager' });
    if (kind === 'menu') this.currentMenuItem.set({ outletId: this.defaultOutletId(), name: '', category: 'Food', subcategory: '', price: 0, taxPercent: 5, variants: [], modifiers: [], available: true, featured: false, stockItem: '', imageUrl: '' });
    if (kind === 'order') {
      const outletId = this.defaultOutletId();
      const table = this.pos.tables().find(item => item.outletId === outletId);
      this.currentOrder.set({ outletId, type: 'TABLE', tableNo: table?.number || '', roomNo: '', guestName: '', server: 'Unassigned', status: this.pos.orderStatuses()[0] || 'OPEN', notes: '', lines: [] });
    }
    if (kind === 'bill') {
      const order = this.pos.orders()[0];
      this.currentBill.set({ orderId: order?.id, orderType: order?.type || 'TABLE', tableNo: order?.tableNo || '', floorId: order?.floorId || null, roomId: order?.roomId || null, roomNo: order?.roomNo || '', guestName: order?.guestName || '', subtotal: 0, discount: 0, tax: 0, paid: 0, status: this.pos.billStatuses()[0] || 'OPEN', paymentModes: [this.pos.paymentModes()[0] || 'Cash'], compReason: this.pos.voidReasons()[0] || '', postedToFolio: false });
    }
    if (kind === 'table') this.currentTable.set({ outletId: this.defaultOutletId(), number: '', section: this.pos.tableSections()[0] || 'Indoor', status: this.pos.tableStatuses()[0] || 'AVAILABLE', covers: 0, server: 'Unassigned', bookingTime: this.currentTimeValue(), mergedWith: '' });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEdit(kind: ModalKind, item: any): void {
    this.modalKind.set(kind);
    this.modalMode.set('edit');
    if (kind === 'outlet') this.currentOutlet.set({ ...item });
    if (kind === 'menu') this.currentMenuItem.set({ ...item, variants: [...item.variants], modifiers: [...item.modifiers] });
    if (kind === 'order') this.currentOrder.set({ ...item, lines: item.lines.map((line: PosOrderLine) => ({ ...line })) });
    if (kind === 'bill') {
      const order = this.pos.orders().find(value => value.id === Number(item.orderId));
      this.currentBill.set({
        ...item,
        orderType: item.orderType || order?.type,
        tableNo: item.tableNo || order?.tableNo || '',
        floorId: item.floorId || order?.floorId || null,
        roomId: item.roomId || order?.roomId || null,
        roomNo: item.roomNo || order?.roomNo || '',
        guestName: item.guestName || order?.guestName || '',
        paymentModes: [...item.paymentModes]
      });
    }
    if (kind === 'table') this.currentTable.set({ ...item });
    this.isModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  private currentTimeValue(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    const outlet = this.pos.outlets().find(item => item.id === id);
    this.openDeleteConfirm({
      kind: 'outlet',
      id,
      title: outlet?.name || 'Outlet',
      message: 'This outlet will be removed from POS outlet management.'
    });
  }

  deleteMenuItem(id: number): void {
    const item = this.pos.menuItems().find(value => value.id === id);
    this.openDeleteConfirm({
      kind: 'menu',
      id,
      title: item?.name || 'Menu item',
      message: 'This menu item will be removed from the selected outlet menu.'
    });
  }

  deleteTable(table: PosTable, event?: Event): void {
    event?.stopPropagation();
    this.openDeleteConfirm({
      kind: 'table',
      id: table.id,
      title: `Table ${table.number}`,
      message: 'This table will be removed from the dining layout.'
    });
  }

  openDeleteConfirm(target: DeleteTarget): void {
    this.deleteTarget.set(target);
    document.body.style.overflow = 'hidden';
  }

  closeDeleteConfirm(): void {
    this.deleteTarget.set(null);
    if (!this.isModalOpen() && !this.isDiningActionOpen()) document.body.style.overflow = '';
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    if (target.kind === 'outlet') this.pos.deleteOutlet(target.id);
    if (target.kind === 'menu') this.pos.deleteMenuItem(target.id);
    if (target.kind === 'table') {
      this.pos.deleteTable(target.id);
      if (this.selectedTable()?.id === target.id) this.selectedTable.set(null);
    }
    this.closeDeleteConfirm();
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

  updateOrderOutlet(value: number | string): void {
    const outletId = Number(value || this.defaultOutletId());
    const firstTable = this.pos.tables().find(table => table.outletId === outletId);
    this.currentOrder.update(order => ({
      ...order,
      outletId,
      tableNo: order.type === 'TABLE' ? firstTable?.number || '' : order.tableNo,
      roomNo: order.type === 'TABLE' ? '' : order.roomNo,
      roomId: order.type === 'TABLE' ? null : order.roomId,
      floorId: order.type === 'TABLE' ? null : order.floorId
    }));
  }

  updateOrderType(value: 'TABLE' | 'TAKEAWAY' | 'ROOM'): void {
    if (value === 'TABLE') {
      const outletId = Number(this.currentOrder().outletId || this.defaultOutletId());
      const firstTable = this.pos.tables().find(table => table.outletId === outletId);
      this.currentOrder.update(order => ({ ...order, type: value, tableNo: firstTable?.number || '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
      return;
    }

    if (value === 'ROOM') {
      const firstFloor = this.orderRoomFloors()[0] || null;
      const firstRoom = this.masters.rooms()
        .filter(room => room.isActive)
        .filter(room => !firstFloor || room.floorId === firstFloor.id)
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
      this.currentOrder.update(order => ({
        ...order,
        type: value,
        outletId: this.roomServiceOutletId(),
        tableNo: '',
        floorId: firstFloor?.id || null,
        roomId: firstRoom?.id || null,
        roomNo: firstRoom?.roomNumber || '',
        guestName: order.guestName || ''
      }));
      return;
    }

    this.currentOrder.update(order => ({ ...order, type: value, tableNo: '', roomNo: '', roomId: null, floorId: null, guestName: '' }));
  }

  updateOrderTable(value: string): void {
    this.currentOrder.update(order => ({ ...order, tableNo: value }));
  }

  updateOrderFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
    this.currentOrder.update(order => ({
      ...order,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateOrderRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.currentOrder.update(order => ({
      ...order,
      roomId,
      roomNo: room?.roomNumber || ''
    }));
  }

  selectDiningTable(table: PosTable): void {
    this.selectedTable.set(table);
    this.diningForm.set({
      server: table.server === 'Unassigned' ? 'Arjun Menon' : table.server,
      covers: table.covers || 2,
      secondaryTableId: this.mergeCandidates()[0]?.id || null,
      floorId: this.diningForm().floorId,
      roomId: this.diningForm().roomId,
      roomNo: '102',
      guestName: table.guestName || (table.server !== 'Unassigned' ? table.server : 'Guest'),
      bookingTime: table.bookingTime || 'Today, 08:00 PM',
      notes: ''
    });
  }

  openDiningAction(action: DiningAction): void {
    if (action !== 'RESET' && action !== 'ROOM' && !this.selectedTable()) {
      const first = this.outletTables()[0];
      if (first) this.selectDiningTable(first);
    }
    this.diningAction.set(action);
    if (action === 'ROOM') this.prepareRoomServiceDefaults();
    if (action === 'START' || action === 'ROOM') this.seedStartOrderLines();
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

    if (action === 'ROOM') {
      const room = this.selectedRoomServiceRoom();
      const roomNo = room?.roomNumber || form.roomNo;
      this.pos.startRoomOrder({
        outletId: this.roomServiceOutletId(),
        roomNo,
        guestName: form.guestName,
        server: form.server,
        notes: form.notes || `Deliver to room ${roomNo}.`
      }, this.startOrderLines());
      this.closeDiningAction();
      return;
    }

    const table = this.selectedTable();
    if (!table) return;

    if (action === 'START') {
      this.pos.startTableOrder({ ...table, server: form.server, covers: form.covers, guestName: form.guestName }, this.startOrderLines());
    }
    if (action === 'BOOK') {
      this.pos.bookTable(table, {
        guestName: form.guestName,
        covers: form.covers,
        server: form.server,
        bookingTime: form.bookingTime
      });
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

  updateRoomServiceFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];

    this.diningForm.update(form => ({
      ...form,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateRoomServiceRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.diningForm.update(form => ({
      ...form,
      roomId,
      roomNo: room?.roomNumber || form.roomNo
    }));
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

  updatePaymentMode(value: string): void {
    this.currentBill.update(bill => ({ ...bill, paymentModes: value ? [value] : [] }));
  }

  updateBillOrderType(value: 'TABLE' | 'TAKEAWAY' | 'ROOM'): void {
    const order = this.pos.orders().find(item => item.type === value);
    this.currentBill.update(bill => ({
      ...bill,
      orderType: value,
      orderId: order?.id,
      tableNo: value === 'TABLE' ? order?.tableNo || '' : '',
      floorId: value === 'ROOM' ? order?.floorId || null : null,
      roomId: value === 'ROOM' ? order?.roomId || null : null,
      roomNo: value === 'ROOM' ? order?.roomNo || '' : '',
      guestName: value === 'ROOM' ? order?.guestName || bill.guestName || '' : bill.guestName || ''
    }));
  }

  updateBillOrder(value: number | string): void {
    const order = this.pos.orders().find(item => item.id === Number(value));
    if (!order) return;
    this.currentBill.update(bill => ({
      ...bill,
      orderId: order.id,
      orderType: order.type,
      tableNo: order.type === 'TABLE' ? order.tableNo || '' : '',
      floorId: order.type === 'ROOM' ? order.floorId || null : null,
      roomId: order.type === 'ROOM' ? order.roomId || null : null,
      roomNo: order.type === 'ROOM' ? order.roomNo || '' : '',
      guestName: order.guestName || bill.guestName || ''
    }));
  }

  updateBillTable(value: string): void {
    this.currentBill.update(bill => ({ ...bill, tableNo: value }));
  }

  updateBillFloor(value: number | string): void {
    const floorId = Number(value) || null;
    const firstRoom = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))[0];
    this.currentBill.update(bill => ({
      ...bill,
      floorId,
      roomId: firstRoom?.id || null,
      roomNo: firstRoom?.roomNumber || ''
    }));
  }

  updateBillRoom(value: number | string): void {
    const roomId = Number(value) || null;
    const room = this.masters.rooms().find(item => item.id === roomId);
    this.currentBill.update(bill => ({
      ...bill,
      roomId,
      roomNo: room?.roomNumber || ''
    }));
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
    if (action === 'ROOM') return 'Room Service Order';
    if (action === 'BOOK') return 'Book Table';
    if (action === 'MERGE') return 'Merge Tables';
    if (action === 'RESET') return 'Reset Paid Tables';
    return 'Dining Action';
  }

  roomServiceFloorLabel(): string {
    const room = this.selectedRoomServiceRoom();
    if (!room) return 'Select Floor / Room';
    const floor = this.masters.floorsMap().get(room.floorId);
    return `Floor ${floor?.floorNumber || room.floorId}`;
  }

  roomServiceRoomNumber(): string {
    return this.selectedRoomServiceRoom()?.roomNumber || this.diningForm().roomNo || 'No.';
  }

  private defaultOutletId(): number {
    return this.outletFilter() === 'ALL' ? this.pos.outlets()[0]?.id || 1 : Number(this.outletFilter());
  }

  private roomServiceOutletId(): number {
    return this.pos.outlets().find(outlet => outlet.type === 'Room Service' && outlet.active)?.id || this.defaultOutletId();
  }

  private prepareRoomServiceDefaults(): void {
    const current = this.diningForm();
    const floors = this.roomServiceFloors();
    const floorId = current.floorId || floors[0]?.id || null;
    const rooms = this.masters.rooms()
      .filter(room => room.isActive && (!floorId || room.floorId === floorId))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    const room = rooms.find(item => item.id === current.roomId) || rooms[0] || null;

    this.diningForm.set({
      ...current,
      floorId,
      roomId: room?.id || null,
      roomNo: room?.roomNumber || current.roomNo || '',
      guestName: current.guestName || 'Guest',
      server: current.server || 'Meena Pillai'
    });
  }

  private seedStartOrderLines(): void {
    if (this.startOrderLines().length) return;
    const featured = this.diningMenuItems().filter(item => item.featured).slice(0, 2);
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
