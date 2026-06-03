import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type UserDepartment = string;
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
export type RoleLevel = 'Property' | 'Department' | 'Supervisor' | 'Admin';

export interface PermissionModule {
  id?: number;
  key: string;
  label: string;
  group: string;
  icon: string;
}

export type PermissionMatrix = Record<string, Record<PermissionAction, boolean>>;

export interface UserRole {
  id: number;
  name: string;
  description: string;
  department: UserDepartment;
  level: RoleLevel;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionMatrix;
  userCount?: number;
  permissionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemUser {
  id: number;
  employeeId: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  department: UserDepartment;
  roleId: number;
  property: string;
  shift: string;
  status: UserStatus;
  twoFactorEnabled: boolean;
  accessibleFloors: string[];
  lastLogin: string;
  loginFailures: number;
  notes: string;
}

export interface AccessActivity {
  id: number;
  at: string;
  actor: string;
  event: string;
  target: string;
  module: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ipAddress: string;
}

export interface PropertyOption {
  id: number;
  name: string;
}

export interface DepartmentOption {
  id: number;
  name: string;
  code?: string;
}

export interface FloorOption {
  id: number;
  name: string;
  hotelId?: number;
}

interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  metadata?: {
    totalRecords?: number;
    currentPage?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

interface ApiCommonMaster {
  id?: number;
  category?: string;
  code?: string;
  value?: string;
}

interface ApiModule {
  id: number;
  name: string;
  category: string;
}

interface ApiHotel {
  id: number;
  name: string;
}

interface ApiFloor {
  id: number;
  hotelId?: number;
  floorNumber: string;
  isActive?: boolean;
}

interface ApiPermission {
  id?: number;
  moduleId: number;
  moduleName?: string;
  category?: string;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  canExport?: boolean;
}

interface ApiRole {
  id: number;
  name: string;
  department?: ApiCommonMaster;
  departmentId?: number;
  accessLevel?: string;
  status?: string;
  description?: string;
  permissions?: ApiPermission[];
  userCount?: number;
  permissionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiUser {
  id: number;
  employeeId?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  department?: ApiCommonMaster | string;
  departmentId?: number;
  role?: ApiRole;
  roleId?: number;
  property?: ApiCommonMaster | string;
  propertyId?: number;
  shift?: string;
  status?: string;
  floorAccess?: string[];
  accessibleFloors?: string[];
  twoFactorEnabled?: boolean;
  lastLogin?: string;
  loginFailures?: number;
  notes?: string;
}

interface ApiAuditLog {
  id: number;
  at?: string;
  createdAt?: string;
  timestamp?: string;
  actor?: string;
  userName?: string;
  event?: string;
  action?: string;
  target?: string;
  module?: string;
  severity?: string;
  ipAddress?: string;
}

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly http = inject(HttpClient);
  private readonly userBaseUrl = '/api/hmsUserService/v1';
  private readonly masterBaseUrl = '/api/masterService/v1';
  private readonly hmsBaseUrl = '/api/hmsService/v1';

  readonly permissionActions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
  readonly permissionModules = signal<PermissionModule[]>([
    { id: 1, key: 'dashboard', label: 'Dashboard', group: 'Operations', icon: 'dashboard' },
    { id: 2, key: 'reservations', label: 'Reservations', group: 'Front Office', icon: 'calendar_month' },
    { id: 3, key: 'arrivals_departures', label: 'Arrivals & Departures', group: 'Front Office', icon: 'login' },
    { id: 4, key: 'guest_profiles', label: 'Guest Profiles', group: 'Front Office', icon: 'person_search' },
    { id: 5, key: 'housekeeping_board', label: 'Housekeeping Board', group: 'Housekeeping', icon: 'cleaning_services' },
    { id: 6, key: 'room_audit_sop', label: 'Room Audit SOP', group: 'Housekeeping', icon: 'fact_check' },
    { id: 7, key: 'lost_found', label: 'Lost & Found', group: 'Housekeeping', icon: 'search_off' },
    { id: 8, key: 'reports', label: 'Reports', group: 'Management', icon: 'bar_chart' },
    { id: 9, key: 'user_management', label: 'User Management', group: 'Management', icon: 'manage_accounts' }
  ]);

  readonly departments = signal<DepartmentOption[]>([
    { id: 1, name: 'Front Office' },
    { id: 2, name: 'Housekeeping' },
    { id: 3, name: 'Hotel Setup' },
    { id: 4, name: 'Accounts' },
    { id: 5, name: 'Management' },
    { id: 6, name: 'Maintenance' },
    { id: 7, name: 'Security' }
  ]);
  readonly statuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];
  readonly roleLevels: RoleLevel[] = ['Property', 'Department', 'Supervisor', 'Admin'];
  readonly properties = signal<PropertyOption[]>([
    { id: 1, name: 'HMS Cloud - Main Hotel' },
    { id: 2, name: 'HMS Cloud - Annex' },
    { id: 3, name: 'HMS Cloud - Banquet Wing' }
  ]);
  readonly shifts = ['Morning Shift', 'Evening Shift', 'Night Shift', 'General Shift'];
  readonly floors = signal<FloorOption[]>([
    { id: 1, name: 'Floor 1' },
    { id: 2, name: 'Floor 2' },
    { id: 3, name: 'Floor 3' }
  ]);

  readonly isLoading = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly users = signal<SystemUser[]>([]);
  readonly roles = signal<UserRole[]>([]);
  readonly activity = signal<AccessActivity[]>([]);

  readonly rolesMap = computed(() => new Map(this.roles().map(role => [role.id, role])));

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.apiError.set(null);

    forkJoin({
      hotels: this.http.get<StandardResponse<ApiHotel[]>>(`${this.masterBaseUrl}/hotels/getAllHotels`).pipe(catchError(() => of(null))),
      floors: this.http.get<StandardResponse<ApiFloor[]>>(`${this.masterBaseUrl}/floors/getAllFloors`).pipe(catchError(() => of(null))),
      departments: this.http.get<ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]>>(`${this.hmsBaseUrl}/housekeeping/audit/getCommonMaster/DEPARTMENT`).pipe(catchError(() => of(null))),
      modules: this.http.get<StandardResponse<ApiModule[]>>(`${this.userBaseUrl}/roles/getAllModules`).pipe(catchError(() => of(null))),
      roles: this.http.get<StandardResponse<ApiRole[]>>(`${this.userBaseUrl}/roles/getAllRoles`).pipe(catchError(() => of(null))),
      users: this.http.get<StandardResponse<ApiUser[]>>(`${this.userBaseUrl}/users/getAllUsers`).pipe(catchError(() => of(null))),
      audit: this.http.get<StandardResponse<ApiAuditLog[]>>(`${this.userBaseUrl}/audit-logs/getAllAuditLogs`).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ hotels, floors, departments, modules, roles, users, audit }) => {
        if (hotels?.success && hotels.data?.length) this.setProperties(hotels.data);
        if (floors?.success && floors.data?.length) this.setFloors(floors.data);
        this.setDepartments(this.commonMastersData(departments));
        if (modules?.success && modules.data?.length) this.setModules(modules.data);
        if (roles?.success) this.roles.set((roles.data || []).map(role => this.mapRole(role)));
        if (users?.success) this.users.set((users.data || []).map(user => this.mapUser(user)));
        if (audit?.success) this.activity.set((audit.data || []).map(log => this.mapAudit(log)));
        this.isLoading.set(false);
      },
      error: err => {
        this.apiError.set(err?.message || 'Unable to load user management data.');
        this.isLoading.set(false);
      }
    });
  }

  saveUser(input: Partial<SystemUser>): void {
    const payload = this.toUserRequest(input);
    const request$ = input.id
      ? this.http.put<StandardResponse<ApiUser | object>>(`${this.userBaseUrl}/users/updateUser/${input.id}`, payload)
      : this.http.post<StandardResponse<ApiUser | object>>(`${this.userBaseUrl}/users/createUser`, payload);

    request$.pipe(
      tap(() => this.loadUsers()),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to save user.');
        return of(null);
      })
    ).subscribe();
  }

  deleteUser(id: number): void {
    this.http.delete<StandardResponse<void>>(`${this.userBaseUrl}/users/deleteUser/${id}`).pipe(
      tap(() => this.users.update(users => users.filter(user => user.id !== id))),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to delete user.');
        return of(null);
      })
    ).subscribe();
  }

  setUserStatus(id: number, status: UserStatus): void {
    const params = new HttpParams().set('status', status);
    this.http.patch<StandardResponse<object>>(`${this.userBaseUrl}/users/changeStatus/${id}`, null, { params }).pipe(
      tap(() => this.users.update(users => users.map(user => user.id === id ? { ...user, status, loginFailures: status === 'LOCKED' ? user.loginFailures : 0 } : user))),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to change user status.');
        return of(null);
      })
    ).subscribe();
  }

  getUserById(id: number, onLoaded?: (user: SystemUser) => void): void {
    this.http.get<StandardResponse<ApiUser>>(`${this.userBaseUrl}/users/getUserById/${id}`).pipe(
      map(response => response.data ? this.mapUser(response.data) : null),
      tap(user => {
        if (!user) return;
        this.users.update(users => users.map(existing => existing.id === user.id ? user : existing));
        onLoaded?.(user);
      }),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to load user.');
        return of(null);
      })
    ).subscribe();
  }

  resetPassword(id: number): void {
    const user = this.users().find(item => item.id === id);
    if (user) this.addActivity('System', 'Password reset requested; API endpoint not available', user.fullName, 'Users', 'WARNING');
  }

  saveRole(input: Partial<UserRole>): void {
    const payload = this.toRoleRequest(input);
    const request$ = input.id
      ? this.http.put<StandardResponse<ApiRole>>(`${this.userBaseUrl}/roles/updateRole/${input.id}`, payload)
      : this.http.post<StandardResponse<ApiRole>>(`${this.userBaseUrl}/roles/createRole`, payload);

    request$.pipe(
      tap(response => {
        if (response?.success && response.data) {
          const saved = this.mapRole(response.data);
          this.roles.update(roles => input.id ? roles.map(role => role.id === saved.id ? saved : role) : [saved, ...roles]);
        } else {
          this.loadRoles();
        }
      }),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to save role.');
        return of(null);
      })
    ).subscribe();
  }

  deleteRole(id: number): void {
    this.http.delete<StandardResponse<void>>(`${this.userBaseUrl}/roles/deleteRole/${id}`).pipe(
      tap(() => this.roles.update(roles => roles.filter(role => role.id !== id))),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to delete role.');
        return of(null);
      })
    ).subscribe();
  }

  getRoleById(id: number, onLoaded?: (role: UserRole) => void): void {
    this.http.get<StandardResponse<ApiRole>>(`${this.userBaseUrl}/roles/getRoleById/${id}`).pipe(
      map(response => response.data ? this.mapRole(response.data) : null),
      tap(role => {
        if (!role) return;
        this.roles.update(roles => roles.map(existing => existing.id === role.id ? role : existing));
        onLoaded?.(role);
      }),
      catchError(err => {
        this.apiError.set(err?.error?.message || err?.message || 'Unable to load role.');
        return of(null);
      })
    ).subscribe();
  }

  cloneRole(role: UserRole): void {
    this.saveRole({
      ...role,
      id: undefined,
      name: `${role.name} Copy`,
      isSystem: false,
      createdAt: undefined,
      updatedAt: undefined
    });
  }

  roleUserCount(roleId: number): number {
    const role = this.roles().find(item => item.id === Number(roleId));
    return this.users().filter(user => Number(user.roleId) === Number(roleId)).length || Number(role?.userCount || 0);
  }

  emptyPermissions(): PermissionMatrix {
    return this.permissionModules().reduce((matrix, module) => {
      matrix[module.key] = this.permissionActions.reduce((actions, action) => {
        actions[action] = false;
        return actions;
      }, {} as Record<PermissionAction, boolean>);
      return matrix;
    }, {} as PermissionMatrix);
  }

  permissionsFor(moduleKeys: string[], actions: PermissionAction[]): PermissionMatrix {
    const matrix = this.emptyPermissions();
    moduleKeys.forEach(key => {
      actions.forEach(action => {
        if (matrix[key]) matrix[key][action] = true;
      });
    });
    return matrix;
  }

  clonePermissions(matrix: PermissionMatrix): PermissionMatrix {
    return this.permissionModules().reduce((copy, module) => {
      copy[module.key] = this.permissionActions.reduce((actions, action) => {
        actions[action] = !!matrix[module.key]?.[action];
        return actions;
      }, {} as Record<PermissionAction, boolean>);
      return copy;
    }, {} as PermissionMatrix);
  }

  private loadUsers(): void {
    this.http.get<StandardResponse<ApiUser[]>>(`${this.userBaseUrl}/users/getAllUsers`).pipe(
      map(response => response.data || []),
      catchError(() => of([]))
    ).subscribe(users => this.users.set(users.map(user => this.mapUser(user))));
  }

  private loadRoles(): void {
    this.http.get<StandardResponse<ApiRole[]>>(`${this.userBaseUrl}/roles/getAllRoles`).pipe(
      map(response => response.data || []),
      catchError(() => of([]))
    ).subscribe(roles => this.roles.set(roles.map(role => this.mapRole(role))));
  }

  private setModules(modules: ApiModule[]): void {
    this.permissionModules.set(modules.map(module => ({
      id: module.id,
      key: this.moduleKey(module.name),
      label: module.name,
      group: module.category,
      icon: this.iconForModule(module.name)
    })));
  }

  private setProperties(hotels: ApiHotel[]): void {
    this.properties.set(hotels.map(hotel => ({
      id: Number(hotel.id),
      name: hotel.name
    })).filter(property => property.id && property.name));
  }

  private setFloors(floors: ApiFloor[]): void {
    const options = floors
      .filter(floor => floor.isActive !== false)
      .map(floor => ({
        id: Number(floor.id),
        name: floor.floorNumber,
        hotelId: floor.hotelId ? Number(floor.hotelId) : undefined
      }))
      .filter(floor => floor.id && floor.name);
    if (options.length) this.floors.set(options);
  }

  private setDepartments(departments: ApiCommonMaster[]): void {
    const options = departments.map(department => ({
      id: Number(department.id),
      name: department.value || department.code || '',
      code: department.code
    })).filter(department => department.id && department.name);
    if (options.length) this.departments.set(options);
  }

  private mapUser(user: ApiUser): SystemUser {
    return {
      id: Number(user.id),
      employeeId: user.employeeId || `EMP-${user.id}`,
      fullName: user.fullName || user.username || 'Unnamed User',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      department: this.departmentFromApi(user.department, user.departmentId),
      roleId: Number(user.roleId || user.role?.id || this.roles()[0]?.id || 0),
      property: this.propertyFromApi(user.property, user.propertyId),
      shift: user.shift || this.shifts[0],
      status: this.statusFromApi(user.status),
      twoFactorEnabled: !!user.twoFactorEnabled,
      accessibleFloors: user.floorAccess?.length ? user.floorAccess : user.accessibleFloors?.length ? user.accessibleFloors : ['All Floors'],
      lastLogin: user.lastLogin || 'Never',
      loginFailures: Number(user.loginFailures || 0),
      notes: user.notes || ''
    };
  }

  private mapRole(role: ApiRole): UserRole {
    return {
      id: Number(role.id),
      name: role.name || `Role #${role.id}`,
      description: role.description || '',
      department: this.departmentFromApi(role.department, role.departmentId),
      level: this.levelFromApi(role.accessLevel),
      isSystem: false,
      isActive: String(role.status || 'ACTIVE').toUpperCase() === 'ACTIVE',
      permissions: this.permissionsFromApi(role.permissions || []),
      userCount: Number(role.userCount || 0),
      permissionCount: Number(role.permissionCount || 0),
      createdAt: role.createdAt || '',
      updatedAt: role.updatedAt || ''
    };
  }

  private mapAudit(log: ApiAuditLog): AccessActivity {
    return {
      id: Number(log.id),
      at: log.at || log.createdAt || log.timestamp || '',
      actor: log.actor || log.userName || 'System',
      event: log.event || log.action || 'Activity recorded',
      target: log.target || '-',
      module: log.module || 'User Management',
      severity: this.severityFromApi(log.severity),
      ipAddress: log.ipAddress || '-'
    };
  }

  private permissionsFromApi(permissions: ApiPermission[]): PermissionMatrix {
    const matrix = this.emptyPermissions();
    permissions.forEach(permission => {
      const module = this.permissionModules().find(item => item.id === Number(permission.moduleId))
        || this.permissionModules().find(item => item.key === this.moduleKey(permission.moduleName || ''));
      if (!module) return;
      matrix[module.key] = {
        view: !!permission.canView,
        create: !!permission.canCreate,
        edit: !!permission.canEdit,
        delete: !!permission.canDelete,
        approve: !!permission.canApprove,
        export: !!permission.canExport
      };
    });
    return matrix;
  }

  private toUserRequest(input: Partial<SystemUser>): object {
    return {
      employeeId: input.employeeId || '',
      fullName: input.fullName || '',
      username: input.username || '',
      email: input.email || '',
      phone: input.phone || '',
      departmentId: this.departmentId(input.department),
      roleId: Number(input.roleId || this.roles()[0]?.id || 0),
      propertyId: this.propertyId(input.property),
      shift: input.shift || this.shifts[0],
      status: input.status || 'ACTIVE',
      floorAccess: input.accessibleFloors || ['All Floors'],
      notes: input.notes || '',
      password: (input as any).password || undefined
    };
  }

  private toRoleRequest(input: Partial<UserRole>): object {
    return {
      name: input.name || '',
      departmentId: this.departmentId(input.department),
      accessLevel: input.level || 'Department',
      status: input.isActive === false ? 'INACTIVE' : 'ACTIVE',
      description: input.description || '',
      permissions: this.permissionsToApi(input.permissions || this.emptyPermissions())
    };
  }

  private permissionsToApi(matrix: PermissionMatrix): object[] {
    return this.permissionModules()
      .filter(module => module.id)
      .map(module => ({
        moduleId: module.id,
        canView: !!matrix[module.key]?.view,
        canCreate: !!matrix[module.key]?.create,
        canEdit: !!matrix[module.key]?.edit,
        canDelete: !!matrix[module.key]?.delete,
        canApprove: !!matrix[module.key]?.approve,
        canExport: !!matrix[module.key]?.export
      }));
  }

  private departmentFromApi(value?: ApiCommonMaster | string, id?: number): UserDepartment {
    const raw = typeof value === 'string' ? value : value?.value || value?.code || '';
    const byId = this.departments().find(department => department.id === Number(id));
    const byName = this.departments().find(department => department.name.toLowerCase() === raw.toLowerCase() || department.code?.toLowerCase() === raw.toLowerCase());
    return raw || byId?.name || byName?.name || this.departments()[0]?.name || 'Front Office';
  }

  private propertyFromApi(value?: ApiCommonMaster | string, id?: number): string {
    const raw = typeof value === 'string' ? value : value?.value || '';
    const byId = this.properties().find(property => property.id === Number(id));
    return raw || byId?.name || this.properties()[0]?.name || 'HMS Cloud - Main Hotel';
  }

  private statusFromApi(status?: string): UserStatus {
    const normalized = String(status || 'ACTIVE').toUpperCase();
    return this.statuses.includes(normalized as UserStatus) ? normalized as UserStatus : 'ACTIVE';
  }

  private levelFromApi(level?: string): RoleLevel {
    const normalized = String(level || 'Department').toLowerCase();
    return this.roleLevels.find(item => item.toLowerCase() === normalized) || 'Department';
  }

  private severityFromApi(severity?: string): AccessActivity['severity'] {
    const normalized = String(severity || 'INFO').toUpperCase();
    return ['INFO', 'WARNING', 'CRITICAL'].includes(normalized) ? normalized as AccessActivity['severity'] : 'INFO';
  }

  private departmentId(department?: UserDepartment): number {
    const normalized = String(department || '').toLowerCase();
    return this.departments().find(item => item.name.toLowerCase() === normalized || item.code?.toLowerCase() === normalized)?.id || this.departments()[0]?.id || 1;
  }

  private propertyId(property?: string): number {
    return this.properties().find(item => item.name === property)?.id || this.properties()[0]?.id || 1;
  }

  private moduleKey(name: string): string {
    return String(name || '').toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  private iconForModule(name: string): string {
    const key = this.moduleKey(name);
    const icons: Record<string, string> = {
      dashboard: 'dashboard',
      reservations: 'calendar_month',
      arrivals_departures: 'login',
      guest_profiles: 'person_search',
      housekeeping_board: 'cleaning_services',
      room_audit_sop: 'fact_check',
      lost_found: 'search_off',
      reports: 'bar_chart',
      user_management: 'manage_accounts'
    };
    return icons[key] || 'apps';
  }

  private commonMastersData(response: ApiCommonMaster[] | StandardResponse<ApiCommonMaster[]> | null): ApiCommonMaster[] {
    if (!response) return [];
    return Array.isArray(response) ? response : response.success ? response.data || [] : [];
  }

  private addActivity(actor: string, event: string, target: string, module: string, severity: AccessActivity['severity']): void {
    const nextId = Math.max(0, ...this.activity().map(item => item.id)) + 1;
    this.activity.update(log => [{
      id: nextId,
      at: 'Just now',
      actor,
      event,
      target,
      module,
      severity,
      ipAddress: 'local'
    }, ...log]);
  }
}
