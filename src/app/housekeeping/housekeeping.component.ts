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

type TabType = 'board' | 'tasks' | 'staff' | 'lost-found' | 'maintenance';

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

  private updateTabFromUrl(url: string) {
    const segments = url.split('/');
    const lastSegment = segments[segments.length - 1]?.split('?')[0]; // strip query params
    if (['board', 'tasks', 'staff', 'lost-found', 'maintenance'].includes(lastSegment)) {
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
