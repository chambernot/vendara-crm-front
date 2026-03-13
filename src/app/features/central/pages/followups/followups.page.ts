import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CentralService } from '../../data-access/central.service';
import { CentralStore } from '../../data-access/central.store';
import { FollowupItemVm, FOLLOWUP_REASON_LABELS, FollowupReason } from '../../data-access/central.models';
import { FollowupStore } from '../../data-access/followup.store';
import { FollowupQueueService } from '../../data-access/followup-queue.service';
import { FollowupsApiService } from '../../data-access/followups-api.service';
import { FollowUpsService } from '../../data-access/followups.service';
import { Followup } from '../../data-access/followup.models';
import { TemplateStore } from '../../data-access/template.store';
import { MessageTemplate } from '../../data-access/template.models';
import { TemplateSuggestionContext } from '../../data-access/templates-api.service';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ClientQuickCreateModalComponent } from '../../../../shared/ui/client-quick-create-modal/client-quick-create-modal.component';
import { MessageComposerComponent, MessageComposerContext } from '../../../../shared/ui/message-composer/message-composer.component';
import { TelemetryService } from '../../../../core/telemetry';
import { Client, ClientsStore } from '../../../clients/data-access';
import { MessageStore } from '../../../messages/data-access/message.store';
import { MessagesService } from '../../../messages/data-access/messages.service';
import { MessagesApiService } from '../../../messages/data-access/messages-api.service';
import { AiSuggestion, AiClientAnalysis, AiEngineService, AiContextSignal } from '../../../../core/ai';
import { ScheduledMessageStore } from '../../../messages/data-access/scheduled-message.store';

import { FollowUpsJobService } from '../../data-access/followups-job.service';
import { environment } from '../../../../../environments/environment';
import { WorkspaceService } from '../../../../core/workspace';
import { ToastService } from '../../../../shared/services/toast.service';
import { EventBusService } from '../../../../shared/services/event-bus.service';

type FollowupTab = 'today' | 'overdue' | 'completed' | 'scheduled';

interface FollowupWithStatus extends FollowupItemVm {
  justCopied?: boolean;
  sending?: boolean;
  lastMessageId?: string;
  sendError?: string;
}

interface SelectedClient {
  id: string;
  name: string;
  whatsapp?: string;
}

@Component({
  selector: 'app-followups',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ScoreBadgeComponent,
    EmptyStateComponent,
    ClientQuickCreateModalComponent,
    MessageComposerComponent,
  ],
  templateUrl: './followups.page.html',
})
export class FollowupsPage implements OnInit, OnDestroy {
  private centralService = inject(CentralService);
  private centralStore = inject(CentralStore);
  private aiEngine = inject(AiEngineService);
  private telemetryService = inject(TelemetryService);
  private messagesApi = inject(MessagesApiService);
  private clientsStore = inject(ClientsStore);
  private messageStore = inject(MessageStore);
  private messagesService = inject(MessagesService);
  private templateStore = inject(TemplateStore);
  private followupStore = inject(FollowupStore);
  private followupQueueService = inject(FollowupQueueService);
  private followupsApiService = inject(FollowupsApiService);
  private followUpsService = inject(FollowUpsService);
  private workspaceService = inject(WorkspaceService);
  private scheduledMessageStore = inject(ScheduledMessageStore);

  private followUpsJobService = inject(FollowUpsJobService);
  private toastService = inject(ToastService);
  private eventBus = inject(EventBusService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Abas
  activeTab = signal<FollowupTab>('today');
  
  // Followups originais
  followups: FollowupWithStatus[] = [];
  loading = true;
  loadError = signal<string | null>(null);
  reasonLabels = FOLLOWUP_REASON_LABELS;
  showSuccessMessage = false;
  createdClientName = '';

  // Generating state
  generatingFollowups = signal(false);

  // Resultado da última geração (para dicas no empty state)
  lastGenerateResult = signal<{ createdCount: number; skippedCount: number; reasons: string[] } | null>(null);

  // Stats - baseados nos dados carregados da API
  followupStats = computed(() => ({
    today: this.todayFollowups().length,
    overdue: this.overdueFollowups().length,
    scheduled: this.scheduledFollowups().length,
    completed: this.completedFollowupsToday().length, // Apenas concluídos do dia
  }));
  scheduledStats = computed(() => this.scheduledMessageStore.getStats());

  // Scheduled messages
  scheduledMessages = this.scheduledMessageStore.activeScheduled;
  readyMessages = this.scheduledMessageStore.readyToSend;

  // Followups por aba
  todayFollowups = signal<FollowupItemVm[]>([]);
  overdueFollowups = signal<FollowupItemVm[]>([]);
  scheduledFollowups = signal<FollowupItemVm[]>([]);
  completedFollowups = signal<FollowupItemVm[]>([]);

  // Computed para followups concluídos do dia
  completedFollowupsToday = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.completedFollowups().filter(followup => {
      if (!followup.completedAt) return false; // Não mostrar se não tiver data de conclusão
      
      const completedDate = new Date(followup.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      
      return completedDate >= today && completedDate < tomorrow;
    });
  });

  // Computed para followups ordenados por priority score
  sortedTodayFollowups = computed(() => {
    return [...this.todayFollowups()].sort((a, b) => 
      (b.suggestion?.followupPriorityScore || 0) - (a.suggestion?.followupPriorityScore || 0)
    );
  });

  sortedOverdueFollowups = computed(() => {
    return [...this.overdueFollowups()].sort((a, b) => 
      (b.suggestion?.followupPriorityScore || 0) - (a.suggestion?.followupPriorityScore || 0)
    );
  });

  sortedScheduledFollowups = computed(() => {
    return [...this.scheduledFollowups()].sort((a, b) => 
      (b.suggestion?.followupPriorityScore || 0) - (a.suggestion?.followupPriorityScore || 0)
    );
  });

  // Explicabilidade da IA
  showExplanation = signal(false);
  selectedSuggestion = signal<AiSuggestion | null>(null);

  // Cliente alvo
  allClients = signal<Client[]>([]);
  clientSearchTerm = signal('');
  selectedClient = signal<SelectedClient | null>(null);
  selectedClientFullData = signal<Client | null>(null); // Dados completos para IA
  clientAiAnalysis = signal<AiClientAnalysis | null>(null); // Análise da IA
  isModalOpen = signal(false);
  successMessageText = signal('');

  // Enviar mensagem
  templates = signal<MessageTemplate[]>([]);
  selectedTemplateId = signal('');
  messagePreview = signal('');
  justCopiedMessage = signal(false);
  sendingMessage = signal(false);
  sendError = signal('');

  // Message Composer
  isComposerOpen = signal(false);
  composerContext = signal<MessageComposerContext | null>(null);
  pendingScheduledMessageId = signal<string | null>(null); // ID da mensagem agendada sendo enviada



  // Reagendar followup
  rescheduleFollowupId = signal<string | null>(null);
  rescheduleDate = ''; // Propriedade normal para ngModel
  isRescheduleModalOpen = signal(false);

  // Computed
  filteredClients = computed(() => {
    const term = this.clientSearchTerm().toLowerCase().trim();
    if (!term) return [];
    
    return this.allClients()
      .filter(c => c.name.toLowerCase().includes(term))
      .slice(0, 6);
  });

  // Environment (para mostrar botão de teste apenas em dev)
  isDevMode = !environment.production;

  private followUpSub?: Subscription;
  private routerSub?: Subscription;

  ngOnInit(): void {
    // ========== VERIFICAÇÃO CRÍTICA DE WORKSPACE ==========
    console.log('🔍 [FOLLOWUPS PAGE] ngOnInit iniciado');
    
    // CRITICAL: Verificar se workspace está disponível ANTES de fazer qualquer chamada API
    const workspaceId = this.workspaceService.getCurrentWorkspaceId();
    console.log('🔍 [FOLLOWUPS PAGE] currentWorkspaceId:', workspaceId);
    
    if (!workspaceId) {
      console.error('❌ [FOLLOWUPS PAGE] NENHUM WORKSPACE ATIVO! Redirecionando...');
      
      // Redirecionar para seleção de workspace
      this.router.navigate(['/workspace/select']);
      return;
    }
    
    console.log('✅ [FOLLOWUPS PAGE] Workspace ativo confirmado:', workspaceId);
    console.log('======================================================');
    
    // Verificar se há query param de cliente criado
    this.route.queryParams.subscribe(params => {
      if (params['createdClientId']) {
        this.showSuccessMessage = true;
        this.createdClientName = 'Cliente';
        
        // Limpar query param após processar
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });

        // Esconder mensagem após 5 segundos
        setTimeout(() => {
          this.showSuccessMessage = false;
        }, 5000);
      }
    });

    // CRITICAL: Carregar dados SEM delay - workspace já deve estar disponível
    console.log('🔄 [FOLLOWUPS PAGE] Iniciando carregamento de dados...');
    
    // Carregar dados da API
    this.loadFollowups();
    this.loadClients();
    this.loadTemplates();
    
    // Gerar followups automaticamente após carregar a página
    // Delay de 2 segundos para garantir que clientes foram carregados
    setTimeout(() => {
      console.log('🔄 [FOLLOWUPS PAGE] Verificando e gerando followups automaticamente...');
      this.generateFollowups();
    }, 2000);
    
    // Restaurar cliente selecionado do store (persiste por workspace)
    this.restoreSelectedClient();

    // Escutar evento global de follow-up atualizado (ex: mensagem enviada pelo Composer)
    this.followUpSub = this.eventBus.on('followUpUpdated').subscribe(() => {
      console.log('[Central] ✅ followUpUpdated recebido — recarregando follow-ups após delay de 2s');
      // Delay maior para garantir que o backend processou
      setTimeout(() => {
        console.log('[Central] 🔄 Executando reload de follow-ups...');
        this.loadFollowups();
      }, 2000);
    });
    
    // Escutar navegação para recarregar quando voltar para esta página
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/app/central') {
        console.log('[Central] Página reativada via navegação — recarregando follow-ups');
        // Delay pequeno para garantir que componente está totalmente montado
        setTimeout(() => this.loadFollowups(), 100);
      }
    });
    
    // Log telemetry on page open
    try {
      this.telemetryService.log('central_open');
    } catch {
      // Silent fail
    }
  }

  ngOnDestroy(): void {
    this.followUpSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  // Gerenciamento de abas
  setActiveTab(tab: FollowupTab): void {
    this.activeTab.set(tab);
  }

  // Explicabilidade da IA
  showAiExplanation(suggestion: AiSuggestion): void {
    this.selectedSuggestion.set(suggestion);
    this.showExplanation.set(true);
  }

  closeExplanation(): void {
    this.showExplanation.set(false);
    this.selectedSuggestion.set(null);
  }

  // Gerenciamento de followups
  completeFollowup(followupId: string): void {
    // Usar API
    this.followupsApiService.complete(followupId).subscribe({
      next: () => {
        this.successMessageText.set('✅ Follow-up concluído com sucesso!');
        setTimeout(() => this.successMessageText.set(''), 3000);
        this.loadFollowups();
        
        // Log telemetry
        try {
          this.telemetryService.log('central_open');
        } catch {
          // Silent fail
        }
      },
      error: (error) => {
        console.error('[FollowupsPage] ❌ Erro ao concluir follow-up:', error);
        console.error('[FollowupsPage] ❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        
        // Mensagem de erro mais detalhada
        const errorMsg = error.error?.message || error.message || 'Erro desconhecido';
        alert(`Erro ao concluir follow-up: ${errorMsg}`);
      }
    });
  }

  /**
   * Reagenda followup para nova data
   */
  rescheduleFollowup(followupId: string, newDate?: string): void {
    console.log('[Followups] 🔄 rescheduleFollowup chamado:', { followupId, newDate });
    
    // Se foi passada data diretamente (por exemplo, do modal), usar essa data
    if (newDate) {
      this.confirmReschedule(followupId, newDate);
      return;
    }

    // Caso contrário, abrir modal para seleção de data
    this.rescheduleFollowupId.set(followupId);
    this.isRescheduleModalOpen.set(true);
    
    console.log('[Followups] 📅 Modal de reagendamento aberto para followup:', followupId);
    
    // Definir data padrão como amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.rescheduleDate = tomorrow.toISOString().split('T')[0];
    console.log('[Followups] 📅 Data padrão definida:', this.rescheduleDate);
  }

  /**
   * Confirma o reagendamento com a data selecionada
   */
  confirmReschedule(followupId: string, dateStr: string): void {
    console.log('[Followups] confirmReschedule chamado:', { followupId, dateStr, type: typeof dateStr });
    
    // Validar formato
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error('[Followups] Formato de data inválido:', dateStr);
      alert('Formato de data inválido. Use YYYY-MM-DD (ex: 2026-01-20)');
      return;
    }

    // Validar que a data é futura
    const selectedDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('[Followups] Comparação de datas:', {
      selectedDate: selectedDate.toISOString(),
      today: today.toISOString(),
      selectedTime: selectedDate.getTime(),
      todayTime: today.getTime(),
      isFuture: selectedDate.getTime() > today.getTime()
    });
    
    if (selectedDate.getTime() <= today.getTime()) {
      alert('⚠️ Selecione uma data futura para reagendar.');
      return;
    }

    console.log('[Followups] Enviando reschedule com payload:', { newDueDate: dateStr });

    // Usar API
    this.followupsApiService.reschedule(followupId, { newDueDate: dateStr }).subscribe({
      next: (updatedFollowup) => {
        console.log('[Followups] ✅✅✅ FOLLOWUP REAGENDADO COM SUCESSO ✅✅✅');
        console.log('[Followups] 📋 Dados do followup após reagendamento:', {
          id: updatedFollowup.id,
          status: updatedFollowup.status,
          bucket: updatedFollowup.bucket,
          dueDate: updatedFollowup.dueDate,
          completedAt: updatedFollowup.completedAt
        });
        
        this.successMessageText.set('📅 Follow-up reagendado com sucesso!');
        setTimeout(() => this.successMessageText.set(''), 3000);
        
        // Delay maior para garantir que o backend recalculou o bucket
        setTimeout(() => {
          console.log('[Followups] 🔄 Recarregando followups após reagendamento...');
          this.loadFollowups();
        }, 1000);
        
        this.closeRescheduleModal();
        
        // Log telemetry
        try {
          this.telemetryService.log('central_open'); // Usar evento existente
        } catch {
          // Silent fail
        }
      },
      error: (error) => {
        console.error('Error rescheduling followup:', error);
        const errorMsg = error?.error?.message || error?.message || 'Erro ao reagendar follow-up';
        alert(`Erro ao reagendar: ${errorMsg}`);
        this.closeRescheduleModal();
      }
    });
  }

  /**
   * Fecha o modal de reagendamento
   */
  closeRescheduleModal(): void {
    this.isRescheduleModalOpen.set(false);
    this.rescheduleFollowupId.set(null);
    this.rescheduleDate = '';
  }

  /**
   * Confirma o reagendamento a partir do modal
   */
  onRescheduleConfirm(): void {
    const followupId = this.rescheduleFollowupId();
    const dateStr = this.rescheduleDate; // Propriedade normal, não precisa de ()
    
    console.log('[Followups] ✅ onRescheduleConfirm - Botão confirmar clicado:', { followupId, dateStr });
    
    if (!followupId || !dateStr) {
      console.warn('[Followups] ⚠️ Faltam dados para confirmar:', { followupId, dateStr });
      return;
    }
    
    this.confirmReschedule(followupId, dateStr);
  }

  /**
   * Retorna a data mínima para o calendário (amanhã)
   */
  getMinDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  snoozeFollowup(followupId: string, days: number): void {
    const until = new Date();
    until.setDate(until.getDate() + days);
    this.followupStore.snooze(followupId, until.toISOString());
    this.loadFollowups();
  }

  /**
   * Abre composer com template recomendado
   */
  sendNowWithRecommendedTemplate(followup: FollowupItemVm): void {
    const suggestionContext = this.deriveSuggestionContext(followup);

    // Navegar para thread de mensagens com contexto para sugestão de template
    const queryParams: Record<string, string> = {
      context: suggestionContext,
    };
    if (followup.followupId) {
      queryParams['followupId'] = followup.followupId;
    }

    this.router.navigate(['/app/mensagens', followup.clientId], { queryParams });
  }

  /**
   * Deriva o contexto de sugestão de template a partir do followup.
   * - awaiting_customer_reply → NEEDS_REPLY
   * - dias sem contato >= 2 (48h) → NO_RESPONSE_48H
   * - reason=pos_venda → POST_SALE
   * - padrão → GENERAL
   */
  private deriveSuggestionContext(followup: FollowupItemVm): TemplateSuggestionContext {
    if (followup.reason === 'awaiting_customer_reply') {
      return 'NEEDS_REPLY';
    }
    if (followup.reason === 'pos_venda') {
      return 'POST_SALE';
    }
    if (followup.daysSinceLastContact >= 2) {
      return 'NO_RESPONSE_48H';
    }
    // PECA_PARADA: quando a peça está parada (via tag ou reason)
    if ((followup as any).reason === 'peca_parada') {
      return 'PECA_PARADA';
    }
    return 'GENERAL';
  }

  /**
   * Mapeia recommendedTemplateId da IA para ID de template real
   */
  private findTemplateIdByRecommendation(recommendedId: string): string | undefined {
    const templates = this.templates();
    if (templates.length === 0) return undefined;

    // Mapeamento de IDs da IA para títulos dos templates
    const mapping: Record<string, string[]> = {
      'closing_deal': ['preço', 'price'],
      'price_offer': ['preço', 'price'],
      'gift_options': ['presente', 'gift'],
      'delivery_info': ['entrega', 'delivery'],
      'vip_reactivation': ['retomada', 'sumiu'],
      'new_products': ['novidades', 'new'],
      're_engagement': ['sumiu', 'retomada'],
      'post_sale': ['pós-venda', 'agradecimento']
    };

    const keywords = mapping[recommendedId];
    if (!keywords) return templates[0].id; // Fallback para primeiro template

    // Buscar por título que contenha as keywords
    const matchedTemplate = templates.find(t => 
      keywords.some(keyword => t.title.toLowerCase().includes(keyword.toLowerCase()))
    );

    return matchedTemplate?.id || templates[0].id;
  }

  // Gerenciamento de mensagens agendadas
  sendScheduledNow(scheduledId: string): void {
    const scheduled = this.scheduledMessageStore.getById(scheduledId);
    if (!scheduled) return;

    // Salvar ID da mensagem agendada para marcar como enviada após o envio
    this.pendingScheduledMessageId.set(scheduledId);

    // Abrir composer com a mensagem agendada
    this.composerContext.set({
      mode: 'central',
      clientId: scheduled.clientId,
      recommendedTemplateId: scheduled.templateId,
      source: 'central',
    });
    
    this.isComposerOpen.set(true);
  }

  cancelScheduled(scheduledId: string): void {
    this.scheduledMessageStore.cancel(scheduledId);
  }

  rescheduleMessage(scheduledId: string): void {
    // TODO: Implementar modal de reagendamento
    const newDate = prompt('Nova data/hora (YYYY-MM-DDTHH:MM):');
    if (newDate) {
      this.scheduledMessageStore.reschedule(scheduledId, new Date(newDate).toISOString());
    }
  }

  /**
   * Dev helper: Agendar mensagem de teste em 1 minuto
   */
  scheduleTestMessage(): void {
    const clients = this.allClients();
    if (clients.length === 0) {
      alert('Nenhum cliente disponível para teste');
      return;
    }

    // Pegar primeiro cliente com WhatsApp
    const client = clients.find(c => c.whatsapp) || clients[0];
    
    // Agendar para 1 minuto no futuro
    const plannedAt = new Date();
    plannedAt.setMinutes(plannedAt.getMinutes() + 1);

    const templates = this.templateStore.approvedTemplates();
    const template = templates[0];

    if (!template) {
      alert('Nenhum template aprovado disponível para teste');
      return;
    }

    this.scheduledMessageStore.create({
      clientId: client.id,
      clientName: client.name,
      templateId: template.id,
      messageContent: `🧪 Teste: Mensagem agendada para ${client.name}`,
      plannedAt: plannedAt.toISOString(),
      meta: {
        source: 'test',
        isTest: true,
      },
    });

    this.successMessageText.set(`✅ Mensagem de teste agendada para daqui 1 minuto (${client.name})`);
    setTimeout(() => this.successMessageText.set(''), 3000);

    // Mudar para aba agendadas
    this.setActiveTab('scheduled');
  }

  loadClients(): void {
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        this.allClients.set(clients);
      },
      error: (err) => {
        console.error('Error loading clients:', err);
      }
    });
  }

  loadTemplates(): void {
    const templates = this.templateStore.approvedTemplates();
    this.templates.set(templates);
    
    // Selecionar primeiro template por padrão
    if (templates.length > 0) {
      this.selectedTemplateId.set(templates[0].id);
      this.updateMessagePreview();
    }
  }

  navigateToNewClient(): void {
    this.router.navigate(['/app/clientes/novo'], {
      queryParams: { returnTo: '/app/central' }
    });
  }

  loadFollowups(): void {
    this.loading = true;
    this.loadError.set(null);

    console.log('[Followups] Loading from API via summary (com fallback automático)');

    // Buscar dados de clientes para enriquecer
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        // Usa FollowUpsService.summary() que já inclui fallback para buckets individuais em caso de 404
        this.followUpsService.summary().subscribe({
          next: (summary) => {
            console.log('[Followups] Summary Response:', {
              today: summary.today.length,
              overdue: summary.overdue.length,
              scheduled: summary.scheduled.length,
              done: summary.done.length
            });

            // Mapear followups com dados de clientes
            const enrichFollowup = (followup: Followup): FollowupItemVm => {
              const client = clients.find(c => c.id === followup.clientId);
              if (!client) {
                return {
                  clientId: followup.clientId,
                  clientName: 'Cliente desconhecido',
                  score: 0,
                  daysSinceLastContact: 0,
                  reason: 'novidades' as FollowupReason,
                  suggestedTemplateId: '',
                  dueDate: followup.dueDate,
                  followupId: followup.id,
                  completedAt: followup.completedAt
                };
              }

              const daysSinceLastContact = Math.floor(
                (Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
              );

              const primaryReason = followup.primaryReason 
                || (followup.reasons?.length ? followup.reasons[0] : '') 
                || this.buildReadableReason(followup, daysSinceLastContact);

              return {
                clientId: client.id,
                clientName: client.name,
                score: client.score,
                daysSinceLastContact,
                reason: this.inferReasonFromFollowup(followup) as FollowupReason,
                suggestedTemplateId: followup.recommendedTemplateId || '',
                dueDate: followup.dueDate,
                followupId: followup.id,
                completedAt: followup.completedAt,
                suggestion: {
                  id: followup.id,
                  title: primaryReason,
                  reason: primaryReason,
                  priority: followup.priorityScore >= 80 ? 'high' : followup.priorityScore >= 60 ? 'medium' : 'low',
                  action: 'send_message',
                  followupPriorityScore: followup.priorityScore || 50,
                  recommendedTemplateId: followup.recommendedTemplateId,
                  recommendedReasonText: followup.reasons?.join(' • ') || primaryReason,
                  recommendedTiming: this.mapRecommendedTiming(followup.recommendedTiming)
                }
              };
            };

            this.todayFollowups.set(summary.today.map(enrichFollowup));
            this.overdueFollowups.set(summary.overdue.map(enrichFollowup));
            this.scheduledFollowups.set(summary.scheduled.map(enrichFollowup));
            this.completedFollowups.set(summary.done.map(enrichFollowup));

            console.log('[Followups] ✅ Buckets atualizados:', {
              '📅 Hoje': this.todayFollowups().length,
              '🔴 Atrasados': this.overdueFollowups().length,
              '⏰ Agendados': this.scheduledFollowups().length,
              '✅ Concluídos': this.completedFollowups().length
            });

            // Log detalhado de cada followup recebido do backend
            console.log('[Followups] 📋 DETALHES de todos followups recebidos:');
            console.log('[Followups] TODAY (count:', summary.today.length, '):', summary.today.map(f => ({
              id: f.id,
              clientId: f.clientId,
              status: f.status,
              bucket: f.bucket,
              dueDate: f.dueDate
            })));
            console.log('[Followups] OVERDUE (count:', summary.overdue.length, '):', summary.overdue.map(f => ({
              id: f.id,
              clientId: f.clientId,
              status: f.status,
              bucket: f.bucket,
              dueDate: f.dueDate
            })));
            console.log('[Followups] SCHEDULED (count:', summary.scheduled.length, '):', summary.scheduled.map(f => ({
              id: f.id,
              clientId: f.clientId,
              status: f.status,
              bucket: f.bucket,
              dueDate: f.dueDate
            })));
            console.log('[Followups] DONE (count:', summary.done.length, '):', summary.done.map(f => ({
              id: f.id,
              clientId: f.clientId,
              status: f.status,
              bucket: f.bucket,
              dueDate: f.dueDate,
              completedAt: f.completedAt
            })));

            // Legado - para compatibilidade
            this.followups = [
              ...summary.today.map(enrichFollowup),
              ...summary.overdue.map(enrichFollowup)
            ].map(f => ({ 
              ...f, 
              justCopied: false,
              sending: false 
            }));

            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading followups:', error);
            const status = error?.status;
            let errorMsg: string;
            if (status === 400) {
              errorMsg = 'Workspace não selecionado.';
            } else if (status === 401) {
              errorMsg = 'Sessão expirada. Faça login novamente.';
            } else if (status === 500) {
              errorMsg = 'Erro no servidor ao carregar follow-ups. Verifique se o backend HCAJOAIS está rodando.';
            } else if (status === 0) {
              errorMsg = 'Não foi possível conectar ao servidor. Verifique se o backend está acessível.';
            } else {
              errorMsg = error?.error?.message || error?.message || 'Erro ao carregar follow-ups';
            }
            this.todayFollowups.set([]);
            this.overdueFollowups.set([]);
            this.scheduledFollowups.set([]);
            this.completedFollowups.set([]);
            this.followups = [];
            this.loading = false;
            this.loadError.set(errorMsg);
            this.toastService.showError(errorMsg);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.loadError.set(err?.message || 'Erro ao carregar clientes para follow-ups');
        this.toastService.showError(err?.message || 'Erro ao carregar clientes para follow-ups');
      },
    });
  }
  
  /**
   * Mapeia RecommendedTiming da API para formato esperado pela UI
   */
  private mapRecommendedTiming(timing?: 'morning' | 'afternoon' | 'evening' | 'this_week'): 'now' | 'today' | 'tomorrow' | 'this_week' | undefined {
    if (!timing) return 'today';
    if (timing === 'this_week') return 'this_week';
    // morning, afternoon, evening -> today
    return 'today';
  }
  
  /**
   * Infere a reason a partir dos dados do followup
   */
  private inferReasonFromFollowup(followup: any): string {
    // Detectar AWAITING_CUSTOMER_REPLY
    if (followup.reason === 'AWAITING_CUSTOMER_REPLY' || followup.primaryReason === 'AWAITING_CUSTOMER_REPLY') {
      return 'awaiting_customer_reply';
    }
    if (followup.reasons && followup.reasons.length > 0) {
      if (followup.reasons.some((r: string) => r === 'AWAITING_CUSTOMER_REPLY' || r.toLowerCase().includes('aguardar resposta'))) {
        return 'awaiting_customer_reply';
      }
    }

    // Usar reasons array do novo modelo
    if (followup.reasons && followup.reasons.length > 0) {
      const reasonText = followup.reasons[0].toLowerCase();
      if (reasonText.includes('preço')) return 'pediu_preco';
      if (reasonText.includes('presente')) return 'presente';
      if (reasonText.includes('sumiu') || reasonText.includes('inativo')) return 'sumiu';
      if (reasonText.includes('novidade')) return 'novidades';
      if (reasonText.includes('pós-venda') || reasonText.includes('pos_venda')) return 'pos_venda';
    }
    
    // Fallback para campo legado
    if (followup.reason) {
      const reasonText = followup.reason.toLowerCase();
      if (reasonText.includes('preço')) return 'pediu_preco';
      if (reasonText.includes('presente')) return 'presente';
      if (reasonText.includes('sumiu') || reasonText.includes('inativo')) return 'sumiu';
      if (reasonText.includes('novidade')) return 'novidades';
      if (reasonText.includes('pós-venda') || reasonText.includes('pos_venda')) return 'pos_venda';
    }
    return 'novidades';
  }

  /**
   * Constrói um motivo legível quando o backend não retorna primaryReason nem reasons
   */
  private buildReadableReason(followup: any, daysSinceLastContact: number): string {
    // Se tem bucket/status que indica algo específico
    if (followup.bucket === 'overdue') {
      return 'Follow-up atrasado';
    }

    // Baseado nos dias sem contato
    if (daysSinceLastContact > 30) {
      return `Cliente sem contato há ${daysSinceLastContact} dias`;
    }
    if (daysSinceLastContact > 14) {
      return 'Cliente sem interação recente';
    }
    if (daysSinceLastContact > 7) {
      return 'Manter relacionamento ativo';
    }
    
    // Baseado no score de prioridade
    if (followup.priorityScore >= 80) {
      return 'Cliente com alta prioridade';
    }
    if (followup.priorityScore >= 60) {
      return 'Oportunidade de contato';
    }

    // Se houve interação recente (resposta do cliente), foi gerado por isso
    if (daysSinceLastContact <= 2) {
      return 'Retomar conversa recente';
    }

    return 'Manter relacionamento';
  }

  /**
   * Navega para a conversa do cliente no Composer/Messages,
   * passando followupId para que o envio vincule a mensagem ao follow-up.
   */
  navigateToConversation(clientId: string, followupId?: string): void {
    const queryParams: Record<string, string> = {};
    if (followupId) {
      queryParams['followupId'] = followupId;
    }
    this.router.navigate(['/app/mensagens', clientId], { queryParams });
  }

  /**
   * Verifica se o followup tem reason AWAITING_CUSTOMER_REPLY
   */
  isAwaitingCustomerReply(followup: FollowupItemVm): boolean {
    return followup.reason === 'awaiting_customer_reply'
      || followup.suggestion?.reason === 'AWAITING_CUSTOMER_REPLY'
      || followup.suggestion?.reason === 'Aguardar resposta do cliente';
  }

  async copyMessage(followup: FollowupWithStatus): Promise<void> {
    const message = this.buildMessageFromTemplate(
      followup.suggestedTemplateId,
      followup.clientName
    );

    await this.centralService.copyToClipboard(message);

    // Log telemetry
    try {
      this.telemetryService.log('template_copied', { templateId: followup.suggestedTemplateId });
    } catch {
      // Silent fail
    }

    // Mostrar feedback visual
    followup.justCopied = true;
    setTimeout(() => {
      followup.justCopied = false;
    }, 2000);
  }

  /**
   * Constrói uma mensagem a partir de um template
   */
  private buildMessageFromTemplate(templateId: string, clientName: string, extras?: { produto?: string; preco?: string }): string {
    const template = this.templateStore.getById(templateId);
    if (!template) return '';

    let message = template.body;
    const firstName = clientName.split(' ')[0];

    // Double-curly format (frontend seed)
    message = message.replace(/\{\{primeiro_nome\}\}/g, firstName);
    message = message.replace(/\{\{nome_completo\}\}/g, clientName);
    message = message.replace(/\{\{nome\}\}/g, clientName);
    // Single-curly format (backend API)
    message = message.replace(/\{NomeCliente\}/gi, firstName);
    message = message.replace(/\{PrimeiroNome\}/gi, firstName);
    message = message.replace(/\{NomeCompleto\}/gi, clientName);
    message = message.replace(/\{Nome\}/gi, clientName);

    if (extras?.produto) {
      message = message.replace(/\{\{produto\}\}/g, extras.produto);
      message = message.replace(/\{Produto\}/gi, extras.produto);
    }

    if (extras?.preco) {
      message = message.replace(/\{\{preco\}\}/g, extras.preco);
      message = message.replace(/\{Preco\}/gi, extras.preco);
    }

    // Limpar placeholders restantes
    message = message.replace(/\{\{\w+\}\}/g, '');
    message = message.replace(/\{\w+\}/g, '');

    return message.trim();
  }

  /**
   * Envia mensagem via endpoint unificado /api/messages/send
   */
  sendViaApi(followup: FollowupWithStatus): void {
    followup.sending = true;
    followup.sendError = undefined;

    // Mapear reason para templateId
    const templateId = this.getTemplateIdByReason(followup.reason);
    const messageText = this.buildMessageFromTemplate(templateId, followup.clientName);

    // Enviar via endpoint unificado
    this.messagesApi.sendMessage({
      clientId: followup.clientId,
      provider: 'meta',
      text: messageText,
      templateId: templateId,
    }).subscribe({
      next: (message) => {
        followup.sending = false;
        followup.lastMessageId = message.id;
        
        // Mostrar sucesso
        alert(`✅ Enviado com sucesso!\n\nMessage ID: ${message.id}`);
        
        // Log telemetry
        try {
          this.telemetryService.log('whatsapp_sent_from_central', {
            templateId,
            reason: followup.reason,
            origin: 'central'
          });
        } catch {
          // Silent fail
        }
      },
      error: (error) => {
        followup.sending = false;
        
        // Tratar erro 409
        if (error?.status === 409) {
          const errorCode = error?.error?.code;
          if (errorCode === 'OUTSIDE_WINDOW') {
            followup.sendError = 'Fora da janela de 24h. Template necessário.';
          } else if (errorCode === 'TEMPLATE_NOT_APPROVED') {
            followup.sendError = 'Template não aprovado. Configure em Settings.';
          } else {
            followup.sendError = error?.error?.message || 'Erro ao enviar';
          }
        } else {
          followup.sendError = error?.error?.message || error?.message || 'Erro ao enviar';
        }
        
        // Mostrar erro e oferecer fallback
        const shouldFallback = confirm(
          `❌ Erro ao enviar:\n${followup.sendError}\n\nDeseja abrir o WhatsApp Web manualmente?`
        );
        
        if (shouldFallback) {
          this.openWhatsApp(followup);
        }
      }
    });
  }

  /**
   * Mapeia reason para templateId (ID interno do template)
   */
  private getTemplateIdByReason(reason: FollowupReason): string {
    // Buscar template por reason ou usar o primeiro disponível
    const templates = this.templateStore.approvedTemplates();
    if (!templates.length) return '';
    
    // Mapeamento de reason para keywords de template
    const mapping: Record<FollowupReason, string[]> = {
      pediu_preco: ['preco', 'price'],
      sumiu: ['sumiu', 'retomada'],
      presente: ['presente', 'gift'],
      novidades: ['novidades', 'new'],
      pos_venda: ['pos-venda', 'agradecimento'],
      awaiting_customer_reply: ['sumiu', 'retomada']
    };
    
    const keywords = mapping[reason] || [];
    const match = templates.find(t => 
      keywords.some(kw => t.title.toLowerCase().includes(kw.toLowerCase()))
    );
    
    return match?.id || templates[0].id;
  }

  openWhatsApp(followup: FollowupItemVm): void {
    // Navega para a tela de mensagens com o cliente
    this.router.navigate(['/app/mensagens', followup.clientId]);
    
    // Log telemetry
    try {
      this.telemetryService.log('whatsapp_opened', { hasPhone: true });
    } catch {
      // Silent fail
    }
  }

  // ===============================================
  // Cliente Alvo - Busca e Seleção
  // ===============================================

  /**
   * Restaura o cliente selecionado do store (persistido por workspace)
   */
  private restoreSelectedClient(): void {
    const savedClientId = this.centralStore.selectedClientId();
    if (!savedClientId) return;

    // Carregar cliente do store e selecionar
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        const client = clients.find(c => c.id === savedClientId);
        if (client) {
          // Selecionar sem persistir novamente (já está persistido)
          this.selectedClient.set({
            id: client.id,
            name: client.name,
            whatsapp: client.whatsapp
          });
          this.selectedClientFullData.set(client);
          
          // Executar análise da IA
          this.runAiAnalysis(client);
        } else {
          // Cliente não encontrado, limpar do store
          this.centralStore.clearSelectedClient();
        }
      }
    });
  }

  selectClient(client: Client): void {
    this.selectedClient.set({
      id: client.id,
      name: client.name,
      whatsapp: client.whatsapp
    });
    this.selectedClientFullData.set(client);
    this.clientSearchTerm.set('');
    
    // Executar análise da IA
    this.runAiAnalysis(client);
    
    // Persistir no store (por workspace)
    this.centralStore.setSelectedClient(client.id);
    
    // Log telemetry
    try {
      this.telemetryService.log('client_viewed', { clientId: client.id });
    } catch {
      // Silent fail
    }
  }

  selectClientFromFollowup(followup: FollowupItemVm): void {
    // Buscar dados completos do cliente
    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        const client = clients.find(c => c.id === followup.clientId);
        if (client) {
          this.selectClient(client);
          
          // Scroll suave para o topo (Cliente alvo)
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.selectedClientFullData.set(null);
    this.clientAiAnalysis.set(null);
    this.messagePreview.set('');
    this.sendError.set('');
    this.selectedTemplateId.set('');
    
    // Limpar do store (persiste a remoção por workspace)
    this.centralStore.clearSelectedClient();
  }

  /**
   * Executa análise da IA para o cliente selecionado
   */
  private runAiAnalysis(client: Client): void {
    // Calcular sinais de contexto
    const now = Date.now();
    const lastContact = new Date(client.lastContactAt).getTime();
    const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));

    // Buscar mensagens para calcular lifetimeValue (simulado)
    // TODO: Implementar cálculo real quando houver histórico de vendas
    const lifetimeValue = 0;

    const signals = {
      daysSinceLastContact,
      hasNegotiatingTag: client.tags.includes('negociando'),
      hasBoughtBefore: false, // TODO: Implementar lógica real
      lifetimeValue,
      lastMessageIntent: undefined as 'price' | 'gift' | 'delivery' | 'other' | undefined
    };

    // Executar análise da IA
    const analysis = this.aiEngine.computeClientAi(signals);
    this.clientAiAnalysis.set(analysis);

    // Selecionar template recomendado pela IA
    const topSuggestion = analysis.suggestions[0];
    if (topSuggestion?.recommendedTemplateId) {
      // Mapear recommendedTemplateId para um template real
      const mappedTemplateId = this.findTemplateByRecommendation(topSuggestion.recommendedTemplateId);
      if (mappedTemplateId) {
        this.selectedTemplateId.set(mappedTemplateId);
      } else if (this.templates().length > 0) {
        // Fallback: selecionar primeiro template ativo
        this.selectedTemplateId.set(this.templates()[0].id);
      }
    } else if (this.templates().length > 0) {
      // Sem recomendação: selecionar primeiro template
      this.selectedTemplateId.set(this.templates()[0].id);
    }

    // Atualizar preview com template recomendado
    this.updateMessagePreview();
  }

  /**
   * Mapeia o recommendedTemplateId da IA para um template real
   */
  private findTemplateByRecommendation(recommendedId: string): string | null {
    const templates = this.templates();
    if (templates.length === 0) return null;

    // Mapeamento de IDs da IA para títulos/tags dos templates
    const mapping: Record<string, { titleIncludes?: string; tags?: FollowupReason[] }> = {
      'closing_deal': { titleIncludes: 'preço', tags: ['pediu_preco'] },
      'price_offer': { titleIncludes: 'preço', tags: ['pediu_preco'] },
      'gift_options': { titleIncludes: 'presente', tags: ['presente'] },
      'delivery_info': { titleIncludes: 'entrega' },
      'vip_reactivation': { titleIncludes: 'retomada', tags: ['sumiu', 'novidades'] },
      'new_products': { titleIncludes: 'novidades', tags: ['novidades'] },
      're_engagement': { titleIncludes: 'sumiu', tags: ['sumiu'] },
      'post_sale': { titleIncludes: 'pós-venda', tags: ['pos_venda'] }
    };

    const criteria = mapping[recommendedId];
    if (!criteria) return templates[0].id; // Fallback para primeiro template

    // Buscar por título ou tags
    const matchedTemplate = templates.find(t => {
      if (criteria.titleIncludes && t.title.toLowerCase().includes(criteria.titleIncludes.toLowerCase())) {
        return true;
      }
      if (criteria.tags && criteria.tags.some(tag => t.tags.includes(tag))) {
        return true;
      }
      return false;
    });

    return matchedTemplate?.id || templates[0].id;
  }

  openQuickCreateModal(): void {
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  onClientCreated(event: { clientId: string; clientName: string }): void {
    this.successMessageText.set(`✅ Cliente "${event.clientName}" criado e selecionado!`);
    
    // Recarregar lista de clientes
    this.loadClients();
    
    // Buscar cliente recém-criado e selecionar
    setTimeout(() => {
      this.clientsStore.getClients().subscribe({
        next: (clients) => {
          const newClient = clients.find(c => c.id === event.clientId);
          if (newClient) {
            this.selectClient(newClient);
          }
        }
      });
    }, 300);

    // Limpar mensagem após 5 segundos
    setTimeout(() => {
      this.successMessageText.set('');
    }, 5000);

    // Log telemetry
    try {
      this.telemetryService.log('client_created', { clientId: event.clientId });
    } catch {
      // Silent fail
    }
  }

  // ===============================================
  // Enviar Mensagem - Template e Preview
  // ===============================================

  onTemplateChange(): void {
    this.updateMessagePreview();
    this.sendError.set('');
  }

  updateMessagePreview(): void {
    const client = this.selectedClient();
    const templateId = this.selectedTemplateId();
    
    if (!client || !templateId) {
      this.messagePreview.set('');
      return;
    }

    const message = this.buildMessageFromTemplate(templateId, client.name);
    this.messagePreview.set(message);
  }

  async copyMessageFromPreview(): Promise<void> {
    const message = this.messagePreview();
    if (!message) return;

    await this.centralService.copyToClipboard(message);

    // Log telemetry
    try {
      this.telemetryService.log('template_copied', { 
        templateId: this.selectedTemplateId() 
      });
    } catch {
      // Silent fail
    }

    // Feedback visual
    this.justCopiedMessage.set(true);
    setTimeout(() => {
      this.justCopiedMessage.set(false);
    }, 2000);
  }

  sendMessageViaApi(): void {
    const client = this.selectedClient();
    const templateId = this.selectedTemplateId();
    
    if (!client || !templateId) return;

    if (!client.whatsapp) {
      this.sendError.set('Cliente não possui WhatsApp cadastrado');
      return;
    }

    this.sendingMessage.set(true);
    this.sendError.set('');

    const messageText = this.messagePreview();

    // Enviar via endpoint unificado /api/messages/send
    this.messagesApi.sendMessage({
      clientId: client.id,
      provider: 'meta',
      text: messageText,
      templateId: templateId,
    }).subscribe({
      next: (message) => {
        this.sendingMessage.set(false);
        
        // Mostrar sucesso
        this.successMessageText.set(`✅ Mensagem enviada com sucesso! ID: ${message.id}`);
        setTimeout(() => {
          this.successMessageText.set('');
        }, 5000);
        
        // Log telemetry
        try {
          this.telemetryService.log('whatsapp_sent_from_central', {
            templateId,
            clientId: client.id
          });
        } catch {
          // Silent fail
        }
      },
      error: (error) => {
        this.sendingMessage.set(false);
        
        // Tratar erro 409
        if (error?.status === 409) {
          const errorCode = error?.error?.code;
          if (errorCode === 'OUTSIDE_WINDOW') {
            this.sendError.set('Fora da janela de 24h. Template necessário.');
          } else if (errorCode === 'TEMPLATE_NOT_APPROVED') {
            this.sendError.set('Template não aprovado. Configure em Settings.');
          } else {
            this.sendError.set(error?.error?.message || 'Erro ao enviar mensagem');
          }
        } else {
          this.sendError.set(error?.error?.message || error?.message || 'Erro ao enviar mensagem');
        }
      }
    });
  }

  openWhatsAppWithSelectedClient(): void {
    const client = this.selectedClient();
    if (!client) return;

    // Navega para a tela de mensagens com o cliente
    this.router.navigate(['/app/mensagens', client.id]);

    // Log telemetry
    try {
      this.telemetryService.log('whatsapp_opened', { 
        clientId: client.id 
      });
    } catch {
      // Silent fail
    }
  }

  getClientDetailLink(clientId: string): string {
    return `/app/clientes/${clientId}`;
  }

  /**
   * Abre o MessageComposer com o contexto do follow-up
   */
  openComposerForFollowup(followup: FollowupWithStatus): void {
    const suggestionContext = this.deriveSuggestionContext(followup);

    const queryParams: Record<string, string> = {
      context: suggestionContext,
    };
    if (followup.followupId) {
      queryParams['followupId'] = followup.followupId;
    }

    this.router.navigate(['/app/mensagens', followup.clientId], { queryParams });

    try {
      this.telemetryService.log('central_open');
    } catch {
      // Silent fail
    }
  }

  /**
   * Envia follow-up (navega para mensagens)
   */
  sendFollowupDirectly(followup: FollowupWithStatus): void {
    const suggestionContext = this.deriveSuggestionContext(followup);

    const queryParams: Record<string, string> = {
      context: suggestionContext,
    };
    if (followup.followupId) {
      queryParams['followupId'] = followup.followupId;
    }

    this.router.navigate(['/app/mensagens', followup.clientId], { queryParams });

    try {
      this.telemetryService.log('central_open');
    } catch {
      // Silent fail
    }
  }

  /**
   * Fecha o MessageComposer
   */
  onComposerClosed(): void {
    this.isComposerOpen.set(false);
    this.composerContext.set(null);
  }

  /**
   * Callback quando mensagem é enviada pelo composer
   * O backend já cuida de:
   *  - gravar a mensagem
   *  - atualizar score/lastContactAt
   *  - marcar followup como DONE (se followUpId foi passado no send)
   */
  onMessageSent(event: { messageId: string }): void {
    this.successMessageText.set('✅ Mensagem enviada com sucesso!');
    
    // Se estava enviando uma mensagem agendada, marcar como enviada
    const pendingId = this.pendingScheduledMessageId();
    if (pendingId) {
      this.scheduledMessageStore.markAsSent(pendingId);
      this.pendingScheduledMessageId.set(null);
    }
    
    // Recarregar follow-ups (o backend já marcou o followup como done)
    setTimeout(() => {
      this.loadFollowups();
    }, 500);
    
    setTimeout(() => {
      this.successMessageText.set('');
    }, 5000);

    try {
      this.telemetryService.log('central_open');
    } catch {
      // Silent fail
    }
  }

  /**
   * Método de debug para repopular a fila manualmente
   * Use no console: Angular element > component.repopulateQueue()
   */
  repopulateQueue(): void {
    console.log('🔄 Repopulando fila de follow-ups...');
    this.followupQueueService.populateQueue();
    
    // Aguardar um pouco e recarregar
    setTimeout(() => {
      this.loadFollowups();
      console.log('✅ Fila repopulada!');
    }, 500);
  }

  /**
   * Formata data de agendamento de forma amigável
   */
  formatScheduledDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const schedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffMs = schedDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0) {
      return `Hoje às ${time}`;
    } else if (diffDays === 1) {
      return `Amanhã às ${time}`;
    } else if (diffDays === -1) {
      return `Ontem às ${time}`;
    } else {
      const dateStr = date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
      return `${dateStr} às ${time}`;
    }
  }

  /**
   * Calcula tempo até a data agendada
   */
  getTimeUntil(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return 'vencido';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `em ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `em ${diffHours}h`;
    } else if (diffDays === 1) {
      return 'em 1 dia';
    } else {
      return `em ${diffDays} dias`;
    }
  }

  // ==========================================
  // GERAR FOLLOW-UPS
  // ==========================================

  /**
   * Gera follow-ups via API backend
   * POST /api/Followups/generate-now
   * workspaceId é injetado automaticamente via interceptor (header x-workspace-id)
   */
  generateFollowups(): void {
    const workspaceId = this.workspaceService.getCurrentWorkspaceId();

    if (!workspaceId) {
      this.toastService.showError('Workspace não selecionado');
      this.router.navigate(['/workspace/select']);
      return;
    }

    this.generatingFollowups.set(true);
    this.lastGenerateResult.set(null);

    console.log('[Followups] 🚀 Iniciando generateNow()...');

    this.followupsApiService.generateNow().subscribe({
      next: (result) => {
        this.generatingFollowups.set(false);
        console.log('[Followups] ✅ generateNow() retornou:', result);

        // Salvar resultado para o empty state
        this.lastGenerateResult.set({
          createdCount: result.createdCount,
          skippedCount: result.skippedCount,
          reasons: result.reasons,
        });

        // Montar toast com detalhes
        const top3Reasons = result.reasons.slice(0, 3);

        if (result.createdCount === 0 && result.skippedCount === 0) {
          this.toastService.showInfo(
            'Nenhum follow-up gerado pelo backend. Verificando conversas sem resposta...'
          );
        } else if (result.createdCount === 0) {
          const reasonsText = top3Reasons.length > 0
            ? `\nMotivos: ${top3Reasons.join(' · ')}`
            : '';
          this.toastService.showInfo(
            `Nenhum novo follow-up criado | Ignorados: ${result.skippedCount}${reasonsText}`
          );
        } else {
          const reasonsText = top3Reasons.length > 0 && result.skippedCount > 0
            ? `\nIgnorados: ${top3Reasons.join(' · ')}`
            : '';
          this.toastService.showSuccess(
            `✅ ${result.createdCount} follow-up(s) criado(s) | ${result.skippedCount} ignorado(s)${reasonsText}`
          );
          this.setActiveTab('today');
        }

        // Sempre recarregar as abas (para atualizar contadores)
        this.loadFollowups();

        // SEMPRE verificar clientes com mensagem enviada sem resposta (complementar ao backend)
        this.checkUnrepliedConversations();

        try {
          this.telemetryService.log('central_generate', {
            created: result.createdCount,
            skipped: result.skippedCount,
            reasons: result.reasons.join(', '),
          });
        } catch {
          // Silent fail
        }
      },
      error: (error) => {
        this.generatingFollowups.set(false);
        console.error('[Followups] ❌ Erro no generateNow():', error);

        const status = error?.status;
        if (status === 400) {
          this.toastService.showError('Workspace não selecionado. Selecione um ambiente antes de gerar.');
        } else if (status === 401) {
          this.toastService.showError('Sessão expirada. Faça login novamente.');
        } else if (status === 403) {
          this.toastService.showError('Sem acesso ao ambiente');
        } else if (status === 404) {
          this.toastService.showError('Endpoint não encontrado. Verifique se o backend está rodando.');
        } else {
          this.toastService.showError(error?.error?.message || error?.message || 'Erro ao gerar follow-ups');
        }

        // MESMO com erro no backend, verificar conversas sem resposta no frontend
        console.log('[Followups] ⚠️ Backend falhou, mas vamos verificar conversas sem resposta pelo frontend...');
        this.checkUnrepliedConversations();
      },
    });
  }

  /**
   * Verifica conversas onde a última mensagem foi enviada pelo vendedor (outbound)
   * e o cliente não respondeu há mais de 1 dia.
   * Para esses casos, cria follow-ups via API com reason "Aguardando resposta do cliente".
   */
  private checkUnrepliedConversations(): void {
    const clients = this.allClients();
    console.log(`[Followups] 🔍 checkUnrepliedConversations - ${clients.length} clientes carregados`);

    if (clients.length === 0) {
      console.warn('[Followups] ⚠️ Nenhum cliente carregado, carregando antes de verificar...');
      this.clientsStore.getClients().subscribe({
        next: (loadedClients) => {
          this.allClients.set(loadedClients);
          console.log(`[Followups] ✅ ${loadedClients.length} clientes carregados`);
          this.fetchAndProcessConversations(loadedClients);
        },
        error: (err) => {
          console.error('[Followups] ❌ Erro ao carregar clientes:', err);
        }
      });
      return;
    }

    this.fetchAndProcessConversations(clients);
  }

  /**
   * Busca mensagens da API e processa conversas sem resposta
   */
  private fetchAndProcessConversations(clients: Client[]): void {
    const clientData = clients.map(c => ({
      id: c.id,
      name: c.name,
      whatsapp: (c as any).whatsapp || (c as any).phone || ''
    }));
    console.log(`[Followups] 📨 Buscando mensagens para ${clientData.length} clientes...`);

    // Buscar conversas da API via MessagesService
    this.messagesService.loadConversationsWithClients(clientData);

    // Aguardar conversas carregarem e então verificar
    let attempts = 0;
    const maxAttempts = 50; // 50 x 200ms = 10s
    const checkInterval = setInterval(() => {
      attempts++;
      if (!this.messagesService.loadingConversations()) {
        clearInterval(checkInterval);
        const error = this.messagesService.conversationsError();
        if (error) {
          console.error('[Followups] ❌ Erro ao carregar conversas:', error);
          return;
        }
        this.processUnrepliedConversations();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.warn('[Followups] ⏰ Timeout ao aguardar conversas (10s)');
      }
    }, 200);
  }

  /**
   * Processa conversas carregadas para encontrar clientes sem resposta
   */
  private processUnrepliedConversations(): void {
    const conversations = this.messagesService.conversations();
    console.log(`[Followups] 📋 processUnrepliedConversations - ${conversations?.length || 0} conversas`);
    
    if (!conversations || conversations.length === 0) {
      console.log('[Followups] ⚠️ Nenhuma conversa carregada para verificar respostas pendentes');
      this.toastService.showInfo('Nenhuma conversa encontrada para verificar respostas pendentes.');
      return;
    }

    // Log de cada conversa para debug
    for (const conv of conversations) {
      console.log(`[Followups]   📧 ${conv.clientName || conv.clientId}: lastDirection=${conv.lastDirection}, lastMessageAt=${conv.lastMessageAt}`);
    }

    // Buscar followups atuais para evitar duplicatas
    const currentFollowups = [
      ...this.todayFollowups(),
      ...this.overdueFollowups(),
      ...this.scheduledFollowups(),
    ];
    const followupClientIds = new Set(currentFollowups.map(f => f.clientId));
    console.log(`[Followups] 📊 ${currentFollowups.length} followups existentes, IDs: ${[...followupClientIds].join(', ')}`);

    const now = new Date();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const candidates: Array<{ conv: any; diffDays: number }> = [];

    for (const conv of conversations) {
      // Só analisar conversas onde a última mensagem foi outbound (enviada pelo vendedor)
      if (conv.lastDirection !== 'outbound') {
        console.log(`[Followups]   ⏭️ ${conv.clientName || conv.clientId}: lastDirection=${conv.lastDirection} (não é outbound, pulando)`);
        continue;
      }

      // Já tem followup aberto? Pular
      if (followupClientIds.has(conv.clientId)) {
        console.log(`[Followups]   ⏭️ ${conv.clientName || conv.clientId}: já tem followup aberto, pulando`);
        continue;
      }

      // Calcular há quanto tempo a mensagem foi enviada
      const lastMsgDate = new Date(conv.lastMessageAt);
      const diffMs = now.getTime() - lastMsgDate.getTime();
      const diffDays = Math.floor(diffMs / ONE_DAY_MS);

      console.log(`[Followups]   🕐 ${conv.clientName || conv.clientId}: última msg outbound há ${diffDays} dia(s) (${conv.lastMessageAt})`);

      // Se a última mensagem outbound foi há mais de 1 dia sem resposta
      if (diffDays >= 1) {
        candidates.push({ conv, diffDays });
      }
    }

    if (candidates.length === 0) {
      console.log('[Followups] ✅ Nenhum cliente aguardando resposta encontrado');
      this.toastService.showInfo('Todos os clientes já foram verificados. Nenhum aguardando resposta.');
      return;
    }

    console.log(`[Followups] 🎯 ${candidates.length} cliente(s) aguardando resposta:`);
    candidates.forEach(c => console.log(`  - ${c.conv.clientName || c.conv.clientId} (${c.diffDays} dias)`));

    let createdCount = 0;
    let errorCount = 0;
    let processedCount = 0;
    const total = candidates.length;

    const onAllProcessed = () => {
      console.log(`[Followups] 📊 Resultado: ${createdCount} criados, ${errorCount} erros de ${total} candidatos`);
      if (createdCount > 0) {
        this.toastService.showSuccess(`📩 ${createdCount} follow-up(s) criado(s) para clientes aguardando resposta`);
        // Recarregar followups para mostrar os novos na UI
        setTimeout(() => this.loadFollowups(), 500);
      } else if (errorCount > 0) {
        this.toastService.showError(`Erro ao criar follow-ups para ${errorCount} cliente(s)`);
      } else if (total > 0) {
        // Todos os candidatos foram processados mas nenhum follow-up foi criado
        this.toastService.showInfo(`Backend não gerou follow-ups para ${total} candidato(s). Verifique os logs do console para mais detalhes.`);
      }
    };

    for (const { conv, diffDays } of candidates) {
      console.log(`[Followups] 📤 Gerando followup via backend para ${conv.clientName || conv.clientId} (clientId: ${conv.clientId})`);

      // Usar POST /api/Followups/generate com clientId - a lógica de criação é do backend
      this.followupsApiService.generateForClient(conv.clientId).subscribe({
        next: (result) => {
          createdCount += result.createdCount;
          processedCount++;
          
          if (result.createdCount > 0) {
            console.log(`[Followups] ✅ Follow-up CRIADO para: ${conv.clientName || conv.clientId}`, result);
          } else {
            console.warn(`[Followups] ⚠️ Follow-up NÃO criado para: ${conv.clientName || conv.clientId}`);
            console.warn(`[Followups]    Motivos skip (${result.reasons.length}):`, result.reasons);
            console.warn(`[Followups]    skippedCount: ${result.skippedCount}`);
            console.warn(`[Followups]    message: ${result.message}`);
          }
          
          if (processedCount === total) onAllProcessed();
        },
        error: (err) => {
          processedCount++;
          if (err?.status === 409 || err?.status === 422) {
            console.log(`[Followups] ℹ️ Follow-up já existe para ${conv.clientName || conv.clientId} (${err?.status})`);
          } else {
            errorCount++;
            console.error(`[Followups] ❌ Erro ao gerar follow-up para ${conv.clientName || conv.clientId}:`, err);
          }
          if (processedCount === total) onAllProcessed();
        },
      });
    }
  }

  /**
   * [DEPRECATED - Mantido apenas para referência]
   * Gera fila de teste baseada nos primeiros 8 clientes
   * Use generateFollowups() ao invés deste método
   */
  generateTestQueue(): void {
    if (environment.production) {
      console.warn('Modo teste desabilitado em produção');
      return;
    }

    const clients = this.allClients();
    
    // Verificar se há clientes suficientes
    if (clients.length < 1) {
      alert('❌ Nenhum cliente cadastrado!\n\nCadastre alguns clientes antes de gerar a fila de teste.');
      return;
    }

    if (!confirm(`Gerar fila de teste com até 8 clientes?\n\nIsso criará followups apenas para clientes com score >= 40.\n\nClientes disponíveis: ${clients.length}`)) {
      return;
    }

    // Pegar até 8 clientes
    const testClients = clients.slice(0, Math.min(8, clients.length));
    let created = 0;
    let skipped = 0;

    for (const client of testClients) {
      // Verificar se já existe followup aberto para este cliente
      const existingFollowups = this.followupStore.getByClientId(client.id);
      const hasOpenFollowup = existingFollowups.some(f => f.status === 'open' || f.status === 'scheduled');
      
      if (hasOpenFollowup) {
        skipped++;
        console.log(`Cliente ${client.name} já tem followup aberto - ignorado`);
        continue;
      }

      // Buscar mensagens do cliente
      const messages = this.messageStore.getByClientId(client.id);
      
      // Inferir lifetimeValue baseado em tags
      const lifetimeValue = client.tags.includes('vip') ? 1000 : 0;
      const hasBoughtBefore = client.tags.includes('cliente') || client.tags.includes('vip');
      
      // Construir sinais de contexto para a IA
      const signals: AiContextSignal = {
        daysSinceLastContact: this.calculateDaysSinceLastContact(client.lastContactAt),
        hasNegotiatingTag: client.tags.includes('negociando'),
        hasBoughtBefore: hasBoughtBefore,
        lifetimeValue: lifetimeValue,
        lastMessageIntent: this.inferLastMessageIntent(messages.length > 0 ? messages[messages.length - 1]?.textPreview : '')
      };

      // Usar buildFollowupCandidate da IA (aplica threshold e cooldown automaticamente)
      const candidate = this.aiEngine.buildFollowupCandidate(signals);
      
      // Usar upsertFromCandidate que já aplica as regras de threshold
      const followup = this.followupStore.upsertFromCandidate(client.id, candidate, 'today');
      
      if (followup) {
        created++;
        console.log(`✅ Followup criado para ${client.name} (score: ${candidate.score})`);
      } else {
        skipped++;
        if (candidate.isCooldown) {
          console.log(`⏭️ Cliente ${client.name} em cooldown - ignorado`);
        } else {
          console.log(`⏭️ Cliente ${client.name} com score ${candidate.score} < 40 - ignorado`);
        }
      }
    }

    // Recarregar lista
    this.loadFollowups();

    // Mostrar resultado
    const message = created > 0 
      ? `✅ Fila de teste gerada!\n\n✅ Criados: ${created}\n⏭️ Ignorados: ${skipped}\n\nOs follow-ups aparecem na aba "Hoje".`
      : `⏭️ Nenhum follow-up criado.\n\nTodos os ${testClients.length} clientes testados têm score < 40 ou já possuem follow-up aberto.\n\nDica: Clientes com tags "negociando" ou "vip" têm scores mais altos.`;
    
    alert(message);
  }

  /**
   * Calcula quantos dias desde o último contato
   */
  private calculateDaysSinceLastContact(lastContactAt: string): number {
    const now = Date.now();
    const lastContact = new Date(lastContactAt).getTime();
    return Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
  }

  /**
   * Infere a intenção da última mensagem
   */
  private inferLastMessageIntent(text: string): 'price' | 'gift' | 'delivery' | 'other' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('preço') || lowerText.includes('valor') || lowerText.includes('quanto')) {
      return 'price';
    }
    
    if (lowerText.includes('presente') || lowerText.includes('casamento') || lowerText.includes('aniversário')) {
      return 'gift';
    }
    
    if (lowerText.includes('entrega') || lowerText.includes('prazo') || lowerText.includes('envio')) {
      return 'delivery';
    }
    
    return 'other';
  }

  /**
   * Busca WhatsApp do cliente por ID
   */
  getClientWhatsApp(clientId: string): string | null {
    const client = this.allClients().find(c => c.id === clientId);
    return client?.whatsapp || null;
  }

  /**
   * Retorna label amigável do template recomendado.
   * Tries to find the actual template name in the TemplateStore first.
   */
  getTemplateLabel(recommendedId: string): string {
    // Try to find the real template name from the store
    const template = this.templateStore.getById(recommendedId);
    if (template) return template.title;

    // Try to match by AI recommendation ID → template title
    const templates = this.templates();
    const mapping: Record<string, string[]> = {
      'closing_deal': ['preço', 'price'],
      'price_offer': ['preço', 'price'],
      'gift_options': ['presente', 'gift'],
      'delivery_info': ['entrega', 'delivery'],
      'vip_reactivation': ['retomada', 'sumiu'],
      'new_products': ['novidades', 'new'],
      're_engagement': ['sumiu', 'retomada'],
      'post_sale': ['pós-venda', 'agradecimento'],
    };
    const keywords = mapping[recommendedId];
    if (keywords) {
      const match = templates.find(t =>
        keywords.some(kw => t.title.toLowerCase().includes(kw.toLowerCase()))
      );
      if (match) return match.title;
    }

    // Fallback to static labels
    const labelMapping: Record<string, string> = {
      'closing_deal': 'Fechamento de negócio',
      'price_offer': 'Oferta de preço',
      'gift_options': 'Opções de presente',
      'delivery_info': 'Informações de entrega',
      'vip_reactivation': 'Reativação VIP',
      'new_products': 'Novos produtos',
      're_engagement': 'Reengajamento',
      'post_sale': 'Pós-venda'
    };

    return labelMapping[recommendedId] || 'Template personalizado';
  }
}








