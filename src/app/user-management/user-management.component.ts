import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  PermissionAction,
  PermissionMatrix,
  PermissionModule,
  SystemUser,
  UserManagementService,
  UserRole,
  UserShift,
  UserStatus
} from './user-management.service';

type UserManagementTab = 'users' | 'roles' | 'shifts' | 'activity';
type ShiftTab = 'master' | 'assignment';
type ModalMode = 'create' | 'edit';
type UserValidationKey =
  'employeeId' |
  'fullName' |
  'username' |
  'email' |
  'phone' |
  'department' |
  'roleId' |
  'property' |
  'shift' |
  'status' |
  'accessibleFloors';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  readonly userService = inject(UserManagementService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  activeTab = signal<UserManagementTab>('users');
  activeShiftTab = signal<ShiftTab>('master');
  searchQuery = signal('');
  assignmentSearchQuery = signal('');
  departmentFilter = signal('All Departments');
  statusFilter = signal('All Statuses');
  roleFilter = signal('All Roles');
  activitySeverityFilter = signal('All Events');

  isUserModalOpen = signal(false);
  isRoleModalOpen = signal(false);
  isShiftModalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  currentUser = signal<Partial<SystemUser>>({});
  currentRole = signal<Partial<UserRole>>({});
  currentShift = signal<Partial<UserShift>>({});
  roleDeleteTarget = signal<UserRole | null>(null);
  shiftDeleteTarget = signal<UserShift | null>(null);
  userFormSubmitted = signal(false);
  userValidationErrors = signal<Partial<Record<UserValidationKey, string>>>({});
  userTouchedFields = signal<Partial<Record<UserValidationKey, boolean>>>({});

  readonly userStats = computed(() => {
    const users = this.userService.users();
    return {
      total: users.length,
      active: users.filter(user => user.status === 'ACTIVE').length,
      locked: users.filter(user => user.status === 'LOCKED').length,
      twoFactor: users.filter(user => user.twoFactorEnabled).length,
      roles: this.userService.roles().length,
      admins: this.userService.roles().filter(role => role.level === 'Admin').length
    };
  });

  readonly shiftStats = computed(() => {
    const shifts = this.userService.shiftConfigs();
    const assigned = this.userService.users().filter(user => !!user.shift).length;
    return {
      total: shifts.length,
      active: shifts.filter(shift => shift.isActive).length,
      assigned,
      unassigned: this.userService.users().filter(user => !user.shift).length
    };
  });

  readonly filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const department = this.departmentFilter();
    const status = this.statusFilter();
    const role = this.roleFilter();
    return this.userService.users().filter(user => {
      const roleName = this.roleName(user.roleId).toLowerCase();
      const matchesQuery = !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.employeeId.toLowerCase().includes(query) ||
        roleName.includes(query);
      const matchesDepartment = department === 'All Departments' || user.department === department;
      const matchesStatus = status === 'All Statuses' || user.status === status;
      const matchesRole = role === 'All Roles' || Number(user.roleId) === Number(role);
      return matchesQuery && matchesDepartment && matchesStatus && matchesRole;
    });
  });

  readonly filteredRoles = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const department = this.departmentFilter();
    return this.userService.roles().filter(role => {
      const matchesQuery = !query ||
        role.name.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query) ||
        role.department.toLowerCase().includes(query) ||
        role.level.toLowerCase().includes(query);
      const matchesDepartment = department === 'All Departments' || role.department === department;
      return matchesQuery && matchesDepartment;
    });
  });

  readonly filteredActivity = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const severity = this.activitySeverityFilter();
    return this.userService.activity().filter(item => {
      const matchesQuery = !query ||
        item.actor.toLowerCase().includes(query) ||
        item.event.toLowerCase().includes(query) ||
        item.target.toLowerCase().includes(query) ||
        item.module.toLowerCase().includes(query);
      const matchesSeverity = severity === 'All Events' || item.severity === severity;
      return matchesQuery && matchesSeverity;
    });
  });

  readonly filteredShifts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const department = this.departmentFilter();
    return this.userService.shiftConfigs().filter(shift => {
      const matchesQuery = !query ||
        shift.name.toLowerCase().includes(query) ||
        shift.code.toLowerCase().includes(query) ||
        shift.department.toLowerCase().includes(query) ||
        shift.property.toLowerCase().includes(query);
      const matchesDepartment = department === 'All Departments' || shift.department === department;
      return matchesQuery && matchesDepartment;
    });
  });

  readonly filteredShiftAssignmentUsers = computed(() => {
    const query = this.assignmentSearchQuery().toLowerCase().trim();
    return this.filteredUsers().filter(user => {
      const roleName = this.roleName(user.roleId).toLowerCase();
      return !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.employeeId.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query) ||
        user.shift.toLowerCase().includes(query) ||
        roleName.includes(query);
    });
  });

  ngOnInit(): void {
    this.updateTabFromUrl(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  switchTab(tab: UserManagementTab): void {
    this.router.navigate([`/user-management/${tab}`]);
  }

  openCreateUser(): void {
    this.modalMode.set('create');
    this.userFormSubmitted.set(false);
    this.userValidationErrors.set({});
    this.userTouchedFields.set({});
    this.currentUser.set({
      employeeId: '',
      fullName: '',
      username: '',
      email: '',
      phone: '',
      department: this.userService.departments()[0]?.name || 'Front Office',
      roleId: this.userService.roles()[0]?.id,
      property: this.userService.properties()[0]?.name,
      shift: this.userService.shifts()[0],
      status: 'ACTIVE',
      twoFactorEnabled: false,
      accessibleFloors: ['All Floors'],
      notes: ''
    });
    this.isUserModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEditUser(user: SystemUser): void {
    this.modalMode.set('edit');
    this.userFormSubmitted.set(false);
    this.userValidationErrors.set({});
    this.userTouchedFields.set({});
    this.currentUser.set({ ...user, accessibleFloors: [...user.accessibleFloors] });
    this.isUserModalOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.userService.getUserById(user.id, latest => {
      this.currentUser.set({ ...latest, accessibleFloors: [...latest.accessibleFloors] });
    });
  }

  saveUser(): void {
    this.userFormSubmitted.set(true);
    if (!this.validateUserForm()) return;
    this.userService.saveUser(this.normalizedUserForSave());
    this.closeUserModal();
  }

  closeUserModal(): void {
    this.isUserModalOpen.set(false);
    this.userFormSubmitted.set(false);
    this.userValidationErrors.set({});
    this.userTouchedFields.set({});
    document.body.style.overflow = '';
  }

  openCreateRole(): void {
    this.modalMode.set('create');
    this.currentRole.set({
      name: '',
      description: '',
      department: this.userService.departments()[0]?.name || 'Front Office',
      level: 'Department',
      isActive: true,
      isSystem: false,
      permissions: this.userService.emptyPermissions()
    });
    this.isRoleModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEditRole(role: UserRole): void {
    this.modalMode.set('edit');
    this.currentRole.set({
      ...role,
      permissions: this.userService.clonePermissions(role.permissions)
    });
    this.isRoleModalOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.userService.getRoleById(role.id, latest => {
      this.currentRole.set({
        ...latest,
        permissions: this.userService.clonePermissions(latest.permissions)
      });
    });
  }

  saveRole(): void {
    this.userService.saveRole(this.currentRole());
    this.closeRoleModal();
  }

  closeRoleModal(): void {
    this.isRoleModalOpen.set(false);
    document.body.style.overflow = '';
  }

  openCreateShift(): void {
    this.modalMode.set('create');
    this.currentShift.set({
      name: '',
      code: '',
      startTime: '09:00',
      endTime: '18:00',
      department: this.userService.departments()[0]?.name || 'Front Office',
      property: this.userService.properties()[0]?.name,
      isActive: true,
      notes: ''
    });
    this.isShiftModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  openEditShift(shift: UserShift): void {
    this.modalMode.set('edit');
    this.currentShift.set({ ...shift });
    this.isShiftModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  saveShift(): void {
    this.userService.saveShift(this.currentShift());
    this.closeShiftModal();
  }

  closeShiftModal(): void {
    this.isShiftModalOpen.set(false);
    document.body.style.overflow = '';
  }

  deleteShift(shift: UserShift): void {
    this.shiftDeleteTarget.set(shift);
    document.body.style.overflow = 'hidden';
  }

  closeShiftDeleteModal(): void {
    this.shiftDeleteTarget.set(null);
    document.body.style.overflow = '';
  }

  confirmDeleteShift(): void {
    const shift = this.shiftDeleteTarget();
    if (!shift) return;
    this.userService.deleteShift(shift.id);
    this.closeShiftDeleteModal();
  }

  assignUserShift(user: SystemUser, shift: string): void {
    this.userService.setUserShift(user, shift);
  }

  assignedUsersForShift(shiftName: string): SystemUser[] {
    return this.userService.users().filter(user => user.shift === shiftName);
  }

  deleteUser(user: SystemUser): void {
    if (confirm(`Delete user "${user.fullName}"?`)) {
      this.userService.deleteUser(user.id);
    }
  }

  deleteRole(role: UserRole): void {
    if (this.isRoleDeleteFrozen(role)) return;
    this.roleDeleteTarget.set(role);
    document.body.style.overflow = 'hidden';
  }

  isRoleDeleteFrozen(role: UserRole): boolean {
    return role.isSystem || this.userService.roleUserCount(role.id) > 0;
  }

  roleDeleteTitle(role: UserRole): string {
    if (role.isSystem) return 'System roles cannot be deleted';
    const assignedUsers = this.userService.roleUserCount(role.id);
    if (assignedUsers > 0) return `Reassign ${assignedUsers} user${assignedUsers === 1 ? '' : 's'} before deleting this role`;
    return 'Delete role';
  }

  closeRoleDeleteModal(): void {
    this.roleDeleteTarget.set(null);
    document.body.style.overflow = '';
  }

  confirmDeleteRole(): void {
    const role = this.roleDeleteTarget();
    if (!role || this.roleDeleteBlockReason(role)) return;
    this.userService.deleteRole(role.id);
    this.closeRoleDeleteModal();
  }

  roleDeleteBlockReason(role: UserRole): string {
    if (role.isSystem) return 'System roles are protected and cannot be deleted.';
    const assignedUsers = this.userService.roleUserCount(role.id);
    if (assignedUsers > 0) {
      return `This role is assigned to ${assignedUsers} user${assignedUsers === 1 ? '' : 's'}. Reassign those users before deleting the role.`;
    }
    return '';
  }

  cloneRole(role: UserRole): void {
    this.userService.cloneRole(role);
  }

  setUserStatus(user: SystemUser, status: UserStatus): void {
    this.userService.setUserStatus(user.id, status);
  }

  resetPassword(user: SystemUser): void {
    this.userService.resetPassword(user.id);
    alert(`Temporary password generated for ${user.fullName}.`);
  }

  updateFloorAccess(floor: string, checked: boolean): void {
    const user = this.currentUser();
    const current = user.accessibleFloors || [];
    let next = checked ? [...current, floor] : current.filter(item => item !== floor);
    if (floor === 'All Floors' && checked) next = ['All Floors'];
    if (floor !== 'All Floors' && checked) next = next.filter(item => item !== 'All Floors');
    this.currentUser.update(value => ({ ...value, accessibleFloors: next.length ? next : ['All Floors'] }));
    this.revalidateSubmittedUserForm();
  }

  hasFloorAccess(floor: string): boolean {
    return !!this.currentUser().accessibleFloors?.includes(floor);
  }

  updateCurrentUser<K extends keyof SystemUser>(field: K, value: SystemUser[K] | undefined): void {
    this.currentUser.update(user => ({ ...user, [field]: value }));
    this.revalidateActiveUserForm();
  }

  markUserFieldTouched(field: UserValidationKey): void {
    this.userTouchedFields.update(touched => ({ ...touched, [field]: true }));
    this.validateUserForm();
  }

  userFieldError(field: UserValidationKey): string {
    if (!this.userFormSubmitted() && !this.userTouchedFields()[field]) return '';
    return this.userValidationErrors()[field] || '';
  }

  hasPermission(matrix: PermissionMatrix | undefined, moduleKey: string, action: PermissionAction): boolean {
    return !!matrix?.[moduleKey]?.[action];
  }

  setCurrentRolePermission(moduleKey: string, action: PermissionAction, checked: boolean): void {
    const role = this.currentRole();
    const permissions = this.userService.clonePermissions(role.permissions || this.userService.emptyPermissions());
    permissions[moduleKey][action] = checked;
    this.currentRole.update(value => ({ ...value, permissions }));
  }

  setModulePermissions(moduleKey: string, checked: boolean): void {
    const role = this.currentRole();
    const permissions = this.userService.clonePermissions(role.permissions || this.userService.emptyPermissions());
    this.userService.permissionActions.forEach(action => {
      permissions[moduleKey][action] = checked;
    });
    this.currentRole.update(value => ({ ...value, permissions }));
  }

  isModuleFullyAllowed(moduleKey: string): boolean {
    const permissions = this.currentRole().permissions;
    return this.userService.permissionActions.every(action => !!permissions?.[moduleKey]?.[action]);
  }

  permissionCount(role: UserRole | Partial<UserRole>): number {
    const matrix = role.permissions;
    if (!matrix) return 0;
    return this.userService.permissionModules().reduce((count, module) => {
      return count + this.userService.permissionActions.filter(action => matrix[module.key]?.[action]).length;
    }, 0);
  }

  actionCount(role: UserRole, action: PermissionAction): number {
    return this.userService.permissionModules().filter(module => role.permissions[module.key]?.[action]).length;
  }

  assignedPermissionModules(role: UserRole): Array<PermissionModule & { actions: PermissionAction[] }> {
    return this.userService.permissionModules()
      .map(module => ({
        ...module,
        actions: this.userService.permissionActions.filter(action => role.permissions[module.key]?.[action])
      }))
      .filter(module => module.actions.length > 0);
  }

  actionLabel(action: PermissionAction): string {
    const labels: Record<PermissionAction, string> = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      approve: 'Approve',
      export: 'Export'
    };
    return labels[action];
  }

  roleName(roleId?: number): string {
    return this.userService.rolesMap().get(Number(roleId))?.name || 'Unassigned';
  }

  roleDepartment(roleId?: number): string {
    return this.userService.rolesMap().get(Number(roleId))?.department || 'No Department';
  }

  statusIcon(status: UserStatus): string {
    if (status === 'ACTIVE') return 'check_circle';
    if (status === 'LOCKED') return 'lock';
    return 'pause_circle';
  }

  shiftTimelineType(shift: UserShift): 'day' | 'afternoon' | 'night' {
    const text = `${shift.name} ${shift.code}`.toLowerCase();
    const startHour = Number(String(shift.startTime || '00:00').split(':')[0]);
    if (text.includes('night') || text.includes('nite') || startHour >= 20 || startHour < 5) return 'night';
    if (text.includes('after') || text.includes('evening') || startHour >= 12) return 'afternoon';
    return 'day';
  }

  shiftTimelineIcon(shift: UserShift): string {
    const type = this.shiftTimelineType(shift);
    if (type === 'night') return 'dark_mode';
    if (type === 'afternoon') return 'wb_twilight';
    return 'wb_sunny';
  }

  shiftTimelineLabel(shift: UserShift): string {
    const type = this.shiftTimelineType(shift);
    if (type === 'night') return 'Night';
    if (type === 'afternoon') return 'Afternoon';
    return 'Day';
  }

  severityIcon(severity: string): string {
    if (severity === 'CRITICAL') return 'gpp_bad';
    if (severity === 'WARNING') return 'report_problem';
    return 'info';
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/user-management/roles')) {
      this.activeTab.set('roles');
    } else if (url.includes('/user-management/shifts')) {
      this.activeTab.set('shifts');
    } else if (url.includes('/user-management/activity')) {
      this.activeTab.set('activity');
    } else {
      this.activeTab.set('users');
    }
    this.searchQuery.set('');
  }

  private validateUserForm(): boolean {
    const user = this.currentUser();
    const errors: Partial<Record<UserValidationKey, string>> = {};
    const employeeId = this.textValue(user.employeeId);
    const fullName = this.textValue(user.fullName);
    const username = this.textValue(user.username);
    const email = this.textValue(user.email);
    const phone = this.textValue(user.phone);

    if (!employeeId) {
      errors.employeeId = 'Employee ID is required.';
    } else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/.test(employeeId)) {
      errors.employeeId = 'Use 3-20 letters, numbers, hyphen or underscore.';
    }

    if (!fullName) {
      errors.fullName = 'Full name is required.';
    } else if (!/^[A-Za-z][A-Za-z .'-]{1,58}[A-Za-z.]$/.test(fullName)) {
      errors.fullName = 'Enter a valid name using letters and spaces.';
    }

    if (!username) {
      errors.username = 'Username is required.';
    } else if (!/^[a-zA-Z][a-zA-Z0-9._-]{2,29}$/.test(username)) {
      errors.username = 'Use 3-30 characters, starting with a letter.';
    }

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (phone && !/^\+?[0-9][0-9\s-]{8,18}$/.test(phone)) {
      errors.phone = 'Enter a valid mobile number.';
    }

    if (!user.department) errors.department = 'Department is required.';
    if (!Number(user.roleId)) errors.roleId = 'Role is required.';
    if (!user.property) errors.property = 'Property is required.';
    if (!user.shift) errors.shift = 'Shift is required.';
    if (!user.status) errors.status = 'Status is required.';
    if (!user.accessibleFloors?.length) errors.accessibleFloors = 'Select at least one floor access option.';

    this.userValidationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private revalidateSubmittedUserForm(): void {
    if (this.userFormSubmitted()) this.validateUserForm();
  }

  private revalidateActiveUserForm(): void {
    if (this.userFormSubmitted() || Object.keys(this.userTouchedFields()).length > 0) this.validateUserForm();
  }

  private normalizedUserForSave(): Partial<SystemUser> {
    const user = this.currentUser();
    return {
      ...user,
      employeeId: this.textValue(user.employeeId),
      fullName: this.textValue(user.fullName).replace(/\s+/g, ' '),
      username: this.textValue(user.username),
      email: this.textValue(user.email).toLowerCase(),
      phone: this.textValue(user.phone),
      accessibleFloors: user.accessibleFloors?.length ? user.accessibleFloors : ['All Floors']
    };
  }

  private textValue(value?: string): string {
    return String(value || '').trim();
  }
}
