import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  HousekeepingService,
  HKRoom, HKTask, HKStaff, LostFoundItem, MaintenanceRequest,
  HKStatus, TaskType, TaskStatus, Priority, LFStatus, MaintStatus, MaintPriority
} from './housekeeping.service';

type TabType = 'board' | 'tasks' | 'audit' | 'staff' | 'lost-found' | 'maintenance';
type AuditResult = 'PASS' | 'RECHECK' | 'FAIL' | 'EXCEPTION';
type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
type AuditFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
type SopStatus = 'DONE' | 'PENDING' | 'ISSUE' | 'BLOCKED';

interface SopCheckpoint {
  id: string;
  frequency: AuditFrequency;
  area: string;
  label: string;
  owner: string;
}

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
  isMaintModalOpen   = signal(false);
  isStatusModalOpen  = signal(false);
  modalMode          = signal<'create' | 'edit'>('create');

  // --- Form state ---
  currentTask     = signal<Partial<HKTask>>({});
  currentLF       = signal<Partial<LostFoundItem>>({});
  currentMaint    = signal<Partial<MaintenanceRequest>>({});
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
      const matchQuery  = !q || t.roomNumber.toLowerCase().includes(q) || t.taskType.toLowerCase().includes(q) || this.getStaffName(t.assignedToId).toLowerCase().includes(q);
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

  sopCheckpoints = signal<SopCheckpoint[]>([
    { id: 'D01', frequency: 'DAILY', area: 'Entry', label: 'Door, lock, latch, DND tag and peephole checked', owner: 'Room Attendant' },
    { id: 'D02', frequency: 'DAILY', area: 'Bedroom', label: 'Bed linen, pillows, dusting, floor and odor checked', owner: 'Room Attendant' },
    { id: 'D03', frequency: 'DAILY', area: 'Bathroom', label: 'WC, shower, mirror, drain, hair and towel setup checked', owner: 'Room Attendant' },
    { id: 'D04', frequency: 'DAILY', area: 'Amenities', label: 'Tea tray, toiletries, stationery and guest supplies replenished', owner: 'Room Attendant' },
    { id: 'D05', frequency: 'DAILY', area: 'PMS Match', label: 'PMS occupancy and housekeeping room status reconciled', owner: 'Supervisor' },
    { id: 'W01', frequency: 'WEEKLY', area: 'Deep Clean', label: 'Mattress rotation, under-bed cleaning and high dusting completed', owner: 'Supervisor' },
    { id: 'W02', frequency: 'WEEKLY', area: 'Linen', label: 'Linen par level, stains, tears and terry stock verified', owner: 'Linen Incharge' },
    { id: 'W03', frequency: 'WEEKLY', area: 'Maintenance', label: 'AC filter, lights, plumbing, TV remote and safe inspected', owner: 'Engineering' },
    { id: 'W04', frequency: 'WEEKLY', area: 'Minibar', label: 'Minibar stock, expiry, consumption and billing posting checked', owner: 'Room Attendant' },
    { id: 'M01', frequency: 'MONTHLY', area: 'Safety', label: 'Smoke detector, emergency map, balcony/window lock and fire safety checked', owner: 'Safety Officer' },
    { id: 'M02', frequency: 'MONTHLY', area: 'Asset Quality', label: 'Furniture, upholstery, curtains, carpet and paint condition audited', owner: 'Executive Housekeeper' },
    { id: 'M03', frequency: 'MONTHLY', area: 'Standards', label: 'Brand standard photo audit and corrective action review completed', owner: 'Executive Housekeeper' }
  ]);

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
    return this.roomAudits().filter(a => {
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

  auditFloors = computed(() => Array.from(new Set(this.roomAudits().map(a => a.floor))));

  activeSopCheckpoints = computed(() => this.sopCheckpoints().filter(c => c.frequency === this.auditFrequency()));

  selectedFloorAudits = computed(() => this.filteredAudits());

  // --- Rooms grouped by floor ---
  roomsByFloor = computed(() => {
    const map = new Map<string, HKRoom[]>();
    this.filteredRooms().forEach(r => {
      if (!map.has(r.floor)) map.set(r.floor, []);
      map.get(r.floor)!.push(r);
    });
    return Array.from(map.entries()).map(([floor, rooms]) => ({ floor, rooms }));
  });

  // --- Helpers ---
  getStaffName(id?: number): string {
    if (!id) return 'Unassigned';
    return this.hk.staffMap().get(id)?.name ?? 'Unknown';
  }

  getStaffAvatar(id?: number): string {
    if (!id) return '—';
    return this.hk.staffMap().get(id)?.avatar ?? '?';
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
    const onDutyStaff = this.hk.staff().find(s => s.status === 'ON_DUTY');
    this.currentTask.set({
      roomNumber: '',
      floor: '',
      taskType: 'STAYOVER_CLEAN',
      priority: 'MEDIUM',
      assignedToId: onDutyStaff?.id,
      estimatedMins: 30,
      notes: '',
    });
    this.isTaskModalOpen.set(true);
  }

  openEditTaskModal(task: HKTask) {
    this.modalMode.set('edit');
    this.currentTask.set({ ...task });
    this.isTaskModalOpen.set(true);
  }

  saveTask() {
    const task = this.currentTask();
    if (!task.roomNumber || !task.taskType) { alert('Please fill all required fields.'); return; }
    // Find roomId from roomNumber
    const room = this.hk.rooms().find(r => r.roomNumber === task.roomNumber);
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
    this.currentLF.set({ roomNumber: '', description: '', category: 'Personal Items', foundBy: '', foundDate: new Date().toISOString().split('T')[0], storageLocation: '', notes: '' });
    this.isLFModalOpen.set(true);
  }

  openEditLFModal(item: LostFoundItem) {
    this.modalMode.set('edit');
    this.currentLF.set({ ...item });
    this.isLFModalOpen.set(true);
  }

  saveLF() {
    const item = this.currentLF();
    if (!item.roomNumber || !item.description) { alert('Please fill all required fields.'); return; }
    this.hk.saveLostFound(item);
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
    this.currentMaint.set({ roomNumber: '', floor: '', issue: '', category: 'General', priority: 'NORMAL', reportedBy: '', notes: '' });
    this.isMaintModalOpen.set(true);
  }

  openEditMaintModal(req: MaintenanceRequest) {
    this.modalMode.set('edit');
    this.currentMaint.set({ ...req });
    this.isMaintModalOpen.set(true);
  }

  saveMaint() {
    const req = this.currentMaint();
    if (!req.roomNumber || !req.issue) { alert('Please fill all required fields.'); return; }
    const room = this.hk.rooms().find(r => r.roomNumber === req.roomNumber);
    this.hk.saveMaintenance({ ...req, floor: room?.floor ?? req.floor ?? '' });
    this.isMaintModalOpen.set(false);
  }

  updateMaintStatus(id: number, status: MaintStatus, event: Event) {
    event.stopPropagation();
    this.hk.updateMaintStatus(id, status);
  }

  deleteMaint(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('Delete this maintenance request?')) this.hk.deleteMaintenance(id);
  }

  // --- Misc ---
  allStatuses: HKStatus[] = ['VACANT_CLEAN','VACANT_DIRTY','OCCUPIED_CLEAN','OCCUPIED_DIRTY','INSPECTED','OUT_OF_ORDER','DO_NOT_DISTURB','UNDER_MAINTENANCE'];

  taskTypes: TaskType[] = ['CHECKOUT_CLEAN','STAYOVER_CLEAN','DEEP_CLEAN','INSPECTION','TURNDOWN'];
  lfCategories = ['Jewellery','Electronics','Clothing','Documents','Wallet/Cards','Personal Items','Other'];
  maintCategories = ['HVAC','Plumbing','Electrical','Furniture','Electronics','General'];
  maintPriorities: MaintPriority[] = ['URGENT','HIGH','NORMAL','LOW'];
}
