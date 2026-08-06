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
    { label: 'Dashboard', icon: 'grid_view', route: '/dashboard', color: '#2563EB' },
    {
      label: 'Front Office',
      icon: 'business_center',
      color: '#D97706',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/front-office/dashboard', color: '#3B82F6' },
        { label: 'Reservations', icon: 'calendar_month', route: '/reservations', color: '#059669' },
        { label: 'Gantt Chart', icon: 'view_timeline', route: '/gantt-chart', color: '#8B5CF6' },
        { label: 'Arrivals', icon: 'login', route: '/arrivals', color: '#10B981' },
        { label: 'Departures', icon: 'logout', route: '/departures', color: '#EF4444' },
        { label: 'Guest Profiles', icon: 'person_search', route: '/guests', color: '#EC4899' },
        { label: 'Reports & Graphs', icon: 'assessment', route: '/reports', queryParams: { category: 'front_office' }, color: '#F59E0B' }
      ]
    },
    {
      label: 'CRM',
      icon: 'groups',
      color: '#EC4899',
      expanded: false,
      children: [
        { label: 'Board', icon: 'space_dashboard', route: '/crm/dashboard', color: '#EC4899' },
        { label: 'Tasks', icon: 'assignment', route: '/crm/tasks', color: '#8B5CF6' },
        { label: 'New Enquiry', icon: 'add_box', route: '/crm/new', color: '#10B981' },
        { label: 'Quotations', icon: 'description', route: '/crm/quotations', color: '#F59E0B' }
      ]
    },
    {
      label: 'Housekeeping',
      icon: 'cleaning_services',
      color: '#10B981',
      expanded: false,
      children: [
        { label: 'Room Board', icon: 'dashboard', route: '/housekeeping/board', color: '#10B981' },
        { label: 'Tasks', icon: 'assignment', route: '/housekeeping/tasks', color: '#3B82F6' },
        { label: 'Audit', icon: 'fact_check', route: '/housekeeping/audit', color: '#8B5CF6' },
        { label: 'Lost & Found', icon: 'search_off', route: '/housekeeping/lost-found', color: '#EF4444' },
        { label: 'Maintenance', icon: 'build_circle', route: '/housekeeping/maintenance', color: '#F59E0B' },
        { label: 'Staff', icon: 'badge', route: '/housekeeping/staff', color: '#EC4899' }
      ]
    },
    {
      label: 'Billing',
      icon: 'account_balance_wallet',
      color: '#16A34A',
      expanded: false,
      children: [
        { label: 'Guest Folios', icon: 'receipt_long', route: '/billing/folios', color: '#16A34A' },
        { label: 'Invoices', icon: 'request_quote', route: '/billing/invoices', color: '#2563EB' },
        { label: 'Refunds', icon: 'currency_exchange', route: '/billing/refunds', color: '#EF4444' },
        { label: 'Inward Stock', icon: 'move_to_inbox', route: '/billing/inward', color: '#8B5CF6' },
        { label: 'Vendor Bills', icon: 'receipt_long', route: '/billing/bills', color: '#F59E0B' }
      ]
    },
    {
      label: 'Laundry',
      icon: 'local_laundry_service',
      color: '#06B6D4',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/laundry/dashboard', color: '#06B6D4' },
        { label: 'Create Order', icon: 'add_circle', route: '/laundry/create', color: '#10B981' },
        { label: 'Order Tracking', icon: 'list_alt', route: '/laundry/orders', color: '#3B82F6' },
        { label: 'Status Flow', icon: 'timeline', route: '/laundry/detail', color: '#8B5CF6' },
        { label: 'Price Master', icon: 'inventory_2', route: '/laundry/catalogue', color: '#F59E0B' }
      ]
    },
    {
      label: 'Inventory',
      icon: 'inventory',
      color: '#8B5CF6',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/inventory/dashboard', color: '#8B5CF6' },
        { label: 'Stock Ledger', icon: 'inventory_2', route: '/inventory/stock', color: '#3B82F6' },
        { label: 'Purchase Requests', icon: 'assignment_add', route: '/inventory/requests', color: '#F97316' },
        { label: 'Store Issues', icon: 'outbox', route: '/inventory/issues', color: '#EF4444' }
      ]
    },
    {
      label: 'Purchase',
      icon: 'shopping_cart_checkout',
      color: '#F97316',
      expanded: false,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/purchase/dashboard', color: '#F97316' },
        { label: 'Suppliers', icon: 'storefront', route: '/purchase/suppliers', color: '#10B981' },
        { label: 'Purchase Orders', icon: 'shopping_cart', route: '/purchase/orders', color: '#3B82F6' },
        { label: 'Item Config', icon: 'inventory_2', route: '/purchase/items', color: '#8B5CF6' }
      ]
    },
    {
      label: 'Hotel Setup',
      icon: 'domain',
      color: '#6366F1',
      expanded: false,
      children: [
        { label: 'Hotels', icon: 'location_city', route: '/masters/hotels', color: '#6366F1' },
        { label: 'Floors', icon: 'layers', route: '/masters/floors', color: '#3B82F6' },
        { label: 'Room Types', icon: 'bed', route: '/masters/room-types', color: '#10B981' },
        { label: 'Rooms', icon: 'meeting_room', route: '/masters/rooms', color: '#8B5CF6' },
        { label: 'Rate Plans', icon: 'sell', route: '/masters/rate-plans', color: '#F59E0B' },
        { label: 'GST Configuration', icon: 'receipt_long', route: '/masters/gst-config', color: '#EC4899' }
      ]
    },
    {
      label: 'User Management',
      icon: 'manage_accounts',
      color: '#E11D48',
      expanded: false,
      children: [
        { label: 'Users', icon: 'group', route: '/user-management/users', color: '#E11D48' },
        { label: 'Roles & Permissions', icon: 'admin_panel_settings', route: '/user-management/roles', color: '#8B5CF6' },
        { label: 'Departments', icon: 'apartment', route: '/user-management/departments', color: '#3B82F6' },
        { label: 'Shift Configuration', icon: 'schedule', route: '/user-management/shifts', color: '#F59E0B' },
        { label: 'Access Audit', icon: 'manage_history', route: '/user-management/activity', color: '#10B981' }
      ]
    },
    {
      label: 'Setup',
      icon: 'tune',
      color: '#64748B',
      expanded: false,
      children: [
        { label: 'Master Data', icon: 'folder', route: '/setup/master-data', color: '#64748B' }
      ]
    },
    {
      label: 'POS',
      icon: 'point_of_sale',
      color: '#0D9488',
      expanded: true,
      children: [
        { label: 'Dashboard', icon: 'dashboard', route: '/pos/dashboard', color: '#2563EB' },
        { label: 'Outlets', icon: 'storefront', route: '/pos/outlets', color: '#D97706' },
        { label: 'Table Dining', icon: 'table_restaurant', route: '/pos/dining', color: '#8B5CF6' },
        { label: 'Orders', icon: 'restaurant_menu', route: '/pos/orders', color: '#EF4444' },
        { label: 'Billing', icon: 'receipt_long', route: '/pos/billing', color: '#16A34A' },
        { label: 'Menu Management', icon: 'menu_book', route: '/pos/menu', color: '#06B6D4' },
        { label: 'Ingredients', icon: 'kitchen', route: '/pos/ingredient-master', color: '#10B981' },
        { label: 'Recipes (BOM)', icon: 'set_meal', route: '/pos/recipes', color: '#F59E0B' },
        { label: 'Kitchen Display', icon: 'kitchen', route: '/pos/kds', color: '#EC4899' }
      ]
    },
    {
      label: 'Channel Manager',
      icon: 'hub',
      color: '#A855F7',
      expanded: true,
      children: [
        { label: 'Channex OTA Sync', icon: 'cloud_sync', route: '/channel-manager/channex', color: '#A855F7' }
      ]
    },
    {
      label: 'Reports & Analytics',
      icon: 'assessment',
      color: '#EAB308',
      expanded: true,
      children: [
        { label: 'Front Office', icon: 'bed', route: '/reports', queryParams: { category: 'front_office' }, color: '#D97706' },
        { label: 'POS & Dining', icon: 'restaurant', route: '/reports', queryParams: { category: 'pos' }, color: '#0D9488' },
        { label: 'Housekeeping', icon: 'cleaning_services', route: '/reports', queryParams: { category: 'housekeeping' }, color: '#10B981' },
        { label: 'Laundry', icon: 'local_laundry_service', route: '/reports', queryParams: { category: 'laundry' }, color: '#06B6D4' },
        { label: 'Purchase & Inventory', icon: 'inventory_2', route: '/reports', queryParams: { category: 'purchase_inventory' }, color: '#8B5CF6' }
      ]
    }
  ];


  isGroupActive(item: any): boolean {
    if (!item.children || !item.children.length) return false;
    const currentUrl = this.router.url;
    return item.children.some((child: any) => {
      if (!child.route) return false;
      const basePath = child.route.split('?')[0];
      return currentUrl === basePath || currentUrl.startsWith(basePath + '/') || currentUrl.startsWith(basePath + '?');
    });
  }

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
