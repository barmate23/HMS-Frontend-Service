import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ReportsService, ReportItem } from '../reports.service';

@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './reports-hub.component.html',
  styleUrls: ['./reports-hub.component.css']
})
export class ReportsHubComponent implements OnInit {
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('all');

  categories = [
    { id: 'all', label: 'All Admin Reports', icon: 'auto_awesome' },
    { id: 'front_office', label: 'Front Office', icon: 'bed' },
    { id: 'pos', label: 'POS & Dining', icon: 'restaurant' },
    { id: 'housekeeping', label: 'Housekeeping', icon: 'cleaning_services' },
    { id: 'laundry', label: 'Laundry', icon: 'local_laundry_service' },
    { id: 'purchase_inventory', label: 'Purchase & Inventory', icon: 'inventory_2' },
    { id: 'favourites', label: 'Favourites', icon: 'star' }
  ];

  constructor(
    public reportsService: ReportsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory.set(params['category']);
      } else {
        this.selectedCategory.set('all');
      }
    });
  }

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

  // Grouped by Department Pillar for Structured Display
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
      const y = height - normalizedY * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
