import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsignationsStore, ConsignationDetailVm } from '../../data-access';
import { SectionCardComponent } from '../../../../shared/ui/section-card/section-card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';

@Component({
  selector: 'app-consignation-detail',
  standalone: true,
  imports: [CommonModule, SectionCardComponent, EmptyStateComponent, ScoreBadgeComponent],
  templateUrl: './consignation-detail.page.html'
})
export class ConsignationDetailPage implements OnInit {
  detail = signal<ConsignationDetailVm | null>(null);
  isLoading = signal(true);
  notFound = signal(false);
  isProcessing = signal(false);

  private currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  private dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private consignationsStore: ConsignationsStore
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDetail(id);
    } else {
      this.notFound.set(true);
      this.isLoading.set(false);
    }
  }

  loadDetail(id: string) {
    this.isLoading.set(true);
    this.consignationsStore.getById(id).subscribe({
      next: (data) => {
        if (data) {
          this.detail.set(data);
          this.notFound.set(false);
        } else {
          this.notFound.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      }
    });
  }

  goBack() {
    this.router.navigate(['/app/consignacoes']);
  }

  navigateToCatalog() {
    const productId = this.detail()?.product.id;
    if (productId) {
      this.router.navigate(['/app/catalogo', productId]);
    }
  }

  callWhatsApp() {
    const whatsapp = this.detail()?.client.whatsapp;
    if (whatsapp) {
      // Placeholder - no MVP apenas mostra console
      console.log('Chamar WhatsApp:', whatsapp);
      alert(`WhatsApp: ${whatsapp}`);
    }
  }

  markAsSold() {
    const detail = this.detail();
    if (!detail || detail.consignation.status !== 'open') return;

    const salePriceStr = prompt('Valor de venda (opcional):', String(detail.product.price));
    const salePrice = salePriceStr ? parseFloat(salePriceStr) : undefined;

    if (salePriceStr !== null) { // Usuário não cancelou
      this.isProcessing.set(true);
      this.consignationsStore.markSold(detail.consignation.id, salePrice).subscribe({
        next: () => {
          this.loadDetail(detail.consignation.id);
          this.isProcessing.set(false);
          alert('Consignação marcada como vendida!');
        },
        error: (err) => {
          this.isProcessing.set(false);
          alert(err.message || 'Erro ao marcar como vendida');
        }
      });
    }
  }

  markAsReturned() {
    const detail = this.detail();
    if (!detail || detail.consignation.status !== 'open') return;

    if (confirm('Tem certeza que deseja marcar esta consignação como devolvida?')) {
      this.isProcessing.set(true);
      this.consignationsStore.markReturned(detail.consignation.id).subscribe({
        next: () => {
          this.loadDetail(detail.consignation.id);
          this.isProcessing.set(false);
          alert('Consignação marcada como devolvida!');
        },
        error: (err) => {
          this.isProcessing.set(false);
          alert(err.message || 'Erro ao marcar como devolvida');
        }
      });
    }
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  formatDate(isoDate: string): string {
    return this.dateFormatter.format(new Date(isoDate));
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      open: 'Em aberto',
      sold: 'Vendida',
      returned: 'Devolvida'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      sold: 'bg-green-100 text-green-800',
      returned: 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }
}
