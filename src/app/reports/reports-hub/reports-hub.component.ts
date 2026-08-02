import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ReportsService, ReportItem } from '../reports.service';

@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './reports-hub.component.html',
  styleUrls: ['./reports-hub.component.css']
})
export class ReportsHubComponent {
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('all');
  activeView = signal<'grid' | 'analytics'>('grid');

  categories = [
    { id: 'all', label: 'All Front Office Reports', icon: 'auto_awesome' },
    { id: 'occupancy', label: 'Occupancy & Demand', icon: 'donut_small' },
    { id: 'guest_ops', label: 'Guest & In-House Ops', icon: 'flight_land' },
    { id: 'room_inventory', label: 'Room Inventory & OOO', icon: 'meeting_room' },
    { id: 'desk_finance', label: 'Front Desk Financials', icon: 'point_of_sale' },
    { id: 'favourites', label: 'Favourites', icon: 'star' }
  ];

  constructor(
    public reportsService: ReportsService,
    private router: Router
  ) {}

  favouriteReports = computed(() => this.reportsService.favouriteReports());

  filteredReports = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    let list = this.reportsService.reportsList();

    if (cat === 'favourites') {
      const favIds = new Set(this.reportsService.favouriteReportIds());
      list = list.filter(r => favIds.has(r.id));
    } else if (cat !== 'all') {
      list = list.filter(r => r.category === cat);
    }

    if (query) {
      list = list.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.categoryLabel.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Grouped by Category Pillar for Structured Sections
  groupedSections = computed(() => {
    const reports = this.filteredReports();
    const map = new Map<string, ReportItem[]>();

    reports.forEach(r => {
      const sec = r.categoryLabel;
      if (!map.has(sec)) {
        map.set(sec, []);
      }
      map.get(sec)!.push(r);
    });

    return Array.from(map.entries()).map(([sectionTitle, items]) => ({
      sectionTitle,
      items
    }));
  });

  openReport(reportId: string): void {
    this.router.navigate(['/reports/view', reportId]);
  }

  toggleFav(reportId: string, event: Event): void {
    this.reportsService.toggleFavourite(reportId, event);
  }

  isFav(reportId: string): boolean {
    return this.reportsService.isFavourite(reportId);
  }

  // Convert array of numbers to SVG polyline points string for sparkline graphs
  getSparklinePoints(data: number[]): string {
    if (!data || !data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data) || 1;
    const width = 120;
    const height = 36;

    return data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const normalizedY = (val - min) / (max - min || 1);
      const y = height - (normalizedY * (height - 8) + 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
