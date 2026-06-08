import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  HousekeepingService,
  HKRoom, HKTask, HKStaff, LostFoundItem, MaintenanceRequest,
  HKStatus, TaskType, TaskStatus, Priority, LFStatus, MaintStatus, MaintPriority,
  AuditFrequency, SopCheckpoint
} from './housekeeping.service';
import { SystemUser, UserManagementService } from '../user-management/user-management.service';

type TabType = 'board' | 'tasks' | 'audit' | 'staff' | 'lost-found' | 'maintenance';
type AuditResult = 'PASS' | 'RECHECK' | 'FAIL' | 'EXCEPTION';
type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
type SopStatus = 'DONE' | 'PENDING' | 'ISSUE' | 'BLOCKED';

interface RoomSopCheck extends SopCheckpoint {
  status: SopStatus;
  evidence: string;
  finding?: string;
}

interface RoomAuditItem {
  id: number;
  roomNumber: string;
  floor: string;
  roomType: string;
  pmsStatus: string;
  hkStatus: HKStatus;
  occupancy: 'Vacant' | 'Occupied';
  guestName?: string;
  assignedToId?: number;
  inspector: string;
  auditedAt: string;
  score: number;
  result: AuditResult;
  severity: AuditSeverity;
  discrepancy: string;
  checklist: {
    cleanliness: number;
    linen: number;
    amenities: number;
    minibar: number;
    maintenance: number;
    safety: number;
  };
  defects: string[];
  followUp: string;
  releaseReady: boolean;
  statusLog: string[];
}

@Component({
  selector: 'app-housekeeping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './housekeeping.component.html',
  styleUrls: ['./housekeeping.component.css']
})
export class HousekeepingComponent implements OnInit, OnDestroy {
  readonly hk = inject(HousekeepingService);
  readonly router = inject(Router);
  readonly userService = inject(UserManagementService);

  private routerSub?: Subscription;

  // --- Tab ---
  activeTab = signal<TabType>('board');

  constructor() {
    this.routerSub = this.router.events.subscribe(() => {
      this.updateTabFromUrl(this.router.url);
    });
  }

  ngOnInit() {
    this.updateTabFromUrl(this.router.url);
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  selectTab(tab: TabType) {
    this.router.navigate(['/housekeeping/' + tab]);
  }

  toggleAuditSop() {
    this.isAuditSopExpanded.update(value => !value);
  }

  private updateTabFromUrl(url: string) {
    const segments = url.split('/');
    const lastSegment = segments[segments.length - 1]?.split('?')[0]; // strip query params
    if (['board', 'tasks', 'audit', 'staff', 'lost-found', 'maintenance'].includes(lastSegment)) {
      this.activeTab.set(lastSegment as TabType);
    } else {
      this.activeTab.set('board');
    }
  }

  // --- Search & Filters ---
  boardFilter   = signal<string>('ALL');
  boardSearch   = signal<string>('');
  taskFilter    = signal<string>('ALL');
  taskSearch    = signal<string>('');
  lfSearch      = signal<string>('');
  maintSearch   = signal<string>('');
  auditSearch   = signal<string>('');
  auditFloor    = signal<string>('Floor 1');
  auditFrequency= signal<AuditFrequency>('DAILY');
  isAuditSopExpanded = signal<boolean>(false);

  // --- Modals ---
  isTaskModalOpen    = signal(false);
  isLFModalOpen      = signal(false);
  isLFViewModalOpen  = signal(false);
  isMaintModalOpen   = signal(false);
  isMaintViewModalOpen = signal(false);
  isStatusModalOpen  = signal(false);
  isSopModalOpen     = signal(false);
  editingSopId       = signal<string | null>(null);
  modalMode          = signal<'create' | 'edit'>('create');

  // --- Form state ---
  currentTask     = signal<Partial<HKTask>>({});
  currentLF       = signal<Partial<LostFoundItem>>({});
  selectedLF      = signal<LostFoundItem | null>(null);
  currentMaint    = signal<Partial<MaintenanceRequest>>({});
  selectedMaint   = signal<MaintenanceRequest | null>(null);
  currentSop      = signal<Partial<SopCheckpoint>>({});
  selectedRoom    = signal<HKRoom | null>(null);
  newRoomStatus   = signal<HKStatus>('VACANT_CLEAN');

  // --- Computed filtered lists ---
  filteredRooms = computed(() => {
    const status = this.boardFilter();
    const q      = this.boardSearch().toLowerCase().trim();
    return this.hk.rooms().filter(r => {
      const matchStatus = status === 'ALL' || r.hkStatus === status;
      const matchQuery  = !q || r.roomNumber.toLowerCase().includes(q) || r.floor.toLowerCase().includes(q) || (r.guestName?.toLowerCase().includes(q) ?? false);
      return matchStatus && matchQuery;
    });
  });

  filteredTasks = computed(() => {
    const status = this.taskFilter();
    const q      = this.taskSearch().toLowerCase().trim();
    return this.hk.tasks().filter(t => {
      const matchStatus = status === 'ALL' || t.status === status;
      const matchQuery  = !q || t.roomNumber.toLowerCase().includes(q) || t.taskType.toLowerCase().includes(q) || this.getTaskStaffName(t).toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  });

  filteredLF = computed(() => {
    const q = this.lfSearch().toLowerCase().trim();
    return this.hk.lostFound().filter(i => !q || i.description.toLowerCase().includes(q) || i.roomNumber.includes(q) || (i.guestName?.toLowerCase().includes(q) ?? false) || i.category.toLowerCase().includes(q));
  });

  filteredMaint = computed(() => {
    const q = this.maintSearch().toLowerCase().trim();
    return this.hk.maintenance().filter(m => !q || m.roomNumber.includes(q) || m.issue.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  });

  roomAudits = signal<RoomAuditItem[]>([
    {
      id: 1,
      roomNumber: '101',
      floor: 'Floor 1',
      roomType: 'Single Room',
      pmsStatus: 'Vacant',
      hkStatus: 'VACANT_DIRTY',
      occupancy: 'Vacant',
      assignedToId: 1,
      inspector: 'Lalitha Nair',
      auditedAt: '2026-05-19T10:45:00Z',
      score: 68,
      result: 'FAIL',
      severity: 'HIGH',
      discrepancy: 'PMS vacant but HK still dirty after late checkout',
      checklist: { cleanliness: 12, linen: 10, amenities: 8, minibar: 8, maintenance: 15, safety: 15 },
      defects: ['Bathroom floor wet', 'Used towels pending pickup', 'Minibar not posted'],
      followUp: 'Reassign checkout clean and supervisor recheck before release.',
      releaseReady: false,
      statusLog: ['09:00 Vacant Dirty by Meena Pillai', '10:20 Cleaning started', '10:45 Audit failed by Lalitha Nair']
    },
    {
      id: 2,
      roomNumber: '102',
      floor: 'Floor 1',
      roomType: 'Double Room',
      pmsStatus: 'Occupied',
      hkStatus: 'OCCUPIED_DIRTY',
      occupancy: 'Occupied',
      guestName: 'Rajan Mehta',
      assignedToId: 1,
      inspector: 'Arjun Menon',
      auditedAt: '2026-05-19T11:10:00Z',
      score: 82,
      result: 'RECHECK',
      severity: 'MEDIUM',
      discrepancy: 'Stayover service pending guest-requested 11 AM slot',
      checklist: { cleanliness: 16, linen: 14, amenities: 12, minibar: 12, maintenance: 14, safety: 14 },
      defects: ['Extra towels requested', 'Coffee amenity low'],
      followUp: 'Complete stayover service and update occupied clean.',
      releaseReady: false,
      statusLog: ['08:00 Occupied Dirty', '10:30 Guest requested delayed service', '11:10 Recheck scheduled']
    },
    {
      id: 3,
      roomNumber: '103',
      floor: 'Floor 1',
      roomType: 'Luxury Suite',
      pmsStatus: 'Occupied',
      hkStatus: 'DO_NOT_DISTURB',
      occupancy: 'Occupied',
      guestName: 'Priya Sharma',
      inspector: 'Lalitha Nair',
      auditedAt: '2026-05-19T11:30:00Z',
      score: 90,
      result: 'EXCEPTION',
      severity: 'LOW',
      discrepancy: 'DND active, physical room audit deferred',
      checklist: { cleanliness: 18, linen: 15, amenities: 15, minibar: 14, maintenance: 14, safety: 14 },
      defects: ['DND card active since morning round'],
      followUp: 'Call guest after 14:00 for service permission.',
      releaseReady: false,
      statusLog: ['09:30 DND noted', '11:30 Audit exception logged']
    },
    {
      id: 4,
      roomNumber: '104',
      floor: 'Floor 1',
      roomType: 'Double Room',
      pmsStatus: 'Vacant',
      hkStatus: 'INSPECTED',
      occupancy: 'Vacant',
      assignedToId: 4,
      inspector: 'Arjun Menon',
      auditedAt: '2026-05-19T09:50:00Z',
      score: 98,
      result: 'PASS',
      severity: 'LOW',
      discrepancy: 'No discrepancy',
      checklist: { cleanliness: 20, linen: 16, amenities: 16, minibar: 16, maintenance: 15, safety: 15 },
      defects: [],
      followUp: 'Ready for front office allocation.',
      releaseReady: true,
      statusLog: ['09:30 Cleaned by Meena Pillai', '09:45 Inspection completed', '09:50 Released']
    },
    {
      id: 5,
      roomNumber: '204',
      floor: 'Floor 2',
      roomType: 'Double Room',
      pmsStatus: 'Blocked',
      hkStatus: 'UNDER_MAINTENANCE',
      occupancy: 'Vacant',
      inspector: 'Lalitha Nair',
      auditedAt: '2026-05-19T10:05:00Z',
      score: 55,
      result: 'FAIL',
      severity: 'HIGH',
      discrepancy: 'Maintenance block open for bathroom tap leak',
      checklist: { cleanliness: 14, linen: 12, amenities: 10, minibar: 10, maintenance: 4, safety: 5 },
      defects: ['Bathroom tap dripping', 'Floor slip risk', 'Room blocked in PMS'],
      followUp: 'Keep room blocked until plumbing closes request.',
      releaseReady: false,
      statusLog: ['09:15 Maintenance request opened', '10:05 Audit failed', '10:10 Engineering notified']
    },
    {
      id: 6,
      roomNumber: '301',
      floor: 'Floor 3',
      roomType: 'Luxury Suite',
      pmsStatus: 'Vacant',
      hkStatus: 'INSPECTED',
      occupancy: 'Vacant',
      assignedToId: 4,
      inspector: 'Arjun Menon',
      auditedAt: '2026-05-19T08:55:00Z',
      score: 96,
      result: 'PASS',
      severity: 'LOW',
      discrepancy: 'No discrepancy',
      checklist: { cleanliness: 19, linen: 16, amenities: 16, minibar: 15, maintenance: 15, safety: 15 },
      defects: ['Lost laptop bag already claimed and closed'],
      followUp: 'Ready for arrival allocation.',
      releaseReady: true,
      statusLog: ['08:45 Cleaned', '08:50 Inspected', '08:55 Audit passed']
    }
  ]);

  filteredAudits = computed(() => {
    const q = this.auditSearch().toLowerCase().trim();
    const floor = this.auditFloor();
    return this.hk.rooms().map(room => this.auditFromRoom(room)).filter(a => {
      const matchFloor = a.floor === floor;
      const matchQuery = !q || a.roomNumber.toLowerCase().includes(q) || a.floor.toLowerCase().includes(q) || a.discrepancy.toLowerCase().includes(q) || (a.guestName?.toLowerCase().includes(q) ?? false);
      return matchFloor && matchQuery;
    });
  });

  auditStats = computed(() => {
    const audits = this.filteredAudits();
    const checks = audits.flatMap(a => this.roomSopChecks(a));
    const total = audits.length;
    const avgScore = total ? Math.round(audits.reduce((sum, audit) => sum + audit.score, 0) / total) : 0;
    return {
      total,
      totalChecks: checks.length,
      done: checks.filter(c => c.status === 'DONE').length,
      pending: checks.filter(c => c.status === 'PENDING').length,
      issues: checks.filter(c => c.status === 'ISSUE').length,
      blocked: checks.filter(c => c.status === 'BLOCKED').length,
      ready: audits.filter(a => a.releaseReady).length,
      avgScore,
      defects: audits.reduce((sum, audit) => sum + audit.defects.length, 0)
    };
  });

  auditFloors = computed(() => Array.from(new Set(this.hk.rooms().map(a => a.floor))));

  sopFrequencyOptions = computed(() => this.hk.sopFrequencyOptions());

  sopAuditAreaOptions = computed(() => this.hk.sopAuditAreaOptions());

  sopResponsibleRoleOptions = computed(() => this.hk.sopResponsibleRoleOptions());

  activeSopCheckpoints = computed(() => this.hk.sopCheckpoints().filter(c => c.frequency === this.auditFrequency()));

  selectedFloorAudits = computed(() => this.filteredAudits());

  boardDashboard = computed(() => {
    const rooms = this.hk.rooms();
    const tasks = this.hk.tasks();
    const maintenance = this.hk.maintenance();
    const lostFound = this.hk.lostFound();
    const dirtyRooms = rooms.filter(room => room.hkStatus === 'VACANT_DIRTY' || room.hkStatus === 'OCCUPIED_DIRTY').length;
    const readyRooms = rooms.filter(room => room.hkStatus === 'VACANT_CLEAN' || room.hkStatus === 'INSPECTED' || room.hkStatus === 'OCCUPIED_CLEAN').length;
    const blockedRooms = rooms.filter(room => room.hkStatus === 'DO_NOT_DISTURB' || room.hkStatus === 'OUT_OF_ORDER' || room.hkStatus === 'UNDER_MAINTENANCE').length;
    const openTasks = tasks.filter(task => task.status !== 'COMPLETED' && task.status !== 'SKIPPED').length;
    const openMaintenance = maintenance.filter(item => item.status !== 'COMPLETED' && item.status !== 'RESOLVED' && item.status !== 'CANCELLED').length;
    const storedLostFound = lostFound.filter(item => item.status === 'STORED').length;
    const readiness = rooms.length ? Math.round((readyRooms / rooms.length) * 100) : 0;

    return {
      rooms: rooms.length,
      dirtyRooms,
      readyRooms,
      blockedRooms,
      openTasks,
      openMaintenance,
      storedLostFound,
      auditCheckpoints: this.activeSopCheckpoints().length,
      readiness,
    };
  });

  currentSopFrequencyId(): number | undefined {
    const current = this.currentSop();
    return current.frequencyId ?? this.sopFrequencyOptions().find(item => item.code === current.frequency || item.value.toUpperCase() === current.frequency)?.id;
  }

  currentSopResponsibleRoleId(): number | undefined {
    const current = this.currentSop();
    return current.responsibleRoleId ?? this.sopResponsibleRoleOptions().find(item => item.value === current.owner || item.code === current.owner)?.id;
  }

  currentSopAuditAreaId(): number | undefined {
    const current = this.currentSop();
    return current.auditAreaId ?? this.sopAuditAreaOptions().find(item => item.value === current.area || item.code === current.area)?.id;
  }

  changeAuditFrequency(frequency: AuditFrequency) {
    this.auditFrequency.set(frequency);
    this.hk.loadSopCheckpoints(frequency);
  }

  openCreateSopModal() {
    this.modalMode.set('create');
    this.editingSopId.set(null);
    const frequency = this.auditFrequency();
    const frequencyOption = this.sopFrequencyOptions().find(item => item.code === frequency || item.value.toUpperCase() === frequency);
    const auditAreaOption = this.sopAuditAreaOptions()[0];
    const roleOption = this.sopResponsibleRoleOptions()[0];
    this.currentSop.set({
      id: this.nextSopId(this.auditFrequency()),
      frequency,
      frequencyId: frequencyOption?.id,
      frequencyValue: frequencyOption?.value,
      area: auditAreaOption?.value ?? '',
      auditAreaId: auditAreaOption?.id,
      label: '',
      owner: roleOption?.value ?? '',
      responsibleRoleId: roleOption?.id
    });
    this.isSopModalOpen.set(true);
  }

  openEditSopModal(checkpoint: SopCheckpoint) {
    this.modalMode.set('edit');
    this.editingSopId.set(checkpoint.id);
    this.currentSop.set({ ...checkpoint });
    this.isSopModalOpen.set(true);
  }

  updateSopFrequency(frequencyId: number | string | undefined) {
    const parsedFrequencyId = Number(frequencyId);
    const frequency = this.sopFrequencyOptions().find(item => item.id === parsedFrequencyId);
    const code = (frequency?.code as AuditFrequency | undefined) ?? this.auditFrequency();
    this.currentSop.update(item => ({
      ...item,
      frequency: code,
      frequencyId: frequency?.id,
      frequencyValue: frequency?.value,
    }));
  }

  updateSopAuditArea(auditAreaId: number | string | undefined) {
    const parsedAuditAreaId = Number(auditAreaId);
    const auditArea = this.sopAuditAreaOptions().find(item => item.id === parsedAuditAreaId);
    this.currentSop.update(item => ({
      ...item,
      area: auditArea?.value ?? '',
      auditAreaId: auditArea?.id,
    }));
  }

  updateSopResponsibleRole(roleId: number | string | undefined) {
    const parsedRoleId = Number(roleId);
    const role = this.sopResponsibleRoleOptions().find(item => item.id === parsedRoleId);
    this.currentSop.update(item => ({
      ...item,
      owner: role?.value ?? '',
      responsibleRoleId: role?.id,
    }));
  }

  saveSopCheckpoint() {
    const checkpoint = this.currentSop();
    const id = (checkpoint.id || '').trim().toUpperCase();
    const frequency = checkpoint.frequency || this.auditFrequency();
    const area = (checkpoint.area || '').trim();
    const label = (checkpoint.label || '').trim();
    const owner = (checkpoint.owner || '').trim();

    if (!id || !area || !label || !owner) {
      alert('Please fill all SOP checkpoint fields.');
      return;
    }

    this.hk.saveSopCheckpoint({
      ...checkpoint,
      id,
      frequency,
      area,
      label,
      owner,
    });
    this.auditFrequency.set(frequency);
    this.isAuditSopExpanded.set(true);
    this.isSopModalOpen.set(false);
    this.editingSopId.set(null);
  }

  deleteSopCheckpoint(checkpoint: SopCheckpoint, event: Event) {
    event.stopPropagation();
    alert(`Delete API is not available for SOP checkpoint ${checkpoint.id}.`);
  }

  private nextSopId(frequency: AuditFrequency): string {
    const prefix = frequency === 'DAILY' ? 'D' : frequency === 'WEEKLY' ? 'W' : 'M';
    const existing = this.hk.sopCheckpoints()
      .filter(item => item.frequency === frequency && item.id.startsWith(prefix))
      .map(item => Number(item.id.replace(prefix, '')))
      .filter(value => Number.isFinite(value));
    const next = (existing.length ? Math.max(...existing) : 0) + 1;
    return `${prefix}${String(next).padStart(2, '0')}`;
  }

  // --- Rooms grouped by floor ---
  roomsByFloor = computed(() => {
    const map = new Map<string, HKRoom[]>();
    this.filteredRooms().forEach(r => {
      if (!map.has(r.floor)) map.set(r.floor, []);
      map.get(r.floor)!.push(r);
    });
    return Array.from(map.entries()).map(([floor, rooms]) => ({ floor, rooms }));
  });

  taskFloors = computed(() => Array.from(new Set(this.hk.rooms().map(room => room.floor))));

  taskRoomsForSelectedFloor = computed(() => {
    const floor = this.currentTask().floor;
    return this.hk.rooms().filter(room => !floor || room.floor === floor);
  });

  lfRoomsForSelectedFloor = computed(() => {
    const roomNumber = this.currentLF().roomNumber;
    const room = this.hk.rooms().find(item => item.roomNumber === roomNumber);
    const floor = (this.currentLF() as Partial<LostFoundItem> & { floor?: string }).floor ?? room?.floor;
    return this.hk.rooms().filter(item => !floor || item.floor === floor);
  });

  lfSelectedFloor = computed(() => {
    const roomNumber = this.currentLF().roomNumber;
    const room = this.hk.rooms().find(item => item.roomNumber === roomNumber);
    return (this.currentLF() as Partial<LostFoundItem> & { floor?: string }).floor ?? room?.floor ?? '';
  });

  assignedHousekeepers = computed(() => {
    const activeUsers = this.userService.users().filter(user => user.status === 'ACTIVE');
    const housekeepingUsers = activeUsers.filter(user => user.department.toLowerCase().includes('housekeeping'));
    return housekeepingUsers.length ? housekeepingUsers : activeUsers;
  });

  activeUsers = computed(() => this.userService.users().filter(user => user.status === 'ACTIVE'));

  maintSelectedFloor = computed(() => {
    const roomNumber = this.currentMaint().roomNumber;
    const room = this.hk.rooms().find(item => item.roomNumber === roomNumber);
    return (this.currentMaint() as Partial<MaintenanceRequest> & { floor?: string }).floor ?? room?.floor ?? '';
  });

  maintRoomsForSelectedFloor = computed(() => {
    const floor = this.maintSelectedFloor();
    return this.hk.rooms().filter(room => !floor || room.floor === floor);
  });

  maintenanceCategoryOptions = computed(() => {
    return this.hk.maintenanceCategories();
  });

  maintenancePriorityOptions = computed(() => {
    return this.hk.maintenancePriorities();
  });

  maintenanceStatusOptions = computed(() => {
    return this.hk.maintenanceStatuses();
  });

  currentMaintCategoryId(): number | undefined {
    const current = this.currentMaint();
    return current.categoryId ?? this.maintenanceCategoryOptions().find(item => item.value === current.category)?.id;
  }

  currentMaintPriorityId(): number | undefined {
    const current = this.currentMaint();
    return current.priorityId ?? this.maintenancePriorityOptions().find(item => item.code === current.priority || item.value === current.priority)?.id;
  }

  currentMaintStatusId(): number | undefined {
    const current = this.currentMaint();
    return this.maintenanceStatusId(current.status);
  }

  maintenanceStatusId(status?: string): number | undefined {
    return this.maintenanceStatusOptions().find(item => item.code === status || item.value === status)?.id;
  }

  // --- Helpers ---
  getStaffName(id?: number): string {
    if (!id) return 'Unassigned';
    return this.userService.users().find(user => user.id === id)?.fullName || this.hk.staffMap().get(id)?.name || 'Unknown';
  }

  getTaskStaffName(task: HKTask): string {
    return task.assignedToName || this.getStaffName(task.assignedToId);
  }

  getStaffAvatar(id?: number): string {
    if (!id) return '—';
    const user = this.userService.users().find(item => item.id === id);
    if (user) return this.userInitials(user);
    return this.hk.staffMap().get(id)?.avatar ?? '?';
  }

  getTaskStaffAvatar(task: HKTask): string {
    if (task.assignedToId && (this.userService.users().some(user => user.id === task.assignedToId) || this.hk.staffMap().has(task.assignedToId))) {
      return this.getStaffAvatar(task.assignedToId);
    }
    const name = task.assignedToName?.trim();
    return name ? name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() : '?';
  }

  userInitials(user: SystemUser): string {
    return user.fullName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
  }

  hkStatusLabel(status: HKStatus): string {
    const map: Record<HKStatus, string> = {
      VACANT_CLEAN:      'Vacant Clean',
      VACANT_DIRTY:      'Vacant Dirty',
      OCCUPIED_CLEAN:    'Occupied Clean',
      OCCUPIED_DIRTY:    'Occupied Dirty',
      INSPECTED:         'Inspected',
      OUT_OF_ORDER:      'Out of Order',
      DO_NOT_DISTURB:    'Do Not Disturb',
      UNDER_MAINTENANCE: 'Under Maintenance',
    };
    return map[status];
  }

  hkStatusIcon(status: HKStatus): string {
    const map: Record<HKStatus, string> = {
      VACANT_CLEAN:      'check_circle',
      VACANT_DIRTY:      'do_not_disturb_on',
      OCCUPIED_CLEAN:    'hotel',
      OCCUPIED_DIRTY:    'bedtime',
      INSPECTED:         'verified',
      OUT_OF_ORDER:      'cancel',
      DO_NOT_DISTURB:    'do_not_disturb',
      UNDER_MAINTENANCE: 'build',
    };
    return map[status];
  }

  private auditFromRoom(room: HKRoom): RoomAuditItem {
    const isBlocked = room.hkStatus === 'DO_NOT_DISTURB' || room.hkStatus === 'OUT_OF_ORDER' || room.hkStatus === 'UNDER_MAINTENANCE';
    const hasIssue = room.hkStatus === 'VACANT_DIRTY' || room.hkStatus === 'OCCUPIED_DIRTY' || room.hkStatus === 'UNDER_MAINTENANCE' || room.hkStatus === 'OUT_OF_ORDER';
    const isReady = room.hkStatus === 'INSPECTED' || room.hkStatus === 'VACANT_CLEAN' || room.hkStatus === 'OCCUPIED_CLEAN';
    const result: AuditResult = isBlocked ? 'EXCEPTION' : hasIssue ? 'RECHECK' : 'PASS';
    const score = isBlocked ? 0 : isReady ? 100 : 75;
    const discrepancy = isBlocked
      ? this.hkStatusLabel(room.hkStatus)
      : hasIssue
        ? `${this.hkStatusLabel(room.hkStatus)} pending audit clearance`
        : 'No discrepancy';

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.type,
      pmsStatus: room.isOccupied ? 'Occupied' : 'Vacant',
      hkStatus: room.hkStatus,
      occupancy: room.isOccupied ? 'Occupied' : 'Vacant',
      guestName: room.guestName,
      assignedToId: room.assignedToId,
      inspector: room.assignedToId ? this.getStaffName(room.assignedToId) : 'Unassigned',
      auditedAt: room.lastCleaned ?? new Date().toISOString(),
      score,
      result,
      severity: hasIssue ? 'MEDIUM' : 'LOW',
      discrepancy,
      checklist: { cleanliness: score, linen: 0, amenities: 0, minibar: 0, maintenance: 0, safety: 0 },
      defects: hasIssue || isBlocked ? [discrepancy] : [],
      followUp: hasIssue || isBlocked ? 'Review room status and complete required audit action.' : 'Room is ready.',
      releaseReady: isReady,
      statusLog: [discrepancy],
    };
  }

  roomOpenTaskCount(room: HKRoom): number {
    return this.hk.tasks().filter(task =>
      (task.roomId === room.id || task.roomNumber === room.roomNumber) &&
      task.status !== 'COMPLETED' &&
      task.status !== 'SKIPPED'
    ).length;
  }

  roomOpenMaintenanceCount(room: HKRoom): number {
    return this.hk.maintenance().filter(item =>
      (item.roomId === room.id || item.roomNumber === room.roomNumber) &&
      item.status !== 'COMPLETED' &&
      item.status !== 'RESOLVED' &&
      item.status !== 'CANCELLED'
    ).length;
  }

  roomStoredLostFoundCount(room: HKRoom): number {
    return this.hk.lostFound().filter(item =>
      (item.roomId === room.id || item.roomNumber === room.roomNumber) &&
      item.status === 'STORED'
    ).length;
  }

  roomBoardClass(room: HKRoom): string {
    if (room.hkStatus === 'DO_NOT_DISTURB' || room.hkStatus === 'OUT_OF_ORDER' || room.hkStatus === 'UNDER_MAINTENANCE') return 'blocked';
    if (room.hkStatus === 'VACANT_DIRTY' || room.hkStatus === 'OCCUPIED_DIRTY') return 'needs-work';
    if (room.hkStatus === 'INSPECTED' || room.hkStatus === 'VACANT_CLEAN' || room.hkStatus === 'OCCUPIED_CLEAN') return 'ready';
    return '';
  }

  auditResultLabel(result: AuditResult): string {
    const map: Record<AuditResult, string> = {
      PASS: 'Passed',
      RECHECK: 'Recheck',
      FAIL: 'Failed',
      EXCEPTION: 'Exception',
    };
    return map[result];
  }

  auditResultIcon(result: AuditResult): string {
    const map: Record<AuditResult, string> = {
      PASS: 'verified',
      RECHECK: 'rate_review',
      FAIL: 'report',
      EXCEPTION: 'do_not_disturb',
    };
    return map[result];
  }

  auditScoreClass(score: number): string {
    return score >= 90 ? 'excellent' : score >= 80 ? 'good' : score >= 70 ? 'watch' : 'poor';
  }

  roomSopChecks(audit: RoomAuditItem): RoomSopCheck[] {
    return this.activeSopCheckpoints().map(check => {
      let status: SopStatus = 'DONE';
      let evidence = 'Verified during current room audit.';
      let finding: string | undefined;

      if (audit.result === 'FAIL') {
        status = check.area === 'Maintenance' || check.area === 'PMS Match' || check.area === 'Bathroom' ? 'ISSUE' : 'PENDING';
        finding = audit.defects[0] ?? audit.discrepancy;
        evidence = 'Finding recorded; follow-up required before release.';
      } else if (audit.result === 'RECHECK') {
        status = check.area === 'Amenities' || check.area === 'Bedroom' || check.area === 'PMS Match' ? 'PENDING' : 'DONE';
        finding = check.area === 'Amenities' ? 'Guest request or amenity replenishment pending.' : undefined;
        evidence = status === 'DONE' ? 'Checked and acceptable.' : 'Pending supervisor recheck.';
      } else if (audit.result === 'EXCEPTION') {
        status = 'BLOCKED';
        finding = audit.discrepancy;
        evidence = 'Audit blocked by guest privacy or room exception.';
      }

      if (audit.releaseReady && audit.result === 'PASS') {
        evidence = 'Completed and release ready.';
      }

      return { ...check, status, evidence, finding };
    });
  }

  sopStatusLabel(status: SopStatus): string {
    const map: Record<SopStatus, string> = {
      DONE: 'Done',
      PENDING: 'Pending',
      ISSUE: 'Issue',
      BLOCKED: 'Blocked'
    };
    return map[status];
  }

  sopStatusIcon(status: SopStatus): string {
    const map: Record<SopStatus, string> = {
      DONE: 'check_circle',
      PENDING: 'schedule',
      ISSUE: 'report',
      BLOCKED: 'block'
    };
    return map[status];
  }

  checklistTotal(audit: RoomAuditItem): number {
    const c = audit.checklist;
    return c.cleanliness + c.linen + c.amenities + c.minibar + c.maintenance + c.safety;
  }

  taskTypeLabel(t: TaskType): string {
    const map: Record<TaskType, string> = {
      CHECKOUT_CLEAN: 'Checkout Clean',
      STAYOVER_CLEAN: 'Stayover Clean',
      DEEP_CLEAN:     'Deep Clean',
      INSPECTION:     'Inspection',
      TURNDOWN:       'Turndown Service',
    };
    return map[t];
  }

  priorityIcon(p: Priority): string {
    return p === 'HIGH' ? 'keyboard_double_arrow_up' : p === 'MEDIUM' ? 'drag_handle' : 'keyboard_double_arrow_down';
  }

  // --- Board Status Update Modal ---
  openStatusModal(room: HKRoom) {
    this.selectedRoom.set(room);
    this.newRoomStatus.set(room.hkStatus);
    this.isStatusModalOpen.set(true);
  }

  saveRoomStatus() {
    const room = this.selectedRoom();
    if (!room) return;
    this.hk.updateRoomStatus(room.id, this.newRoomStatus());
    this.isStatusModalOpen.set(false);
  }

  quickStatusChange(room: HKRoom, status: HKStatus, event: Event) {
    event.stopPropagation();
    this.hk.updateRoomStatus(room.id, status);
  }

  // --- Task Modal ---
  openCreateTaskModal() {
    this.modalMode.set('create');
    const firstHousekeeper = this.assignedHousekeepers()[0];
    const firstRoom = this.hk.rooms()[0];
    this.currentTask.set({
      roomId: firstRoom?.id,
      roomNumber: firstRoom?.roomNumber ?? '',
      floor: firstRoom?.floor ?? '',
      taskType: 'STAYOVER_CLEAN',
      priority: 'MEDIUM',
      assignedToId: firstHousekeeper?.id,
      assignedToName: firstHousekeeper?.fullName,
      estimatedMins: 30,
      notes: '',
    });
    this.isTaskModalOpen.set(true);
  }

  updateTaskFloor(floor: string) {
    const firstRoom = this.hk.rooms().find(room => room.floor === floor);
    this.currentTask.update(task => ({
      ...task,
      floor,
      roomId: firstRoom?.id,
      roomNumber: firstRoom?.roomNumber ?? '',
    }));
  }

  updateTaskRoom(roomId: number | string) {
    const parsedRoomId = Number(roomId);
    const room = this.hk.rooms().find(item => item.id === parsedRoomId);
    this.currentTask.update(task => ({
      ...task,
      roomId: room?.id,
      roomNumber: room?.roomNumber ?? '',
      floor: room?.floor ?? task.floor ?? '',
    }));
  }

  updateTaskAssignee(userId: number | string | undefined) {
    const parsedUserId = Number(userId);
    const user = this.userService.users().find(item => item.id === parsedUserId);
    this.currentTask.update(task => ({
      ...task,
      assignedToId: user?.id,
      assignedToName: user?.fullName,
    }));
  }

  openEditTaskModal(task: HKTask) {
    this.modalMode.set('edit');
    this.currentTask.set({ ...task });
    this.isTaskModalOpen.set(true);
  }

  saveTask() {
    const task = this.currentTask();
    if (!task.floor || !task.roomId || !task.roomNumber || !task.taskType) { alert('Please fill all required fields.'); return; }
    // Find roomId from roomNumber
    const room = this.hk.rooms().find(r => r.id === task.roomId || r.roomNumber === task.roomNumber);
    const filled = { ...task, roomId: room?.id ?? 0, floor: room?.floor ?? task.floor ?? '' };
    this.hk.saveTask(filled);
    this.isTaskModalOpen.set(false);
  }

  updateTaskStatus(task: HKTask, status: TaskStatus, event: Event) {
    event.stopPropagation();
    this.hk.updateTaskStatus(task.id, status);
  }

  deleteTask(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('Delete this task?')) this.hk.deleteTask(id);
  }

  // --- Lost & Found Modal ---
  openCreateLFModal() {
    this.modalMode.set('create');
    const firstRoom = this.hk.rooms()[0];
    const firstHousekeeper = this.assignedHousekeepers()[0];
    const firstCategory = this.hk.lostFoundCategories()[0];
    this.currentLF.set({
      roomId: firstRoom?.id,
      roomNumber: firstRoom?.roomNumber ?? '',
      description: '',
      categoryId: firstCategory?.id,
      category: firstCategory?.value ?? '',
      foundById: firstHousekeeper?.id,
      foundBy: firstHousekeeper?.fullName ?? '',
      foundDate: new Date().toISOString().split('T')[0],
      status: 'STORED',
      storageLocation: '',
      notes: '',
    });
    this.isLFModalOpen.set(true);
  }

  openEditLFModal(item: LostFoundItem) {
    this.modalMode.set('edit');
    this.currentLF.set({ ...item });
    this.isLFModalOpen.set(true);
  }

  openViewLFModal(item: LostFoundItem) {
    this.selectedLF.set(item);
    this.isLFViewModalOpen.set(true);
  }

  closeViewLFModal() {
    this.isLFViewModalOpen.set(false);
    this.selectedLF.set(null);
  }

  updateLFFloor(floor: string) {
    const firstRoom = this.hk.rooms().find(room => room.floor === floor);
    this.currentLF.update(item => ({
      ...item,
      roomId: firstRoom?.id,
      roomNumber: firstRoom?.roomNumber ?? '',
      floor,
    } as Partial<LostFoundItem> & { floor?: string }));
  }

  updateLFRoom(roomId: number | string) {
    const parsedRoomId = Number(roomId);
    const room = this.hk.rooms().find(item => item.id === parsedRoomId);
    this.currentLF.update(item => ({
      ...item,
      roomId: room?.id,
      roomNumber: room?.roomNumber ?? '',
      floor: room?.floor ?? (item as Partial<LostFoundItem> & { floor?: string }).floor ?? '',
    } as Partial<LostFoundItem> & { floor?: string }));
  }

  updateLFFoundBy(userId: number | string | undefined) {
    const parsedUserId = Number(userId);
    const user = this.userService.users().find(item => item.id === parsedUserId);
    this.currentLF.update(item => ({
      ...item,
      foundById: user?.id,
      foundBy: user?.fullName ?? '',
    }));
  }

  updateLFCategory(categoryId: number | string | undefined) {
    const parsedCategoryId = Number(categoryId);
    const category = this.hk.lostFoundCategories().find(item => item.id === parsedCategoryId);
    this.currentLF.update(item => ({
      ...item,
      categoryId: category?.id,
      category: category?.value ?? '',
    }));
  }

  saveLF() {
    const item = this.currentLF();
    if (!item.roomId || !item.roomNumber || !item.description || !item.categoryId || !item.category || !item.foundBy || !item.storageLocation) { alert('Please fill all required fields.'); return; }
    const room = this.hk.rooms().find(r => r.id === item.roomId || r.roomNumber === item.roomNumber);
    this.hk.saveLostFound({ ...item, roomId: room?.id ?? item.roomId, roomNumber: room?.roomNumber ?? item.roomNumber });
    this.isLFModalOpen.set(false);
  }

  updateLFStatus(id: number, status: LFStatus, event: Event) {
    event.stopPropagation();
    this.hk.updateLFStatus(id, status);
  }

  deleteLF(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('Remove this Lost & Found record?')) this.hk.deleteLostFound(id);
  }

  // --- Maintenance Modal ---
  openCreateMaintModal() {
    this.modalMode.set('create');
    const firstRoom = this.hk.rooms()[0];
    const firstCategory = this.maintenanceCategoryOptions()[0];
    const firstPriority = this.maintenancePriorityOptions()[0];
    const firstStatus = this.maintenanceStatusOptions()[0];
    const firstUser = this.activeUsers()[0];
    this.currentMaint.set({
      roomId: firstRoom?.id,
      roomNumber: firstRoom?.roomNumber ?? '',
      floor: firstRoom?.floor ?? '',
      issue: '',
      categoryId: firstCategory?.id,
      category: firstCategory?.value ?? '',
      priorityId: firstPriority?.id,
      priority: (firstPriority?.code as MaintPriority) ?? (firstPriority?.value as MaintPriority) ?? undefined,
      reportedById: firstUser?.id,
      reportedBy: firstUser?.fullName ?? '',
      assignedToId: undefined,
      assignedTo: '',
      status: (firstStatus?.code as MaintStatus) ?? (firstStatus?.value as MaintStatus) ?? undefined,
      notes: ''
    });
    this.isMaintModalOpen.set(true);
  }

  openEditMaintModal(req: MaintenanceRequest) {
    this.modalMode.set('edit');
    this.currentMaint.set({ ...req });
    this.isMaintModalOpen.set(true);
  }

  openViewMaintModal(req: MaintenanceRequest) {
    this.selectedMaint.set(req);
    this.isMaintViewModalOpen.set(true);
  }

  closeViewMaintModal() {
    this.selectedMaint.set(null);
    this.isMaintViewModalOpen.set(false);
  }

  updateMaintFloor(floor: string) {
    const firstRoom = this.hk.rooms().find(room => room.floor === floor);
    this.currentMaint.update(item => ({ ...item, floor, roomId: firstRoom?.id, roomNumber: firstRoom?.roomNumber ?? '' }));
  }

  updateMaintRoom(roomId: number | string) {
    const parsedRoomId = Number(roomId);
    const room = this.hk.rooms().find(item => item.id === parsedRoomId);
    this.currentMaint.update(item => ({ ...item, roomId: room?.id, roomNumber: room?.roomNumber ?? '', floor: room?.floor ?? item.floor ?? '' }));
  }

  updateMaintCategory(categoryId: number | string | undefined) {
    const parsedCategoryId = Number(categoryId);
    const category = this.maintenanceCategoryOptions().find(item => item.id === parsedCategoryId);
    this.currentMaint.update(item => ({ ...item, categoryId: category?.id, category: category?.value ?? '' }));
  }

  updateMaintPriority(priorityId: number | string | undefined) {
    const parsedPriorityId = Number(priorityId);
    const priority = this.maintenancePriorityOptions().find(item => item.id === parsedPriorityId);
    this.currentMaint.update(item => ({ ...item, priorityId: priority?.id, priority: (priority?.code as MaintPriority) ?? (priority?.value as MaintPriority) ?? undefined }));
  }

  updateMaintStatusOption(statusId: number | string | undefined) {
    const parsedStatusId = Number(statusId);
    const status = this.maintenanceStatusOptions().find(item => item.id === parsedStatusId);
    this.currentMaint.update(item => ({ ...item, status: (status?.code as MaintStatus) ?? (status?.value as MaintStatus) ?? undefined }));
  }

  updateMaintUser(field: 'reported' | 'assigned', userId: number | string | undefined) {
    const parsedUserId = Number(userId);
    const user = this.userService.users().find(item => item.id === parsedUserId);
    this.currentMaint.update(item => field === 'reported'
      ? { ...item, reportedById: user?.id, reportedBy: user?.fullName ?? '' }
      : { ...item, assignedToId: user?.id, assignedTo: user?.fullName ?? '' }
    );
  }

  saveMaint() {
    const req = this.currentMaint();
    if (!req.roomId || !req.roomNumber || !req.issue || !req.categoryId || !req.category || !req.priorityId || !req.priority || !req.status || !req.reportedBy) { alert('Please fill all required fields.'); return; }
    const room = this.hk.rooms().find(r => r.id === req.roomId || r.roomNumber === req.roomNumber);
    this.hk.saveMaintenance({ ...req, roomId: room?.id ?? req.roomId, roomNumber: room?.roomNumber ?? req.roomNumber, floor: room?.floor ?? req.floor ?? '' });
    this.isMaintModalOpen.set(false);
  }

  updateMaintStatus(id: number, status: MaintStatus, event: Event) {
    event.stopPropagation();
    this.hk.updateMaintStatus(id, status);
  }

  updateMaintStatusInline(req: MaintenanceRequest, statusId: number | string | undefined) {
    const parsedStatusId = Number(statusId);
    const status = this.maintenanceStatusOptions().find(item => item.id === parsedStatusId);
    const nextStatus = (status?.code ?? status?.value) as MaintStatus | undefined;
    if (!nextStatus || nextStatus === req.status) return;
    this.hk.updateMaintStatus(req.id, nextStatus);
  }

  deleteMaint(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('Delete this maintenance request?')) this.hk.deleteMaintenance(id);
  }

  // --- Misc ---
  allStatuses: HKStatus[] = ['VACANT_CLEAN','VACANT_DIRTY','OCCUPIED_CLEAN','OCCUPIED_DIRTY','INSPECTED','OUT_OF_ORDER','DO_NOT_DISTURB','UNDER_MAINTENANCE'];

  taskTypes: TaskType[] = ['CHECKOUT_CLEAN','STAYOVER_CLEAN','DEEP_CLEAN','INSPECTION','TURNDOWN'];
}
