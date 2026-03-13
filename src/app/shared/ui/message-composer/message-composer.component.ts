import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessagesApiService } from '../../../features/messages/data-access/messages-api.service';
import { ClientsStore, Client } from '../../../features/clients/data-access';
import { ClientsApiService } from '../../../features/clients/data-access/clients-api.service';
import { TelemetryService } from '../../../core/telemetry';
import { TemplateStore } from '../../../features/central/data-access/template.store';
import { TemplateSuggestionContext, TemplateSuggestion } from '../../../features/central/data-access/templates-api.service';
import { ScoreBadgeComponent } from '../score-badge/score-badge.component';
import { getFirstContactMessage } from '../../constants/whatsapp.constants';
import { AiEngineService, AiClientAnalysis } from '../../../core/ai';
import { EventBusService } from '../../../shared/services/event-bus.service';
import { environment } from '../../../../environments/environment';
import { Product } from '../../../features/catalog/data-access/catalog.models';
import { ProductService } from '../../../features/catalog/data-access/product.service';
import { WorkspaceService } from '../../../core/workspace';

// ---------------------------------------------------------------------------
// Modos de operacao do Composer
// ---------------------------------------------------------------------------
export type ComposerMode = 'client' | 'central' | 'free';

export interface MessageComposerContext {
  /** Modo de operacao */
  mode: ComposerMode;
  clientId?: string;
  followUpId?: string;
  suggestedText?: string;
  /** Legado / compatibilidade */
  productId?: string;
  source?: 'central' | 'client' | 'product';
  recommendedTemplateId?: string;
  clientLocked?: boolean;
  /**
   * Contexto de sugestão de templates:
   * - NEEDS_REPLY: followUp com tipo awaiting_customer_reply
   * - NO_RESPONSE_48H: followUp sem resposta há 48h+
   * - POST_SALE: após registrar venda
   * - GENERAL: padrão
   */
  suggestionContext?: TemplateSuggestionContext;
}

@Component({
  selector: 'app-message-composer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScoreBadgeComponent],
  templateUrl: './message-composer.component.html',
})
export class MessageComposerComponent {
  private messagesApi = inject(MessagesApiService);
  private clientsStore = inject(ClientsStore);
  private clientsApi = inject(ClientsApiService);
  private telemetry = inject(TelemetryService);
  private templateStore = inject(TemplateStore);
  private aiEngine = inject(AiEngineService);
  private eventBus = inject(EventBusService);
  private productService = inject(ProductService);
  private workspaceService = inject(WorkspaceService);

  @Input() isOpen = false;
  @Input() set context(value: MessageComposerContext | null) {
    if (value) {
      this.contextSignal.set(value);
    }
  }

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<{ messageId: string }>();

  // --- State ---
  contextSignal = signal<MessageComposerContext | null>(null);
  selectedClientId = signal<string | null>(null);
  selectedClient = signal<Client | null>(null);
  selectedTemplateId = signal<string>('');
  messageText = signal<string>('');
  provider = signal<'simulator' | 'meta'>('meta');
  sending = signal(false);
  sendSuccess = signal(false);
  sentMessageId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  loadingClient = signal(false);

  // Seletor de cliente (modo free)
  showClientSelector = signal(false);
  allClients = signal<Client[]>([]);
  clientSearchTerm = signal<string>('');

  // Seletor de produto
  showProductSelector = signal(false);
  allProducts = signal<Product[]>([]);
  selectedProduct = signal<Product | null>(null);
  productSearchTerm = signal<string>('');

  // IA
  showAiAnalysis = signal(false);
  clientAiAnalysis = signal<AiClientAnalysis | null>(null);

  // Template suggestions (API-based)
  templateSuggestion = signal<TemplateSuggestion | null>(null);
  templateSuggestionReason = signal<string | null>(null);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  mode = computed<ComposerMode>(() => {
    const ctx = this.contextSignal();
    return ctx?.mode ?? 'free';
  });

  isClientLocked = computed(() => this.mode() !== 'free');

  filteredClients = computed(() => {
    const term = this.clientSearchTerm().toLowerCase().trim();
    const clients = this.allClients();
    if (!term) return clients.slice(0, 50);
    return clients
      .filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.whatsapp?.includes(term)
      )
      .slice(0, 50);
  });

  daysSinceLastContact = computed(() => {
    const client = this.selectedClient();
    if (!client?.lastContactAt) return null;
    return Math.floor((Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24));
  });

  canSendMessage = computed(() => {
    const client = this.selectedClient();
    const text = this.messageText().trim();
    if (!client || !text || this.sending()) return false;
    
    // Validate WhatsApp Business requirements
    if (!client.whatsapp) return false; // Must have phone number
    
    // Opt-in implícito: Cliente que já teve contato anterior tem opt-in implícito
    const hasImplicitOptIn = client.whatsappOptIn === true || !!client.lastContactAt;
    if (!hasImplicitOptIn) return false;
    
    // If template is required, must have an approved template selected
    if (this.requiresTemplate()) {
      const selectedTemplate = this.templates().find(t => t.id === this.selectedTemplateId());
      if (!selectedTemplate || !selectedTemplate.isApproved) return false;
    }
    
    return true;
  });

  complianceWarning = computed(() => {
    const client = this.selectedClient();
    const prov = this.provider();
    if (!client) return null;

    // Check if Meta mode requires phone number
    if (!client.whatsapp) {
      return {
        type: 'error' as const,
        title: 'WhatsApp não cadastrado',
        message: 'Cliente precisa ter um número de WhatsApp cadastrado. Edite o cliente para adicionar.'
      };
    }

    // Opt-in implícito: Cliente que já teve contato anterior
    const hasImplicitOptIn = client.whatsappOptIn === true || !!client.lastContactAt;
    
    if (!hasImplicitOptIn) {
      return {
        type: 'error' as const,
        title: 'Cliente não autorizou WhatsApp',
        message: 'Não é possível enviar mensagens. O cliente precisa autorizar receber mensagens no WhatsApp ou ter histórico de contato.'
      };
    }
    
    // Warning if explicit opt-in is missing but has contact history
    if (!client.whatsappOptIn && client.lastContactAt) {
      return {
        type: 'info' as const,
        title: 'Opt-in via histórico de contato',
        message: 'Cliente tem histórico de contato. Considere marcar opt-in explícito na edição do cliente.'
      };
    }

    return null;
  });

  // Meta is ready if we're in production or if templates exist
  metaReady = computed(() => {
    return true; // Always allow Meta mode - backend will validate configuration
  });

  templates = computed(() => {
    // Use approved templates from store (already filtered for Meta compliance)
    const approvedFromStore = this.templateStore.approvedTemplates();
    
    console.log('[MessageComposer] 🔍 Approved templates from store:', approvedFromStore.length);
    
    // Map to component format
    const mapped = approvedFromStore.map(t => {
      const result = {
        id: t.id,
        name: t.title,
        preview: t.body,
        variables: this.extractVariables(t.body),
        metaStatus: t.meta?.status ?? 'APPROVED', // Already approved
        isApproved: true, // All templates here are approved
        isActive: t.isActive,
      };
      
      console.log('[MessageComposer] 🔍 Template mapped:', {
        name: result.name,
        metaStatus: result.metaStatus,
        isApproved: result.isApproved
      });
      
      return result;
    });

    console.log('[MessageComposer] ✅ Final approved templates:', mapped.length);
    
    return mapped;
  });

  // Check if we need to use a template (when starting conversation or outside 24h window)
  requiresTemplate = computed(() => {
    const client = this.selectedClient();
    if (!client) return false;
    
    // If no last contact, require template to start conversation
    if (!client.lastContactAt) return true;
    
    // If last contact was more than 24 hours ago, require template
    const hoursSinceLastContact = (Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastContact > 24;
  });

  approvedTemplatesAvailable = computed(() => {
    return this.templates().some(t => t.isApproved);
  });

  // Forçar sempre Meta (WhatsApp Business) - sem opção de simulador
  providers = [{ value: 'meta' as const, label: 'WhatsApp Business' }];

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor() {
    effect(() => {
      const ctx = this.contextSignal();
      if (ctx && this.isOpen) {
        this.loadContextData(ctx);
      }
    });

    this.clientsStore.getClients().subscribe({
      next: (clients) => this.allClients.set(clients),
    });
  }

  // ---------------------------------------------------------------------------
  // Load context
  // ---------------------------------------------------------------------------

  private loadContextData(ctx: MessageComposerContext): void {
    this.sendSuccess.set(false);
    this.errorMessage.set(null);
    this.showAiAnalysis.set(false);
    this.clientAiAnalysis.set(null);
    this.templateSuggestion.set(null);
    this.templateSuggestionReason.set(null);

    // Texto sugerido
    if (ctx.suggestedText) {
      this.messageText.set(ctx.suggestedText);
    } else {
      this.messageText.set('');
    }

    // Template recomendado
    if (ctx.recommendedTemplateId) {
      this.selectedTemplateId.set(ctx.recommendedTemplateId);
      if (!ctx.suggestedText) {
        this.applyTemplateText(ctx.recommendedTemplateId);
      }
    } else {
      this.selectedTemplateId.set('');
    }

    // Cliente
    if (ctx.clientId) {
      this.selectedClientId.set(ctx.clientId);
      this.loadingClient.set(true);
      this.clientsStore.getClients().subscribe({
        next: (clients) => {
          const client = clients.find(c => c.id === ctx.clientId);
          if (client) {
            this.selectedClient.set(client);
            this.runAiAnalysis(client);
            if (this.selectedTemplateId() && !ctx.suggestedText) {
              this.applyTemplateText(this.selectedTemplateId());
            }
            // Load template suggestions from API if context is available
            this.loadTemplateSuggestions(ctx, client);
          } else {
            this.selectedClient.set(null);
          }
          this.loadingClient.set(false);
        },
      });
    } else {
      this.selectedClientId.set(null);
      this.selectedClient.set(null);
      this.loadingClient.set(false);
    }
  }

  /**
   * Loads template suggestions from the API.
   * Uses suggestionContext from the ComposerContext.
   * Auto-selects the top suggestion if no template is already set.
   * In Meta mode, only selects approved templates.
   */
  private loadTemplateSuggestions(ctx: MessageComposerContext, client: Client): void {
    const sugCtx = ctx.suggestionContext ?? 'GENERAL';
    this.templateStore.loadSuggestions(client.id, sugCtx);

    // Wait for suggestions to load, then auto-select #1 if no template selected
    const checkInterval = setInterval(() => {
      if (!this.templateStore.suggestionsLoading()) {
        clearInterval(checkInterval);
        const top = this.templateStore.topSuggestion();
        
        // topSuggestion is already filtered for approved templates in TemplateStore
        if (top) {
          this.templateSuggestion.set(top);
          this.templateSuggestionReason.set(top.reason);

          // Auto-select if no template already chosen
          if (!this.selectedTemplateId() && !ctx.recommendedTemplateId) {
            this.selectedTemplateId.set(top.templateId);
            this.applyTemplateText(top.templateId);
          }
        } else {
          // No approved templates available in suggestions
          this.templateSuggestion.set(null);
          this.templateSuggestionReason.set(null);
        }
      }
    }, 100);

    // Safety timeout
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  // ---------------------------------------------------------------------------
  // Template -> Texto
  // ---------------------------------------------------------------------------

  private applyTemplateText(templateId: string): void {
    const template = this.templates().find(t => t.id === templateId);
    if (!template) return;

    let text = template.preview;
    
    // Substituir variáveis de cliente
    const client = this.selectedClient();
    if (client) {
      const firstName = client.name.split(' ')[0];
      // Double-curly format (frontend seed): {{primeiro_nome}}, {{nome_completo}}, {{nome}}
      text = text.replace(/\{\{primeiro_nome\}\}/g, firstName);
      text = text.replace(/\{\{nome_completo\}\}/g, client.name);
      text = text.replace(/\{\{nome\}\}/g, client.name);
      // Single-curly format (backend API): {NomeCliente}, {Nome}, {PrimeiroNome}
      text = text.replace(/\{NomeCliente\}/gi, firstName);
      text = text.replace(/\{PrimeiroNome\}/gi, firstName);
      text = text.replace(/\{NomeCompleto\}/gi, client.name);
      text = text.replace(/\{Nome\}/gi, client.name);
    }
    
    // Substituir variáveis de produto
    const product = this.selectedProduct();
    if (product) {
      console.log('[DEBUG applyTemplateText] Produto selecionado:', product);
      const productType = this.formatProductType(product.type);
      const productMaterial = this.formatProductMaterial(product.material);
      const productPrice = this.formatPrice(product.price);
      const vitrineLink = this.generateVitrineLink(product.id);
      console.log('[DEBUG applyTemplateText] Link da vitrine:', vitrineLink);
      
      // Variáveis de produto (double-curly: frontend)
      text = text.replace(/\{\{produto_nome\}\}/g, product.name);
      text = text.replace(/\{\{produto_preco\}\}/g, productPrice);
      text = text.replace(/\{\{produto_categoria\}\}/g, productType);
      text = text.replace(/\{\{produto_material\}\}/g, productMaterial);
      text = text.replace(/\{\{link_vitrine\}\}/g, vitrineLink);
      text = text.replace(/\{\{produto\}\}/g, product.name); // Compatibilidade
      text = text.replace(/\{\{preco\}\}/g, productPrice); // Compatibilidade
      
      // Variáveis de produto (single-curly: backend)
      text = text.replace(/\{ProdutoNome\}/gi, product.name);
      text = text.replace(/\{ProdutoPreco\}/gi, productPrice);
      text = text.replace(/\{ProdutoCategoria\}/gi, productType);
      text = text.replace(/\{ProdutoMaterial\}/gi, productMaterial);
      
      console.log('[DEBUG applyTemplateText] ANTES de substituir {LinkVitrine}:', text);
      text = text.replace(/\{LinkVitrine\}/gi, vitrineLink);
      console.log('[DEBUG applyTemplateText] DEPOIS de substituir {LinkVitrine}:', text);
      
      text = text.replace(/\{Produto\}/gi, product.name);
      text = text.replace(/\{Preco\}/gi, productPrice);
    }
    
    console.log('[DEBUG applyTemplateText] Texto final após substituições:', text);
    
    // Strip unresolved placeholders (both formats)
    text = text.replace(/\{\{\w+\}\}/g, '');
    text = text.replace(/\{\w+\}/g, '');
    this.messageText.set(text);
  }

  private formatProductType(type: string): string {
    const types: Record<string, string> = {
      'ANEL': 'Anel',
      'COLAR': 'Colar',
      'PULSEIRA': 'Pulseira',
      'BRINCO': 'Brinco',
      'CORRENTE': 'Corrente',
      'OUTRO': 'Joia'
    };
    return types[type] || type;
  }

  private formatProductMaterial(material: string): string {
    const materials: Record<string, string> = {
      'OURO': 'Ouro',
      'PRATA': 'Prata',
      'ACO': 'Aço',
      'PEROLA': 'Pérola',
      'FOLHEADO': 'Folheado',
      'OUTRO': 'Material especial'
    };
    return materials[material] || material;
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  private generateVitrineLink(productId: string): string {
    // Tentar obter workspace do sessionStorage
    let workspaceSlug: string | null = null;
    
    try {
      const workspaceJson = sessionStorage.getItem('currentWorkspace');
      console.log('[DEBUG generateVitrineLink] currentWorkspace JSON:', workspaceJson);
      if (workspaceJson) {
        const workspace = JSON.parse(workspaceJson);
        workspaceSlug = workspace.slug;
        console.log('[DEBUG generateVitrineLink] workspace.slug:', workspaceSlug);
      }
    } catch (e) {
      console.warn('Erro ao obter workspace do sessionStorage:', e);
    }
    
    // Se não tiver slug, use um padrão ou o ID do workspace
    if (!workspaceSlug) {
      const workspaceId = this.workspaceService.getCurrentWorkspaceId();
      workspaceSlug = workspaceId || 'vitrine';
      console.log('[DEBUG generateVitrineLink] Fallback para workspaceId:', workspaceSlug);
    }
    
    const finalLink = `${window.location.origin}/vitrine/${workspaceSlug}/${productId}`;
    console.log('[DEBUG generateVitrineLink] Link gerado:', finalLink);
    console.log('[DEBUG generateVitrineLink] ProductId:', productId);
    return finalLink;
  }

  onTemplateChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const templateId = select.value;
    this.selectedTemplateId.set(templateId);
    if (templateId) {
      this.applyTemplateText(templateId);
    }
  }

  // ---------------------------------------------------------------------------
  // Selecao de cliente (modo free)
  // ---------------------------------------------------------------------------

  onSelectClient(): void {
    this.clientSearchTerm.set('');
    this.showClientSelector.set(true);
  }

  onClientSelected(clientId: string): void {
    this.selectedClientId.set(clientId);
    this.showClientSelector.set(false);

    this.clientsStore.getClients().subscribe({
      next: (clients) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          this.selectedClient.set(client);
          this.runAiAnalysis(client);
          if (this.selectedTemplateId()) {
            this.applyTemplateText(this.selectedTemplateId());
          }
        }
      },
    });
  }

  onCloseClientSelector(): void {
    this.showClientSelector.set(false);
    this.clientSearchTerm.set('');
  }

  onClientSearchChange(event: Event): void {
    this.clientSearchTerm.set((event.target as HTMLInputElement).value);
  }

  // ---------------------------------------------------------------------------
  // Seleção de produto
  // ---------------------------------------------------------------------------

  onSelectProduct(): void {
    this.productSearchTerm.set('');
    this.showProductSelector.set(true);
    this.loadProducts();
  }

  private loadProducts(): void {
    this.productService.list({ activeOnly: true }).subscribe({
      next: (response) => {
        this.allProducts.set(response.items);
      },
      error: (err) => {
        console.error('Erro ao carregar produtos:', err);
        this.allProducts.set([]);
      }
    });
  }

  onProductSelected(productId: string): void {
    const product = this.allProducts().find(p => p.id === productId);
    if (product) {
      this.selectedProduct.set(product);
      this.showProductSelector.set(false);
      
      // Reaplica template se houver um selecionado
      if (this.selectedTemplateId()) {
        this.applyTemplateText(this.selectedTemplateId());
      }
    }
  }

  onRemoveProduct(): void {
    this.selectedProduct.set(null);
    if (this.selectedTemplateId()) {
      this.applyTemplateText(this.selectedTemplateId());
    }
  }

  onCloseProductSelector(): void {
    this.showProductSelector.set(false);
    this.productSearchTerm.set('');
  }

  onProductSearchChange(event: Event): void {
    this.productSearchTerm.set((event.target as HTMLInputElement).value);
  }

  filteredProducts = computed(() => {
    const term = this.productSearchTerm().toLowerCase().trim();
    if (!term) return this.allProducts();
    return this.allProducts().filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.type.toLowerCase().includes(term) ||
      p.material.toLowerCase().includes(term)
    );
  });

  // ---------------------------------------------------------------------------
  // Provider
  // ---------------------------------------------------------------------------
  // Auto-select Template
  // ---------------------------------------------------------------------------

  /**
   * Auto-seleciona o template padrão vendara_contato_inicial quando fora da janela
   */
  private autoSelectDefaultTemplate(): void {
    const defaultTemplate = this.templates().find(t => 
      t.name.toLowerCase().includes('vendara_contato_inicial') || 
      t.name.toLowerCase().includes('contato_inicial')
    );
    
    if (defaultTemplate) {
      this.selectedTemplateId.set(defaultTemplate.id);
      this.applyTemplateText(defaultTemplate.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Texto livre
  // ---------------------------------------------------------------------------

  onMessageTextChange(event: Event): void {
    this.messageText.set((event.target as HTMLTextAreaElement).value);
  }

  // ---------------------------------------------------------------------------
  // ENVIO via POST /api/messages/send
  // ---------------------------------------------------------------------------

  async onSend(): Promise<void> {
    const client = this.selectedClient();
    const text = this.messageText().trim();
    const ctx = this.contextSignal();

    if (!client || !text || !ctx) return;

    // Validate requirements for WhatsApp Business
    if (!client.whatsapp) {
      this.errorMessage.set('Cliente não possui WhatsApp cadastrado. Edite o cliente para adicionar um número.');
      return;
    }
    
    // Opt-in implícito: Cliente que já teve contato anterior tem opt-in implícito
    const hasImplicitOptIn = client.whatsappOptIn === true || !!client.lastContactAt;
    if (!hasImplicitOptIn) {
      this.errorMessage.set('Cliente não autorizou receber mensagens no WhatsApp e não tem histórico de contato.');
      return;
    }
    
    // If template is required, validate that an approved template is selected
    if (this.requiresTemplate()) {
      const selectedTemplate = this.templates().find(t => t.id === this.selectedTemplateId());
      if (!selectedTemplate) {
        this.errorMessage.set('Selecione um template aprovado para iniciar a conversa.');
        return;
      }
      if (!selectedTemplate.isApproved) {
        this.errorMessage.set('Template ainda não aprovado no Meta. Use apenas templates aprovados.');
        return;
      }
    }

    this.sending.set(true);
    this.errorMessage.set(null);

    try {
      this.telemetry.log('whatsapp_api_send_attempt', {
        mode: ctx.mode,
        provider: this.provider(),
        hasFollowUp: !!ctx.followUpId,
        requiresTemplate: this.requiresTemplate(),
      });
    } catch { /* silent */ }

    try {
      // Adicionar mensagem de apresentação se for primeiro contato
      let finalText = text;
      const isFirstContact = !client.lastContactAt;
      
      if (isFirstContact && !this.selectedTemplateId()) {
        const welcomeMsg = getFirstContactMessage(client.name);
        finalText = `${welcomeMsg}\n\n---\n\n${text}`;
        console.log('[Composer] 🎉 Primeiro contato! Adicionando mensagem de apresentação da Vendara');
      }

      const payload = {
        clientId: client.id,
        provider: this.provider(),
        text: finalText,
        // Incluir followUpId se presente
        ...(ctx.followUpId ? { followUpId: ctx.followUpId } : {}),
        // Incluir templateId SOMENTE se NÃO tiver produto selecionado
        // (quando tem produto, o frontend já fez a interpolação completa)
        ...(this.selectedTemplateId() && !this.selectedProduct() ? { templateId: this.selectedTemplateId() } : {}),
        // Ou usar o templateId da sugestão se disponível
        ...(this.templateSuggestion()?.templateId && !this.selectedTemplateId() && !this.selectedProduct()
          ? { templateId: this.templateSuggestion()!.templateId }
          : {}),
      };

      console.log('[Composer] 📤 Payload a ser enviado:', payload);
      console.log('[Composer] 📋 Detalhes:');
      console.log('  - clientId:', payload.clientId);
      console.log('  - provider:', payload.provider);
      console.log('  - text length:', payload.text?.length);
      console.log('  - text preview:', payload.text?.substring(0, 100));
      console.log('  - templateId:', payload.templateId);
      console.log('  - followUpId:', payload.followUpId);
      console.log('  - hasProduct:', !!this.selectedProduct());

      const message = await new Promise<any>((resolve, reject) => {
        this.messagesApi.sendMessage(payload).subscribe({
          next: (msg) => resolve(msg),
          error: (err) => reject(err),
        });
      });

      console.log('[Composer] Message sent:', message);

      this.sentMessageId.set(message.id);
      this.sendSuccess.set(true);
      this.sent.emit({ messageId: message.id });

      // Notificar globalmente que um follow-up pode ter sido concluído
      if (ctx.followUpId) {
        this.eventBus.emit('followUpUpdated');
      }

      try {
        this.telemetry.log('whatsapp_api_send_success', {
          messageId: message.id,
          mode: ctx.mode,
          provider: this.provider(),
        });
      } catch { /* silent */ }

      setTimeout(() => this.onClose(), 2000);
    } catch (error: any) {
      console.error('[Composer] Send error:', error);
      
      // Tratar erro 409 (Conflict)
      if (error?.status === 409) {
        const errorCode = error?.error?.code;
        const errorMsg = error?.error?.message || error?.message || 'Erro ao enviar mensagem.';
        
        if (errorCode === 'OUTSIDE_WINDOW') {
          // Fora da janela de 24h - forçar uso de template
          this.errorMessage.set('Fora da janela de atendimento. Use um template aprovado.');
          if (!this.selectedTemplateId()) {
            this.autoSelectDefaultTemplate();
          }
        } else if (errorCode === 'TEMPLATE_NOT_APPROVED') {
          // Template não aprovado - redirecionar para settings
          this.errorMessage.set('Template não aprovado no Meta. Configure templates em Settings.');
          // Opcional: redirecionar após delay
          // setTimeout(() => this.router.navigate(['/app/workspace/settings/templates']), 3000);
        } else {
          this.errorMessage.set(errorMsg);
        }
      } else {
        this.errorMessage.set(error?.error?.message || error?.message || 'Erro ao enviar mensagem. Tente novamente.');
      }

      try {
        this.telemetry.log('whatsapp_api_send_fail', {
          mode: ctx.mode,
          error: error?.message,
          status: error?.status,
          errorCode: error?.error?.code,
        });
      } catch { /* silent */ }
    } finally {
      this.sending.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Fechar / Reset
  // ---------------------------------------------------------------------------

  onClose(): void {
    if (this.sending()) return;
    this.closed.emit();
    this.reset();
  }

  private reset(): void {
    this.contextSignal.set(null);
    this.selectedClientId.set(null);
    this.selectedClient.set(null);
    this.selectedTemplateId.set('');
    this.messageText.set('');
    this.provider.set('meta');
    this.sending.set(false);
    this.sendSuccess.set(false);
    this.sentMessageId.set(null);
    this.errorMessage.set(null);
    this.showClientSelector.set(false);
    this.showAiAnalysis.set(false);
    this.clientAiAnalysis.set(null);
    this.loadingClient.set(false);
    this.templateSuggestion.set(null);
    this.templateSuggestionReason.set(null);
    this.templateStore.clearSuggestions();
  }

  // ---------------------------------------------------------------------------
  // IA
  // ---------------------------------------------------------------------------

  private runAiAnalysis(client: Client): void {
    const daysSince = Math.floor(
      (Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const analysis = this.aiEngine.computeClientAi({
      daysSinceLastContact: daysSince,
      hasNegotiatingTag: client.tags.includes('negociando'),
      hasBoughtBefore: false,
      lifetimeValue: 0,
      lastMessageIntent: undefined,
    });

    this.clientAiAnalysis.set(analysis);

    const ctx = this.contextSignal();
    if (!this.selectedTemplateId() && !ctx?.recommendedTemplateId) {
      const topSugg = analysis.suggestions[0];
      if (topSugg?.recommendedTemplateId) {
        const mapped = this.findTemplateByRecommendation(topSugg.recommendedTemplateId);
        if (mapped) {
          this.selectedTemplateId.set(mapped);
          this.applyTemplateText(mapped);
        }
      }
    }
  }

  private findTemplateByRecommendation(recommendedId: string): string | null {
    const templates = this.templates();
    if (!templates.length) return null;

    const mapping: Record<string, string[]> = {
      closing_deal: ['preco', 'price'],
      price_offer: ['preco', 'price'],
      gift_options: ['presente', 'gift'],
      delivery_info: ['entrega', 'delivery'],
      vip_reactivation: ['retomada', 'sumiu'],
      new_products: ['novidades', 'new'],
      re_engagement: ['sumiu', 'retomada'],
      post_sale: ['pos-venda', 'agradecimento'],
    };

    const keywords = mapping[recommendedId];
    if (!keywords) return templates[0].id;

    const match = templates.find(t =>
      keywords.some(kw => t.name.toLowerCase().includes(kw.toLowerCase()))
    );
    return match?.id || templates[0].id;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractVariables(body: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const vars: string[] = [];
    let m;
    while ((m = regex.exec(body)) !== null) {
      if (!vars.includes(m[1])) vars.push(m[1]);
    }
    return vars;
  }

  trackByClientId(_: number, client: Client): string {
    return client.id;
  }

  getAllClients(): Client[] {
    return this.filteredClients();
  }

  get composerTitle(): string {
    switch (this.mode()) {
      case 'client': return 'Enviar Mensagem';
      case 'central': return 'Enviar Mensagem (Follow-up)';
      case 'free': return 'Nova Mensagem';
    }
  }
}
