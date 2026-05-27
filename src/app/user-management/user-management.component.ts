import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  PermissionAction,
  PermissionMatrix,
  SystemUser,
  UserManagementService,
  UserRole,
  UserStatus
} from './user-management.service';

type UserManagementTab = 'users' | 'roles' | 'activity';
type ModalMode = 'create' | 'edit';

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
  searchQuery = signal('');
  departmentFilter = signal('All Departments');
  statusFilter = signal('All Statuses');
  roleFilter = signal('All Roles');
  activitySeverityFilter = signal('All Events');

  isUserModalOpen = signal(false);
  isRoleModalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  currentUser = signal<Partial<SystemUser>>({});
  currentRole = signal<Partial<UserRole>>({});

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
    this.currentUser.set({
      employeeId: '',
      fullName: '',
      username: '',
      email: '',
      phone: '',
      department: 'Front Office',
      roleId: this.userService.roles()[0]?.id,
      property: this.userService.properties[0],
      shift: this.userService.shifts[0],
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
    this.currentUser.set({ ...user, accessibleFloors: [...user.accessibleFloors] });
    this.isUserModalOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  saveUser(): void {
    this.userService.saveUser(this.currentUser());
    this.closeUserModal();
  }

  closeUserModal(): void {
    this.isUserModalOpen.set(false);
    document.body.style.overflow = '';
  }

  openCreateRole(): void {
    this.modalMode.set('create');
    this.currentRole.set({
      name: '',
      description: '',
      department: 'Front Office',
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
  }

  saveRole(): void {
    this.userService.saveRole(this.currentRole());
    this.closeRoleModal();
  }

  closeRoleModal(): void {
    this.isRoleModalOpen.set(false);
    document.body.style.overflow = '';
  }

  deleteUser(user: SystemUser): void {
    if (confirm(`Delete user "${user.fullName}"?`)) {
      this.userService.deleteUser(user.id);
    }
  }

  deleteRole(role: UserRole): void {
    if (role.isSystem) {
      alert('System roles cannot be deleted.');
      return;
    }
    if (this.userService.roleUserCount(role.id) > 0) {
      alert('This role is assigned to users. Reassign those users before deleting the role.');
      return;
    }
    if (confirm(`Delete role "${role.name}"?`)) {
      this.userService.deleteRole(role.id);
    }
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
  }

  hasFloorAccess(floor: string): boolean {
    return !!this.currentUser().accessibleFloors?.includes(floor);
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
    return this.userService.permissionModules.reduce((count, module) => {
      return count + this.userService.permissionActions.filter(action => matrix[module.key]?.[action]).length;
    }, 0);
  }

  actionCount(role: UserRole, action: PermissionAction): number {
    return this.userService.permissionModules.filter(module => role.permissions[module.key]?.[action]).length;
  }

  assignedPermissionModules(role: UserRole) {
    return this.userService.permissionModules
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

  severityIcon(severity: string): string {
    if (severity === 'CRITICAL') return 'gpp_bad';
    if (severity === 'WARNING') return 'report_problem';
    return 'info';
  }

  private updateTabFromUrl(url: string): void {
    if (url.includes('/user-management/roles')) {
      this.activeTab.set('roles');
    } else if (url.includes('/user-management/activity')) {
      this.activeTab.set('activity');
    } else {
      this.activeTab.set('users');
    }
    this.searchQuery.set('');
  }
}
