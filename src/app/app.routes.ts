import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { ReservationCenter } from './reservations/reservation-center';
import { NewBookingComponent } from './reservations/new-booking/new-booking.component';
import { ArrivalsComponent } from './reservations/arrivals/arrivals.component';
import { authGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./auth/auth.component').then(m => m.AuthComponent) },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'reservations', component: ReservationCenter },
      { path: 'new-booking', component: NewBookingComponent },
      { path: 'arrivals', component: ArrivalsComponent },
      { path: 'gantt-chart', loadComponent: () => import('./reservations/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent) },
      { path: 'departures', loadComponent: () => import('./reservations/departures/departures.component').then(m => m.DeparturesComponent) },
      { path: 'guests', loadComponent: () => import('./guests/guest-profiles.component').then(m => m.GuestProfilesComponent) },
      { path: 'billing', redirectTo: 'billing/folios', pathMatch: 'full' },
      { path: 'billing/folios', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) },
      { path: 'billing/payments', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) },
      { path: 'billing/invoices', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) },
      { path: 'billing/refunds', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) },
      { path: 'housekeeping', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/board', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/tasks', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/audit', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/staff', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/lost-found', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/maintenance', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'laundry', redirectTo: 'laundry/dashboard', pathMatch: 'full' },
      { path: 'laundry/dashboard', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'laundry/create', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'laundry/orders', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'laundry/detail', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'laundry/catalogue', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'laundry/services', loadComponent: () => import('./laundry/laundry.component').then(m => m.LaundryComponent) },
      { path: 'masters/hotels', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/floors', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/room-types', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/rooms', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/rate-plans', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'user-management', redirectTo: 'user-management/users', pathMatch: 'full' },
      { path: 'user-management/users', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/roles', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/departments', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/shifts', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/activity', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'setup', redirectTo: 'setup/master-data', pathMatch: 'full' },
      { path: 'setup/master-data', loadComponent: () => import('./setup/master-data-configuration.component').then(m => m.MasterDataConfigurationComponent) },
      { path: 'pos', redirectTo: 'pos/dashboard', pathMatch: 'full' },
      { path: 'pos/dashboard', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/outlets', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/dining', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/orders', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/billing', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/menu', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) },
      { path: 'pos/billing-setup', loadComponent: () => import('./pos/pos.component').then(m => m.PosComponent) }
    ]
  }
];
