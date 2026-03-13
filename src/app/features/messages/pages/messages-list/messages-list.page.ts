import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageStore } from '../../data-access/message.store';
import {
  MessageStatus,
  MessageStatusLabels,
  MessageStatusColors,
  MessageDirectionLabels,
  MessageProviderLabels,
  MessageProvider,
  Message,
} from '../../data-access/message.models';
import { ClientsStore } from '../../../clients/data-access/clients.store';
import { MessageComposerComponent, MessageComposerContext } from '../../../../shared/ui/message-composer/message-composer.component';

@Component({
  selector: 'app-messages-list',
  standalone: true,
  imports: [CommonModule, MessageComposerComponent],
  templateUrl: './messages-list.page.html',
})
export class MessagesListPage implements OnInit {
  private messageStore = inject(MessageStore);
  private clientsStore = inject(ClientsStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Filters
  selectedStatus = signal<MessageStatus | 'all'>('all');
  selectedDirection = signal<'all' | 'outbound' | 'inbound'>('all');
  selectedProvider = signal<MessageProvider | 'all'>('all');
  searchTerm = signal('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  filterByClientId = signal<string>('');

  // Client cache (para busca por nome)
  private clientsCache = signal(new Map<string, string>()); // clientId -> clientName

  // Data
  allMessages = this.messageStore.messages;
  stats = computed(() => this.messageStore.getStats());

  ngOnInit(): void {
    // Carregar clientes para cache de nomes
    this.clientsStore.getClients().subscribe(clients => {
      const cache = new Map<string, string>();
      clients.forEach(c => cache.set(c.id, c.name));
      this.clientsCache.set(cache);
    });

    // Check for clientId query param
    const clientId = this.route.snapshot.queryParamMap.get('clientId');
    if (clientId) {
      this.filterByClientId.set(clientId);
    }
  }

  filteredMessages = computed(() => {
    let messages = this.allMessages();

    // Filter by client ID
    const clientId = this.filterByClientId();
    if (clientId) {
      messages = messages.filter(m => m.clientId === clientId);
    }

    // Filter by status
    const status = this.selectedStatus();
    if (status !== 'all') {
      messages = messages.filter(m => m.status === status);
    }

    // Filter by direction
    const direction = this.selectedDirection();
    if (direction !== 'all') {
      messages = messages.filter(m => m.direction === direction);
    }

    // Filter by provider
    const provider = this.selectedProvider();
    if (provider !== 'all') {
      messages = messages.filter(m => m.provider === provider);
    }

    // Filter by date range
    const start = this.startDate();
    if (start) {
      const startTime = new Date(start).getTime();
      messages = messages.filter(m => new Date(m.createdAt).getTime() >= startTime);
    }

    const end = this.endDate();
    if (end) {
      const endTime = new Date(end).setHours(23, 59, 59, 999);
      messages = messages.filter(m => new Date(m.createdAt).getTime() <= endTime);
    }

    // Filter by search term (busca por texto e nome do cliente)
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      messages = messages.filter(m => {
        const clientName = this.clientsCache().get(m.clientId)?.toLowerCase() || '';
        
        return (
          m.textPreview.toLowerCase().includes(term) ||
          m.clientId.toLowerCase().includes(term) ||
          clientName.includes(term)
        );
      });
    }

    // Sort by date descending
    return messages.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  statusOptions: Array<{ value: MessageStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'intent', label: MessageStatusLabels.intent },
    { value: 'queued', label: MessageStatusLabels.queued },
    { value: 'sent', label: MessageStatusLabels.sent },
    { value: 'delivered', label: MessageStatusLabels.delivered },
    { value: 'read', label: MessageStatusLabels.read },
    { value: 'failed', label: MessageStatusLabels.failed },
  ];

  directionOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'outbound', label: MessageDirectionLabels.outbound },
    { value: 'inbound', label: MessageDirectionLabels.inbound },
  ];

  providerOptions: Array<{ value: MessageProvider | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'meta', label: MessageProviderLabels.meta },
    { value: 'simulator', label: MessageProviderLabels.simulator },
  ];

  onStatusChange(value: MessageStatus | 'all'): void {
    this.selectedStatus.set(value);
  }

  onDirectionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDirection.set(select.value as any);
  }

  onProviderChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedProvider.set(select.value as any);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate.set(input.value);
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate.set(input.value);
  }

  clearFilters(): void {
    this.selectedStatus.set('all');
    this.selectedDirection.set('all');
    this.selectedProvider.set('all');
    this.searchTerm.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.filterByClientId.set('');
    
    // Clear URL params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  getClientName(clientId: string): string {
    return this.clientsCache().get(clientId) || clientId;
  }

  getStatusLabel(status: MessageStatus): string {
    return MessageStatusLabels[status];
  }

  getStatusClass(status: MessageStatus): string {
    return MessageStatusColors[status];
  }

  getStatusIcon(status: MessageStatus): string {
    const icons: Record<MessageStatus, string> = {
      intent: '⏳',
      queued: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '❌',
    };
    return icons[status] || '';
  }

  getDirectionLabel(direction: 'outbound' | 'inbound'): string {
    return MessageDirectionLabels[direction];
  }

  getProviderLabel(provider: MessageProvider): string {
    return MessageProviderLabels[provider];
  }

  getDirectionIcon(direction: 'outbound' | 'inbound'): string {
    return direction === 'outbound' ? '↑' : '↓';
  }

  formatDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;

    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id;
  }

  /**
   * Interpola variáveis de template no texto da mensagem.
   * Substitui variáveis do Meta WhatsApp ({{1}}, {{2}}, etc.) e outras variáveis comuns.
   */
  interpolateMessageText(text: string, clientId: string): string {
    if (!text) return text;
    
    const clientFullName = this.clientsCache().get(clientId);
    if (!clientFullName) return text;
    
    const firstName = clientFullName.split(' ')[0];
    
    let interpolated = text;
    
    // Variáveis numeradas do Meta WhatsApp ({{1}}, {{2}}, etc.)
    // Normalmente {{1}} = primeiro nome
    interpolated = interpolated.replace(/\{\{1\}\}/g, firstName);
    interpolated = interpolated.replace(/\{\{2\}\}/g, clientFullName);
    
    // Variáveis nomeadas comuns (frontend/backend)
    interpolated = interpolated.replace(/\{\{primeiro_nome\}\}/gi, firstName);
    interpolated = interpolated.replace(/\{\{nome_completo\}\}/gi, clientFullName);
    interpolated = interpolated.replace(/\{\{nome\}\}/gi, clientFullName);
    
    // Single-curly format (backend API)
    interpolated = interpolated.replace(/\{NomeCliente\}/gi, firstName);
    interpolated = interpolated.replace(/\{PrimeiroNome\}/gi, firstName);
    interpolated = interpolated.replace(/\{NomeCompleto\}/gi, clientFullName);
    interpolated = interpolated.replace(/\{Nome\}/gi, clientFullName);
    
    return interpolated;
  }

  // ===== Composer (modo livre) =====
  isComposerOpen = signal(false);
  composerContext = signal<MessageComposerContext | null>(null);

  openComposer(): void {
    this.composerContext.set({ mode: 'free' });
    this.isComposerOpen.set(true);
  }

  onComposerClosed(): void {
    this.isComposerOpen.set(false);
    this.composerContext.set(null);
  }

  onComposerSent(event: { messageId: string }): void {
    console.log('[MessagesList] Mensagem enviada:', event.messageId);
    // MessageStore will reload on next access
  }
}
