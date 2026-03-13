import { Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessagesService } from '../../data-access/messages.service';
import { ClientsStore } from '../../../clients/data-access/clients.store';
import { ToastService } from '../../../../shared/services/toast.service';
import { EventBusService } from '../../../../shared/services/event-bus.service';
import { TemplateStore } from '../../../central/data-access/template.store';
import { TemplateSuggestion, TemplateSuggestionContext } from '../../../central/data-access/templates-api.service';
import { getFirstContactMessage } from '../../../../shared/constants/whatsapp.constants';
import { FollowupsApiService } from '../../../central/data-access/followups-api.service';
import { MessageComposerComponent, MessageComposerContext } from '../../../../shared/ui/message-composer/message-composer.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-message-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageComposerComponent],
  template: `
    <div class="flex flex-col h-[calc(100vh-8rem)] bg-gray-100">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          (click)="goBack()"
          class="text-gray-600 hover:text-gray-900 p-1"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>

        <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <span class="text-purple-600 font-bold">
            {{ getInitials(clientName()) }}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-gray-900 truncate">{{ clientName() }}</h2>
          @if (clientWhatsapp()) {
            <p class="text-xs text-gray-500">{{ clientWhatsapp() }}</p>
          }
        </div>
      </div>

      <!-- Follow-up banner -->
      @if (followUpId) {
        <div class="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
          <span>📋</span>
          <span class="font-medium">Follow-up vinculado</span>
          <span class="text-blue-500">— ao enviar, o follow-up será concluído automaticamente.</span>
        </div>
      }

      <!-- 24h Window Warning Banner -->
      @if (requiresTemplate()) {
        <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 flex-1">
              <svg class="w-5 h-5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <span class="text-sm font-semibold text-orange-900">Fora da janela de 24h</span>
                <span class="text-xs text-orange-700 ml-2">Use um template aprovado</span>
              </div>
            </div>
            <button
              (click)="openComposer()"
              class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 font-medium shadow-sm flex-shrink-0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Abrir Composer
            </button>
          </div>
        </div>
      }

      <!-- Template suggestion banner -->
      @if (suggestionsLoading()) {
        <div class="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2 text-sm text-gray-500">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
          <span>Carregando sugestões de template...</span>
        </div>
      }

      @if (!suggestionsLoading() && suggestionsError()) {
        <div class="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-700">
          <span>⚠️</span>
          <span>Sugestões indisponíveis</span>
          <button
            (click)="reloadSuggestions()"
            class="ml-auto text-xs px-2 py-1 bg-yellow-200 rounded hover:bg-yellow-300 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      }

      <!-- Template suggestion banner -->
      @if (!requiresTemplate() && !suggestionsLoading() && topSuggestions().length > 0) {
        <div class="bg-green-50 border-b border-green-200 px-4 py-2">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            <span class="text-sm font-medium text-green-800">Sugestões:</span>
            <div class="flex-1 flex flex-wrap gap-1.5">
              @for (sug of topSuggestions(); track sug.templateId) {
                <button
                  (click)="selectSuggestion(sug)"
                  [class]="selectedSuggestion()?.templateId === sug.templateId
                    ? 'bg-green-200 border-green-400'
                    : 'bg-white border-green-300 hover:bg-green-100'"
                  class="border rounded-md px-2 py-1 text-xs transition-all"
                  type="button"
                >
                  <span class="font-medium text-green-900">{{ sug.templateName || sug.code }}</span>
                </button>
              }
              @if (selectedSuggestion()) {
                <button
                  (click)="clearSuggestion()"
                  class="border border-gray-300 bg-white hover:bg-gray-100 rounded-md px-2 py-1 text-xs text-gray-600 transition-all"
                  type="button"
                >
                  ✕
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- Messages area -->
      <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-3">
        <!-- Loading -->
        @if (messagesService.loadingThread()) {
          <div class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        }

        <!-- Error -->
        @if (messagesService.threadError() && !messagesService.loadingThread()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p class="text-red-700 text-sm">{{ messagesService.threadError() }}</p>
            <button
              (click)="reload()"
              class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        }

        <!-- Empty State -->
        @if (!messagesService.loadingThread() && !messagesService.threadError() && messagesService.threadMessages().length === 0) {
          <div class="text-center py-12">
            <div class="text-4xl mb-3">💬</div>
            <h3 class="text-lg font-semibold text-gray-700">Sem mensagens ainda</h3>
            <p class="text-sm text-gray-500 mt-1">Envie a primeira mensagem abaixo.</p>
          </div>
        }

        <!-- Messages (chat bubbles) -->
        @for (msg of messagesService.threadMessages(); track msg.id) {
          <div [class]="msg.direction === 'outbound' ? 'flex justify-end' : 'flex justify-start'">
            <div
              [class]="msg.direction === 'outbound'
                ? 'bg-purple-600 text-white rounded-2xl rounded-br-md max-w-[80%] px-4 py-2.5 shadow-sm'
                : 'bg-white text-gray-900 rounded-2xl rounded-bl-md max-w-[80%] px-4 py-2.5 shadow-sm border border-gray-200'"
            >
              <p class="text-sm whitespace-pre-wrap break-words">{{ interpolateMessageText(msg.textPreview) || '(sem texto)' }}</p>
              <div [class]="msg.direction === 'outbound' ? 'flex items-center justify-end gap-1.5 mt-1' : 'flex items-center gap-1.5 mt-1'">
                <span [class]="msg.direction === 'outbound' ? 'text-xs text-purple-200' : 'text-xs text-gray-400'">
                  {{ formatTime(msg.createdAt) }}
                </span>
                @if (msg.direction === 'outbound') {
                  <span class="text-xs">
                    @switch (msg.status) {
                      @case ('sent') { ✓ }
                      @case ('delivered') { ✓✓ }
                      @case ('read') { <span class="text-blue-300">✓✓</span> }
                      @case ('failed') { <span class="text-red-300">✕</span> }
                      @default { ⏳ }
                    }
                  </span>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Composer footer -->
      <div class="bg-white border-t border-gray-200 p-3">
        @if (selectedSuggestion()) {
          <div class="flex items-center gap-2 mb-2 px-1 text-xs text-green-700">
            <span class="font-medium">Template:</span>
            <span>{{ selectedSuggestion()!.templateName || selectedSuggestion()!.code }}</span>
            <span class="text-green-500">·</span>
            <span class="italic">{{ selectedSuggestion()!.reason }}</span>
            <span class="text-orange-600 ml-auto">(não editável)</span>
          </div>
        }
        
        <div class="flex items-end gap-2">
          <textarea
            #composerInput
            [(ngModel)]="messageText"
            placeholder="Digite uma mensagem..."
            rows="1"
            class="flex-1 px-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
            [class.bg-gray-100]="!!selectedSuggestion()"
            [class.cursor-not-allowed]="!!selectedSuggestion()"
            (keydown.enter)="onEnterPress($event)"
            (input)="autoGrow($event)"
            [disabled]="sending() || !!selectedSuggestion()"
            style="max-height: 120px; min-height: 40px;"
          ></textarea>
          <button
            (click)="sendMessage()"
            [disabled]="sending() || !messageText.trim() || (requiresTemplate() && !selectedSuggestion())"
            class="p-2.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            [title]="
              selectedSuggestion() ? 'Enviar template' :
              requiresTemplate() && !selectedSuggestion() ? 'Selecione um template aprovado para enviar' : 
              'Enviar mensagem'
            "
          >
            @if (sending()) {
              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            }
          </button>
        </div>
      </div>
    </div>

    <!-- Message Composer Modal -->
    <app-message-composer
      [isOpen]="isComposerOpen()"
      [context]="composerContext()"
      (closed)="onComposerClosed()"
      (sent)="onComposerSent($event)"
    ></app-message-composer>
  `,
})
export class MessageThreadPage implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('composerInput') private composerInput!: ElementRef;

  messagesService = inject(MessagesService);
  private clientsStore = inject(ClientsStore);
  private toastService = inject(ToastService);
  private eventBus = inject(EventBusService);
  private templateStore = inject(TemplateStore);
  private followupsApi = inject(FollowupsApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  clientId = '';
  /** followUpId vindo da Central via query param */
  followUpId: string | null = null;

  /** Contexto de sugestão de template (query param) */
  suggestionContext: TemplateSuggestionContext | null = null;

  clientName = signal('');
  clientWhatsapp = signal('');
  clientLastContactAt = signal<string | null>(null);
  clientLastInboundAt = signal<string | null>(null);
  messageText = '';
  sending = signal(false);

  // Template suggestion state
  selectedSuggestion = signal<TemplateSuggestion | null>(null);
  suggestionsLoading = signal(false);
  suggestionsError = signal(false);
  topSuggestions = signal<TemplateSuggestion[]>([]);

  // Composer state
  isComposerOpen = signal(false);
  composerContext = signal<MessageComposerContext | null>(null);

  // 24h window compliance - WhatsApp Business policy
  // Only counts INBOUND messages (received from customer)
  requiresTemplate = computed(() => {
    const lastInbound = this.clientLastInboundAt();
    
    // No inbound message history = requires template to start conversation
    if (!lastInbound) {
      console.log('[MessageThread] No inbound history - requires template');
      return true;
    }
    
    const hoursSinceLastInbound = (Date.now() - new Date(lastInbound).getTime()) / (1000 * 60 * 60);
    const requires = hoursSinceLastInbound > 24;
    
    console.log('[MessageThread] Hours since last inbound:', hoursSinceLastInbound.toFixed(2), '- requires template:', requires);
    
    return requires;
  });

  approvedTemplates = computed(() => {
    const approved = this.templateStore.approvedTemplates();
    return approved.map(t => ({
      id: t.id,
      title: t.title,
      body: t.body,
      preview: t.body.substring(0, 100) + (t.body.length > 100 ? '...' : ''),
    }));
  });

  private shouldScrollToBottom = false;
  private previousMessageCount = 0;
  private pollingInterval: any = null;

  constructor() {
    // Auto-update lastInboundAt when new messages arrive (real-time)
    effect(() => {
      const messages = this.messagesService.threadMessages();
      
      // Find most recent inbound message
      const inboundMessages = messages.filter(m => m.direction === 'inbound');
      
      if (inboundMessages.length === 0) {
        console.log('[MessageThread] Nenhuma mensagem inbound no histórico');
        return;
      }
      
      // Get most recent (sort by createdAt desc)
      const mostRecent = inboundMessages.reduce((latest, current) => {
        return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
      });
      
      const newLastInbound = mostRecent.createdAt;
      
      // Only update if changed to avoid infinite loops
      if (this.clientLastInboundAt() !== newLastInbound) {
        console.log('[MessageThread] Atualizando lastInboundAt:', newLastInbound, 'Mensagem:', mostRecent.textPreview?.substring(0, 50));
        this.clientLastInboundAt.set(newLastInbound);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('clientId') || '';
    if (!this.clientId) {
      this.router.navigate(['/app/mensagens']);
      return;
    }

    // Ler followUpId e context da query string
    this.followUpId = this.route.snapshot.queryParamMap.get('followupId') || null;
    const contextParam = this.route.snapshot.queryParamMap.get('context') as TemplateSuggestionContext | null;
    this.suggestionContext = contextParam;

    if (this.followUpId) {
      console.log('[MessageThread] followUpId recebido da Central:', this.followUpId);
    }
    if (this.suggestionContext) {
      console.log('[MessageThread] suggestionContext recebido:', this.suggestionContext);
    }

    // Load thread
    this.messagesService.loadThread(this.clientId);

    // Load client info
    this.clientsStore.getClients().subscribe(clients => {
      const client = clients.find(c => c.id === this.clientId);
      if (client) {
        this.clientName.set(client.name);
        this.clientWhatsapp.set(client.whatsapp || '');
        this.clientLastContactAt.set(client.lastContactAt || null);
        this.clientLastInboundAt.set(client.lastInboundAt || null);
        
        console.log('[MessageThread] Cliente carregado:', {
          name: client.name,
          lastContactAt: client.lastContactAt,
          lastInboundAt: client.lastInboundAt,
          lastOutboundAt: client.lastOutboundAt,
          requiresTemplate: this.requiresTemplate()
        });
      } else {
        this.clientName.set(this.clientId);
      }
    });

    // Load template suggestions only when context is provided (coming from Central)
    if (this.suggestionContext || this.followUpId) {
      this.loadTemplateSuggestions();
    }

    // Start polling for new messages every 3 seconds
    this.startMessagePolling();

    this.shouldScrollToBottom = true;
  }

  ngAfterViewChecked(): void {
    const currentCount = this.messagesService.threadMessages().length;
    if (currentCount !== this.previousMessageCount) {
      this.previousMessageCount = currentCount;
      this.scrollToBottom();
    }
  }

  /** Se veio da Central com followupId, emitir refresh ao destruir */
  ngOnDestroy(): void {
    this.stopMessagePolling();
    this.messagesService.clearThread();
    this.templateStore.clearSuggestions();
    // Emitir refresh para a Central recarregar ao voltar
    this.eventBus.emit('followUpUpdated');
  }

  // ---------------------------------------------------------------------------
  // Message Polling (Real-time updates)
  // ---------------------------------------------------------------------------

  /**
   * Inicia polling para buscar novas mensagens a cada 3 segundos.
   * Essencial para ver respostas do cliente em tempo real.
   */
  private startMessagePolling(): void {
    // Clear any existing interval
    this.stopMessagePolling();

    // Poll every 3 seconds
    this.pollingInterval = setInterval(() => {
      if (this.clientId && !this.messagesService.loadingThread()) {
        this.messagesService.refreshThread(this.clientId);
      }
    }, 3000);

    console.log('[MessageThread] Polling iniciado - atualizações a cada 3s');
  }

  /**
   * Para o polling de mensagens.
   */
  private stopMessagePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[MessageThread] Polling parado');
    }
  }

  // ---------------------------------------------------------------------------
  // Template Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Carrega sugestões de template da API.
   * Determina o contexto: query param > followupId inferido > NEEDS_REPLY default.
   */
  private loadTemplateSuggestions(): void {
    // Validar clientId
    if (!this.clientId) {
      console.warn('[MessageThread] clientId não disponível, não pode carregar sugestões');
      this.suggestionsLoading.set(false);
      return;
    }

    // Determinar contexto
    let context: TemplateSuggestionContext = this.suggestionContext || 'NEEDS_REPLY';

    // Se tiver followUpId mas sem context, inferir
    if (!this.suggestionContext && this.followUpId) {
      context = 'NO_RESPONSE_48H';
    }

    console.log('[MessageThread] Carregando sugestões de template para clientId:', this.clientId, 'context:', context);

    this.suggestionsLoading.set(true);
    this.suggestionsError.set(false);

    // Carregar sugestões da API
    this.templateStore.loadSuggestions(this.clientId, context);

    // Poll até sugestões carregarem
    let pollAttempts = 0;
    const maxPollAttempts = 50; // 5 segundos total
    const checkInterval = setInterval(() => {
      pollAttempts++;
      
      if (!this.templateStore.suggestionsLoading() || pollAttempts >= maxPollAttempts) {
        clearInterval(checkInterval);
        this.suggestionsLoading.set(false);

        const suggestions = this.templateStore.suggestions();
        console.log('[MessageThread] Sugestões carregadas (já filtradas para aprovadas):', suggestions.length, suggestions);

        if (suggestions.length > 0) {
          // Top 3 (already filtered for approved templates in TemplateStore)
          this.topSuggestions.set(suggestions.slice(0, 3));

          // Auto-selecionar top 1
          const top = suggestions[0];
          this.selectedSuggestion.set(top);

          // Preencher texto com previewBody ou buscar body do template
          this.applySelectedSuggestionText(top);

          console.log('[MessageThread] ✅ Auto-selecionado top1 (aprovado):', {
            templateName: top.templateName,
            score: top.score,
            reason: top.reason,
            templateId: top.templateId
          });
        } else {
          this.topSuggestions.set([]);
          console.log('[MessageThread] Nenhuma sugestão aprovada disponível');
        }
      }
    }, 100);

    // Safety timeout — 5s
    setTimeout(() => {
      clearInterval(checkInterval);
      if (this.suggestionsLoading()) {
        console.warn('[MessageThread] Timeout carregando sugestões após 5s');
        this.suggestionsLoading.set(false);
      }
    }, 5000);
  }

  /**
   * Cria sugestões de fallback a partir dos templates locais
   */
  /**
   * Recarrega sugestões (botão "Tentar novamente").
   */
  reloadSuggestions(): void {
    this.topSuggestions.set([]);
    this.selectedSuggestion.set(null);
    this.suggestionsError.set(false);
    this.loadTemplateSuggestions();
  }

  /**
   * Seleciona uma sugestão e preenche o editor.
   */
  selectSuggestion(sug: TemplateSuggestion): void {
    this.selectedSuggestion.set(sug);
    this.applySelectedSuggestionText(sug);
  }

  /**
   * Seleciona um template aprovado (da lista de 24h).
   */
  selectApprovedTemplate(template: { id: string; title: string; body: string; preview: string }): void {
    // Criar um objeto TemplateSuggestion fake para reutilizar a lógica
    const fakeSuggestion: TemplateSuggestion = {
      templateId: template.id,
      templateName: template.title,
      code: template.id,
      reason: 'Template aprovado selecionado manualmente',
      score: 100,
      previewBody: template.body,
    };
    
    this.selectedSuggestion.set(fakeSuggestion);
    this.applySelectedSuggestionText(fakeSuggestion);
  }

  /**
   * Limpa a sugestão selecionada.
   */
  clearSuggestion(): void {
    this.selectedSuggestion.set(null);
    this.messageText = '';
  }

  /**
   * Abre o composer para selecionar template (quando fora da janela de 24h).
   */
  openComposer(): void {
    console.log('[MessageThread] Abrindo composer para cliente:', this.clientId);
    
    const context: MessageComposerContext = {
      mode: 'client',
      clientId: this.clientId,
      followUpId: this.followUpId || undefined,
      suggestionContext: this.suggestionContext || 'GENERAL',
    };
    
    this.composerContext.set(context);
    this.isComposerOpen.set(true);
  }

  /**
   * Fecha o composer.
   */
  onComposerClosed(): void {
    console.log('[MessageThread] Composer fechado');
    this.isComposerOpen.set(false);
    this.composerContext.set(null);
  }

  /**
   * Reage ao envio de mensagem pelo composer.
   */
  onComposerSent(event: { messageId: string }): void {
    console.log('[MessageThread] Mensagem enviada via composer:', event.messageId);
    
    // Fechar o composer
    this.onComposerClosed();
    
    // Recarregar mensagens para mostrar a nova mensagem
    this.messagesService.loadThread(this.clientId);
    this.shouldScrollToBottom = true;
    
    // Mostrar toast de sucesso
    this.toastService.showSuccess('Mensagem enviada com sucesso!');
  }

  /**
   * Aplica o texto da sugestão no editor, interpolando variáveis do cliente.
   */
  private applySelectedSuggestionText(sug: TemplateSuggestion): void {
    let text = sug.previewBody || '';

    // Se previewBody estiver vazio, tentar buscar do template store
    if (!text) {
      const template = this.templateStore.getById(sug.templateId);
      if (template) {
        text = template.body;
      } else {
        console.warn('[MessageThread] Template não encontrado no store:', sug.templateId);
        // Fallback: usar o próprio templateName como texto se nada mais funcionar
        text = sug.templateName || 'Template não disponível';
      }
    }

    console.log('[MessageThread] Aplicando texto do template:', text.substring(0, 50) + '...');

    // Interpolar variáveis do cliente
    const name = this.clientName();
    if (name) {
      const firstName = name.split(' ')[0];
      // Double-curly format (frontend seed)
      text = text.replace(/\{\{primeiro_nome\}\}/g, firstName);
      text = text.replace(/\{\{nome_completo\}\}/g, name);
      text = text.replace(/\{\{nome\}\}/g, name);
      // Single-curly format (backend API)
      text = text.replace(/\{NomeCliente\}/gi, firstName);
      text = text.replace(/\{PrimeiroNome\}/gi, firstName);
      text = text.replace(/\{NomeCompleto\}/gi, name);
      text = text.replace(/\{Nome\}/gi, name);
    }
    // Limpar placeholders restantes (ambos formatos)
    text = text.replace(/\{\{\w+\}\}/g, '');
    text = text.replace(/\{\w+\}/g, '');

    this.messageText = text;
    console.log('[MessageThread] messageText definido:', this.messageText.length, 'caracteres');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  goBack(): void {
    // Se veio da Central (tinha followupId), volta para Central
    const cameFromCentral = this.route.snapshot.queryParamMap.has('followupId') ||
                            this.route.snapshot.queryParamMap.has('context');
    if (cameFromCentral) {
      this.router.navigate(['/app/central']);
    } else {
      this.router.navigate(['/app/mensagens']);
    }
  }

  reload(): void {
    this.messagesService.loadThread(this.clientId);
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text) return;

    this.sending.set(true);

    // Montar templateId se sugestão selecionada
    const templateId = this.selectedSuggestion()?.templateId ?? undefined;
    const templateName = this.selectedSuggestion()?.templateName ?? 'Sem template';

    // Adicionar mensagem de apresentação se for primeiro contato
    let finalText = text;
    const isFirstContact = !this.clientLastContactAt();
    
    if (isFirstContact && !templateId) {
      const clientNameValue = this.clientName();
      const welcomeMsg = getFirstContactMessage(clientNameValue);
      finalText = `${welcomeMsg}\n\n---\n\n${text}`;
      console.log('[MessageThread] 🎉 Primeiro contato! Adicionando mensagem de apresentação da Vendara');
    }

    console.log('[MessageThread] 📤 Enviando mensagem:', {
      clientId: this.clientId,
      followUpId: this.followUpId,
      templateId,
      templateName,
      textLength: finalText.length
    });

    // Passar followUpId e templateId para que o backend grave no payload
    this.messagesService.sendMessage(this.clientId, finalText, this.followUpId ?? undefined, templateId).subscribe({
      next: (msg) => {
        this.messageText = '';
        this.sending.set(false);

        if (this.followUpId) {
          this.toastService.showSuccess('Mensagem enviada! Follow-up concluído ✅');
          console.log('[MessageThread] ✅ Mensagem enviada com followUpId:', this.followUpId);
          console.log('[MessageThread] 📡 Emitindo evento followUpUpdated...');
          
          // Notificar a Central para recarregar follow-ups
          this.eventBus.emit('followUpUpdated');
          
          // Limpar followUpId após uso (um envio por follow-up)
          this.followUpId = null;
        } else {
          this.toastService.showSuccess('Mensagem enviada!');
          
          // Auto-completar followups em aberto (quando não há followUpId explícito)
          this.autoCompleteOpenFollowups(this.clientId);
        }

        // Service already does local insert + refetch
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        this.sending.set(false);
        this.toastService.showError(err?.message || 'Erro ao enviar mensagem');
      }
    });
  }

  onEnterPress(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  autoGrow(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  /**
   * Auto-completa followups em aberto para o cliente atual
   * quando uma mensagem é enviada (mesmo que não seja pela Central)
   */
  private autoCompleteOpenFollowups(clientId: string): void {
    console.log('[MessageThread] 🔍 Iniciando auto-completar followups...');
    console.log('[MessageThread] 🔍 ClientId:', clientId);
    console.log('[MessageThread] 🔍 Chamando followupsApi.list()...');
    
    // Buscar todos os followups e filtrar pelos em aberto do cliente
    this.followupsApi.list().pipe(
      catchError(error => {
        console.error('[MessageThread] ❌ ERRO ao buscar followups:', error);
        console.error('[MessageThread] ❌ Error details:', JSON.stringify(error, null, 2));
        return of([]);
      })
    ).subscribe(followups => {
      console.log('[MessageThread] 📥 Followups recebidos da API:', followups.length);
      console.log('[MessageThread] 📥 Followups completos:', JSON.stringify(followups, null, 2));
      
      const openFollowups = followups.filter(f => 
        f.clientId === clientId && 
        (f.status === 'open' || f.status === 'scheduled')
      );
      
      console.log('[MessageThread] 📋 Followups do cliente atual:', followups.filter(f => f.clientId === clientId));
      console.log('[MessageThread] 📋 Followups em aberto encontrados:', openFollowups.length);
      console.log('[MessageThread] 📋 IDs dos followups em aberto:', openFollowups.map(f => f.id));
      
      if (openFollowups.length === 0) {
        console.log('[MessageThread] ℹ️ Nenhum followup em aberto para concluir.');
        return;
      }
      
      // Completar todos os followups em aberto
      console.log('[MessageThread] 🚀 Iniciando conclusão de', openFollowups.length, 'followup(s)...');
      const completeRequests = openFollowups.map(f => {
        console.log('[MessageThread] 📤 Completando followup ID:', f.id);
        return this.followupsApi.complete(f.id, 'Respondido via mensagens').pipe(
          catchError(error => {
            console.error('[MessageThread] ❌ Erro ao completar followup:', f.id, error);
            console.error('[MessageThread] ❌ Error details:', JSON.stringify(error, null, 2));
            return of(null);
          })
        );
      });
      
      forkJoin(completeRequests).subscribe(results => {
        const completed = results.filter(r => r !== null).length;
        console.log('[MessageThread] ✅ Followups completados automaticamente:', completed, 'de', results.length);
        
        if (completed > 0) {
          console.log('[MessageThread] 📡 Emitindo evento followUpUpdated...');
          // Notificar a Central para atualizar a lista
          this.eventBus.emit('followUpUpdated');
          
          // Feedback visual
          this.toastService.showSuccess(`${completed} follow-up(s) concluído(s) automaticamente!`);
        } else {
          console.warn('[MessageThread] ⚠️ Nenhum followup foi completado com sucesso.');
        }
      });
    });
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

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Ontem ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Interpola variáveis de template no texto da mensagem.
   * Substitui variáveis do Meta WhatsApp ({{1}}, {{2}}, etc.) e outras variáveis comuns.
   */
  interpolateMessageText(text: string): string {
    if (!text) return text;
    
    const clientFullName = this.clientName();
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

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      // ignore
    }
  }
}
