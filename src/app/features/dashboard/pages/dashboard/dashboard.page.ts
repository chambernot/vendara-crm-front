// Interfaces necessárias para tipagem
interface ClientToBuy {
  id: string;
  name: string;
  score: number;
  lastContactDays: number;
  lastMessageSnippet: string;
}

interface FollowUpClient {
  id: string;
  name: string;
  reason: string;
  days: number;
}


import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';
import { SectionCardComponent } from '../../../../shared/ui/section-card/section-card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ClientsStore } from '../../../clients/data-access/clients.store';
import { Client } from '../../../clients/data-access/clients.models';
import { MessagesService, Conversation } from '../../../messages/data-access/messages.service';
import { DashboardService, StaleProductDto } from '../../../../core/services/dashboard.service';
import { FollowupsApiService } from '../../../central/data-access/followups-api.service';
import { Followup } from '../../../central/data-access/followup.models';



@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ScoreBadgeComponent,
    SectionCardComponent,
    EmptyStateComponent
  ],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage implements OnInit {
  private clientsStore = inject(ClientsStore);
  private messagesService = inject(MessagesService);
  private dashboardService = inject(DashboardService);
  private followupsApi = inject(FollowupsApiService);
  private router = inject(Router);

  // Signals for reactive data
  public clientsToBuy = signal<ClientToBuy[]>([]);
  public followUpClients = signal<FollowUpClient[]>([]);
  public staleProducts = signal<StaleProductDto[]>([]);
  public staleLoading = signal(false);
  public staleError = signal<string|null>(null);
  public staleDays = signal(30);
  public loading = signal(true);
  public loadingFollowUp = signal(true);
  
  // Armazenar todos os clientes para uso no botão WhatsApp
  private allClients = signal<Client[]>([]);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // Carregar conversas para ter os snippets
    this.messagesService.loadConversations();

    // Carregar clientes da API
    this.clientsStore.getClients().subscribe({
      next: (clients: Client[]) => {
        // Armazenar todos os clientes
        this.allClients.set(clients);
        
        const conversations = this.messagesService.conversations();
        const convMap = new Map<string, Conversation>();
        conversations.forEach((c: any) => convMap.set(c.clientId, c));

        // ------- Quem compra hoje: ranking inteligente -------
        const topClients = this.rankClientsToBuyToday(clients, convMap);
        this.clientsToBuy.set(topClients);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
      },
    });

    // Carregar follow-ups da API (hoje + atrasados)
    forkJoin({
      today: this.followupsApi.getToday(),
      overdue: this.followupsApi.getOverdue(),
    }).subscribe({
      next: ({ today, overdue }) => {
        const allFollowups = [...overdue, ...today];
        this.clientsStore.getClients().subscribe((clients: Client[]) => {
          const clientMap = new Map(clients.map(c => [c.id, c.name]));
          const followUps: FollowUpClient[] = allFollowups.slice(0, 5).map((f: any) => ({
            id: f.clientId,
            name: clientMap.get(f.clientId) || f.clientId,
            reason: f.primaryReason || (f.reasons?.[0] || 'follow-up pendente'),
            days: this.calculateDaysSince(f.dueDate),
          }));
          this.followUpClients.set(followUps);
          this.loadingFollowUp.set(false);
        });
      },
      error: (err: any) => {
        this.loadingFollowUp.set(false);
      },
    });

    // Carregar produtos parados (stale)
    this.loadStaleProducts();
  }

  public loadStaleProducts(): void {
    this.staleLoading.set(true);
    this.staleError.set(null);
    this.staleProducts.set([]);
    this.dashboardService.getStaleProducts(this.staleDays()).subscribe({
      next: (products: StaleProductDto[]) => {
        this.staleProducts.set(products);
        this.staleLoading.set(false);
      },
      error: (err: any) => {
        this.staleError.set('Erro ao carregar peças paradas.');
        this.staleLoading.set(false);
      }
    });
  }

  public onStaleDaysChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.staleDays.set(Number(value));
    this.loadStaleProducts();
  }

  public onWhatsAppCall(clientId: string): void {
    // Usar o signal allClients
    const clients = this.allClients();
    const client = clients.find((c: Client) => c.id === clientId);
    
    if (!client) {
      console.error('[Dashboard] Cliente não encontrado:', clientId);
      return;
    }
    
    if (!client.whatsapp) {
      console.warn('[Dashboard] Cliente sem WhatsApp cadastrado:', client.name);
      return;
    }
    
    // Navega para a tela de mensagens com o cliente
    this.router.navigate(['/app/mensagens', client.id]);
    
    console.log('[Dashboard] Abrindo mensagens para:', client.name);
  }

  public onSendFollowUp(clientName: string): void {
    // Implementar envio follow-up
  }

  public navigateToClient(clientId: string): void {
    this.router.navigate(['/app/clientes', clientId]);
  }

  public navigateToProduct(productId: string): void {
    this.router.navigate(['/app/catalogo', productId]);
  }

  public trackByClientId(index: number, client: ClientToBuy | FollowUpClient): string {
    return client.id;
  }

  public trackByProductId(index: number, product: StaleProductDto): string {
    return product.productId;
  }

  private calculateDaysSince(isoDate: string): number {
    if (!isoDate) return 0;
    const date = new Date(isoDate);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  private rankClientsToBuyToday(clients: Client[], convMap: Map<string, Conversation>): ClientToBuy[] {
    const now = new Date();
    
    // Filtrar apenas clientes com WhatsApp cadastrado
    const clientsWithWhatsapp = clients.filter(c => c.whatsapp);
    
    // Mapear e calcular dias desde último contato
    const rankedClients = clientsWithWhatsapp.map(c => {
      const lastContactDate = c.lastContactAt ? new Date(c.lastContactAt) : null;
      const daysSinceContact = lastContactDate 
        ? Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999; // Clientes sem contato vão para o fim
      
      return {
        id: c.id,
        name: c.name,
        score: c.score ?? 0,
        lastContactDays: daysSinceContact,
        lastMessageSnippet: convMap.get(c.id)?.lastMessage || 'Sem mensagens',
      };
    });
    
    // Ordenar por SCORE decrescente (maior score = maior probabilidade de compra)
    // Em caso de empate no score, priorizar quem tem contato mais recente
    rankedClients.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Maior score primeiro
      }
      return a.lastContactDays - b.lastContactDays; // Menor dias = mais recente
    });
    
    // Retornar apenas os TOP 5
    return rankedClients.slice(0, 5);
  }
}

