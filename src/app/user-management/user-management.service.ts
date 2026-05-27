import { Injectable, computed, signal } from '@angular/core';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type UserDepartment = 'Front Office' | 'Housekeeping' | 'Hotel Setup' | 'Accounts' | 'Management' | 'Maintenance' | 'Security';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';
export type RoleLevel = 'Property' | 'Department' | 'Supervisor' | 'Admin';

export interface PermissionModule {
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

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  readonly permissionActions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

  readonly permissionModules: PermissionModule[] = [
    { key: 'dashboard', label: 'Dashboard', group: 'Operations', icon: 'dashboard' },
    { key: 'reservations', label: 'Reservations', group: 'Front Office', icon: 'calendar_month' },
    { key: 'arrivals_departures', label: 'Arrivals & Departures', group: 'Front Office', icon: 'login' },
    { key: 'guest_profiles', label: 'Guest Profiles', group: 'Front Office', icon: 'person_search' },
    { key: 'housekeeping_board', label: 'Housekeeping Board', group: 'Housekeeping', icon: 'cleaning_services' },
    { key: 'room_audit', label: 'Room Audit SOP', group: 'Housekeeping', icon: 'fact_check' },
    { key: 'lost_found', label: 'Lost & Found', group: 'Housekeeping', icon: 'search_off' },
    { key: 'maintenance', label: 'Maintenance', group: 'Housekeeping', icon: 'build_circle' },
    { key: 'hotel_setup', label: 'Hotel Setup', group: 'Configuration', icon: 'domain' },
    { key: 'night_audit', label: 'Night Audit', group: 'Finance', icon: 'bedtime' },
    { key: 'reports', label: 'Reports', group: 'Analytics', icon: 'bar_chart' },
    { key: 'user_management', label: 'User Management', group: 'Security', icon: 'manage_accounts' }
  ];

  readonly departments: UserDepartment[] = ['Front Office', 'Housekeeping', 'Hotel Setup', 'Accounts', 'Management', 'Maintenance', 'Security'];
  readonly statuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];
  readonly roleLevels: RoleLevel[] = ['Property', 'Department', 'Supervisor', 'Admin'];
  readonly properties = ['HMS Cloud - Main Hotel', 'HMS Cloud - Annex', 'HMS Cloud - Banquet Wing'];
  readonly shifts = ['Morning Shift', 'Evening Shift', 'Night Shift', 'General Shift'];
  readonly floors = ['Floor 1', 'Floor 2', 'Floor 3', 'All Floors'];

  readonly roles = signal<UserRole[]>([
    {
      id: 1,
      name: 'Property Administrator',
      description: 'Full property access including setup, users, reports and operational approvals.',
      department: 'Management',
      level: 'Admin',
      isSystem: true,
      isActive: true,
      permissions: this.permissionsFor(this.permissionModules.map(module => module.key), this.permissionActions),
      createdAt: '2026-05-01 09:15 AM',
      updatedAt: '2026-05-20 05:20 PM'
    },
    {
      id: 2,
      name: 'Front Office Manager',
      description: 'Controls reservations, guest profiles, arrivals, departures and front desk approvals.',
      department: 'Front Office',
      level: 'Supervisor',
      isSystem: false,
      isActive: true,
      permissions: this.permissionsFor(['dashboard', 'reservations', 'arrivals_departures', 'guest_profiles', 'reports'], ['view', 'create', 'edit', 'approve', 'export']),
      createdAt: '2026-05-02 10:10 AM',
      updatedAt: '2026-05-19 02:45 PM'
    },
    {
      id: 3,
      name: 'Housekeeping Supervisor',
      description: 'Manages room board, tasks, room audits, lost & found and maintenance follow-up.',
      department: 'Housekeeping',
      level: 'Supervisor',
      isSystem: false,
      isActive: true,
      permissions: this.permissionsFor(['dashboard', 'housekeeping_board', 'room_audit', 'lost_found', 'maintenance'], ['view', 'create', 'edit', 'approve', 'export']),
      createdAt: '2026-05-03 11:30 AM',
      updatedAt: '2026-05-21 01:05 PM'
    },
    {
      id: 4,
      name: 'Room Attendant',
      description: 'Updates assigned housekeeping tasks and daily room audit checkpoints.',
      department: 'Housekeeping',
      level: 'Department',
      isSystem: false,
      isActive: true,
      permissions: this.permissionsFor(['housekeeping_board', 'room_audit', 'lost_found', 'maintenance'], ['view', 'edit']),
      createdAt: '2026-05-04 08:40 AM',
      updatedAt: '2026-05-17 06:10 PM'
    },
    {
      id: 5,
      name: 'Night Auditor',
      description: 'Runs end-of-day audit workflows, finance checks and operational reports.',
      department: 'Accounts',
      level: 'Supervisor',
      isSystem: false,
      isActive: true,
      permissions: this.permissionsFor(['dashboard', 'reservations', 'guest_profiles', 'night_audit', 'reports'], ['view', 'edit', 'approve', 'export']),
      createdAt: '2026-05-04 09:20 PM',
      updatedAt: '2026-05-22 07:30 AM'
    }
  ]);

  readonly users = signal<SystemUser[]>([
    {
      id: 101,
      employeeId: 'EMP-001',
      fullName: 'Amit Desai',
      username: 'amit.desai',
      email: 'amit.desai@hmscloud.local',
      phone: '+91 98765 11001',
      department: 'Management',
      roleId: 1,
      property: 'HMS Cloud - Main Hotel',
      shift: 'General Shift',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      accessibleFloors: ['All Floors'],
      lastLogin: 'Today, 09:10 AM',
      loginFailures: 0,
      notes: 'Primary system administrator.'
    },
    {
      id: 102,
      employeeId: 'EMP-014',
      fullName: 'Rajan Mehta',
      username: 'rajan.mehta',
      email: 'rajan.mehta@hmscloud.local',
      phone: '+91 98111 22333',
      department: 'Front Office',
      roleId: 2,
      property: 'HMS Cloud - Main Hotel',
      shift: 'Morning Shift',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      accessibleFloors: ['All Floors'],
      lastLogin: 'Today, 08:24 AM',
      loginFailures: 0,
      notes: 'Can approve reservation changes.'
    },
    {
      id: 103,
      employeeId: 'EMP-021',
      fullName: 'Meena Pillai',
      username: 'meena.pillai',
      email: 'meena.pillai@hmscloud.local',
      phone: '+91 98444 77120',
      department: 'Housekeeping',
      roleId: 3,
      property: 'HMS Cloud - Main Hotel',
      shift: 'Morning Shift',
      status: 'ACTIVE',
      twoFactorEnabled: false,
      accessibleFloors: ['Floor 1', 'Floor 2'],
      lastLogin: 'Today, 07:55 AM',
      loginFailures: 0,
      notes: 'Supervises daily SOP audit.'
    },
    {
      id: 104,
      employeeId: 'EMP-036',
      fullName: 'Rahul Shetty',
      username: 'rahul.shetty',
      email: 'rahul.shetty@hmscloud.local',
      phone: '+91 99000 56421',
      department: 'Housekeeping',
      roleId: 4,
      property: 'HMS Cloud - Main Hotel',
      shift: 'Evening Shift',
      status: 'ACTIVE',
      twoFactorEnabled: false,
      accessibleFloors: ['Floor 2', 'Floor 3'],
      lastLogin: 'Yesterday, 06:42 PM',
      loginFailures: 1,
      notes: 'Assigned to rooms 201-305.'
    },
    {
      id: 105,
      employeeId: 'EMP-042',
      fullName: 'Deepa Thomas',
      username: 'deepa.thomas',
      email: 'deepa.thomas@hmscloud.local',
      phone: '+91 99888 65432',
      department: 'Accounts',
      roleId: 5,
      property: 'HMS Cloud - Main Hotel',
      shift: 'Night Shift',
      status: 'LOCKED',
      twoFactorEnabled: true,
      accessibleFloors: ['All Floors'],
      lastLogin: 'May 25, 2026, 11:55 PM',
      loginFailures: 4,
      notes: 'Locked after failed login attempts.'
    }
  ]);

  readonly activity = signal<AccessActivity[]>([
    { id: 1, at: 'Today, 09:10 AM', actor: 'Amit Desai', event: 'Signed in with 2FA', target: 'Admin Console', module: 'Authentication', severity: 'INFO', ipAddress: '192.168.1.24' },
    { id: 2, at: 'Today, 08:40 AM', actor: 'Meena Pillai', event: 'Updated room audit permission', target: 'Housekeeping Supervisor', module: 'Roles', severity: 'WARNING', ipAddress: '192.168.1.31' },
    { id: 3, at: 'Yesterday, 11:58 PM', actor: 'System', event: 'Locked user after failed attempts', target: 'Deepa Thomas', module: 'Security', severity: 'CRITICAL', ipAddress: '192.168.1.18' },
    { id: 4, at: 'Yesterday, 06:45 PM', actor: 'Rajan Mehta', event: 'Reset temporary password', target: 'Front Desk Trainee', module: 'Users', severity: 'WARNING', ipAddress: '192.168.1.44' },
    { id: 5, at: 'May 25, 2026, 05:20 PM', actor: 'Amit Desai', event: 'Created role', target: 'Night Auditor', module: 'Roles', severity: 'INFO', ipAddress: '192.168.1.24' }
  ]);

  readonly rolesMap = computed(() => new Map(this.roles().map(role => [role.id, role])));

  saveUser(input: Partial<SystemUser>): SystemUser {
    const nextId = Math.max(100, ...this.users().map(user => user.id)) + 1;
    const user: SystemUser = {
      id: input.id ?? nextId,
      employeeId: input.employeeId?.trim() || `EMP-${nextId}`,
      fullName: input.fullName?.trim() || 'New User',
      username: input.username?.trim() || `user.${nextId}`,
      email: input.email?.trim() || `user${nextId}@hmscloud.local`,
      phone: input.phone?.trim() || '',
      department: input.department ?? 'Front Office',
      roleId: Number(input.roleId ?? this.roles()[0]?.id ?? 1),
      property: input.property || this.properties[0],
      shift: input.shift || this.shifts[0],
      status: input.status ?? 'ACTIVE',
      twoFactorEnabled: !!input.twoFactorEnabled,
      accessibleFloors: input.accessibleFloors?.length ? [...input.accessibleFloors] : ['All Floors'],
      lastLogin: input.lastLogin || 'Never',
      loginFailures: Number(input.loginFailures ?? 0),
      notes: input.notes || ''
    };

    if (input.id) {
      this.users.update(users => users.map(existing => existing.id === input.id ? user : existing));
      this.addActivity('Amit Desai', 'Updated user profile', user.fullName, 'Users', 'INFO');
    } else {
      this.users.update(users => [user, ...users]);
      this.addActivity('Amit Desai', 'Created user account', user.fullName, 'Users', 'INFO');
    }

    return user;
  }

  deleteUser(id: number): void {
    const user = this.users().find(item => item.id === id);
    this.users.update(users => users.filter(item => item.id !== id));
    if (user) this.addActivity('Amit Desai', 'Deleted user account', user.fullName, 'Users', 'CRITICAL');
  }

  setUserStatus(id: number, status: UserStatus): void {
    let name = '';
    this.users.update(users => users.map(user => {
      if (user.id !== id) return user;
      name = user.fullName;
      return { ...user, status, loginFailures: status === 'LOCKED' ? user.loginFailures : 0 };
    }));
    this.addActivity('Amit Desai', `Changed user status to ${status}`, name || `User #${id}`, 'Users', status === 'LOCKED' ? 'WARNING' : 'INFO');
  }

  resetPassword(id: number): void {
    const user = this.users().find(item => item.id === id);
    if (user) this.addActivity('Amit Desai', 'Generated temporary password', user.fullName, 'Users', 'WARNING');
  }

  saveRole(input: Partial<UserRole>): UserRole {
    const nextId = Math.max(0, ...this.roles().map(role => role.id)) + 1;
    const now = 'Today, 01:30 PM';
    const role: UserRole = {
      id: input.id ?? nextId,
      name: input.name?.trim() || 'New Role',
      description: input.description?.trim() || '',
      department: input.department ?? 'Front Office',
      level: input.level ?? 'Department',
      isSystem: !!input.isSystem,
      isActive: input.isActive ?? true,
      permissions: this.clonePermissions(input.permissions || this.emptyPermissions()),
      createdAt: input.createdAt || now,
      updatedAt: now
    };

    if (input.id) {
      this.roles.update(roles => roles.map(existing => existing.id === input.id ? role : existing));
      this.addActivity('Amit Desai', 'Updated role permissions', role.name, 'Roles', 'WARNING');
    } else {
      this.roles.update(roles => [role, ...roles]);
      this.addActivity('Amit Desai', 'Created role', role.name, 'Roles', 'INFO');
    }

    return role;
  }

  deleteRole(id: number): void {
    const role = this.roles().find(item => item.id === id);
    this.roles.update(roles => roles.filter(item => item.id !== id));
    if (role) this.addActivity('Amit Desai', 'Deleted role', role.name, 'Roles', 'CRITICAL');
  }

  cloneRole(role: UserRole): UserRole {
    return this.saveRole({
      ...role,
      id: undefined,
      name: `${role.name} Copy`,
      isSystem: false,
      createdAt: undefined,
      updatedAt: undefined
    });
  }

  roleUserCount(roleId: number): number {
    return this.users().filter(user => Number(user.roleId) === Number(roleId)).length;
  }

  emptyPermissions(): PermissionMatrix {
    return this.permissionModules.reduce((matrix, module) => {
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
    return this.permissionModules.reduce((copy, module) => {
      copy[module.key] = this.permissionActions.reduce((actions, action) => {
        actions[action] = !!matrix[module.key]?.[action];
        return actions;
      }, {} as Record<PermissionAction, boolean>);
      return copy;
    }, {} as PermissionMatrix);
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
      ipAddress: '192.168.1.24'
    }, ...log]);
  }
}
