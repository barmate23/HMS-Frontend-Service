import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

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
  assignedStaffName?: string;
  dnd: boolean;
  priority: Priority;
  tasksCount?: number;
  maintenanceCount?: number;
  lostFoundCount?: number;
  sopChecksCount?: number;
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
  role: string;
  shift: string;
  status: StaffStatus;
  assignedRoomIds: number[];
  completedToday: number;
  pendingTasks?: number;
  pendingTaskDetails?: HKTask[];
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
  isActive?: boolean;
}

interface UpdateHkStatusRequest {
  roomId: number;
  hkStatusId: number;
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

interface ApiRoomAssignmentDTO {
  id?: number;
  roomNumber?: string;
  roomTypeName?: string;
  status?: string;
  assignedUserId?: number;
  assignedUserName?: string;
  assignedToCurrentUser?: boolean;
  assignedToOther?: boolean;
}

interface ApiStaffDTO {
  id?: number;
  fullName?: string;
  role?: string;
  status?: string;
  shift?: string;
  phone?: string;
  completedToday?: number;
  pendingTasks?: number;
  pendingTaskDetails?: ApiTaskDTO[];
  assignedRoomDetails?: ApiRoomAssignmentDTO[];
}

interface ApiFloorDTO {
  id?: number;
  floorNumber?: string;
  isActive?: boolean;
}

interface ApiRoomTypeDTO {
  id?: number;
  name?: string;
}

interface ApiMasterRoomDTO {
  id?: number;
  roomNumber?: string;
  floorId?: number;
  floorNumber?: string;
  roomTypeId?: number;
  typeId?: number;
  roomTypeName?: string;
  status?: string;
  isActive?: boolean;
}

interface UserRoomAssignmentRequest {
  userId: number;
  roomIds: number[];
  assignedBy: string;
}

export interface HousekeepingDashboardSummary {
  readyRooms?: number;
  needService?: number;
  blockedDnd?: number;
  openTasks?: number;
  repairIssues?: number;
  sopChecks?: number;
  readyPercentage?: number;
}

export interface HousekeepingAttentionItem {
  label?: string;
  count?: number;
  type?: string;
}

export interface HousekeepingTeamLoad {
  pendingSubmissions?: number;
  inProgress?: number;
  staffProfiles?: number;
}

export interface HousekeepingAuditReadiness {
  activeSop?: string;
  checkpoints?: number;
  roomsTracked?: number;
}

export interface HousekeepingRoomBoard {
  roomNumber?: string;
  category?: string;
  status?: string;
  tasksCount?: number;
  maintenanceCount?: number;
  lostFoundCount?: number;
  sopChecksCount?: number;
  assignedStaff?: string;
  statusColor?: string;
}

export interface HousekeepingFloorRoomBoard {
  floorName?: string;
  roomCount?: number;
  rooms?: HousekeepingRoomBoard[];
}

export interface HousekeepingDashboardData {
  summary?: HousekeepingDashboardSummary;
  attentionQueue?: HousekeepingAttentionItem[];
  teamLoad?: HousekeepingTeamLoad;
  auditReadiness?: HousekeepingAuditReadiness;
  floorRoomBoard?: HousekeepingFloorRoomBoard[];
}

@Injectable({ providedIn: 'root' })
export class HousekeepingService {
  private readonly http = inject(HttpClient);
  private readonly taskApiBase = '/api/hmsService/v1/tasks';
  private readonly lostFoundApiBase = '/api/hmsService/v1/lost-found';
  private readonly maintenanceApiBase = '/api/hmsService/v1/maintenance';
  private readonly auditApiBase = '/api/hmsService/v1/housekeeping/audit';
  private readonly dashboardApiBase = '/api/hmsService/v1/housekeeping/dashboard';
  private readonly staffApiBase = '/api/hmsService/v1/housekeeping/staff';
  private readonly hmsApiBase = '/api/hmsService/v1';
  private readonly masterApiBase = '/api/masterService/v1';
  private readonly hkStatusCodeByStatus: Record<HKStatus, string> = {
    VACANT_CLEAN: 'VC',
    VACANT_DIRTY: 'VD',
    OCCUPIED_CLEAN: 'OC',
    OCCUPIED_DIRTY: 'OD',
    INSPECTED: 'INS',
    OUT_OF_ORDER: 'OOO',
    DO_NOT_DISTURB: 'DND',
    UNDER_MAINTENANCE: 'UM',
  };
  private hkStatusIdByStatus?: Map<HKStatus, number>;

  private _rooms = signal<HKRoom[]>([]);
  private _roomFloors = signal<string[]>([]);
  private _dashboard = signal<HousekeepingDashboardData | null>(null);

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
  readonly roomFloors = this._roomFloors.asReadonly();
  readonly dashboard  = this._dashboard.asReadonly();
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
    this.loadDashboard();
    this.loadRooms();
    this.loadStaff();
    this.loadTasks();
    this.loadLostFound();
    this.loadLostFoundCategories();
    this.loadMaintenance();
    this.loadMaintenanceMasters();
    this.loadSopMasters();
    this.loadSopCheckpoints();
  }

  loadDashboard() {
    this.http.get<ApiResponse<HousekeepingDashboardData>>(`${this.dashboardApiBase}/getHkDashboardData`).subscribe({
      next: response => this._dashboard.set(response.data ?? null),
      error: error => {
        console.error('Failed to load housekeeping dashboard data', error);
        this._dashboard.set(null);
      },
    });
  }

  // --- Room CRUD ---
  loadRooms() {
    forkJoin({
      floors: this.http.get<ApiResponse<ApiFloorDTO[]>>(`${this.masterApiBase}/floors/getAllFloors`),
      roomTypes: this.http.get<ApiResponse<ApiRoomTypeDTO[]>>(`${this.masterApiBase}/roomTypes/getAllRoomTypes`),
      rooms: this.http.get<ApiResponse<ApiMasterRoomDTO[]>>(`${this.masterApiBase}/rooms/getAllRooms`),
    }).subscribe({
      next: response => {
        const floorItems = (response.floors.data ?? []).filter(floor => floor.id && floor.floorNumber && floor.isActive !== false);
        const floors = new Map(floorItems.map(floor => [Number(floor.id), floor.floorNumber || `Floor ${floor.id}`]));
        const roomTypes = new Map((response.roomTypes.data ?? []).map(type => [Number(type.id), type.name || 'Room']));
        const rooms = (response.rooms.data ?? [])
          .filter(room => room.id && room.roomNumber && room.isActive !== false)
          .map(room => this.fromApiMasterRoom(room, floors, roomTypes))
          .sort((a, b) => a.floor.localeCompare(b.floor, undefined, { numeric: true }) || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
        this._roomFloors.set(floorItems.map(floor => floor.floorNumber || `Floor ${floor.id}`));
        this._rooms.set(rooms);
      },
      error: error => {
        console.error('Failed to load housekeeping rooms', error);
        this._roomFloors.set([]);
        this._rooms.set([]);
      },
    });
  }

  updateRoomStatus(roomId: number, status: HKStatus): Observable<void> {
    const previousRooms = this._rooms();
    this.applyLocalRoomStatus(roomId, status);

    return this.resolveHkStatusId(status).pipe(
      switchMap(hkStatusId => {
        const payload: UpdateHkStatusRequest = { roomId, hkStatusId };
        return this.http.post<ApiResponse<void>>(`${this.dashboardApiBase}/updateHkStatus`, payload);
      }),
      tap(() => {
        this.loadDashboard();
        this.loadRooms();
      }),
      map(() => undefined),
      catchError(error => {
        console.error('Failed to update housekeeping room status', error);
        this._rooms.set(previousRooms);
        this.loadDashboard();
        this.loadRooms();
        return throwError(() => error);
      }),
    );
  }

  private applyLocalRoomStatus(roomId: number, status: HKStatus) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, hkStatus: status, lastCleaned: status === 'VACANT_CLEAN' || status === 'INSPECTED' ? new Date().toISOString() : r.lastCleaned } : r));
  }

  private resolveHkStatusId(status: HKStatus): Observable<number> {
    const cached = this.hkStatusIdByStatus?.get(status);
    if (cached) return of(cached);

    return this.http.get<ApiResponse<CommonMasterOption[]>>(`${this.hmsApiBase}/common/getCommonMaster/HK_STATUS`).pipe(
      map(response => {
        const codeToStatus = new Map(Object.entries(this.hkStatusCodeByStatus).map(([hkStatus, code]) => [code, hkStatus as HKStatus]));
        const statusIds = new Map<HKStatus, number>();
        const options = [...(response.data ?? [])]
          .filter(option => option.id && option.isActive !== false)
          .sort((a, b) => Number(a.id) - Number(b.id));

        for (const option of options) {
          const statusKey = codeToStatus.get(String(option.code || '').trim().toUpperCase());
          if (statusKey && !statusIds.has(statusKey)) {
            statusIds.set(statusKey, Number(option.id));
          }
        }

        this.hkStatusIdByStatus = statusIds;
        const id = statusIds.get(status);
        if (!id) throw new Error(`No HK_STATUS common master id found for ${status}`);
        return id;
      }),
    );
  }

  assignRoomToStaff(roomId: number, staffId: number | undefined) {
    this._rooms.update(list => list.map(r => r.id === roomId ? { ...r, assignedToId: staffId } : r));
    this._staff.update(list => list.map(staff => {
      const withoutRoom = staff.assignedRoomIds.filter(id => id !== roomId);
      return staff.id === staffId ? { ...staff, assignedRoomIds: [...withoutRoom, roomId] } : { ...staff, assignedRoomIds: withoutRoom };
    }));
  }

  loadStaff() {
    this.http.get<ApiResponse<ApiStaffDTO[]>>(`${this.staffApiBase}/getHousekeepingStaff`).subscribe({
      next: response => this.applyApiStaff(response.data ?? []),
      error: error => {
        console.error('Failed to load housekeeping staff', error);
        this._staff.set([]);
      },
    });
  }

  saveStaffAssignments(userId: number, roomIds: number[], assignedBy = 'System') {
    const payload: UserRoomAssignmentRequest = { userId, roomIds, assignedBy };
    this.applyLocalStaffAssignments(userId, roomIds);

    this.http.post<ApiResponse<void>>(`${this.staffApiBase}/saveAssignments`, payload).subscribe({
      next: () => this.loadStaff(),
      error: error => {
        console.error('Failed to save staff room assignments', error);
        this.loadStaff();
      },
    });
  }

  private applyApiStaff(items: ApiStaffDTO[]) {
    const staff = items.map(item => this.fromApiStaff(item)).filter(item => item.id && item.name);
    this._staff.set(staff);

    const assignedRoomIds = new Set(staff.flatMap(item => item.assignedRoomIds));
    this._rooms.update(rooms => rooms.map(room => {
      const assignedStaff = staff.find(item => item.assignedRoomIds.includes(room.id));
      if (assignedStaff) return { ...room, assignedToId: assignedStaff.id };
      return assignedRoomIds.has(room.id) ? room : { ...room, assignedToId: undefined };
    }));
  }

  private fromApiStaff(item: ApiStaffDTO): HKStaff {
    const name = item.fullName?.trim() || `Staff #${item.id ?? ''}`.trim();
    const pendingTaskDetails = (item.pendingTaskDetails ?? []).map(task => this.fromApiTask(task));
    return {
      id: Number(item.id ?? 0),
      name,
      role: item.role?.trim() || 'HOUSEKEEPER',
      shift: item.shift?.trim() || '-',
      status: this.asStaffStatus(item.status),
      assignedRoomIds: (item.assignedRoomDetails ?? [])
        .map(room => this.numberOrUndefined(room.id))
        .filter((id): id is number => !!id),
      completedToday: Number(item.completedToday ?? 0),
      pendingTasks: Number(item.pendingTasks ?? pendingTaskDetails.length),
      pendingTaskDetails,
      phone: item.phone || '-',
      avatar: this.initials(name),
    };
  }

  private applyLocalStaffAssignments(userId: number, roomIds: number[]) {
    const selected = new Set(roomIds);
    this._rooms.update(rooms => rooms.map(room => {
      if (selected.has(room.id)) return { ...room, assignedToId: userId };
      return room.assignedToId === userId ? { ...room, assignedToId: undefined } : room;
    }));
    this._staff.update(staff => staff.map(item => {
      if (item.id === userId) return { ...item, assignedRoomIds: roomIds };
      return { ...item, assignedRoomIds: item.assignedRoomIds.filter(id => !selected.has(id)) };
    }));
  }

  private fromApiMasterRoom(room: ApiMasterRoomDTO, floors: Map<number, string>, roomTypes: Map<number, string>): HKRoom {
    const existing = this._rooms().find(item => item.id === room.id);
    const assignedStaff = this._staff().find(staff => staff.assignedRoomIds.includes(Number(room.id)));
    const typeId = Number(room.roomTypeId ?? room.typeId ?? 0);
    const hkStatus = this.asHKStatus(room.status);

    return {
      id: Number(room.id),
      roomNumber: room.roomNumber ?? '',
      floor: floors.get(Number(room.floorId)) || room.floorNumber || `Floor ${room.floorId ?? '-'}`,
      type: roomTypes.get(typeId) || room.roomTypeName || 'Room',
      hkStatus,
      isOccupied: String(room.status || '').toUpperCase() === 'OCCUPIED',
      lastCleaned: existing?.lastCleaned,
      assignedToId: existing?.assignedToId ?? assignedStaff?.id,
      dnd: existing?.dnd ?? false,
      priority: existing?.priority ?? 'LOW',
    };
  }

  private asHKStatus(value?: string): HKStatus {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (normalized === 'OCCUPIED') return 'OCCUPIED_CLEAN';
    if (normalized === 'CLEANING') return 'VACANT_DIRTY';
    if (normalized === 'MAINTENANCE') return 'UNDER_MAINTENANCE';
    if (normalized === 'OUT_OF_ORDER') return 'OUT_OF_ORDER';
    if (normalized === 'DO_NOT_DISTURB') return 'DO_NOT_DISTURB';
    if (normalized === 'OCCUPIED_DIRTY') return 'OCCUPIED_DIRTY';
    if (normalized === 'VACANT_DIRTY') return 'VACANT_DIRTY';
    if (normalized === 'INSPECTED') return 'INSPECTED';
    return 'VACANT_CLEAN';
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

  private asStaffStatus(value?: string): StaffStatus {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (normalized === 'ON_BREAK') return 'ON_BREAK';
    if (normalized === 'INACTIVE' || normalized === 'OFF_DUTY') return 'OFF_DUTY';
    return 'ON_DUTY';
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : name.slice(0, 2);
    return letters.toUpperCase() || 'ST';
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
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/LOST_FOUND_CATEGORY`).subscribe({
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
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/MAINTENANCE_CATEGORY`).subscribe({
      next: response => this._maintenanceCategories.set(this.commonMasterData(response)),
      error: error => console.error('Failed to load maintenance categories', error),
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/MAINTENANCE_PRIORITY`).subscribe({
      next: response => this._maintenancePriorities.set(this.commonMasterData(response)),
      error: error => console.error('Failed to load maintenance priorities', error),
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/MAINTENANCE_STATUS`).subscribe({
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
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/SOP_FREQUENCY`).subscribe({
      next: response => this._sopFrequencyOptions.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load SOP frequencies', error);
        this._sopFrequencyOptions.set([]);
      },
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/AUDIT_AREA`).subscribe({
      next: response => this._sopAuditAreaOptions.set(this.commonMasterData(response)),
      error: error => {
        console.error('Failed to load audit areas', error);
        this._sopAuditAreaOptions.set([]);
      },
    });
    this.http.get<CommonMasterOption[] | ApiListResponse<CommonMasterOption>>(`${this.hmsApiBase}/common/getCommonMaster/RESPONSIBLE_ROLE`).subscribe({
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
