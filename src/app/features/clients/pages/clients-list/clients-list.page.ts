import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { ClientsStore } from '../../data-access/clients.store';
import { Client } from '../../data-access/clients.models';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';
import { TagsApiService, TagDefinition } from '../../../../core/tags/tags-api.service';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    EmptyStateComponent,
    ScoreBadgeComponent,
  ],
  templateUrl: './clients-list.page.html',
})
export class ClientsListPage implements OnInit {
  allClients = signal<Client[]>([]);
  allTags = signal<TagDefinition[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  filteredClients = computed(() => {
    let clients = this.allClients();

    // Filtro de busca por nome ou WhatsApp
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      clients = clients.filter((c) =>
        c.name.toLowerCase().includes(term) ||
        c.whatsapp?.toLowerCase().includes(term)
      );
    }

    return clients;
  });

  constructor(
    private store: ClientsStore,
    private tagsApi: TagsApiService,
    private router: Router
  ) {
    // Recarrega a lista quando volta da tela de detalhes
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Se voltou para /app/clientes, recarrega
        if (event.url === '/app/clientes') {
          console.log('🔄 [ClientsList] Voltou para lista, recarregando...');
          this.loadClients();
        }
      });
  }

  ngOnInit(): void {
    // Carrega tags para exibir labels
    this.tagsApi.listTagDefinitions().subscribe({
      next: (tags) => {
        this.allTags.set(tags);
        console.log('📋 [ClientsList] Tags carregadas:', tags.length);
      },
      error: (error) => {
        console.error('❌ [ClientsList] Erro ao carregar tags:', error);
      },
    });

    // Carrega clientes
    this.loadClients();
  }

  private loadClients(): void {
    this.loading.set(true);
    this.store.getClients().subscribe({
      next: (clients) => {
        this.allClients.set(clients);
        this.loading.set(false);
        console.log('✅ [ClientsList] Clientes carregados:', clients.length);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  trackById(index: number, client: Client): string {
    return client.id;
  }

  getDaysSinceLastContact(lastContactAt: string): number {
    const now = new Date();
    const lastContact = new Date(lastContactAt);
    const diffTime = Math.abs(now.getTime() - lastContact.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // Busca o label da tag pelo ID
  getTagLabel(tagId: string): string {
    const tag = this.allTags().find((t) => t.id === tagId);
    return tag?.label ?? tagId;
  }

  // Navega para tela de mensagens com o cliente
  openWhatsApp(client: Client, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Navega para a tela de mensagens com o cliente
    this.router.navigate(['/app/mensagens', client.id]);
  }

  // Formata a data da última compra
  formatLastPurchaseDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  }
}
