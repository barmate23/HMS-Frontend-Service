import { Injectable, signal, computed } from '@angular/core';

export type HKStatus =
  | 'VACANT_CLEAN'
  | 'VACANT_DIRTY'
  | 'OCCUPIED_CLEAN'
  | 'OCCUPIED_DIRTY'
  | 'INSPECTED'
  | 'OUT_OF_ORDER'
  | 'DO_NOT_DISTURB'
  | 'UNDER_MAINTENANCE';

export type TaskType = 'CHECKOUT_CLEAN' | 'STAYOVER_CLEAN' | 'DEEP_CLEAN' | 'INSPECTION' | 'TURNDOWN';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type StaffRole = 'HOUSEKEEPER' | 'SUPERVISOR' | 'INSPECTOR';
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';
export type StaffStatus = 'ON_DUTY' | 'OFF_DUTY' | 'ON_BREAK';
export type LFStatus = 'STORED' | 'CLAIMED' | 'DONATED' | 'DISPOSED';
export type MaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type MaintPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface HKRoom {
  id: number;
  roomNumber: string;
  floor: string;
  type: string;
  hkStatus: HKStatus;
  isOccupied: boolean;
  guestName?: string;
  checkoutDate?: string;
  lastCleaned?: string;
  assignedToId?: number;
  dnd: boolean;
  priority: Priority;
}

export interface HKTask {
  id: number;
  roomId: number;
  roomNumber: string;
  floor: string;
  assignedToId?: number;
  taskType: TaskType;
  priority: Priority;
  status: TaskStatus;
  notes: string;
  estimatedMins: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface HKStaff {
  id: number;
  name: string;
  role: StaffRole;
  shift: ShiftType;
  status: StaffStatus;
  assignedRoomIds: number[];
  completedToday: number;
  phone: string;
  avatar: string;
}

export interface LostFoundItem {
  id: number;
  roomNumber: string;
  description: string;
  category: string;
  foundBy: string;
  foundDate: string;
  status: LFStatus;
  guestName?: string;
  guestContact?: string;
  storageLocation: string;
  notes: string;
}

export interface MaintenanceRequest {
  id: number;
  roomNumber: string;
  floor: string;
  issue: string;
  category: string;
  priority: MaintPriority;
  status: MaintStatus;
  reportedBy: string;
  reportedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class HousekeepingService {

  private _rooms = signal<HKRoom[]>([
    { id: 1,  roomNumber: '101', floor: 'Floor 1', type: 'Single Room',   hkStatus: 'VACANT_DIRTY',    isOccupied: false, lastCleaned: '2026-05-19T06:00:00Z', assignedToId: 1, dnd: false, priority: 'HIGH' },
    { id: 2,  roomNumber: '102', floor: 'Floor 1', type: 'Double Room',   hkStatus: 'OCCUPIED_DIRTY',  isOccupied: true,  guestName: 'Rajan Mehta',       checkoutDate: '2026-05-20', lastCleaned: '2026-05-18T08:00:00Z', dnd: false, priority: 'MEDIUM' },
    { id: 3,  roomNumber: '103', floor: 'Floor 1', type: 'Luxury Suite',  hkStatus: 'DO_NOT_DISTURB',  isOccupied: true,  guestName: 'Priya Sharma',      checkoutDate: '2026-05-22', dnd: true, priority: 'LOW' },
    { id: 4,  roomNumber: '104', floor: 'Floor 1', type: 'Double Room',   hkStatus: 'INSPECTED',       isOccupied: false, lastCleaned: '2026-05-19T09:30:00Z', dnd: false, priority: 'LOW' },
    { id: 5,  roomNumber: '105', floor: 'Floor 1', type: 'Single Room',   hkStatus: 'OUT_OF_ORDER',    isOccupied: false, dnd: false, priority: 'HIGH' },
    { id: 6,  roomNumber: '201', floor: 'Floor 2', type: 'Double Room',   hkStatus: 'VACANT_CLEAN',    isOccupied: false, lastCleaned: '2026-05-19T10:00:00Z', dnd: false, priority: 'LOW' },
    { id: 7,  roomNumber: '202', floor: 'Floor 2', type: 'Luxury Suite',  hkStatus: 'OCCUPIED_CLEAN',  isOccupied: true,  guestName: 'Amit Desai',        checkoutDate: '2026-05-21', lastCleaned: '2026-05-19T11:00:00Z', dnd: false, priority: 'LOW' },
    { id: 8,  roomNumber: '203', floor: 'Floor 2', type: 'Single Room',   hkStatus: 'VACANT_DIRTY',    isOccupied: false, lastCleaned: '2026-05-18T12:00:00Z', assignedToId: 2, dnd: false, priority: 'MEDIUM' },
    { id: 9,  roomNumber: '204', floor: 'Floor 2', type: 'Double Room',   hkStatus: 'UNDER_MAINTENANCE',isOccupied: false, dnd: false, priority: 'HIGH' },
    { id: 10, roomNumber: '205', floor: 'Floor 2', type: 'Double Room',   hkStatus: 'OCCUPIED_DIRTY',  isOccupied: true,  guestName: 'Sunita Rao',        checkoutDate: '2026-05-20', dnd: false, priority: 'HIGH' },
    { id: 11, roomNumber: '301', floor: 'Floor 3', type: 'Luxury Suite',  hkStatus: 'INSPECTED',       isOccupied: false, lastCleaned: '2026-05-19T08:45:00Z', dnd: false, priority: 'LOW' },
    { id: 12, roomNumber: '302', floor: 'Floor 3', type: 'Double Room',   hkStatus: 'VACANT_DIRTY',    isOccupied: false, assignedToId: 3, dnd: false, priority: 'MEDIUM' },
    { id: 13, roomNumber: '303', floor: 'Floor 3', type: 'Single Room',   hkStatus: 'OCCUPIED_CLEAN',  isOccupied: true,  guestName: 'Vikram Nair',       checkoutDate: '2026-05-23', dnd: false, priority: 'LOW' },
    { id: 14, roomNumber: '304', floor: 'Floor 3', type: 'Luxury Suite',  hkStatus: 'OCCUPIED_DIRTY',  isOccupied: true,  guestName: 'Kavitha Reddy',     checkoutDate: '2026-05-20', dnd: false, priority: 'HIGH' },
    { id: 15, roomNumber: 'G01', floor: 'Ground',  type: 'Palazzo Deluxe',hkStatus: 'VACANT_CLEAN',    isOccupied: false, lastCleaned: '2026-05-19T07:30:00Z', dnd: false, priority: 'LOW' },
  ]);

  private _tasks = signal<HKTask[]>([
    { id: 1,  roomId: 1,  roomNumber: '101', floor: 'Floor 1', assignedToId: 1, taskType: 'CHECKOUT_CLEAN', priority: 'HIGH',   status: 'IN_PROGRESS', notes: 'Late checkout guest, deep clean required.', estimatedMins: 45, startedAt: '2026-05-19T09:00:00Z', createdAt: '2026-05-19T07:00:00Z' },
    { id: 2,  roomId: 2,  roomNumber: '102', floor: 'Floor 1', assignedToId: 1, taskType: 'STAYOVER_CLEAN', priority: 'MEDIUM', status: 'PENDING',     notes: 'Guest requested service at 11AM.',          estimatedMins: 30, createdAt: '2026-05-19T07:00:00Z' },
    { id: 3,  roomId: 8,  roomNumber: '203', floor: 'Floor 2', assignedToId: 2, taskType: 'CHECKOUT_CLEAN', priority: 'MEDIUM', status: 'PENDING',     notes: '',                                           estimatedMins: 40, createdAt: '2026-05-19T07:00:00Z' },
    { id: 4,  roomId: 10, roomNumber: '205', floor: 'Floor 2', assignedToId: 2, taskType: 'STAYOVER_CLEAN', priority: 'HIGH',   status: 'PENDING',     notes: 'Extra towels and amenities requested.',      estimatedMins: 35, createdAt: '2026-05-19T07:00:00Z' },
    { id: 5,  roomId: 12, roomNumber: '302', floor: 'Floor 3', assignedToId: 3, taskType: 'CHECKOUT_CLEAN', priority: 'MEDIUM', status: 'PENDING',     notes: '',                                           estimatedMins: 40, createdAt: '2026-05-19T07:00:00Z' },
    { id: 6,  roomId: 14, roomNumber: '304', floor: 'Floor 3', assignedToId: 3, taskType: 'STAYOVER_CLEAN', priority: 'HIGH',   status: 'PENDING',     notes: 'Suite — extended time needed.',              estimatedMins: 60, createdAt: '2026-05-19T07:00:00Z' },
    { id: 7,  roomId: 7,  roomNumber: '202', floor: 'Floor 2', assignedToId: 4, taskType: 'TURNDOWN',       priority: 'LOW',    status: 'PENDING',     notes: 'Evening turndown service.',                  estimatedMins: 15, createdAt: '2026-05-19T07:00:00Z' },
    { id: 8,  roomId: 4,  roomNumber: '104', floor: 'Floor 1', assignedToId: 4, taskType: 'INSPECTION',     priority: 'LOW',    status: 'COMPLETED',   notes: 'Passed inspection.',                         estimatedMins: 10, completedAt: '2026-05-19T09:45:00Z', createdAt: '2026-05-19T07:00:00Z' },
    { id: 9,  roomId: 11, roomNumber: '301', floor: 'Floor 3', assignedToId: 4, taskType: 'INSPECTION',     priority: 'LOW',    status: 'COMPLETED',   notes: 'Ready for checkin.',                         estimatedMins: 10, completedAt: '2026-05-19T08:50:00Z', createdAt: '2026-05-19T07:00:00Z' },
    { id: 10, roomId: 15, roomNumber: 'G01', floor: 'Ground',  assignedToId: 1, taskType: 'DEEP_CLEAN',     priority: 'LOW',    status: 'COMPLETED',   notes: 'Weekly deep clean completed.',               estimatedMins: 90, completedAt: '2026-05-19T10:30:00Z', createdAt: '2026-05-19T07:00:00Z' },
  ]);

  private _staff = signal<HKStaff[]>([
    { id: 1, name: 'Meena Pillai',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [1, 2, 15], completedToday: 1, phone: '+91 98765 00001', avatar: 'MP' },
    { id: 2, name: 'Rahul Shetty',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [8, 10],    completedToday: 0, phone: '+91 98765 00002', avatar: 'RS' },
    { id: 3, name: 'Deepa Thomas',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_BREAK', assignedRoomIds: [12, 14],   completedToday: 0, phone: '+91 98765 00003', avatar: 'DT' },
    { id: 4, name: 'Arjun Menon',    role: 'INSPECTOR',   shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [4, 7, 11], completedToday: 2, phone: '+91 98765 00004', avatar: 'AM' },
    { id: 5, name: 'Lalitha Nair',   role: 'SUPERVISOR',  shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [],         completedToday: 0, phone: '+91 98765 00005', avatar: 'LN' },
    { id: 6, name: 'Suresh Kumar',   role: 'HOUSEKEEPER', shift: 'AFTERNOON', status: 'OFF_DUTY', assignedRoomIds: [],         completedToday: 0, phone: '+91 98765 00006', avatar: 'SK' },
  ]);

  private _lostFound = signal<LostFoundItem[]>([
    { id: 1, roomNumber: '102', description: 'Gold wristwatch (Titan brand)', category: 'Jewellery',     foundBy: 'Meena Pillai',  foundDate: '2026-05-18', status: 'STORED',  guestName: 'Rajan Mehta',  guestContact: '+91 98111 22333', storageLocation: 'HK Office - Locker A1', notes: 'Guest notified via call.' },
    { id: 2, roomNumber: '301', description: 'Grey laptop bag with charger', category: 'Electronics',    foundBy: 'Arjun Menon',   foundDate: '2026-05-17', status: 'CLAIMED', guestName: 'Priya Sharma', guestContact: '+91 91234 56789', storageLocation: 'HK Office - Shelf B2', notes: 'Claimed by guest on 2026-05-18.' },
    { id: 3, roomNumber: '203', description: 'Blue children\'s stuffed toy',  category: 'Personal Items', foundBy: 'Rahul Shetty',  foundDate: '2026-05-19', status: 'STORED',  storageLocation: 'HK Office - Shelf C1', notes: 'No guest contact available.' },
    { id: 4, roomNumber: '205', description: 'Black leather wallet',          category: 'Wallet/Cards',  foundBy: 'Deepa Thomas',  foundDate: '2026-05-19', status: 'STORED',  guestName: 'Sunita Rao',   guestContact: '+91 99887 65432', storageLocation: 'HK Office - Locker A2', notes: 'Guest informed.' },
    { id: 5, roomNumber: '104', description: 'Red woollen muffler',           category: 'Clothing',      foundBy: 'Arjun Menon',   foundDate: '2026-05-15', status: 'DONATED', storageLocation: 'HK Office - Donated Bin', notes: 'Unclaimed after 7 days. Donated to charity.' },
  ]);

  private _maintenance = signal<MaintenanceRequest[]>([
    { id: 1, roomNumber: '105', floor: 'Floor 1', issue: 'AC not cooling, compressor noise',      category: 'HVAC',      priority: 'URGENT', status: 'IN_PROGRESS', reportedBy: 'Meena Pillai',  reportedAt: '2026-05-19T08:30:00Z', assignedTo: 'Engineering Team', notes: 'Technician assigned.' },
    { id: 2, roomNumber: '204', floor: 'Floor 2', issue: 'Bathroom tap dripping continuously',   category: 'Plumbing',  priority: 'HIGH',   status: 'OPEN',        reportedBy: 'Rahul Shetty',  reportedAt: '2026-05-19T09:15:00Z', notes: 'Needs urgent plumber.' },
    { id: 3, roomNumber: '302', floor: 'Floor 3', issue: 'Wardrobe door hinge broken',           category: 'Furniture', priority: 'NORMAL', status: 'OPEN',        reportedBy: 'Deepa Thomas',  reportedAt: '2026-05-19T10:00:00Z', notes: '' },
    { id: 4, roomNumber: '101', floor: 'Floor 1', issue: 'Bathroom light flickering',            category: 'Electrical',priority: 'NORMAL', status: 'RESOLVED',    reportedBy: 'Meena Pillai',  reportedAt: '2026-05-18T14:00:00Z', resolvedAt: '2026-05-18T16:30:00Z', assignedTo: 'Electrician Ravi', notes: 'Bulb replaced.' },
    { id: 5, roomNumber: '202', floor: 'Floor 2', issue: 'TV remote not working',                category: 'Electronics',priority:'LOW',    status: 'RESOLVED',    reportedBy: 'Arjun Menon',   reportedAt: '2026-05-17T11:00:00Z', resolvedAt: '2026-05-17T11:45:00Z', assignedTo: 'Front Office', notes: 'Batteries replaced.' },
  ]);

  // Public read-only signals
  readonly rooms      = this._rooms.asReadonly();
  readonly tasks      = this._tasks.asReadonly();
  readonly staff      = this._staff.asReadonly();
  readonly lostFound  = this._lostFound.asReadonly();
  readonly maintenance= this._maintenance.asReadonly();

  // Computed stats
  readonly roomStats = computed(() => {
    const rooms = this._rooms();
    return {
      total:       rooms.length,
      vacantDirty: rooms.filter(r => r.hkStatus === 'VACANT_DIRTY').length,
      vacantClean: rooms.filter(r => r.hkStatus === 'VACANT_CLEAN').length,
      occupiedDirty: rooms.filter(r => r.hkStatus === 'OCCUPIED_DIRTY').length,
      occupiedClean: rooms.filter(r => r.hkStatus === 'OCCUPIED_CLEAN').length,
      inspected:   rooms.filter(r => r.hkStatus === 'INSPECTED').length,
      dnd:         rooms.filter(r => r.hkStatus === 'DO_NOT_DISTURB').length,
      oor:         rooms.filter(r => r.hkStatus === 'OUT_OF_ORDER' || r.hkStatus === 'UNDER_MAINTENANCE').length,
    };
  });

  readonly taskStats = computed(() => {
    const tasks = this._tasks();
    return {
      total:      tasks.length,
      pending:    tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      completed:  tasks.filter(t => t.status === 'COMPLETED').length,
    };
  });

  readonly staffMap = computed(() => new Map(this._staff().map(s => [s.id, s])));

  // --- Room CRUD ---
  updateRoomStatus(roomId: number, status: HKStatus) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, hkStatus: status, lastCleaned: status === 'VACANT_CLEAN' || status === 'INSPECTED' ? new Date().toISOString() : r.lastCleaned } : r));
  }

  assignRoomToStaff(roomId: number, staffId: number | undefined) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, assignedToId: staffId } : r));
  }

  // --- Task CRUD ---
  saveTask(task: Partial<HKTask>): HKTask {
    const now = new Date().toISOString();
    let saved: HKTask;
    if (task.id) {
      this._tasks.update(list => list.map(t => {
        if (t.id === task.id) { saved = { ...t, ...task }; return saved; }
        return t;
      }));
    } else {
      const newId = this._tasks().reduce((max, t) => t.id > max ? t.id : max, 0) + 1;
      saved = { ...task, id: newId, status: 'PENDING', createdAt: now } as HKTask;
      this._tasks.update(list => [saved, ...list]);
    }
    return saved!;
  }

  updateTaskStatus(taskId: number, status: TaskStatus) {
    const now = new Date().toISOString();
    this._tasks.update(list => list.map(t => {
      if (t.id === taskId) {
        return { ...t, status, startedAt: status === 'IN_PROGRESS' ? now : t.startedAt, completedAt: status === 'COMPLETED' ? now : t.completedAt };
      }
      return t;
    }));
    // If completed, update room status
    if (status === 'COMPLETED') {
      const task = this._tasks().find(t => t.id === taskId);
      if (task && (task.taskType === 'CHECKOUT_CLEAN' || task.taskType === 'STAYOVER_CLEAN' || task.taskType === 'DEEP_CLEAN')) {
        this.updateRoomStatus(task.roomId, 'VACANT_CLEAN');
      }
    }
  }

  deleteTask(id: number) {
    this._tasks.update(list => list.filter(t => t.id !== id));
  }

  // --- Lost & Found CRUD ---
  saveLostFound(item: Partial<LostFoundItem>): LostFoundItem {
    let saved: LostFoundItem;
    if (item.id) {
      this._lostFound.update(list => list.map(i => { if (i.id === item.id) { saved = { ...i, ...item }; return saved; } return i; }));
    } else {
      const newId = this._lostFound().reduce((max, i) => i.id > max ? i.id : max, 0) + 1;
      saved = { ...item, id: newId, status: 'STORED', foundDate: new Date().toISOString().split('T')[0] } as LostFoundItem;
      this._lostFound.update(list => [saved, ...list]);
    }
    return saved!;
  }

  updateLFStatus(id: number, status: LFStatus) {
    this._lostFound.update(list => list.map(i => i.id === id ? { ...i, status } : i));
  }

  deleteLostFound(id: number) {
    this._lostFound.update(list => list.filter(i => i.id !== id));
  }

  // --- Maintenance CRUD ---
  saveMaintenance(req: Partial<MaintenanceRequest>): MaintenanceRequest {
    let saved: MaintenanceRequest;
    if (req.id) {
      this._maintenance.update(list => list.map(m => { if (m.id === req.id) { saved = { ...m, ...req }; return saved; } return m; }));
    } else {
      const newId = this._maintenance().reduce((max, m) => m.id > max ? m.id : max, 0) + 1;
      saved = { ...req, id: newId, status: 'OPEN', reportedAt: new Date().toISOString() } as MaintenanceRequest;
      this._maintenance.update(list => [saved, ...list]);
    }
    return saved!;
  }

  updateMaintStatus(id: number, status: MaintStatus) {
    this._maintenance.update(list => list.map(m => m.id === id ? { ...m, status, resolvedAt: (status === 'RESOLVED' || status === 'CLOSED') ? new Date().toISOString() : m.resolvedAt } : m));
  }

  deleteMaintenance(id: number) {
    this._maintenance.update(list => list.filter(m => m.id !== id));
  }
}
