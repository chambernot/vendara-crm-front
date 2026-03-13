import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConsignationsStore, ConsignationListItemVm, ConsignationStatus } from '../../data-access';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';

type FilterType = 'all' | ConsignationStatus;

@Component({
  selector: 'app-consignations-list',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ScoreBadgeComponent],
  templateUrl: './consignations-list.page.html'
})
export class ConsignationsListPage implements OnInit {
  consignations = signal<ConsignationListItemVm[]>([]);
  filteredConsignations = signal<ConsignationListItemVm[]>([]);
  isLoading = signal(true);
  currentFilter = signal<FilterType>('all');

  private currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  constructor(
    private consignationsStore: ConsignationsStore,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadConsignations();
  }

  loadConsignations() {
    this.isLoading.set(true);
    this.consignationsStore.list().subscribe({
      next: (data) => {
        // Ordenar por mais recentes primeiro
        const sorted = [...data].sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        this.consignations.set(sorted);
        this.applyFilter(this.currentFilter());
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  applyFilter(filter: FilterType) {
    this.currentFilter.set(filter);
    const all = this.consignations();
    
    if (filter === 'all') {
      this.filteredConsignations.set(all);
    } else {
      this.filteredConsignations.set(all.filter(c => c.status === filter));
    }
  }

  navigateToNew() {
    this.router.navigate(['/app/consignacoes/nova']);
  }

  navigateToDetail(id: string) {
    this.router.navigate(['/app/consignacoes', id]);
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  getStatusLabel(status: ConsignationStatus): string {
    const labels: Record<ConsignationStatus, string> = {
      open: 'Em aberto',
      sold: 'Vendida',
      returned: 'Devolvida'
    };
    return labels[status];
  }

  getStatusClass(status: ConsignationStatus): string {
    const classes: Record<ConsignationStatus, string> = {
      open: 'bg-blue-100 text-blue-800',
      sold: 'bg-green-100 text-green-800',
      returned: 'bg-gray-100 text-gray-800'
    };
    return classes[status];
  }
}
