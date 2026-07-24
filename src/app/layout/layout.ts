import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class Layout implements OnInit {
  isCollapsed = signal(false);
  activeTheme = signal('oasis');
  activeBg = signal('warm');

  themeOptions = [
    { name: 'Oasis Pine', primary: '#0F3D3E', light: '#E8F3F1', accent: '#C08261', value: 'oasis' },
    { name: 'Royal Sapphire', primary: '#1E3A8A', light: '#EFF6FF', accent: '#F59E0B', value: 'sapphire' },
    { name: 'Amethyst Violet', primary: '#6D28D9', light: '#F5F3FF', accent: '#EC4899', value: 'violet' },
    { name: 'Terracotta Rust', primary: '#B45309', light: '#FFFBEB', accent: '#10B981', value: 'terracotta' }
  ];

  bgOptions = [
    {
      name: 'Beige (Warm)',
      value: 'warm',
      s50: '#FFFFFF',
      s100: '#F4F1EA',
      s200: '#E6E2D8',
      s500: '#737373',
      s700: '#404040',
      s800: '#262626',
      s900: '#171717'
    },
    {
      name: 'Slate (Cool)',
      value: 'cool',
      s50: '#FFFFFF',
      s100: '#F1F5F9',
      s200: '#E2E8F0',
      s500: '#64748B',
      s700: '#334155',
      s800: '#1E293B',
      s900: '#0F172A'
    },
    {
      name: 'Mint (Fresh)',
      value: 'mint',
      s50: '#FFFFFF',
      s100: '#F0FDF8',
      s200: '#CCFBEF',
      s500: '#4B9E87',
      s700: '#1A5C4A',
      s800: '#0F3D30',
      s900: '#062820'
    },
    {
      name: 'Lavender (Soft)',
      value: 'lavender',
      s50: '#FFFFFF',
      s100: '#F5F3FF',
      s200: '#EDE9FE',
      s500: '#7C6FAF',
      s700: '#4C3D8F',
      s800: '#2E2260',
      s900: '#1A1240'
    },
    {
      name: 'Sand (Desert)',
      value: 'sand',
      s50: '#FFFFFF',
      s100: '#FDF8F0',
      s200: '#F5E9D0',
      s500: '#9C7B4E',
      s700: '#6B4E27',
      s800: '#4A3118',
      s900: '#2E1C09'
    },
    {
      name: 'Stone (Neutral)',
      value: 'stone',
      s50: '#FFFFFF',
      s100: '#F5F5F4',
      s200: '#E7E5E4',
      s500: '#78716C',
      s700: '#44403C',
      s800: '#292524',
      s900: '#1C1917'
    }
  ];

  ngOnInit() {
    const savedTheme = localStorage.getItem('hms-theme-color') || 'oasis';
    this.applyTheme(savedTheme);

    const savedBg = localStorage.getItem('hms-bg-theme') || 'warm';
    this.applyBgTheme(savedBg);
  }

  applyTheme(themeValue: string) {
    const option = this.themeOptions.find(t => t.value === themeValue);
    if (!option) return;

    this.activeTheme.set(themeValue);
    localStorage.setItem('hms-theme-color', themeValue);
    document.documentElement.style.setProperty('--primary-color', option.primary);
    document.documentElement.style.setProperty('--primary-light', option.light);
    document.documentElement.style.setProperty('--accent-color', option.accent);
  }

  applyBgTheme(bgValue: string) {
    const opt = this.bgOptions.find(b => b.value === bgValue);
    if (!opt) return;

    this.activeBg.set(bgValue);
    localStorage.setItem('hms-bg-theme', bgValue);
    document.documentElement.style.setProperty('--surface-50', opt.s50);
    document.documentElement.style.setProperty('--surface-100', opt.s100);
    document.documentElement.style.setProperty('--surface-200', opt.s200);
    document.documentElement.style.setProperty('--surface-500', opt.s500);
    document.documentElement.style.setProperty('--surface-700', opt.s700);
    document.documentElement.style.setProperty('--surface-800', opt.s800);
    document.documentElement.style.setProperty('--surface-900', opt.s900);
  }

  getActiveThemeColor(): string {
    const opt = this.themeOptions.find(t => t.value === this.activeTheme());
    return opt ? opt.primary : '#0F3D3E';
  }

  constructor(
    readonly auth: AuthService,
    private readonly router: Router
  ) { }

  navItems = [
    { label: 'Dashboard', icon: 'grid_view', route: '/dashboard' },
    {
      label: 'Front Office',
      icon: 'business_center',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/front-office/dashboard' },
        { label: 'Reservations', icon: 'calendar_month', route: '/reservations' },
        { label: 'Gantt Chart', icon: 'view_timeline', route: '/gantt-chart' },
        { label: 'Arrivals', icon: 'login', route: '/arrivals' },
        { label: 'Departures', icon: 'logout', route: '/departures' },
        { label: 'Guest Profiles', icon: 'person_search', route: '/guests' }
      ]
    },
    {
      label: 'CRM',
      icon: 'groups',
      expanded: false,
      children: [
        { label: 'Board', icon: 'space_dashboard', route: '/crm/dashboard' },
        { label: 'Tasks', icon: 'assignment', route: '/crm/tasks' },
        { label: 'New Enquiry', icon: 'add_box', route: '/crm/new' },
        { label: 'Quotations', icon: 'description', route: '/crm/quotations' },
        { label: 'Staff', icon: 'badge', route: '/crm/staff' }
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
      label: 'Billing',
      icon: 'account_balance_wallet',
      expanded: false,
      children: [
        { label: 'Guest Folios', icon: 'receipt_long', route: '/billing/folios' },
        { label: 'Invoices', icon: 'request_quote', route: '/billing/invoices' },
        { label: 'Refunds', icon: 'currency_exchange', route: '/billing/refunds' },
        { label: 'Inward Stock', icon: 'move_to_inbox', route: '/billing/inward' },
        { label: 'Vendor Bills', icon: 'receipt_long', route: '/billing/bills' }
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
        { label: 'Price Master', icon: 'inventory_2', route: '/laundry/catalogue' }
      ]
    },
    {
      label: 'Inventory',
      icon: 'inventory',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/inventory/dashboard' },
        { label: 'Stock Ledger', icon: 'inventory_2', route: '/inventory/stock' },
        { label: 'Purchase Requests', icon: 'assignment_add', route: '/inventory/requests' },
        { label: 'Store Issues', icon: 'outbox', route: '/inventory/issues' }
      ]
    },
    {
      label: 'Purchase',
      icon: 'shopping_cart_checkout',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/purchase/dashboard' },
        { label: 'Suppliers', icon: 'storefront', route: '/purchase/suppliers' },
        { label: 'Purchase Orders', icon: 'shopping_cart', route: '/purchase/orders' },
        { label: 'Item Config', icon: 'inventory_2', route: '/purchase/items' }
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
        { label: 'Rate Plans', icon: 'sell', route: '/masters/rate-plans' },
        { label: 'GST Configuration', icon: 'receipt_long', route: '/masters/gst-config' }
      ]
    },
    {
      label: 'User Management',
      icon: 'manage_accounts',
      expanded: false,
      children: [
        { label: 'Users', icon: 'group', route: '/user-management/users' },
        { label: 'Roles & Permissions', icon: 'admin_panel_settings', route: '/user-management/roles' },
        { label: 'Departments', icon: 'apartment', route: '/user-management/departments' },
        { label: 'Shift Configuration', icon: 'schedule', route: '/user-management/shifts' },
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
        { label: 'Dashboard', icon: 'dashboard', route: '/pos/dashboard' },
        { label: 'Outlets', icon: 'storefront', route: '/pos/outlets' },
        { label: 'Table Dining', icon: 'table_restaurant', route: '/pos/dining' },
        { label: 'Orders', icon: 'restaurant_menu', route: '/pos/orders' },
        { label: 'Billing', icon: 'receipt_long', route: '/pos/billing' },
        { label: 'Menu Management', icon: 'menu_book', route: '/pos/menu' }
      ]

    },
    {
      label: 'Channel Manager',
      icon: 'hub',
      expanded: true,
      children: [
        { label: 'Agoda YCS API', icon: 'sync_alt', route: '/channel-manager/agoda' }
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

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
