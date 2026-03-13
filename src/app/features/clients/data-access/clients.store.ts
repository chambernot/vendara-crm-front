import { inject, Injectable } from '@angular/core';
import { Observable, delay, map, of, switchMap, catchError, forkJoin, tap, throwError } from 'rxjs';
import { Client, ClientDetailVm, ClientInsight, ClientActivity, ClientActivityType, Sale } from './clients.models';
import { AiContextSignal, AiEngineService } from '../../../core/ai';
import { StorageService, STORAGE_KEYS } from '../../../core/storage';
import { TelemetryService } from '../../../core/telemetry';
import { environment } from '../../../../environments/environment';
import { ClientInsightsService } from './client-insights.service';
import { MessageStore } from '../../messages/data-access/message.store';
import { ClientsDataService } from './clients-data.service';

/**
 * Normaliza número de WhatsApp removendo caracteres especiais
 * Mantém apenas dígitos para comparação de unicidade
 */
function normalizeWhatsapp(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/[\s\+\(\)\-]/g, '');
}

/**
 * Deriva a intenção da última mensagem baseado em palavras-chave
 */
function deriveMessageIntent(snippet: string): 'price' | 'gift' | 'delivery' | 'other' {
  const lower = snippet.toLowerCase();
  
  if (lower.includes('preço') || lower.includes('quanto') || lower.includes('valor') || lower.includes('orçamento')) {
    return 'price';
  }
  if (lower.includes('presente') || lower.includes('gift') || lower.includes('aniversário') || lower.includes('esposa') || lower.includes('namorada')) {
    return 'gift';
  }
  if (lower.includes('entrega') || lower.includes('entregar') || lower.includes('prazo') || lower.includes('receber')) {
    return 'delivery';
  }
  
  return 'other';
}

/**
 * Seed inicial de clientes (apenas primeiro uso)
 */
function seedClients(): Client[] {
  return [
    {
      id: '1',
      name: 'Maria Silva',
      whatsapp: '+5511999887766',
      score: 85,
      scoreLabel: 'Alta',
      scoreTier: 'HOT',
      lastContactAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['vip', 'negociando'],
      notes: 'Cliente preferencial, adora brincos de ouro',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      name: 'João Santos',
      whatsapp: '+5511988776655',
      score: 45,
      scoreLabel: 'Média',
      scoreTier: 'WARM',
      lastContactAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['interessado'],
      notes: 'Procurou aliança, mas não fechou ainda',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      name: 'Ana Oliveira',
      whatsapp: '+5511977665544',
      score: 92,
      scoreLabel: 'Alta',
      scoreTier: 'HOT',
      lastContactAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['vip', 'fidelizado'],
      notes: 'Cliente há 3 anos, compra regularmente',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      name: 'Pedro Costa',
      whatsapp: '+5511966554433',
      score: 28,
      scoreLabel: 'Baixa',
      scoreTier: 'COLD',
      lastContactAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['inativo'],
      notes: 'Não responde há mais de um mês',
      whatsappOptIn: false, // Não autorizou
      whatsappOptInAt: undefined,
      lastInboundAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      name: 'Carla Fernandes',
      whatsapp: '+5511955443322',
      score: 67,
      scoreLabel: 'Média',
      scoreTier: 'WARM',
      lastContactAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['interessado', 'casamento'],
      notes: 'Pediu orçamento para alianças de noivado',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6',
      name: 'Roberto Lima',
      whatsapp: '+5511944332211',
      score: 73,
      scoreLabel: 'Alta',
      scoreTier: 'HOT',
      lastContactAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['negociando', 'presente'],
      notes: 'Quer comprar colar para esposa',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '7',
      name: 'Juliana Rocha',
      whatsapp: '+5511933221100',
      score: 38,
      scoreLabel: 'Baixa',
      scoreTier: 'COLD',
      lastContactAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['interessado'],
      notes: 'Perguntou sobre brincos de prata',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '8',
      name: 'Marcos Almeida',
      whatsapp: '+5511922110099',
      score: 88,
      scoreLabel: 'Alta',
      scoreTier: 'HOT',
      lastContactAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ['vip', 'fidelizado'],
      notes: 'Cliente corporativo, compra presentes para equipe',
      whatsappOptIn: true,
      whatsappOptInAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      lastInboundAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(), // Fora da janela 24h
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class ClientsStore {
  private aiEngine = inject(AiEngineService);
  private storage = inject(StorageService);
  private telemetryService = inject(TelemetryService);
  private insightsService = inject(ClientInsightsService);
  private messageStore = inject(MessageStore);
  private clientsDataService = inject(ClientsDataService);
  
  constructor() {
    // Remove duplicatas existentes na inicialização
    this.removeDuplicates();
    
    // ClientsDataService agora sempre usa API
  }
  
  // Clients agora vem do LocalStorage (ou seed se habilitado e vazio)
  private get clients(): Client[] {
    const stored = this.storage.get<Client[]>(STORAGE_KEYS.clients);
    
    // Se existe dados, retorna
    if (stored && stored.length > 0) {
      return stored;
    }
    
    // Se não existe E seed está habilitado, aplica seed usando upsert para evitar duplicatas
    if (environment.enableSeedData) {
      const seeded = this.applySeedData();
      return seeded;
    }
    
    // Sistema inicia vazio
    return [];
  }

  private set clients(value: Client[]) {
    this.storage.set(STORAGE_KEYS.clients, value);
  }

  // Activities storage
  private get activities(): ClientActivity[] {
    const stored = this.storage.get<ClientActivity[]>('client_activities');
    return stored || [];
  }

  private set activities(value: ClientActivity[]) {
    this.storage.set('client_activities', value);
  }

  // Sales storage
  private get sales(): Sale[] {
    const stored = this.storage.get<Sale[]>('client_sales');
    return stored || [];
  }

  private set sales(value: Sale[]) {
    this.storage.set('client_sales', value);
  }

  /**
   * Gera ID único para atividade
   */
  private generateActivityId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Gera ID único para venda
   */
  private generateSaleId(): string {
    return `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Adiciona uma venda para um cliente
   */
  addSale(clientId: string, amount: number, description?: string, date?: string): Sale {
    const sale: Sale = {
      id: this.generateSaleId(),
      clientId,
      amount,
      description,
      date: date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const sales = [...this.sales, sale];
    this.sales = sales;

    // Criar atividade
    this.createActivity(
      clientId,
      'client_updated',
      `Venda registrada: ${this.formatCurrency(amount)}${description ? ` - ${description}` : ''}`,
      { saleId: sale.id, amount, description }
    );

    // Score será recalculado no backend - front deve fazer GET após registrar venda

    // Log telemetry
    try {
      this.telemetryService.log('client_updated', {
        clientId,
        detail: 'sale_added',
        amount
      });
    } catch {
      // Silent fail
    }

    return sale;
  }

  /**
   * Obtém vendas de um cliente
   */
  getSalesByClient(clientId: string): Sale[] {
    return this.sales
      .filter(s => s.clientId === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Formata valor monetário
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  /**
   * Cria uma nova atividade para um cliente
   */
  createActivity(
    clientId: string, 
    type: ClientActivityType, 
    text: string, 
    meta?: Record<string, any>
  ): ClientActivity {
    const activity: ClientActivity = {
      id: this.generateActivityId(),
      clientId,
      type,
      text,
      createdAt: new Date().toISOString(),
      meta,
    };

    const activities = [...this.activities, activity];
    this.activities = activities;

    return activity;
  }

  /**
   * Obtém atividades de um cliente (ordenadas por data decrescente)
   */
  getActivities(clientId: string, limit?: number): ClientActivity[] {
    const activities = this.activities
      .filter(a => a.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return limit ? activities.slice(0, limit) : activities;
  }

  /**
   * Atualiza lastContactAt de um cliente
   */
  updateLastContact(clientId: string, date?: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === clientId);
    if (index === -1) return;

    clients[index].lastContactAt = date || new Date().toISOString();
    
    // Score será recalculado no backend na próxima requisição GET
    
    this.clients = clients;
  }

  /**
   * Atualiza lastOutboundAt quando uma mensagem outbound é enviada
   */
  updateLastOutbound(clientId: string, date?: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === clientId);
    if (index === -1) return;

    clients[index].lastOutboundAt = date || new Date().toISOString();
    
    // Atualizar também lastContactAt se for mais recente
    const newDate = date || new Date().toISOString();
    if (!clients[index].lastContactAt || new Date(newDate) > new Date(clients[index].lastContactAt)) {
      clients[index].lastContactAt = newDate;
    }
    
    // Score será recalculado no backend na próxima requisição GET
    
    this.clients = clients;
  }

  /**
   * Atualiza lastInboundAt quando recebe mensagem do cliente
   */
  updateLastInbound(clientId: string, date?: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === clientId);
    if (index === -1) return;

    clients[index].lastInboundAt = date || new Date().toISOString();
    
    // Atualizar também lastContactAt se for mais recente
    const newDate = date || new Date().toISOString();
    if (!clients[index].lastContactAt || new Date(newDate) > new Date(clients[index].lastContactAt)) {
      clients[index].lastContactAt = newDate;
    }
    
    // Score será recalculado no backend na próxima requisição GET
    
    this.clients = clients;
  }

  /**
   * Aplica seed data usando upsert para garantir que não haja duplicatas
   * mesmo se o seed for aplicado múltiplas vezes
   */
  private applySeedData(): Client[] {
    const seedData = seedClients();
    const existingClients = this.storage.get<Client[]>(STORAGE_KEYS.clients) || [];
    
    // Se não há clientes existentes, apenas salva o seed
    if (existingClients.length === 0) {
      this.storage.set(STORAGE_KEYS.clients, seedData);
      return seedData;
    }
    
    // Se há clientes, usa upsert para cada um do seed (evita duplicatas)
    let updatedClients = [...existingClients];
    seedData.forEach(seedClient => {
      const normalizedWhatsapp = normalizeWhatsapp(seedClient.whatsapp);
      
      // Busca se já existe por ID ou WhatsApp
      const existingIndex = updatedClients.findIndex(c => 
        c.id === seedClient.id || 
        (normalizedWhatsapp && normalizeWhatsapp(c.whatsapp) === normalizedWhatsapp)
      );
      
      if (existingIndex === -1) {
        // Não existe, adiciona
        updatedClients.push(seedClient);
      }
      // Se existe, não faz nada (mantém o existente)
    });
    
    this.storage.set(STORAGE_KEYS.clients, updatedClients);
    return updatedClients;
  }

  private insights: Record<string, ClientInsight> = {
    '1': {
      lastMessageSnippet: 'Adorei os brincos que você mostrou! Vou pensar e te respondo...',
      daysSinceLastContact: 2,
      lifetimeValue: 8750.00,
      totalPurchasedValue: 8750.00,
      lastPurchaseAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    '2': {
      lastMessageSnippet: 'Preciso ver com minha noiva primeiro',
      daysSinceLastContact: 15,
      lifetimeValue: 0,
      totalPurchasedValue: 0,
      lastPurchaseAt: undefined,
    },
    '3': {
      lastMessageSnippet: 'Obrigada! Sempre um prazer comprar com vocês',
      daysSinceLastContact: 1,
      lifetimeValue: 23400.00,
      totalPurchasedValue: 23400.00,
      lastPurchaseAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    '4': {
      lastMessageSnippet: 'Ok, obrigado',
      daysSinceLastContact: 45,
      lifetimeValue: 450.00,
      totalPurchasedValue: 450.00,
      lastPurchaseAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    '5': {
      lastMessageSnippet: 'Pode me mandar mais opções de alianças?',
      daysSinceLastContact: 7,
      lifetimeValue: 0,
      totalPurchasedValue: 0,
      lastPurchaseAt: undefined,
    },
    '6': {
      lastMessageSnippet: 'Vou passar aí na loja essa semana',
      daysSinceLastContact: 5,
      lifetimeValue: 1200.00,
      totalPurchasedValue: 1200.00,
      lastPurchaseAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    '7': {
      lastMessageSnippet: 'Quanto fica esse brinco de prata?',
      daysSinceLastContact: 30,
      lifetimeValue: 0,
      totalPurchasedValue: 0,
      lastPurchaseAt: undefined,
    },
    '8': {
      lastMessageSnippet: 'Vamos precisar de 15 peças para o evento',
      daysSinceLastContact: 3,
      lifetimeValue: 34500.00,
      totalPurchasedValue: 34500.00,
      lastPurchaseAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  private recentActivity: Record<string, { at: string; text: string }[]> = {
    '1': [
      { at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente visualizou catálogo de brincos' },
      { at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: Brinco de ouro 18k - R$ 2.850,00' },
      { at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), text: 'Enviada promoção de colar de pérolas' },
    ],
    '2': [
      { at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente solicitou orçamento de alianças' },
      { at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), text: 'Primeiro contato via WhatsApp' },
    ],
    '3': [
      { at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), text: 'Mensagem de agradecimento enviada' },
      { at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: Anel de diamante - R$ 5.400,00' },
      { at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: Pulseira de ouro - R$ 3.200,00' },
      { at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cadastro de cliente VIP realizado' },
    ],
    '4': [
      { at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), text: 'Último contato sem resposta' },
      { at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: Pingente de prata - R$ 450,00' },
    ],
    '5': [
      { at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente solicitou mais opções de alianças' },
      { at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), text: 'Enviado catálogo de alianças de noivado' },
      { at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), text: 'Primeiro contato - interesse em casamento' },
    ],
    '6': [
      { at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente confirmou visita à loja' },
      { at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), text: 'Enviadas fotos de colares' },
      { at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: Brincos de prata - R$ 1.200,00' },
    ],
    '7': [
      { at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente perguntou sobre brincos de prata' },
      { at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), text: 'Primeiro contato via Instagram' },
    ],
    '8': [
      { at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), text: 'Solicitação de orçamento para evento corporativo' },
      { at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), text: 'Compra realizada: 10 pingentes personalizados - R$ 8.500,00' },
      { at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(), text: 'Cliente VIP corporativo cadastrado' },
    ],
  };

  getClients(): Observable<Client[]> {
    console.log('📋 [ClientsStore] ========== BUSCANDO CLIENTES ==========');
    
    // CRITICAL: Verificar se há workspace ativo antes de fazer requisição
    // ⚠️ Workspace vem da API e fica em memória/sessionStorage, não localStorage
    const workspaceId = (() => {
      try {
        return sessionStorage.getItem('currentWorkspaceId');
      } catch {
        return null;
      }
    })();
    
    console.log('📋 [ClientsStore] currentWorkspaceId:', workspaceId);
    
    if (!workspaceId) {
      console.error('❌ [ClientsStore] NENHUM WORKSPACE ATIVO! Não é possível buscar clientes.');
      console.error('❌ [ClientsStore] Esta requisição FALHARÁ com erro 400 ou 403.');
      
      // Retornar erro específico em vez de array vazio
      return throwError(() => new Error(
        'Nenhum workspace ativo. Por favor, selecione um ambiente de trabalho.'
      ));
    }
    
    console.log('✅ [ClientsStore] Workspace ativo encontrado:', workspaceId);
    console.log('📋 [ClientsStore] Iniciando requisição à API...');
    
    // Buscar clientes via DataService (API)
    return this.clientsDataService.listClients().pipe(
      // Para cada cliente, buscar suas vendas da API e calcular score
      switchMap(clients => {
        console.log('📋 [ClientsStore] Clientes carregados:', clients.length);
        
        // Se não houver clientes, retornar array vazio
        if (clients.length === 0) {
          console.log('ℹ️ [ClientsStore] Nenhum cliente encontrado no workspace');
          return of([]);
        }
        
        // API já retorna clientes com score calculado - apenas retornar os dados
        console.log('✅ [ClientsStore] Clientes carregados da API com scores:', 
          clients.map(c => `${c.name}: ${c.score} (${c.scoreTier})`).join(', ')
        );
        
        return of(clients);
      }),
      catchError((error) => {
        console.error('❌ [ClientsStore] ========== ERRO AO BUSCAR CLIENTES ==========');
        console.error('❌ [ClientsStore] Erro completo:', error);
        console.error('❌ [ClientsStore] Status:', error.status);
        console.error('❌ [ClientsStore] Message:', error.message);
        console.error('❌ [ClientsStore] Error object:', error.error);
        
        // Verificar se é erro de workspace
        if (error.status === 400 || error.status === 403) {
          const errorMessage = error.error?.message || error.message || '';
          if (errorMessage.toLowerCase().includes('workspace') || 
              errorMessage.toLowerCase().includes('header')) {
            console.error('❌ [ClientsStore] ERRO DE WORKSPACE DETECTADO!');
            console.error('❌ [ClientsStore] O header x-workspace-id pode não ter sido enviado.');
            const currentId = (() => {
              try { return sessionStorage.getItem('currentWorkspaceId'); } catch { return 'N/A'; }
            })();
            console.error('❌ [ClientsStore] currentWorkspaceId no momento do erro:', currentId);
          }
        }
        
        console.error('❌ [ClientsStore] ================================================');
        
        // Retornar array vazio para não quebrar a UI
        return of([]);
      })
    );
  }

  getClientDetail(id: string): Observable<ClientDetailVm | null> {
    console.log('🔍 [ClientsStore] Buscando detalhes do cliente:', id);
    
    // Buscar cliente via DataService (API) com fallback ao LocalStorage
    return this.clientsDataService.getClientById(id).pipe(
      catchError((error) => {
        console.warn('⚠️ [ClientsStore] Erro ao buscar cliente da API, tentando LocalStorage:', error);
        // Fallback: buscar do LocalStorage
        const localClient = this.clients.find(c => c.id === id);
        if (!localClient) {
          console.error('❌ [ClientsStore] Cliente não encontrado nem na API nem no LocalStorage');
          return of(null);
        }
        console.log('✅ [ClientsStore] Cliente encontrado no LocalStorage:', localClient.name);
        return of(localClient);
      }),
      // Adicionar log para ver o que a API retorna
      tap((client: Client | null) => {
        if (client) {
          console.log('👤 [ClientsStore] Cliente retornado da API:', client.name);
          console.log('🏷️ [ClientsStore] Tags do cliente na API:', client.tags);
          // Merge whatsappOptIn from localStorage (backend doesn't track this field)
          const localClient = this.clients.find(c => c.id === client.id);
          if (localClient) {
            if (client.whatsappOptIn === undefined && localClient.whatsappOptIn !== undefined) {
              client.whatsappOptIn = localClient.whatsappOptIn;
              client.whatsappOptInAt = localClient.whatsappOptInAt;
            }
          }
        }
      }),
      // Buscar vendas da API em paralelo
      switchMap((client: Client | null) => {
        if (!client) {
          return of(null);
        }

        console.log('✅ [ClientsStore] Cliente carregado:', client.name);

        // Buscar vendas do cliente da API com fallback ao LocalStorage
        return this.clientsDataService.getSalesByClient(id).pipe(
          // Fallback: Se API falhar, usa LocalStorage
          catchError((error) => {
            console.warn('⚠️ [ClientsStore] Erro ao buscar vendas da API, usando LocalStorage:', error);
            const localSales = this.getSalesByClient(id);
            return of(localSales);
          }),
          map(clientSales => {
            // Garantir que clientSales é um array (API pode retornar undefined)
            const salesArray = Array.isArray(clientSales) ? clientSales : [];
            console.log('📊 [ClientsStore] Vendas do cliente:', salesArray.length);
            console.log('📦 [ClientsStore] Vendas completas:', salesArray);
            
            // Calcular lifetime value a partir das vendas reais
            const calculatedLifetimeValue = salesArray.reduce((sum, sale) => {
              // Tenta primeiro 'totalAmount' (backend atual), depois 'total', depois 'amount' (modelo antigo)
              const saleValue = sale.totalAmount ?? sale.total ?? sale.amount ?? 0;
              const amount = typeof saleValue === 'number' ? saleValue : parseFloat(saleValue) || 0;
              console.log('💰 [ClientsStore] Processando venda:', sale.id, 'totalAmount:', sale.totalAmount, 'total:', sale.total, 'amount:', sale.amount, 'usado:', amount);
              return sum + amount;
            }, 0);
            console.log('💰 [ClientsStore] Total calculado:', calculatedLifetimeValue, 'de', salesArray.length, 'vendas');
            
            // Obter última data de compra - tentar vários campos possíveis
            let lastPurchaseAt: string | undefined = undefined;
            if (salesArray.length > 0) {
              // Tentar ordenar por data mais recente
              const sortedSales = [...salesArray].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.date || 0).getTime();
                const dateB = new Date(b.createdAt || b.date || 0).getTime();
                return dateB - dateA; // Mais recente primeiro
              });
              lastPurchaseAt = sortedSales[0]?.createdAt || sortedSales[0]?.date;
              console.log('📅 [ClientsStore] Venda mais recente:', sortedSales[0]);
              console.log('📅 [ClientsStore] Data extraída:', lastPurchaseAt);
            }

            // Obter mensagens do cliente
            const clientMessages = this.messageStore.getByClientId(id);

            // Compute insights from message activity
            const messageInsights = this.insightsService.computeClientInsights(clientMessages);

            const insight = this.insights[id] || {
              lastMessageSnippet: 'Sem mensagens recentes',
              daysSinceLastContact: 0,
              lifetimeValue: 0,
            };
            
            // Atualizar insight com valores calculados de mensagens e vendas
            insight.lifetimeValue = calculatedLifetimeValue;
            insight.lastPurchaseAt = lastPurchaseAt;
            insight.totalPurchasedValue = calculatedLifetimeValue;
            insight.daysSinceLastContact = messageInsights.daysSinceLastContact;

            console.log('💰 [ClientsStore] Total comprado calculado:', calculatedLifetimeValue);
            console.log('📅 [ClientsStore] Última compra:', lastPurchaseAt);

            // Calcular days since last purchase
            let daysSinceLastPurchase: number | undefined = undefined;
            if (lastPurchaseAt) {
              const purchaseDate = new Date(lastPurchaseAt);
              const now = Date.now();
              const purchaseTime = purchaseDate.getTime();
              const diffMs = now - purchaseTime;
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              daysSinceLastPurchase = diffDays;
              
              console.log('🔢 [ClientsStore] Cálculo de dias desde última compra:');
              console.log('   lastPurchaseAt string:', lastPurchaseAt);
              console.log('   purchaseDate:', purchaseDate);
              console.log('   purchaseTime:', purchaseTime);
              console.log('   now:', now);
              console.log('   diffMs:', diffMs);
              console.log('   daysSinceLastPurchase:', daysSinceLastPurchase);
            }

            // Criar sinais de contexto para IA
            const signals: AiContextSignal = {
              daysSinceLastContact: insight.daysSinceLastContact,
              hasNegotiatingTag: client.tags.includes('negociando'),
              hasBoughtBefore: !!lastPurchaseAt,
              lifetimeValue: calculatedLifetimeValue,
              lastMessageIntent: deriveMessageIntent(insight.lastMessageSnippet),
              daysSinceLastPurchase
            };

            console.log('🧠 [ClientsStore] Sinais para IA:', signals);

            // Computar análise de IA (passando clientId para filtrar sugestões aplicadas)
            const aiAnalysis = this.aiEngine.computeClientAi(signals, id);

            console.log('🎯 [ClientsStore] Score recalculado:', aiAnalysis.score.score);
            console.log('💡 [ClientsStore] Sugestões geradas:', aiAnalysis.suggestions.length);

            // Score já vem calculado da API - não fazer cálculo local
            console.log('📊 [ClientsStore] Score da API:', client.score, '- Tier:', client.scoreTier, '- Label:', client.scoreLabel);
            console.log('📊 [ClientsStore] Breakdown da API:', client.scoreBreakdown);

            const detail: ClientDetailVm = {
              client: client, // Usar cliente direto da API com score já calculado
              insight,
              ai: aiAnalysis.score,
              suggestions: aiAnalysis.suggestions,
              recentActivity: this.getActivities(id, 5), // Get up to 5 most recent activities
              sales: salesArray, // Usa o array garantido
            };

            console.log('✅ [ClientsStore] ClientDetail completo criado');
            return detail;
          })
        );
      })
    );
  }

  /**
   * Atualiza dados do cliente (com persistência)
   */
  updateClient(id: string, patch: Partial<Client>): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    clients[index] = { ...clients[index], ...patch };
    this.clients = clients; // Persiste

    // Log telemetry
    try {
      this.telemetryService.log('client_updated', { clientId: id });
    } catch {
      // Silent fail
    }
  }

  /**
   * Adiciona tag ao cliente (com persistência)
   * Nota: Score será recalculado no backend. Frontend deve fazer GET após operação.
   */
  addTag(id: string, tag: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    const existingTags = clients[index].tags || [];
    if (!existingTags.includes(tag)) {
      clients[index].tags = [...existingTags, tag];
      
      // Score será recalculado no backend - frontend deve fazer GET após adicionar tag
      
      this.clients = clients; // Persiste

      // Create activity
      this.createActivity(
        id,
        'tag_added',
        `Tag "${tag}" adicionada`,
        { tag }
      );
    }
  }

  /**
   * Remove tag do cliente (com persistência)
   * Nota: Score será recalculado no backend. Frontend deve fazer GET após operação.
   */
  removeTag(id: string, tag: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    const hadTag = (clients[index].tags || []).includes(tag);
    clients[index].tags = (clients[index].tags || []).filter(t => t !== tag);
    
    // Score será recalculado no backend - frontend deve fazer GET após remover tag
    
    this.clients = clients; // Persiste

    // Create activity if tag was actually removed
    if (hadTag) {
      this.createActivity(
        id,
        'tag_removed',
        `Tag "${tag}" removida`,
        { tag }
      );
    }
  }

  /**
   * Atualiza WhatsApp do cliente (com persistência)
   */
  updateWhatsApp(id: string, whatsapp: string): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    clients[index].whatsapp = whatsapp;
    clients[index].lastContactAt = new Date().toISOString();
    this.clients = clients; // Persiste

    // Log telemetry
    try {
      this.telemetryService.log('client_updated', { clientId: id });
    } catch {
      // Silent fail
    }
  }

  /**
   * Atualiza opt-in do WhatsApp (compliance)
   */
  updateWhatsAppOptIn(id: string, optIn: boolean): void {
    const clients = this.clients;
    const index = clients.findIndex(c => c.id === id);
    if (index === -1) return;

    const previousOptIn = clients[index].whatsappOptIn;
    clients[index].whatsappOptIn = optIn;
    clients[index].whatsappOptInAt = optIn ? new Date().toISOString() : undefined;
    this.clients = clients; // Persiste

    // Create activity if status changed
    if (previousOptIn !== optIn) {
      this.createActivity(
        id,
        optIn ? 'opt_in_enabled' : 'opt_in_disabled',
        optIn ? 'Cliente autorizou receber mensagens no WhatsApp' : 'Cliente desautorizou recebimento de mensagens no WhatsApp'
      );
    }

    // Log telemetry
    try {
      this.telemetryService.log('client_updated', { 
        clientId: id, 
        detail: 'whatsapp_optin_changed',
        optIn 
      });
    } catch {
      // Silent fail
    }
  }

  /**
   * Verifica se um WhatsApp já está cadastrado para outro cliente
   * Retorna o cliente conflitante ou null se não houver conflito
   * 
   * @param whatsapp WhatsApp a verificar
   * @param excludeClientId ID do cliente a excluir da verificação (para edição)
   * @returns Cliente conflitante ou null
   */
  checkWhatsAppDuplicate(whatsapp: string, excludeClientId?: string): Client | null {
    if (!whatsapp) return null;
    
    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
    if (!normalizedWhatsapp) return null;
    
    const clients = this.clients;
    const duplicate = clients.find(c => 
      c.id !== excludeClientId && 
      normalizeWhatsapp(c.whatsapp) === normalizedWhatsapp
    );
    
    return duplicate || null;
  }

  /**
   * Upsert (insert or update) de cliente com garantia de unicidade por WhatsApp
   * 
   * Regras de unicidade:
   * 1. Se client.id existe, atualiza o registro com esse ID
   * 2. Se não, mas whatsapp normalizado existe, atualiza esse registro (mantém o id existente)
   * 3. Se não existe nem id nem whatsapp, cria novo registro
   * 
   * @param client Cliente a ser inserido ou atualizado
   * @returns Cliente resultante (novo ou atualizado)
   */
  upsertClient(client: Client): Client {
    const clients = this.clients;
    const normalizedWhatsapp = normalizeWhatsapp(client.whatsapp);
    
    // Prioridade 1: Buscar por ID
    let existingIndex = clients.findIndex(c => c.id === client.id);
    
    // Prioridade 2: Se não encontrou por ID e tem WhatsApp, buscar por WhatsApp normalizado
    if (existingIndex === -1 && normalizedWhatsapp) {
      existingIndex = clients.findIndex(c => 
        normalizeWhatsapp(c.whatsapp) === normalizedWhatsapp
      );
    }
    
    if (existingIndex !== -1) {
      // Update: mantém o ID original, atualiza demais campos
      const existingClient = clients[existingIndex];
      clients[existingIndex] = {
        ...client,
        id: existingClient.id, // Preserva o ID original
      };
      this.clients = clients; // Persiste
      
      // Log telemetry
      try {
        this.telemetryService.log('client_updated', { 
          clientId: existingClient.id,
          reason: 'upsert'
        });
      } catch {
        // Silent fail
      }
      
      return clients[existingIndex];
    } else {
      // Insert: novo cliente
      const newClient: Client = {
        ...client,
        id: client.id || Date.now().toString(), // Garante que tem ID
      };
      
      const updatedClients = [...clients, newClient];
      this.clients = updatedClients; // Persiste
      
      // Log telemetry
      try {
        this.telemetryService.log('client_created', { clientId: newClient.id });
      } catch {
        // Silent fail
      }
      
      return newClient;
    }
  }

  /**
   * Remove duplicatas existentes na base de dados
   * Mantém apenas o primeiro registro para cada WhatsApp normalizado
   * 
   * Esta função pode ser chamada manualmente para limpar dados duplicados existentes
   */
  removeDuplicates(): void {
    const clients = this.clients;
    const seen = new Map<string, string>(); // normalizedWhatsapp -> clientId
    const uniqueClients: Client[] = [];
    
    clients.forEach(client => {
      const normalizedWhatsapp = normalizeWhatsapp(client.whatsapp);
      
      if (!normalizedWhatsapp) {
        // Cliente sem WhatsApp, mantém sempre
        uniqueClients.push(client);
        return;
      }
      
      if (!seen.has(normalizedWhatsapp)) {
        // Primeiro registro deste WhatsApp
        seen.set(normalizedWhatsapp, client.id);
        uniqueClients.push(client);
      }
      // Se já existe, ignora (remove duplicata)
    });
    
    this.clients = uniqueClients;
    
    // Log telemetry
    const removedCount = clients.length - uniqueClients.length;
    if (removedCount > 0) {
      try {
        this.telemetryService.log('client_updated', { 
          detail: 'duplicates_removed',
          count: removedCount 
        });
      } catch {
        // Silent fail
      }
    }
  }

  /**
   * Cria novo cliente (com persistência)
   * Usa upsert internamente para garantir unicidade por WhatsApp
   */
  createClient(input: {
    name: string;
    whatsapp?: string;
    tags?: string[];
    notes?: string;
    lastContactAt?: string;
  }): Observable<Client> {
    // Preparar DTO para API
    const dto: any = {
      name: input.name.trim(),
      WhatsApp: input.whatsapp?.trim() || ''  // Backend espera WhatsApp (obrigatório, pode ser vazio)
    };

    // Adicionar tags apenas se fornecido
    if (input.tags && input.tags.length > 0) {
      dto.tags = input.tags;
    }

    // Adicionar notes apenas se fornecido
    if (input.notes && input.notes.trim()) {
      dto.notes = input.notes.trim();
    }

    console.log('🔵 [ClientsStore] Creating client with DTO:', dto);

    // Usar DataService para criar cliente (API ou LocalStorage)
    return this.clientsDataService.createClient(dto);
  }
}
