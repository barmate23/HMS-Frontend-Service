import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class Layout {
  isCollapsed = signal(false);

  navItems = [
    { label: 'Dashboard', icon: 'grid_view', route: '/dashboard' },
    { 
      label: 'Front Office', 
      icon: 'business_center', 
      expanded: false,
      children: [
        { label: 'Reservations', icon: 'calendar_month', route: '/reservations' },
        { label: 'Gantt Chart', icon: 'view_timeline', route: '/gantt-chart' },
        { label: 'Arrivals', icon: 'login', route: '/arrivals' },
        { label: 'Departures', icon: 'logout', route: '/departures' },
        { label: 'Guest Profiles', icon: 'person_search', route: '/guests' }
      ]
    },
    { 
      label: 'Housekeeping', 
      icon: 'cleaning_services', 
      expanded: false,
      children: [
        { label: 'Room Board', icon: 'dashboard', route: '/housekeeping/board' },
        { label: 'Tasks', icon: 'assignment', route: '/housekeeping/tasks' },
        { label: 'Audit', icon: 'fact_check', route: '/housekeeping/audit' },
        { label: 'Lost & Found', icon: 'search_off', route: '/housekeeping/lost-found' },
        { label: 'Maintenance', icon: 'build_circle', route: '/housekeeping/maintenance' },
        { label: 'Staff', icon: 'badge', route: '/housekeeping/staff' }
      ]
    },
    {
      label: 'Laundry',
      icon: 'local_laundry_service',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/laundry/dashboard' },
        { label: 'Create Order', icon: 'add_circle', route: '/laundry/create' },
        { label: 'Order Tracking', icon: 'list_alt', route: '/laundry/orders' },
        { label: 'Status Flow', icon: 'timeline', route: '/laundry/detail' },
        { label: 'Linen Outsource', icon: 'qr_code_scanner', route: '/laundry/linen' },
        { label: 'Price Master', icon: 'inventory_2', route: '/laundry/catalogue' },
        { label: 'Reports', icon: 'bar_chart', route: '/laundry/reports' }
      ]
    },
    {
      label: 'Hotel Setup',
      icon: 'domain',
      expanded: false,
      children: [
        { label: 'Hotels', icon: 'location_city', route: '/masters/hotels' },
        { label: 'Floors', icon: 'layers', route: '/masters/floors' },
        { label: 'Room Types', icon: 'bed', route: '/masters/room-types' },
        { label: 'Rooms', icon: 'meeting_room', route: '/masters/rooms' },
        { label: 'Rate Plans', icon: 'sell', route: '/masters/rate-plans' }
      ]
    },
    {
      label: 'User Management',
      icon: 'manage_accounts',
      expanded: false,
      children: [
        { label: 'Users', icon: 'group', route: '/user-management/users' },
        { label: 'Roles & Permissions', icon: 'admin_panel_settings', route: '/user-management/roles' },
        { label: 'Access Audit', icon: 'manage_history', route: '/user-management/activity' }
      ]
    },
    {
      label: 'Setup',
      icon: 'tune',
      expanded: false,
      children: [
        { label: 'Master Data', icon: 'folder', route: '/setup/master-data' }
      ]
    },
    {
      label: 'POS',
      icon: 'point_of_sale',
      expanded: false,
      children: [
        { label: 'Outlets', icon: 'storefront', route: '/pos/outlets' },
        { label: 'Table Dining', icon: 'table_restaurant', route: '/pos/dining' },
        { label: 'Orders', icon: 'restaurant_menu', route: '/pos/orders' },
        { label: 'Billing', icon: 'receipt_long', route: '/pos/billing' },
        { label: 'Menu Management', icon: 'menu_book', route: '/pos/menu' }
      ]
    }
  ];

  toggleSidebar() {
    this.isCollapsed.update(v => !v);
  }

  toggleSubmenu(item: any) {
    if (this.isCollapsed()) {
      this.isCollapsed.set(false); // expand sidebar if clicking submenu while collapsed
    }
    if (item.children) {
      item.expanded = !item.expanded;
    }
  }
}
