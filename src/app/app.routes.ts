import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { ReservationCenter } from './reservations/reservation-center';
import { NewBookingComponent } from './reservations/new-booking/new-booking.component';
import { ArrivalsComponent } from './reservations/arrivals/arrivals.component';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'reservations', pathMatch: 'full' },
      { path: 'reservations', component: ReservationCenter },
      { path: 'new-booking', component: NewBookingComponent },
      { path: 'arrivals', component: ArrivalsComponent },
      { path: 'gantt-chart', loadComponent: () => import('./reservations/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent) },
      { path: 'departures', loadComponent: () => import('./reservations/departures/departures.component').then(m => m.DeparturesComponent) },
      { path: 'guests', loadComponent: () => import('./guests/guest-profiles.component').then(m => m.GuestProfilesComponent) },
      { path: 'housekeeping', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/board', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/tasks', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/audit', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/staff', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/lost-found', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'housekeeping/maintenance', loadComponent: () => import('./housekeeping/housekeeping.component').then(m => m.HousekeepingComponent) },
      { path: 'masters/hotels', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/floors', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/room-types', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/rooms', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'masters/rate-plans', loadComponent: () => import('./masters/hotel-masters.component').then(m => m.HotelMastersComponent) },
      { path: 'user-management', redirectTo: 'user-management/users', pathMatch: 'full' },
      { path: 'user-management/users', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/roles', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'user-management/activity', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) }
    ]
  }
];
