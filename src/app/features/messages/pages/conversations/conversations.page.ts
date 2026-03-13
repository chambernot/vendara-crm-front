import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessagesService, Conversation } from '../../data-access/messages.service';
import { ClientsStore } from '../../../clients/data-access/clients.store';

interface ClientItem {
  id: string;
  name: string;
  whatsapp?: string;
}

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Mensagens</h1>
            <p class="text-sm text-gray-600 mt-1">Conversas com seus clientes</p>
          </div>
          <button
            (click)="showClientPicker.set(true)"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Nova conversa
          </button>
        </div>
      </div>

      <div class="p-4 space-y-2">
        <!-- Search -->
        <div class="relative mb-4">
          <input
            type="text"
            placeholder="Buscar conversa..."
            [value]="searchTerm()"
            (input)="onSearch($event)"
            class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
          />
          <svg class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>

        <!-- Loading -->
        @if (messagesService.loadingConversations()) {
          <div class="space-y-3">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="bg-white rounded-lg shadow p-4 animate-pulse">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div class="flex-1">
                    <div class="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div class="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                  <div class="h-3 bg-gray-200 rounded w-14"></div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Error -->
        @if (messagesService.conversationsError() && !messagesService.loadingConversations()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p class="text-red-700 font-medium">{{ messagesService.conversationsError() }}</p>
            <button
              (click)="reload()"
              class="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Tentar novamente
            </button>
          </div>
        }

        <!-- Empty State -->
        @if (!messagesService.loadingConversations() && !messagesService.conversationsError() && filteredConversations().length === 0) {
          <div class="bg-white rounded-lg shadow p-8 text-center">
            <div class="text-4xl mb-3">💬</div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Sem mensagens ainda</h3>
            <p class="text-sm text-gray-600 mb-4">
              Envie uma mensagem para um cliente para iniciar uma conversa.
            </p>
            <button
              (click)="showClientPicker.set(true)"
              class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Iniciar conversa
            </button>
          </div>
        }

        <!-- Conversations List -->
        @if (!messagesService.loadingConversations() && filteredConversations().length > 0) {
          @for (conv of filteredConversations(); track conv.clientId) {
            <button
              (click)="openThread(conv.clientId)"
              [class]="'w-full rounded-lg shadow hover:shadow-md transition-all p-4 flex items-center gap-3 text-left border-2 ' + 
                (conv.unreadCount > 0 
                  ? 'bg-purple-50 border-purple-400 hover:bg-purple-100' 
                  : 'bg-white border-transparent hover:bg-gray-50')"
            >
              <!-- Avatar with Unread Indicator -->
              <div class="relative flex-shrink-0">
                <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <span class="text-purple-600 font-bold text-lg">
                    {{ getInitials(conv.clientName || conv.clientId) }}
                  </span>
                </div>
                @if (conv.unreadCount > 0) {
                  <div class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
                    <span class="text-white text-xs font-bold">{{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}</span>
                  </div>
                }
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <h3 [class]="'truncate ' + (conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-900')">
                    {{ conv.clientName || conv.clientId }}
                  </h3>
                  <span [class]="'text-xs flex-shrink-0 ml-2 ' + (conv.unreadCount > 0 ? 'text-purple-600 font-semibold' : 'text-gray-500')">
                    {{ formatDate(conv.lastMessageAt) }}
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  @if (conv.lastDirection === 'outbound') {
                    <span class="text-xs text-gray-400">Você:</span>
                  }
                  <p [class]="'text-sm truncate ' + (conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600')">
                    {{ conv.lastMessage }}
                  </p>
                </div>
                @if (conv.clientWhatsapp) {
                  <p class="text-xs text-gray-400 mt-0.5">{{ conv.clientWhatsapp }}</p>
                }
              </div>

              <!-- Badges Container -->
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                @if (conv.unreadCount > 0) {
                  <span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full min-w-[2rem]">
                    {{ conv.unreadCount }}
                  </span>
                }
                <span [class]="'inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ' + 
                  (conv.unreadCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600')">
                  {{ conv.messageCount }}
                </span>
              </div>

              <!-- Arrow -->
              <svg [class]="'w-5 h-5 flex-shrink-0 ' + (conv.unreadCount > 0 ? 'text-purple-600' : 'text-gray-400')" 
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          }
        }
      </div>

      <!-- Client Picker Overlay -->
      @if (showClientPicker()) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" (click)="closeClientPicker()">
          <div class="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col" (click)="$event.stopPropagation()">
            <!-- Picker Header -->
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900">Escolher cliente</h2>
              <button
                (click)="closeClientPicker()"
                class="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Picker Search -->
            <div class="p-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Buscar cliente..."
                [value]="clientSearchTerm()"
                (input)="onClientSearch($event)"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <!-- Loading clients -->
            @if (loadingClients()) {
              <div class="p-8 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p class="text-sm text-gray-500 mt-3">Carregando clientes...</p>
              </div>
            }

            <!-- Client List -->
            @if (!loadingClients()) {
              <div class="overflow-y-auto flex-1 p-2">
                @if (filteredClients().length === 0) {
                  <div class="py-8 text-center">
                    <p class="text-sm text-gray-500">Nenhum cliente encontrado</p>
                  </div>
                }
                @for (client of filteredClients(); track client.id) {
                  <button
                    (click)="selectClient(client)"
                    class="w-full text-left p-3 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-3"
                  >
                    <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span class="text-purple-600 font-bold text-sm">
                        {{ getInitials(client.name) }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="font-medium text-gray-900 text-sm truncate">{{ client.name }}</h4>
                      @if (client.whatsapp) {
                        <p class="text-xs text-gray-500">{{ client.whatsapp }}</p>
                      }
                    </div>
                    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ConversationsPage implements OnInit {
  messagesService = inject(MessagesService);
  private clientsStore = inject(ClientsStore);
  private router = inject(Router);

  searchTerm = signal('');
  showClientPicker = signal(false);
  clientSearchTerm = signal('');
  allClients = signal<ClientItem[]>([]);
  loadingClients = signal(false);

  filteredConversations = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const convs = this.messagesService.conversations();
    if (!term) return convs;
    return convs.filter(c =>
      c.clientName.toLowerCase().includes(term) ||
      c.clientWhatsapp.includes(term) ||
      c.lastMessage.toLowerCase().includes(term)
    );
  });

  filteredClients = computed(() => {
    const term = this.clientSearchTerm().toLowerCase().trim();
    const clients = this.allClients();
    if (!term) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.whatsapp && c.whatsapp.includes(term))
    );
  });

  ngOnInit(): void {
    this.loadingClients.set(true);
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        const items: ClientItem[] = clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          whatsapp: c.whatsapp || c.phone || '',
        }));
        this.allClients.set(items);
        this.loadingClients.set(false);
        // Carregar conversas já enriquecidas com nomes dos clientes
        this.messagesService.loadConversationsWithClients(items);
      },
      error: () => {
        this.loadingClients.set(false);
        // Sem clientes, carregar conversas sem nomes
        this.messagesService.loadConversations();
      }
    });
  }

  reload(): void {
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        const items: ClientItem[] = clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          whatsapp: c.whatsapp || c.phone || '',
        }));
        this.allClients.set(items);
        this.messagesService.loadConversationsWithClients(items);
      },
      error: () => {
        this.messagesService.loadConversations();
      }
    });
  }

  openThread(clientId: string): void {
    this.router.navigate(['/app/mensagens', clientId]);
  }

  selectClient(client: ClientItem): void {
    this.showClientPicker.set(false);
    this.clientSearchTerm.set('');
    this.router.navigate(['/app/mensagens', client.id]);
  }

  closeClientPicker(): void {
    this.showClientPicker.set(false);
    this.clientSearchTerm.set('');
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onClientSearch(event: Event): void {
    this.clientSearchTerm.set((event.target as HTMLInputElement).value);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}
