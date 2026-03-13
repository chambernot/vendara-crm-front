import { Component, OnInit, signal, inject, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ClientsStore } from '../../data-access/clients.store';
import { ClientsDataService } from '../../data-access/clients-data.service';
import { ClientDetailVm, Client, ClientActivityType } from '../../data-access/clients.models';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { MessageComposerComponent, MessageComposerContext } from '../../../../shared/ui/message-composer/message-composer.component';
import { TagSelectorModalComponent } from '../../../../shared/ui/tag-selector-modal/tag-selector-modal.component';
import { TelemetryService } from '../../../../core/telemetry';
import { MessagesApiService, Message } from '../../../messages/data-access/messages-api.service';
import { MessageStatusLabels, MessageStatusColors, MessageProviderLabels } from '../../../messages/data-access/message.models';
import { TagsApiService } from '../../../../core/tags/tags-api.service';
import { AiSuggestionActionsService, SuggestionsApiService } from '../../../../core/ai';
import { ToastService } from '../../../../shared/services/toast.service';
import { CatalogStore } from '../../../catalog/data-access/catalog.store';
import { catchError, of, switchMap, debounceTime, distinctUntilChanged } from 'rxjs';
import { SaleFormComponent } from '../../../sales/ui/sale-form/sale-form.component';
import { Sale } from '../../../sales/data-access/sales.models';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    ScoreBadgeComponent,
    EmptyStateComponent,
    MessageComposerComponent,
    TagSelectorModalComponent,
    SaleFormComponent,
  ],
  templateUrl: './client-detail.page.html',
})
export class ClientDetailPage implements OnInit, OnDestroy {
  /**
   * Cancela o modo de edição e restaura os dados originais do cliente
   */
  cancelEdit(): void {
    this.isEditMode.set(false);
    this.validationError.set(null);
    if (this.originalClient) {
      this.initForm(this.originalClient);
    }
  }
  loading = signal(true);
  clientDetail = signal<ClientDetailVm | null>(null);
  notFound = signal(false);
  sendingMessage = signal(false);
  lastMessageId = signal<string | null>(null);

  // MVP: simplified properties
  notes = '';
  activeHistoryTab = signal<'compras' | 'mensagens'>('compras');

  // Edit mode
  isEditMode = signal(false);
  isSaving = signal(false);
  editForm!: FormGroup;
  originalClient: Client | null = null;
  newTag = signal('');
  validationError = signal<string | null>(null);

  // Sale modal
  isSaleModalOpen = signal(false);

  // Tag modal
  isTagModalOpen = signal(false);

  // Tag selector modal (new)
  isTagSelectorModalOpen = signal(false);

  // Message composer
  isComposerOpen = signal(false);
  composerContext = signal<MessageComposerContext | null>(null);

  // Suggestions
  suggestionSuccess = signal<string | null>(null);
  suggestionError = signal<string | null>(null);
  applyingSuggestion = signal<string | null>(null);

  // Tags
  allTags = signal<any[]>([]);

  // Score
  scoreBreakdownOpen = signal(false);
  refreshingScore = signal(false);

  // Messages
  messageFilter = signal<'all' | 'sent' | 'received' | 'failed'>('all');
  expandedMessageId = signal<string | null>(null);
  loadingMessages = signal(false);
  private messagesApi = inject(MessagesApiService);
  private allMessages = signal<Message[]>([]); // Signal to hold messages from API
  private pollingInterval: any = null; // Interval ID for polling
  private pollingCounter = 0; // Counter for polling attempts

  // Services
  private fb = inject(FormBuilder);
  private store = inject(ClientsStore);
  private clientsDataService = inject(ClientsDataService);
  private tagsApi = inject(TagsApiService);
  private telemetryService = inject(TelemetryService);
  private toastService = inject(ToastService);
  private suggestionsApi = inject(SuggestionsApiService);
  private aiSuggestionActions = inject(AiSuggestionActionsService);
  private catalogStore = inject(CatalogStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Exposed helpers for template
  protected readonly isNaN = isNaN;

  // Computed: mensagens filtradas
  clientMessages = computed(() => {
    const messages = this.allMessages();
    const filter = this.messageFilter();
    if (filter === 'all') return messages.slice(0, 20);
    let filtered = messages;
    if (filter === 'sent') {
      filtered = messages.filter((m: Message) => m.direction === 'outbound' && m.status !== 'failed');
    } else if (filter === 'received') {
      filtered = messages.filter((m: Message) => m.direction === 'inbound');
    } else if (filter === 'failed') {
      filtered = messages.filter((m: Message) => m.status === 'failed');
    }
    return filtered.slice(0, 20);
  });

  openTagSelectorModal(): void {
    this.isTagSelectorModalOpen.set(true);
  }

  closeTagSelectorModal(): void {
    this.isTagSelectorModalOpen.set(false);
  }

  onTagSelected(tagSlug: string): void {
    const detail = this.clientDetail();
    if (!detail) return;
    // Find tagId from slug
    const tagDef = this.allTags().find(t => t.slug === tagSlug);
    if (!tagDef) {
      this.toastService.showError('Tag não encontrada.');
      return;
    }
    // Call API to add tag by ID
    this.tagsApi.addTagToClient({ clientId: detail.client.id, tagId: tagDef.id }).subscribe({
      next: () => {
        this.toastService.showSuccess(`Tag "${tagDef.label}" aplicada!`);
        this.closeTagSelectorModal();
        // Refresh client detail
        this.store.getClientDetail(detail.client.id).subscribe({
          next: (updatedDetail) => {
            if (updatedDetail) {
              this.clientDetail.set(updatedDetail);
            }
            // Refresh score (tags impactam score)
            this.refreshScore(detail.client.id);
          }
        });
      },
      error: (err) => {
        this.toastService.showError(err?.message || 'Erro ao aplicar tag.');
      }
    });
  }

  // MVP: Método para salvar observações (auto-save)
  saveNotes(): void {
    const detail = this.clientDetail();
    if (!detail) return;

    // Atualiza apenas as observações
    this.clientsDataService.updateClient(detail.client.id, {
      name: detail.client.name,
      WhatsApp: detail.client.whatsapp || '',
      notes: this.notes,
      lastContactAt: detail.client.lastContactAt,
      tags: detail.client.tags
    }).subscribe({
      next: (updatedClient) => {
        this.toastService.showSuccess('Observações salvas!');
        this.clientDetail.set({
          ...detail,
          client: updatedClient
        });
      },
      error: () => {
        this.toastService.showError('Erro ao salvar observações');
      }
    });
  }

  // MVP: Método para remover tag
  removeTag(tagSlug: string): void {
    const detail = this.clientDetail();
    if (!detail) return;

    const tagDef = this.allTags().find(t => t.slug === tagSlug);
    if (!tagDef) {
      this.toastService.showError('Tag não encontrada.');
      return;
    }

    this.tagsApi.removeTagFromClient(detail.client.id, tagDef.id).subscribe({
      next: () => {
        this.toastService.showSuccess('Tag removida!');
        // Refresh client detail
        this.store.getClientDetail(detail.client.id).subscribe({
          next: (updatedDetail) => {
            if (updatedDetail) {
              this.clientDetail.set(updatedDetail);
            }
            // Refresh score (tags impactam score)
            this.refreshScore(detail.client.id);
          }
        });
      },
      error: (err) => {
        this.toastService.showError(err?.message || 'Erro ao remover tag.');
      }
    });
  }

  getMessageStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      intent: '⏳',
      queued: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '❌',
    };
    return icons[status] || '';
  }

  /**
   * Retorna os IDs das tags aplicadas ao cliente para o modal
   */
  getAppliedTagIds(): string[] {
    const detail = this.clientDetail();
    const allTags = this.allTags();
    if (!detail || !Array.isArray(detail.client.tags) || !Array.isArray(allTags)) return [];
    // detail.client.tags são slugs, allTags tem id e slug
    return detail.client.tags
      .map((slug: string) => {
        const tag = allTags.find((t: any) => t && t.slug === slug);
        return tag ? tag.id : null;
      })
      .filter((id: string | null) => !!id) as string[];
  }

  ngOnInit(): void {
    const clientId = this.route.snapshot.paramMap.get('id');
    if (!clientId) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    // Carregar todas as tags da API
    this.tagsApi.listTagDefinitions().subscribe({
      next: (tags) => {
        console.log('🏷️ [ClientDetail] Tags carregadas:', tags);
        this.allTags.set(tags);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Erro ao carregar tags:', err);
      }
    });

    this.store.getClientDetail(clientId).subscribe({
      next: (detail) => {
        console.log('🔍 [ClientDetail] Detail loaded:', detail);
        console.log('🔍 [ClientDetail] Suggestions:', detail?.suggestions);
        if (detail) {
          this.clientDetail.set(detail);
          this.originalClient = { ...detail.client };
          this.initForm(detail.client);
          // MVP: Carrega observações
          this.notes = detail.client.notes || '';
          // Log score em dev
          if (!environment.production) {
            console.log('📊 [ClientDetail] Score carregado:', detail.client.score, detail.client.scoreTier, detail.client.scoreLabel);
          }
          // Load messages from API
          this.loadMessages(clientId);
          // Log telemetry
          // ...existing code...
        }
        this.loading.set(false); // <-- Liberar loading ao carregar
      },
      error: (err) => {
        this.loading.set(false); // <-- Liberar loading em erro
        // ...existing code...
      }
    });
  }

  /**
   * Carrega mensagens do cliente via API
   */
  private loadMessages(clientId: string): void {
    this.loadingMessages.set(true);
    this.messagesApi.getMessagesByClient(clientId).subscribe({
      next: (messages) => {
        console.log('📨 [ClientDetail] Messages loaded from API:', messages.length);
        // Sort by createdAt descending (newest first)
        const sorted = [...messages].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.allMessages.set(sorted);
        this.loadingMessages.set(false);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Error loading messages:', err);
        this.allMessages.set([]);
        this.loadingMessages.set(false);
      }
    });
  }

  /**
   * Recarrega mensagens do cliente
   */
  private reloadMessages(): void {
    const detail = this.clientDetail();
    if (detail) {
      this.loadMessages(detail.client.id);
    }
  }

  /**
   * Inicia polling de mensagens para atualizar status
   * Executa a cada 10 segundos por 1 minuto (6 tentativas)
   */
  private startMessagePolling(): void {
    // Limpar polling anterior se existir
    this.stopMessagePolling();
    
    this.pollingCounter = 0;
    const maxPolls = 6; // 6 vezes * 10s = 60s (1 minuto)
    
    console.log('🔄 [ClientDetail] Iniciando polling de mensagens...');
    
    this.pollingInterval = setInterval(() => {
      this.pollingCounter++;
      console.log(`🔄 [ClientDetail] Polling #${this.pollingCounter}/${maxPolls}`);
      
      this.reloadMessages();
      
      // Parar após 6 tentativas (1 minuto)
      if (this.pollingCounter >= maxPolls) {
        console.log('✅ [ClientDetail] Polling concluído após 1 minuto');
        this.stopMessagePolling();
      }
    }, 10000); // 10 segundos
  }

  /**
   * Para o polling de mensagens
   */
  private stopMessagePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingCounter = 0;
    }
  }

  /**
   * Busca score atualizado do backend e aplica no clientDetail signal.
   * Chamado após venda, tag, mensagem ou manualmente.
   */
  refreshScore(clientId?: string): void {
    const id = clientId || this.clientDetail()?.client.id;
    if (!id) return;

    this.refreshingScore.set(true);
    this.clientsDataService.getClientScore(id).subscribe({
      next: (result) => {
        const current = this.clientDetail();
        if (current) {
          this.clientDetail.set({
            ...current,
            client: {
              ...current.client,
              score: result.score,
              scoreLabel: result.label as any,
              scoreTier: result.tier as any,
              scoreBreakdown: result.breakdown,
            }
          });
          if (!environment.production) {
            console.log('📊 [ClientDetail] Score atualizado:', result.score, result.tier, result.label);
          }
        }
        this.refreshingScore.set(false);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Erro ao atualizar score:', err);
        this.refreshingScore.set(false);
      }
    });
  }

  /**
   * Toggle do accordion de breakdown do score
   */
  toggleScoreBreakdown(): void {
    this.scoreBreakdownOpen.set(!this.scoreBreakdownOpen());
  }

  /**
   * Inicializa o formulário de edição
   */
  private initForm(client: Client): void {
    this.editForm = this.fb.group({
      name: [client.name, [Validators.required, Validators.minLength(2)]],
      whatsapp: [client.whatsapp, [Validators.required]],
      notes: [client.notes || ''],
      lastContactAt: [client.lastContactAt ? new Date(client.lastContactAt).toISOString().split('T')[0] : ''],
      whatsappOptIn: [client.whatsappOptIn],
      tags: [client.tags || []]
    });
  }

  /**
   * Entra no modo de edição
   */
  enterEditMode(): void {
    const detail = this.clientDetail();
    if (!detail) return;
    this.isEditMode.set(true);
    this.validationError.set(null);
    // Reinicializa o form com os dados atuais
    this.initForm(detail.client);
    try {
      this.telemetryService.log('client_updated', { 
        clientId: detail.client.id,
        action: 'edit_started' 
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Salva as alterações do cliente
   */
  saveClient(): void {
    if (!this.editForm.valid) {
      this.validationError.set('Por favor, preencha todos os campos obrigatórios corretamente.');
      return;
    }

    const detail = this.clientDetail();
    if (!detail) return;

    const formValue = this.editForm.value;
    
    // Normaliza o WhatsApp
    const whatsapp = formValue.whatsapp?.trim();
    
    // Verifica duplicata de WhatsApp
    if (whatsapp) {
      const duplicate = this.store.checkWhatsAppDuplicate(whatsapp, detail.client.id);
      if (duplicate) {
        this.validationError.set(
          `O WhatsApp ${whatsapp} já está cadastrado para o cliente "${duplicate.name}". ` +
          `Por favor, use um número diferente.`
        );
        return;
      }
    }
    
    this.isSaving.set(true);
    this.validationError.set(null);

    // Prepara o DTO de atualização para a API
    const updateDto = {
      name: formValue.name.trim(),
      WhatsApp: whatsapp,
      notes: formValue.notes?.trim() || '',
      lastContactAt: formValue.lastContactAt 
        ? new Date(formValue.lastContactAt).toISOString()
        : detail.client.lastContactAt,
      tags: Array.isArray(formValue.tags)
        ? formValue.tags.filter((t: string) => !!t && typeof t === 'string')
        : []
    };

    // Atualiza via API
    this.clientsDataService.updateClient(detail.client.id, updateDto).subscribe({
      next: (updatedClient) => {
        console.log('✅ [ClientDetail] Cliente atualizado via API:', updatedClient);
        
        // Atualiza o estado local
        this.originalClient = { ...updatedClient };
        this.clientDetail.set({
          ...detail,
          client: updatedClient
        });
        
        // Atualiza também o store local para sincronização
        this.store.upsertClient(updatedClient);
        
        // Sai do modo de edição
        this.isEditMode.set(false);
        this.isSaving.set(false);
        
        // Log telemetry
        try {
          this.telemetryService.log('client_updated', { 
            clientId: updatedClient.id,
            source: 'detail_page'
          });
        } catch {
          // Silent fail
        }
        
        // Feedback visual
        this.toastService.showSuccess('Cliente atualizado com sucesso!');
        
      },
      error: (error) => {
        console.error('❌ [ClientDetail] Erro ao atualizar cliente:', error);
        this.isSaving.set(false);
        this.validationError.set('Erro ao salvar o cliente. Tente novamente.');
        this.toastService.showError('Erro ao atualizar cliente');
      }
    });
  }

  /**
   * Adiciona uma tag ao cliente
   */
  addTagToClient(): void {
    const tagInput = this.newTag().trim();
    if (!tagInput) return;
    
    const currentTags = this.editForm.get('tags')?.value || [];
    
    // Verifica se a tag já existe
    if (currentTags.includes(tagInput)) {
      this.newTag.set('');
      return;
    }
    
    // Adiciona a tag
    const updatedTags = [...currentTags, tagInput];
    this.editForm.patchValue({ tags: updatedTags });
    this.newTag.set('');
  }

  /**
   * Remove uma tag do cliente
   */
  removeTagFromClient(tag: string): void {
    const currentTags = this.editForm.get('tags')?.value || [];
    const updatedTags = currentTags.filter((t: string) => t !== tag);
    this.editForm.patchValue({ tags: updatedTags });
  }

  /**
   * Obtém as tags atuais do formulário
   */
  getCurrentTags(): string[] {
    if (this.isEditMode()) {
      return this.editForm.get('tags')?.value || [];
    }
    return this.clientDetail()?.client.tags || [];
  }

  goBack(): void {
    this.router.navigate(['/app/clientes']);
  }

  openWhatsApp(): void {
    const detail = this.clientDetail();
    if (detail?.client) {
      // Navega para a tela de mensagens com o cliente
      this.router.navigate(['/app/mensagens', detail.client.id]);
    }
  }

  /**
   * Simula uma mensagem inbound (resposta do cliente) para testar engajamento no score
   */
  simulateInboundMessage(): void {
    const detail = this.clientDetail();
    if (!detail) return;

    const responses = [
      'Oi! Tudo bem?',
      'Pode me enviar mais informações?',
      'Adorei! Quero comprar!',
      'Quanto fica esse produto?',
      'Obrigado pela atenção!',
      'Vou passar aí na loja hoje',
      'Preciso pensar melhor',
      'Pode me mandar o catálogo?'
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // Cria uma mensagem inbound simulada via API
    this.messagesApi.createMessage({
      clientId: detail.client.id,
      channel: 'whatsapp',
      provider: 'simulator',
      direction: 'inbound',
      text: randomResponse,
      textPreview: randomResponse,
      meta: { simulated: true }
    }).subscribe({
      next: (message) => {
        console.log('✅ [ClientDetail] Inbound message created:', message);

        // Criar atividade
        this.store.createActivity(
          detail.client.id,
          'message_received',
          `Cliente respondeu: "${randomResponse}"`,
          { simulated: true }
        );

        // Recarregar mensagens e detail
        this.reloadMessages();

        this.store.getClientDetail(detail.client.id).subscribe({
          next: (updatedDetail) => {
            if (updatedDetail) {
              this.clientDetail.set(updatedDetail);
              alert(`✅ Resposta simulada!\n\n"${randomResponse}"\n\nScore atualizado com bônus de engajamento.`);
            }
          }
        });
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Error creating inbound message:', err);
        alert('Erro ao simular resposta do cliente');
      }
    });

    // Log telemetry
    try {
      this.telemetryService.log('client_updated', {
        clientId: detail.client.id,
        detail: 'simulated_inbound'
      });
    } catch {
      // Silent fail
    }
  }

  registerSale(): void {
    // Abre o modal de venda
    this.isSaleModalOpen.set(true);
  }

  closeSaleForm(): void {
    this.isSaleModalOpen.set(false);
  }

  onSaleCreated(sale: Sale): void {
    const detail = this.clientDetail();
    if (!detail) return;

    console.log('✅ [ClientDetail] Venda criada:', sale);
    
    // Fecha o modal
    this.isSaleModalOpen.set(false);
    
    console.log('🔄 [ClientDetail] Recarregando cliente após registrar venda...');
    
    // Recarregar client detail para atualizar histórico
    this.store.getClientDetail(detail.client.id).subscribe({
      next: (updatedDetail) => {
        if (updatedDetail) {
          this.clientDetail.set(updatedDetail);
          console.log('✅ [ClientDetail] ClientDetail completo atualizado');
        }
        // Refresh score separado (backend recalcula após venda)
        this.refreshScore(detail.client.id);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Erro ao recarregar detail:', err);
      }
    });
  }

  addTag(): void {
    const detail = this.clientDetail();
    if (!detail) return;
    
    // Abre o modal seletor de tags
    this.isTagModalOpen.set(true);
  }

  /**
   * Callback quando uma tag é aplicada no modal
   */
  onTagApplied(tagSlug: string): void {
    const detail = this.clientDetail();
    if (!detail) return;

    console.log('🏷️ [ClientDetail] Tag aplicada:', tagSlug);
    console.log('🏷️ [ClientDetail] Score atual:', detail.client.score);

    // Recarregar client direto da API para pegar score atualizado
    console.log('🔄 [ClientDetail] Recarregando cliente após aplicar tag...');
    this.store.getClientDetail(detail.client.id).subscribe({
      next: (updatedDetail) => {
        if (updatedDetail) {
          this.clientDetail.set(updatedDetail);
          console.log('✅ [ClientDetail] ClientDetail completo atualizado');
        }
        // Refresh score (tags impactam score)
        this.refreshScore(detail.client.id);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Erro ao recarregar detail:', err);
      }
    });
    
    // Log telemetry
    try {
      this.telemetryService.log('client_updated', {
        clientId: detail.client.id,
        action: 'tag_applied',
        tagSlug: tagSlug
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Callback quando uma tag é removida no modal
   */
  onTagRemoved(tagSlug: string): void {
    const detail = this.clientDetail();
    if (!detail) return;

    console.log('🔄 [ClientDetail] Recarregando cliente após remover tag...');
    // Recarregar client detail e score
    this.store.getClientDetail(detail.client.id).subscribe({
      next: (updatedDetail) => {
        if (updatedDetail) {
          this.clientDetail.set(updatedDetail);
        }
        // Refresh score (tags impactam score)
        this.refreshScore(detail.client.id);
      },
      error: (err) => {
        console.error('❌ [ClientDetail] Erro ao recarregar detail:', err);
      }
    });
    
    // Log telemetry
    try {
      this.telemetryService.log('client_updated', {
        clientId: detail.client.id,
        action: 'tag_removed',
        tagSlug: tagSlug
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Remove uma tag do cliente (view mode)
   */
  removeClientTag(tagSlug: string): void {
    const detail = this.clientDetail();
    if (!detail) return;

    // Find tag label from API tags
    const tagDef = this.allTags().find(t => t.slug === tagSlug);
    const tagLabel = tagDef?.label || tagSlug;

    if (!confirm(`Deseja remover a tag "${tagLabel}"?`)) {
      return;
    }

    // Remove a tag via API
    this.tagsApi.removeTagFromClient(detail.client.id, tagSlug).subscribe({
      next: () => {
        // Recarregar detail completo com score atualizado
        this.store.getClientDetail(detail.client.id).subscribe({
          next: (updatedDetail) => {
            if (updatedDetail) {
              this.clientDetail.set(updatedDetail);
            }
            // Refresh score (tags impactam score)
            this.refreshScore(detail.client.id);
          }
        });

        this.toastService.showSuccess(`Tag "${tagLabel}" removida com sucesso!`);

        // Log telemetry
        try {
          this.telemetryService.log('client_updated', {
            clientId: detail.client.id,
            action: 'tag_removed_direct',
            tagSlug: tagSlug
          });
        } catch {
          // Silent fail
        }
      },
      error: (err) => {
        console.error('❌ Erro ao remover tag:', err);
        this.toastService.showError('Erro ao remover tag. Tente novamente.');
      }
    });
  }

  /**
   * Retorna a definição de uma tag pelo ID (agora o backend retorna IDs no array de tags)
   */
  getTagDefinition(tagIdOrSlug: string) {
    const tags = this.allTags();
    // Tenta buscar por ID primeiro (novo formato)
    const byId = tags.find(t => t.id === tagIdOrSlug);
    if (byId) return byId;
    // Fallback: busca por slug (compatibilidade com dados antigos)
    return tags.find(t => t.slug === tagIdOrSlug);
  }

  /**
   * Fecha o modal de tag
   */
  onTagModalClosed(): void {
    this.isTagModalOpen.set(false);
  }

  applySuggestion(suggestionId: string): void {
    console.log('🎯 [ClientDetail] applySuggestion chamado para:', suggestionId);
    const detail = this.clientDetail();
    if (!detail) {
      console.error('❌ [ClientDetail] clientDetail não existe');
      return;
    }

    const suggestion = detail.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      console.error('❌ [ClientDetail] Sugestão não encontrada:', suggestionId);
      return;
    }

    console.log('✅ [ClientDetail] Sugestão encontrada:', suggestion);

    // Clear previous messages
    this.suggestionSuccess.set(null);
    this.suggestionError.set(null);

    // Set loading state
    this.applyingSuggestion.set(suggestionId);
    console.log('⏳ [ClientDetail] Loading state definido');

    // 1. Apply the suggestion locally (create followup, add tag, etc)
    this.aiSuggestionActions.applySuggestion(detail.client.id, suggestion)
      .then(result => {
        console.log('📦 [ClientDetail] Resultado local recebido:', result);

        if (!result.success) {
          console.error('❌ [ClientDetail] Falha ao aplicar sugestão localmente:', result.message);
          this.suggestionError.set(`❌ ${result.message}`);
          setTimeout(() => this.suggestionError.set(null), 5000);
          this.applyingSuggestion.set(null);
          return;
        }

        // 2. Call API to persist the application
        const apiPayload = {
          clientId: detail.client.id,
          suggestionId: suggestion.id,
          suggestionType: suggestion.action,
          suggestionText: suggestion.title,
          metadata: {
            actions: result.actions,
            followupId: result.followupId,
            sentMessageId: result.sentMessageId,
            composerUrl: result.composerUrl
          }
        };

        console.log('📡 [ClientDetail] Chamando API /suggestions/apply:', apiPayload);

        this.suggestionsApi.apply(apiPayload).pipe(
          catchError(error => {
            console.error('❌ [ClientDetail] Erro na API /suggestions/apply:', error);
            // Continue mesmo se API falhar (já aplicamos localmente)
            return of(null);
          }),
          switchMap(() => {
            // 3. Reload client detail (score, breakdown, followups)
            console.log('🔄 [ClientDetail] Recarregando dados do cliente...');
            return this.store.getClientDetail(detail.client.id);
          })
        ).subscribe({
          next: (updatedDetail) => {
            if (updatedDetail) {
              // Remove a sugestão aplicada da lista
              const filteredDetail = { 
                ...updatedDetail, 
                suggestions: updatedDetail.suggestions.filter(s => s.id !== suggestionId) 
              };
              this.clientDetail.set(filteredDetail);
              console.log('✅ [ClientDetail] Dados atualizados e sugestão removida');
            }

            // Show success toast with summary
            const actionsText = result.actions.join(', ');
            let toastMessage = `✅ Sugestão aplicada: ${actionsText}`;
            
            if (result.followupId) {
              toastMessage += ' • Follow-up criado';
            }
            if (result.sentMessageId) {
              toastMessage += ' • Mensagem enviada';
            }

            this.suggestionSuccess.set(toastMessage);
            console.log('✅ [ClientDetail] Toast de sucesso:', toastMessage);

            // Auto-hide success message after 5 seconds
            setTimeout(() => {
              if (this.suggestionSuccess() === toastMessage) {
                this.suggestionSuccess.set(null);
              }
            }, 5000);

            // If composer URL is provided, open the composer
            if (result.composerUrl) {
              console.log('✉️ [ClientDetail] Abrindo composer...');
              const templateId = suggestion.payload?.composer?.templateId;
              if (templateId) {
                this.composerContext.set({
                  mode: 'client',
                  clientId: detail.client.id,
                  source: 'client' as const,
                  clientLocked: true,
                  recommendedTemplateId: templateId
                });
                this.isComposerOpen.set(true);
                console.log('✅ [ClientDetail] Composer aberto com templateId:', templateId);
              }
            }

            // Log telemetry
            try {
              this.telemetryService.log('client_updated', {
                clientId: detail.client.id,
                detail: 'suggestion_applied',
                suggestionId,
                suggestionTitle: suggestion.title,
                messageSent: !!result.sentMessageId,
                followupCreated: !!result.followupId
              });
            } catch {
              // Silent fail
            }

            // Clear loading state
            this.applyingSuggestion.set(null);
            console.log('✅ [ClientDetail] Loading state limpo');
          },
          error: (error) => {
            console.error('❌ [ClientDetail] Erro ao recarregar dados:', error);
            this.suggestionError.set('❌ Erro ao atualizar dados do cliente');
            setTimeout(() => this.suggestionError.set(null), 5000);
            this.applyingSuggestion.set(null);
          }
        });
      })
      .catch(error => {
        console.error('❌ [ClientDetail] Erro ao aplicar sugestão:', error);
        this.suggestionError.set('❌ Erro ao aplicar sugestão');
        setTimeout(() => this.suggestionError.set(null), 5000);
        this.applyingSuggestion.set(null);
      });
  }

  getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
    }
  }

  getPriorityLabel(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
    }
  }

  getScoreLevelClass(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-red-100 text-red-800';
    }
  }

  getScoreLevelLabel(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Médio';
      case 'low':
        return 'Baixo';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  formatDate(isoString: string): string {
    if (!isoString) {
      return '-';
    }
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      console.warn('⚠️ [ClientDetail] Data inválida:', isoString);
      return '-';
    }
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  // Message methods
  getMessageStatusLabel(status: Message['status']): string {
    return MessageStatusLabels[status];
  }

  getMessageStatusClass(status: Message['status']): string {
    return MessageStatusColors[status];
  }

  getProviderLabel(provider: Message['provider']): string {
    return MessageProviderLabels[provider];
  }

  setMessageFilter(filter: 'all' | 'sent' | 'received' | 'failed'): void {
    this.messageFilter.set(filter);
  }

  /**
   * Reenvia uma mensagem que falhou
   */
  retryMessage(message: Message): void {
    if (message.status !== 'failed') return;

    const detail = this.clientDetail();
    if (!detail) return;

    // Abre o composer pré-preenchido com a mensagem
    this.composerContext.set({
      mode: 'client',
      clientId: detail.client.id,
      source: 'client',
      clientLocked: true,
    });
    
    this.isComposerOpen.set(true);
    
    alert('💡 Use o composer para reenviar a mensagem com um template.');
  }

  formatMessageDate(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  /**
   * Abre o MessageComposer
   */
  openMessageComposer(): void {
    const detail = this.clientDetail();
    console.log('🚀 [ClientDetail] openMessageComposer called, detail:', detail);
    
    if (!detail) return;

    const context: MessageComposerContext = {
      mode: 'client',
      clientId: detail.client.id,
      source: 'client' as const,
      clientLocked: true
    };
    
    console.log('🚀 [ClientDetail] Setting composer context:', context);
    this.composerContext.set(context);
    
    console.log('🚀 [ClientDetail] Opening composer, isOpen:', this.isComposerOpen());
    this.isComposerOpen.set(true);
    console.log('🚀 [ClientDetail] Composer opened, isOpen:', this.isComposerOpen());

    try {
      this.telemetryService.log('client_viewed', {
        clientId: detail.client.id
      });
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
   */
  onComposerMessageSent(event: { messageId: string }): void {
    console.log('✅ [ClientDetail] Mensagem enviada via composer:', event.messageId);
    
    // Toast de confirmação
    this.toastService.showSuccess('Mensagem enviada com sucesso!');

    // Recarrega mensagens para exibir a nova mensagem
    this.reloadMessages();
    // Refetch após breve delay para garantir consistência com o backend
    setTimeout(() => this.reloadMessages(), 800);
    
    // Inicia polling para atualizar status da mensagem (10s por 1 minuto = 6 vezes)
    this.startMessagePolling();
    
    const clientId = this.clientDetail()?.client.id;
    if (clientId) {
      // Recarregar client para atualizar dados gerais
      console.log('🔄 [ClientDetail] Recarregando cliente após envio de mensagem...');
      this.clientsDataService.getClientById(clientId).subscribe({
        next: (updatedClient) => {
          const currentDetail = this.clientDetail();
          if (currentDetail && updatedClient) {
            this.clientDetail.set({
              ...currentDetail,
              client: updatedClient
            });
          }
          // Refresh score separado (mensagens impactam score)
          this.refreshScore(clientId);
        },
        error: (err) => {
          console.error('❌ [ClientDetail] Erro ao recarregar cliente após mensagem:', err);
        }
      });

      try {
        this.telemetryService.log('client_viewed', {
          clientId,
          messageId: event.messageId,
          action: 'message_sent'
        });
      } catch {
        // Silent fail
      }
    }
  }

  /**
   * Alterna o opt-in do WhatsApp
   */
  toggleWhatsAppOptIn(): void {
    const detail = this.clientDetail();
    if (!detail) return;

    const newOptIn = !detail.client.whatsappOptIn;
    
    // Atualiza no store
    this.store.updateWhatsAppOptIn(detail.client.id, newOptIn);
    
    // Atualiza localmente
    this.clientDetail.set({
      ...detail,
      client: {
        ...detail.client,
        whatsappOptIn: newOptIn,
        whatsappOptInAt: newOptIn ? new Date().toISOString() : undefined
      }
    });

    try {
      this.telemetryService.log('client_updated', {
        clientId: detail.client.id,
        detail: 'whatsapp_optin_toggled'
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Formata timestamp para exibição amigável
   */
  formatTimestamp(isoString?: string): string {
    if (!isoString) return '-';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 10) return 'agora';
    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHour < 24) return `${diffHour}h`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Obtém informações de timing da mensagem
   */
  getMessageTiming(message: Message): string {
    const parts: string[] = [];
    
    if (message.sentAt) {
      parts.push(`✓ Enviada ${this.formatTimestamp(message.sentAt)}`);
    }
    
    if (message.deliveredAt) {
      parts.push(`✓✓ Entregue ${this.formatTimestamp(message.deliveredAt)}`);
    }
    
    if (message.readAt) {
      parts.push(`✓✓ Lida ${this.formatTimestamp(message.readAt)}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : '';
  }

  /**
   * Verifica se a mensagem tem detalhes de timing
   */
  hasTimingDetails(message: Message): boolean {
    return !!(message.sentAt || message.deliveredAt || message.readAt);
  }

  /**
   * Alterna a expansão dos detalhes de uma mensagem
   */
  toggleMessageDetails(messageId: string): void {
    if (this.expandedMessageId() === messageId) {
      this.expandedMessageId.set(null);
    } else {
      this.expandedMessageId.set(messageId);
    }
  }

  /**
   * Verifica se a mensagem está expandida
   */
  isMessageExpanded(messageId: string): boolean {
    return this.expandedMessageId() === messageId;
  }

  /**
   * Retorna o ícone para o tipo de atividade
   */
  getActivityIcon(type: ClientActivityType): string {
    const icons: Record<ClientActivityType, string> = {
      message_sent: '✉️',
      message_failed: '❌',
      message_received: '📨',
      tag_added: '🏷️',
      tag_removed: '🗑️',
      opt_in_enabled: '✅',
      opt_in_disabled: '🚫',
      client_created: '➕',
      client_updated: '✏️',
    };
    return icons[type] || '📝';
  }

  /**
   * Retorna a cor da borda para o tipo de atividade
   */
  getActivityBorderColor(type: ClientActivityType): string {
    const colors: Record<ClientActivityType, string> = {
      message_sent: 'border-blue-500',
      message_failed: 'border-red-500',
      message_received: 'border-green-500',
      tag_added: 'border-purple-500',
      tag_removed: 'border-gray-500',
      opt_in_enabled: 'border-green-500',
      opt_in_disabled: 'border-yellow-500',
      client_created: 'border-blue-500',
      client_updated: 'border-gray-500',
    };
    return colors[type] || 'border-blue-500';
  }

  /**
   * Retorna a classe CSS para um label de score (vindo da API)
   */
  getScoreClassForLabel(label: string): string {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('alta') || lowerLabel.includes('high')) {
      return 'bg-green-100 text-green-800';
    } else if (lowerLabel.includes('média') || lowerLabel.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-red-100 text-red-800';
    }
  }

  /**
   * Retorna uma string amigável de dias atrás
   */
  getDaysAgo(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoje';
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays <= 7) {
      return `${diffDays} dias atrás`;
    } else if (diffDays <= 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`;
    } else if (diffDays <= 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
    } else {
      return 'Há mais de 1 ano';
    }
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    // Para o polling de mensagens ao sair da página
    this.stopMessagePolling();
  }
}
