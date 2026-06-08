import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal, computed, inject } from '@angular/core';

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
export type MaintStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'COMPLETED' | 'CANCELLED';
export type MaintPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW';
export type AuditFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

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
  assignedToName?: string;
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
  roomId?: number;
  roomNumber: string;
  description: string;
  categoryId?: number;
  category: string;
  foundById?: number;
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
  roomId?: number;
  roomNumber: string;
  floor: string;
  issue: string;
  categoryId?: number;
  category: string;
  priorityId?: number;
  priority: MaintPriority;
  status: MaintStatus;
  reportedById?: number;
  reportedBy: string;
  assignedToId?: number;
  reportedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  notes: string;
}

export interface SopCheckpoint {
  id: string;
  apiId?: number;
  frequency: AuditFrequency;
  frequencyId?: number;
  frequencyValue?: string;
  auditAreaId?: number;
  area: string;
  label: string;
  owner: string;
  responsibleRoleId?: number;
}

export interface CommonMasterOption {
  id: number;
  category?: string;
  code?: string;
  value: string;
  description?: string;
}

interface ApiTaskDTO {
  id?: number;
  roomId?: number;
  roomNumber?: string;
  floorNumber?: string;
  taskType?: string;
  priority?: Priority;
  assignedUserId?: number;
  assignedUserName?: string;
  estimatedMinutes?: number;
  instructions?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

interface ApiListResponse<T> {
  success?: boolean;
  data?: T[];
}

interface ApiLostAndFoundDTO {
  id?: number;
  roomId?: number;
  roomNumber?: string;
  itemDescription?: string;
  categoryId?: number;
  categoryValue?: string;
  foundById?: number;
  foundByName?: string;
  storageLocation?: string;
  foundDate?: string;
  guestName?: string;
  guestContact?: string;
  storageNotes?: string;
  status?: LFStatus;
}

interface ApiMaintenanceDTO {
  id?: number;
  roomId?: number;
  roomNumber?: string;
  repairIssue?: string;
  categoryId?: number;
  categoryValue?: string;
  priorityId?: number;
  priorityValue?: string;
  reportedById?: number;
  reportedByName?: string;
  assignedToId?: number;
  assignedToName?: string;
  repairNotes?: string;
  status?: MaintStatus;
  reportedAt?: string;
}

interface ApiSopCheckpointDTO {
  id?: number;
  checkpointId?: string;
  frequencyId?: number;
  frequencyValue?: string;
  auditArea?: string;
  responsibleRoleId?: number;
  responsibleRoleValue?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class HousekeepingService {
  private readonly http = inject(HttpClient);
  private readonly taskApiBase = '/api/hmsService/v1/tasks';
  private readonly lostFoundApiBase = '/api/hmsService/v1/lost-found';
  private readonly maintenanceApiBase = '/api/hmsService/v1/maintenance';
  private readonly auditApiBase = '/api/hmsService/v1/housekeeping/audit';
  private readonly hmsApiBase = '/api/hmsService/v1';

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

  private _tasks = signal<HKTask[]>([]);

  private _staff = signal<HKStaff[]>([
    { id: 1, name: 'Meena Pillai',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [1, 2, 15], completedToday: 1, phone: '+91 98765 00001', avatar: 'MP' },
    { id: 2, name: 'Rahul Shetty',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [8, 10],    completedToday: 0, phone: '+91 98765 00002', avatar: 'RS' },
    { id: 3, name: 'Deepa Thomas',   role: 'HOUSEKEEPER', shift: 'MORNING',   status: 'ON_BREAK', assignedRoomIds: [12, 14],   completedToday: 0, phone: '+91 98765 00003', avatar: 'DT' },
    { id: 4, name: 'Arjun Menon',    role: 'INSPECTOR',   shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [4, 7, 11], completedToday: 2, phone: '+91 98765 00004', avatar: 'AM' },
    { id: 5, name: 'Lalitha Nair',   role: 'SUPERVISOR',  shift: 'MORNING',   status: 'ON_DUTY',  assignedRoomIds: [],         completedToday: 0, phone: '+91 98765 00005', avatar: 'LN' },
    { id: 6, name: 'Suresh Kumar',   role: 'HOUSEKEEPER', shift: 'AFTERNOON', status: 'OFF_DUTY', assignedRoomIds: [],         completedToday: 0, phone: '+91 98765 00006', avatar: 'SK' },
  ]);

  private _lostFound = signal<LostFoundItem[]>([]);
  private _lostFoundCategories = signal<CommonMasterOption[]>([]);

  private _maintenance = signal<MaintenanceRequest[]>([]);
  private _maintenanceCategories = signal<CommonMasterOption[]>([]);
  private _maintenancePriorities = signal<CommonMasterOption[]>([]);
  private _maintenanceStatuses = signal<CommonMasterOption[]>([]);
  private _sopCheckpoints = signal<SopCheckpoint[]>([]);
  private _sopFrequencyOptions = signal<CommonMasterOption[]>([]);
  private _sopAuditAreaOptions = signal<CommonMasterOption[]>([]);
  private _sopResponsibleRoleOptions = signal<CommonMasterOption[]>([]);

  // Public read-only signals
  readonly rooms      = this._rooms.asReadonly();
  readonly tasks      = this._tasks.asReadonly();
  readonly staff      = this._staff.asReadonly();
  readonly lostFound  = this._lostFound.asReadonly();
  readonly lostFoundCategories = this._lostFoundCategories.asReadonly();
  readonly maintenance= this._maintenance.asReadonly();
  readonly maintenanceCategories = this._maintenanceCategories.asReadonly();
  readonly maintenancePriorities = this._maintenancePriorities.asReadonly();
  readonly maintenanceStatuses = this._maintenanceStatuses.asReadonly();
  readonly sopCheckpoints = this._sopCheckpoints.asReadonly();
  readonly sopFrequencyOptions = this._sopFrequencyOptions.asReadonly();
  readonly sopAuditAreaOptions = this._sopAuditAreaOptions.asReadonly();
  readonly sopResponsibleRoleOptions = this._sopResponsibleRoleOptions.asReadonly();

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

  constructor() {
    this.loadTasks();
    this.loadLostFound();
    this.loadLostFoundCategories();
    this.loadMaintenance();
    this.loadMaintenanceMasters();
    this.loadSopMasters();
    this.loadSopCheckpoints();
  }

  // --- Room CRUD ---
  updateRoomStatus(roomId: number, status: HKStatus) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, hkStatus: status, lastCleaned: status === 'VACANT_CLEAN' || status === 'INSPECTED' ? new Date().toISOString() : r.lastCleaned } : r));
  }

  assignRoomToStaff(roomId: number, staffId: number | undefined) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, assignedToId: staffId } : r));
    this._staff.update(list => list.map(staff => {
      const withoutRoom = staff.assignedRoomIds.filter(id => id !== roomId);
      return staff.id === staffId ? { ...staff, assignedRoomIds: [...withoutRoom, roomId] } : { ...staff, assignedRoomIds: withoutRoom };
    }));
  }

  // --- Task CRUD ---
  loadTasks() {
    this.http.get<ApiResponse<ApiTaskDTO[]>>(`${this.taskApiBase}/getAllTasks`).subscribe({
      next: response => this._tasks.set((response.data ?? []).map(item => this.fromApiTask(item))),
      error: error => {
        console.error('Failed to load housekeeping tasks', error);
        this._tasks.set([]);
      },
    });
  }

  saveTask(task: Partial<HKTask>) {
    const payload = this.toApiTask(task);
    if (task.id) {
      this.http.put<ApiResponse<ApiTaskDTO>>(`${this.taskApiBase}/updateTask/${task.id}`, payload).subscribe({
        next: response => {
          const updated = response.data ? this.fromApiTask(response.data) : { ...task, id: task.id } as HKTask;
          this._tasks.update(list => list.map(item => item.id === task.id ? { ...item, ...updated } : item));
        },
        error: error => console.error('Failed to update housekeeping task', error),
      });
    } else {
      this.http.post<ApiResponse<void>>(`${this.taskApiBase}/createTask`, payload).subscribe({
        next: () => this.loadTasks(),
        error: error => console.error('Failed to create housekeeping task', error),
      });
    }
  }

  updateTaskStatus(taskId: number, status: TaskStatus) {
    if (status === 'SKIPPED') {
      this._tasks.update(list => list.map(t => t.id === taskId ? { ...t, status } : t));
      return;
    }

    const now = new Date().toISOString();
    const params = new HttpParams().set('status', status);

    this.http.patch<ApiResponse<ApiTaskDTO>>(`${this.taskApiBase}/updateTaskStatus/${taskId}`, null, { params }).subscribe({
      next: response => {
        const apiTask = response.data ? this.fromApiTask(response.data) : undefined;
        this._tasks.update(list => list.map(t => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            ...(apiTask ?? {}),
            status,
            startedAt: status === 'IN_PROGRESS' ? now : t.startedAt,
            completedAt: status === 'COMPLETED' ? now : t.completedAt,
          };
        }));

        if (status === 'COMPLETED') {
          const task = this._tasks().find(t => t.id === taskId);
          if (task && (task.taskType === 'CHECKOUT_CLEAN' || task.taskType === 'STAYOVER_CLEAN' || task.taskType === 'DEEP_CLEAN')) {
            this.updateRoomStatus(task.roomId, 'VACANT_CLEAN');
          }
        }
      },
      error: error => console.error('Failed to update housekeeping task status', error),
    });
  }

  deleteTask(id: number) {
    this.http.delete<ApiResponse<void>>(`${this.taskApiBase}/deleteTask/${id}`).subscribe({
      next: () => this._tasks.update(list => list.filter(t => t.id !== id)),
      error: error => console.error('Failed to delete housekeeping task', error),
    });
  }

  private fromApiTask(task: ApiTaskDTO): HKTask {
    const room = this._rooms().find(r => r.id === task.roomId || r.roomNumber === task.roomNumber);
    const now = new Date().toISOString();

    return {
      id: Number(task.id ?? 0),
      roomId: Number(task.roomId ?? room?.id ?? 0),
      roomNumber: task.roomNumber ?? room?.roomNumber ?? '',
      floor: task.floorNumber ?? room?.floor ?? '',
      assignedToId: task.assignedUserId,
      assignedToName: task.assignedUserName,
      taskType: this.asTaskType(task.taskType),
      priority: this.asPriority(task.priority),
      status: this.asTaskStatus(task.status),
      notes: task.instructions ?? '',
      estimatedMins: Number(task.estimatedMinutes ?? 0),
      createdAt: now,
    };
  }

  private toApiTask(task: Partial<HKTask>): ApiTaskDTO {
    const room = this._rooms().find(r => r.id === task.roomId || r.roomNumber === task.roomNumber);
    const assignedUserId = this.numberOrUndefined(task.assignedToId);
    const staff = assignedUserId ? this._staff().find(s => s.id === assignedUserId) : undefined;

    return {
      id: this.numberOrUndefined(task.id),
      roomId: this.numberOrUndefined(task.roomId ?? room?.id),
      roomNumber: task.roomNumber ?? room?.roomNumber ?? '',
      floorNumber: task.floor ?? room?.floor ?? '',
      taskType: task.taskType ?? 'STAYOVER_CLEAN',
      priority: task.priority ?? 'MEDIUM',
      assignedUserId,
      assignedUserName: task.assignedToName ?? staff?.name ?? '',
      estimatedMinutes: Number(task.estimatedMins ?? 30),
      instructions: task.notes ?? '',
      status: task.status === 'SKIPPED' ? 'PENDING' : task.status ?? 'PENDING',
    };
  }

  private asTaskType(value?: string): TaskType {
    const normalized = (value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const allowed: TaskType[] = ['CHECKOUT_CLEAN', 'STAYOVER_CLEAN', 'DEEP_CLEAN', 'INSPECTION', 'TURNDOWN'];
    return allowed.includes(normalized as TaskType) ? normalized as TaskType : 'STAYOVER_CLEAN';
  }

  private asPriority(value?: string): Priority {
    return value === 'HIGH' || value === 'LOW' || value === 'MEDIUM' ? value : 'MEDIUM';
  }

  private asTaskStatus(value?: string): TaskStatus {
    if (value === 'IN_PROGRESS' || value === 'COMPLETED' || value === 'PENDING') {
      return value;
    }
    return 'PENDING';
  }

  private numberOrUndefined(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  // --- Lost & Found CRUD ---
  loadLostFound() {
    this.http.get<ApiResponse<ApiLostAndFoundDTO[]>>(`${this.lostFoundApiBase}/getAllLostItem`).subscribe({
      next: response => this._lostFound.set((response.data ?? []).map(item => this.fromApiLostFound(item))),
      error: error => {
        console.error('Failed to load lost and found items', error);
        this._lostFound.set([]);
      },
    });
  }

  saveLostFound(item: Partial<LostFoundItem>) {
    const payload = this.toApiLostFound(item);
    if (item.id) {
      this.http.put<ApiResponse<ApiLostAndFoundDTO>>(`${this.lostFoundApiBase}/updateLostFoundItem/${item.id}`, payload).subscribe({
        next: response => {
          const updated = response.data ? this.fromApiLostFound(response.data) : { ...item, id: item.id } as LostFoundItem;
          this._lostFound.update(list => list.map(existing => existing.id === item.id ? { ...existing, ...updated } : existing));
        },
        error: error => console.error('Failed to update lost and found item', error),
      });
    } else {
      this.http.post<ApiResponse<void>>(`${this.lostFoundApiBase}/createLostFoundItem`, payload).subscribe({
        next: () => this.loadLostFound(),
        error: error => console.error('Failed to create lost and found item', error),
      });
    }
  }

  updateLFStatus(id: number, status: LFStatus) {
    const params = new HttpParams().set('status', status);
    this.http.patch<ApiResponse<ApiLostAndFoundDTO>>(`${this.lostFoundApiBase}/updateLostFoundItemStatus/${id}`, null, { params }).subscribe({
      next: response => {
        const updated = response.data ? this.fromApiLostFound(response.data) : undefined;
        this._lostFound.update(list => list.map(item => item.id === id ? { ...item, ...(updated ?? {}), status } : item));
      },
      error: error => console.error('Failed to update lost and found status', error),
    });
  }

  deleteLostFound(id: number) {
    this.http.delete<ApiResponse<void>>(`${this.lostFoundApiBase}/deleteLostFoundItem/${id}`).subscribe({
      next: () => this._lostFound.update(list => list.filter(item => item.id !== id)),
      error: error => console.error('Failed to delete lost and found item', error),
    });
  }

  private fromApiLostFound(item: ApiLostAndFoundDTO): LostFoundItem {
    return {
      id: Number(item.id ?? 0),
      roomId: this.numberOrUndefined(item.roomId),
      roomNumber: item.roomNumber ?? '',
      description: item.itemDescription ?? '',
      categoryId: this.numberOrUndefined(item.categoryId),
      category: item.categoryValue ?? '',
      foundById: this.numberOrUndefined(item.foundById),
      foundBy: item.foundByName ?? '',
      foundDate: item.foundDate ?? new Date().toISOString().split('T')[0],
      status: this.asLFStatus(item.status),
      guestName: item.guestName,
      guestContact: item.guestContact,
      storageLocation: item.storageLocation ?? '',
      notes: item.storageNotes ?? '',
    };
  }

  private toApiLostFound(item: Partial<LostFoundItem>): ApiLostAndFoundDTO {
    const room = this._rooms().find(r => r.id === item.roomId || r.roomNumber === item.roomNumber);

    return {
      id: this.numberOrUndefined(item.id),
      roomId: this.numberOrUndefined(item.roomId ?? room?.id),
      roomNumber: item.roomNumber ?? room?.roomNumber ?? '',
      itemDescription: item.description ?? '',
      categoryId: this.numberOrUndefined(item.categoryId),
      categoryValue: item.category ?? '',
      foundById: this.numberOrUndefined(item.foundById),
      foundByName: item.foundBy ?? '',
      storageLocation: item.storageLocation ?? '',
      foundDate: item.foundDate ?? new Date().toISOString().split('T')[0],
      guestName: item.guestName ?? '',
      guestContact: item.guestContact ?? '',
      storageNotes: item.notes ?? '',
      status: item.status ?? 'STORED',
    };
  }

  private asLFStatus(status?: string): LFStatus {
    return status === 'CLAIMED' || status === 'DONATED' || status === 'DISPOSED' || status === 'STORED' ? status : 'STORED';
  }

  loadLostFoundCategories() {
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/housekeeping/audit/getCommonMaster/LOST_FOUND_CATEGORY`).subscribe({
      next: response => this._lostFoundCategories.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load lost and found categories', error);
        this._lostFoundCategories.set([]);
      },
    });
  }

  private commonMasterData(response: CommonMasterOption[] | ApiListResponse<CommonMasterOption> | null): CommonMasterOption[] {
    const data = Array.isArray(response) ? response : response?.data ?? [];
    return data
      .map(item => ({
        id: Number(item.id),
        category: item.category,
        code: item.code,
        value: item.value || item.code || '',
        description: item.description,
      }))
      .filter(item => item.id && item.value);
  }

  // --- Maintenance CRUD ---
  loadMaintenance() {
    this.http.get<ApiResponse<ApiMaintenanceDTO[]>>(`${this.maintenanceApiBase}/getAllMaintenance`).subscribe({
      next: response => this._maintenance.set((response.data ?? []).map(item => this.fromApiMaintenance(item))),
      error: error => {
        console.error('Failed to load maintenance issues', error);
        this._maintenance.set([]);
      },
    });
  }

  saveMaintenance(req: Partial<MaintenanceRequest>) {
    const payload = this.toApiMaintenance(req);
    if (req.id) {
      this.http.put<ApiResponse<ApiMaintenanceDTO>>(`${this.maintenanceApiBase}/updateMaintenance/${req.id}`, payload).subscribe({
        next: response => {
          const updated = response.data ? this.fromApiMaintenance(response.data) : { ...req, id: req.id } as MaintenanceRequest;
          this._maintenance.update(list => list.map(item => item.id === req.id ? { ...item, ...updated } : item));
        },
        error: error => console.error('Failed to update maintenance issue', error),
      });
    } else {
      this.http.post<ApiResponse<void>>(`${this.maintenanceApiBase}/createMaintenance`, payload).subscribe({
        next: () => this.loadMaintenance(),
        error: error => console.error('Failed to create maintenance issue', error),
      });
    }
  }

  updateMaintStatus(id: number, status: MaintStatus) {
    const params = new HttpParams().set('status', status);
    this.http.patch<ApiResponse<ApiMaintenanceDTO>>(`${this.maintenanceApiBase}/updateMaintenanceStatus/${id}`, null, { params }).subscribe({
      next: response => {
        const updated = response.data ? this.fromApiMaintenance(response.data) : undefined;
        this._maintenance.update(list => list.map(item => item.id === id ? { ...item, ...(updated ?? {}), status, resolvedAt: (status === 'RESOLVED' || status === 'COMPLETED') ? new Date().toISOString() : item.resolvedAt } : item));
      },
      error: error => console.error('Failed to update maintenance status', error),
    });
  }

  deleteMaintenance(id: number) {
    this.http.delete<ApiResponse<void>>(`${this.maintenanceApiBase}/deleteMaintenance/${id}`).subscribe({
      next: () => this._maintenance.update(list => list.filter(item => item.id !== id)),
      error: error => console.error('Failed to delete maintenance issue', error),
    });
  }

  loadMaintenanceMasters() {
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/housekeeping/audit/getCommonMaster/MAINTENANCE_CATEGORY`).subscribe({
      next: response => this._maintenanceCategories.set(this.commonMasterData(response)),
      error: error => console.error('Failed to load maintenance categories', error),
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/housekeeping/audit/getCommonMaster/MAINTENANCE_PRIORITY`).subscribe({
      next: response => this._maintenancePriorities.set(this.commonMasterData(response)),
      error: error => console.error('Failed to load maintenance priorities', error),
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/housekeeping/audit/getCommonMaster/MAINTENANCE_STATUS`).subscribe({
      next: response => this._maintenanceStatuses.set(this.commonMasterData(response)),
      error: error => console.error('Failed to load maintenance statuses', error),
    });
  }

  private fromApiMaintenance(item: ApiMaintenanceDTO): MaintenanceRequest {
    const room = this._rooms().find(r => r.id === item.roomId || r.roomNumber === item.roomNumber);
    return {
      id: Number(item.id ?? 0),
      roomId: this.numberOrUndefined(item.roomId),
      roomNumber: item.roomNumber ?? room?.roomNumber ?? '',
      floor: room?.floor ?? '',
      issue: item.repairIssue ?? '',
      categoryId: this.numberOrUndefined(item.categoryId),
      category: item.categoryValue ?? '',
      priorityId: this.numberOrUndefined(item.priorityId),
      priority: this.asMaintPriority(item.priorityValue),
      status: this.asMaintStatus(item.status),
      reportedById: this.numberOrUndefined(item.reportedById),
      reportedBy: item.reportedByName ?? '',
      assignedToId: this.numberOrUndefined(item.assignedToId),
      assignedTo: item.assignedToName ?? '',
      reportedAt: item.reportedAt ?? new Date().toISOString(),
      resolvedAt: (item.status === 'RESOLVED' || item.status === 'COMPLETED') ? new Date().toISOString() : undefined,
      notes: item.repairNotes ?? '',
    };
  }

  private toApiMaintenance(item: Partial<MaintenanceRequest>): ApiMaintenanceDTO {
    const room = this._rooms().find(r => r.id === item.roomId || r.roomNumber === item.roomNumber);
    return {
      id: this.numberOrUndefined(item.id),
      roomId: this.numberOrUndefined(item.roomId ?? room?.id),
      roomNumber: item.roomNumber ?? room?.roomNumber ?? '',
      repairIssue: item.issue ?? '',
      categoryId: this.numberOrUndefined(item.categoryId),
      categoryValue: item.category ?? '',
      priorityId: this.numberOrUndefined(item.priorityId),
      priorityValue: item.priority ?? '',
      reportedById: this.numberOrUndefined(item.reportedById),
      reportedByName: item.reportedBy ?? '',
      assignedToId: this.numberOrUndefined(item.assignedToId),
      assignedToName: item.assignedTo ?? '',
      repairNotes: item.notes ?? '',
      status: item.status ?? 'OPEN',
      reportedAt: item.reportedAt ?? new Date().toISOString(),
    };
  }

  // --- Audit SOP checkpoints ---
  loadSopCheckpoints(frequency?: AuditFrequency) {
    const endpoint = frequency
      ? `${this.auditApiBase}/getCheckpointsByFrequency/${frequency}`
      : `${this.auditApiBase}/getAllCheckpoints`;

    this.http.get<ApiResponse<ApiSopCheckpointDTO[]>>(endpoint).subscribe({
      next: response => this._sopCheckpoints.set((response.data ?? []).map(item => this.fromApiSopCheckpoint(item)).sort((a, b) => a.id.localeCompare(b.id))),
      error: error => {
        console.error('Failed to load SOP checkpoints', error);
        this._sopCheckpoints.set([]);
      },
    });
  }

  saveSopCheckpoint(checkpoint: Partial<SopCheckpoint>) {
    const payload = this.toApiSopCheckpoint(checkpoint);
    this.http.post<ApiResponse<void>>(`${this.auditApiBase}/createCheckpoints`, payload).subscribe({
      next: () => this.loadSopCheckpoints(checkpoint.frequency),
      error: error => console.error('Failed to create SOP checkpoint', error),
    });
  }

  loadSopMasters() {
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.auditApiBase}/getCommonMaster/SOP_FREQUENCY`).subscribe({
      next: response => this._sopFrequencyOptions.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load SOP frequencies', error);
        this._sopFrequencyOptions.set([]);
      },
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.auditApiBase}/getCommonMaster/AUDIT_AREA`).subscribe({
      next: response => this._sopAuditAreaOptions.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load audit areas', error);
        this._sopAuditAreaOptions.set([]);
      },
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.auditApiBase}/getCommonMaster/RESPONSIBLE_ROLE`).subscribe({
      next: response => this._sopResponsibleRoleOptions.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load responsible roles', error);
        this._sopResponsibleRoleOptions.set([]);
      },
    });
  }

  private fromApiSopCheckpoint(item: ApiSopCheckpointDTO): SopCheckpoint {
    return {
      id: item.checkpointId ?? String(item.id ?? ''),
      apiId: this.numberOrUndefined(item.id),
      frequencyId: this.numberOrUndefined(item.frequencyId),
      frequencyValue: item.frequencyValue,
      frequency: this.asAuditFrequency(item.frequencyValue),
      area: item.auditArea ?? '',
      auditAreaId: this._sopAuditAreaOptions().find(option => option.value === item.auditArea || option.code === item.auditArea)?.id,
      label: item.description ?? '',
      owner: item.responsibleRoleValue ?? '',
      responsibleRoleId: this.numberOrUndefined(item.responsibleRoleId),
    };
  }

  private toApiSopCheckpoint(item: Partial<SopCheckpoint>): ApiSopCheckpointDTO {
    const frequency = item.frequency ?? 'DAILY';
    const frequencyOption = this._sopFrequencyOptions().find(option => option.id === item.frequencyId || option.code === frequency || option.value.toUpperCase() === frequency);
    const auditAreaOption = this._sopAuditAreaOptions().find(option => option.id === item.auditAreaId || option.value === item.area || option.code === item.area);
    const roleOption = this._sopResponsibleRoleOptions().find(option => option.id === item.responsibleRoleId || option.value === item.owner || option.code === item.owner);

    return {
      checkpointId: item.id ?? '',
      frequencyId: this.numberOrUndefined(item.frequencyId ?? frequencyOption?.id),
      frequencyValue: frequencyOption?.value ?? item.frequencyValue ?? frequency,
      auditArea: auditAreaOption?.value ?? item.area ?? '',
      responsibleRoleId: this.numberOrUndefined(item.responsibleRoleId ?? roleOption?.id),
      responsibleRoleValue: roleOption?.value ?? item.owner ?? '',
      description: item.label ?? '',
    };
  }

  private asAuditFrequency(value?: string): AuditFrequency {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized === 'WEEKLY' || normalized === 'WEEK') return 'WEEKLY';
    if (normalized === 'MONTHLY' || normalized === 'MONTH') return 'MONTHLY';
    return 'DAILY';
  }

  private asMaintPriority(value?: string): MaintPriority {
    const normalized = (value ?? '').toUpperCase().replace(/[\s-]+/g, '_');
    return normalized === 'URGENT' || normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW' || normalized === 'NORMAL' ? normalized : 'NORMAL';
  }

  private asMaintStatus(value?: string): MaintStatus {
    const normalized = (value ?? '').toUpperCase().replace(/[\s-]+/g, '_');
    return normalized === 'ASSIGNED' || normalized === 'IN_PROGRESS' || normalized === 'ON_HOLD' || normalized === 'RESOLVED' || normalized === 'COMPLETED' || normalized === 'CANCELLED' || normalized === 'OPEN' ? normalized : 'OPEN';
  }
}
