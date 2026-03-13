import { Injectable, inject } from '@angular/core';
import { 
  BatchActionResult, 
  BatchActionAddToQueue, 
  BatchActionSchedule, 
  BatchActionSendTemplate,
  BatchActionCompleteFollowup,
  BatchPreview 
} from './batch-mode.models';
import { FollowupStore } from './followup.store';
import { ScheduledMessageStore } from '../../messages/data-access/scheduled-message.store';
import { MessageStore } from '../../messages/data-access/message.store';
import { MessagesApiService } from '../../messages/data-access/messages-api.service';
import { ClientsStore } from '../../clients/data-access';
import { TemplateStore } from './template.store';
import { TelemetryService } from '../../../core/telemetry';

/**
 * Serviço responsável por executar ações em lote na Central
 */
@Injectable({
  providedIn: 'root'
})
export class BatchModeService {
  private followupStore = inject(FollowupStore);
  private scheduledMessageStore = inject(ScheduledMessageStore);
  private messageStore = inject(MessageStore);
  private messagesApi = inject(MessagesApiService);
  private clientsStore = inject(ClientsStore);
  private templateStore = inject(TemplateStore);
  private telemetry = inject(TelemetryService);

  /**
   * Adiciona múltiplos clientes à fila de follow-up
   */
  async addToQueue(action: BatchActionAddToQueue): Promise<BatchActionResult> {
    const result: BatchActionResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: []
    };

    for (const clientId of action.clientIds) {
      try {
        // Criar followup com dueDate de hoje
        this.followupStore.createOrUpdate({
          clientId,
          dueDate: action.metadata.dueDate,
          reasons: ['Adicionado manualmente via modo lote'],
          priorityScore: 50, // Score padrão
          recommendedTemplateId: 'default_followup',
          suggestionId: `batch-${Date.now()}-${clientId}`,
        });

        result.processedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          clientId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    result.success = result.failedCount === 0;

    // Log telemetria
    try {
      this.telemetry.log('central_batch_add_to_queue', {
        count: action.clientIds.length,
        success: result.success
      });
    } catch {
      // Silent fail
    }

    return result;
  }

  /**
   * Agenda mensagens para múltiplos clientes
   */
  async scheduleMessages(action: BatchActionSchedule): Promise<BatchActionResult> {
    const result: BatchActionResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: []
    };

    const template = this.templateStore.getById(action.metadata.templateId);
    if (!template) {
      result.success = false;
      result.errors.push({
        clientId: 'all',
        error: 'Template não encontrado'
      });
      return result;
    }

    for (const clientId of action.clientIds) {
      try {
        // Buscar cliente através de getClients
        let client: any = null;
        this.clientsStore.getClients().subscribe(clients => {
          client = clients.find(c => c.id === clientId);
        });

        if (!client) {
          throw new Error('Cliente não encontrado');
        }

        // Interpolar o template
        const message = this.interpolateTemplate(template.body, client);

        // Criar scheduled message
        this.scheduledMessageStore.create({
          clientId,
          clientName: client.name,
          messageContent: message,
          plannedAt: action.metadata.plannedAt,
          templateId: template.id
        });

        result.processedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          clientId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    result.success = result.failedCount === 0;

    // Log telemetria
    try {
      this.telemetry.log('central_batch_schedule', {
        count: action.clientIds.length,
        templateId: action.metadata.templateId,
        success: result.success
      });
    } catch {
      // Silent fail
    }

    return result;
  }

  /**
   * Envia template para múltiplos clientes
   */
  async sendTemplateToClients(action: BatchActionSendTemplate): Promise<BatchActionResult> {
    const result: BatchActionResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: []
    };

    const template = this.templateStore.getById(action.metadata.templateId);
    if (!template) {
      result.success = false;
      result.errors.push({
        clientId: 'all',
        error: 'Template não encontrado'
      });
      return result;
    }

    for (const clientId of action.clientIds) {
      try {
        // Buscar cliente através de getClients
        let client: any = null;
        this.clientsStore.getClients().subscribe(clients => {
          client = clients.find(c => c.id === clientId);
        });

        if (!client || !client.whatsapp) {
          throw new Error('Cliente sem WhatsApp cadastrado');
        }

        // Interpolar o template
        const message = this.interpolateTemplate(template.body, client);

        // Enviar mensagem via endpoint unificado /api/messages/send
        const response = await this.messagesApi.sendMessage({
          clientId,
          provider: 'meta',
          text: message,
          templateId: template.id
        }).toPromise();

        if (!response) {
          throw new Error('Falha ao enviar mensagem');
        }

        result.processedCount++;

        // Pequeno delay para não sobrecarregar a API
        await this.delay(500);
      } catch (error: any) {
        result.failedCount++;
        
        // Tratar erro 409
        let errorMessage = 'Erro desconhecido';
        if (error instanceof Error) errorMessage = error.message;
        if (error?.status === 409) {
          const errorCode = error?.error?.code;
          if (errorCode === 'OUTSIDE_WINDOW') {
            errorMessage = 'Fora da janela de 24h. Template necessário.';
          } else if (errorCode === 'TEMPLATE_NOT_APPROVED') {
            errorMessage = 'Template não aprovado.';
          } else {
            errorMessage = error?.error?.message || errorMessage;
          }
        }
        
        result.errors.push({
          clientId,
          error: errorMessage
        });
      }
    }

    result.success = result.failedCount === 0;

    // Log telemetria
    try {
      this.telemetry.log('central_batch_send', {
        count: action.clientIds.length,
        templateId: action.metadata.templateId,
        success: result.success
      });
    } catch {
      // Silent fail
    }

    return result;
  }

  /**
   * Conclui follow-ups abertos de múltiplos clientes
   */
  async completeFollowups(action: BatchActionCompleteFollowup): Promise<BatchActionResult> {
    const result: BatchActionResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: [],
      warnings: []
    };

    for (const clientId of action.clientIds) {
      try {
        // Buscar cliente para obter nome
        let clientName = 'Cliente desconhecido';
        this.clientsStore.getClients().subscribe(clients => {
          const client = clients.find(c => c.id === clientId);
          if (client) {
            clientName = client.name;
          }
        });

        // Buscar followups pendentes do cliente
        const followups = this.followupStore.getByClientId(clientId);
        const openFollowup = followups.find(f => f.status === 'open' || f.status === 'scheduled');

        if (!openFollowup) {
          // Cliente sem follow-up aberto - adicionar aviso
          result.warnings?.push({
            clientId,
            warning: `${clientName}: Sem follow-up aberto para concluir`
          });
          continue;
        }

        // Concluir o followup
        const completed = this.followupStore.complete(openFollowup.id);
        
        if (!completed) {
          throw new Error('Falha ao concluir follow-up');
        }

        result.processedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          clientId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    result.success = result.failedCount === 0;

    // Log telemetria
    try {
      this.telemetry.log('central_batch_complete_followup', {
        count: action.clientIds.length,
        processedCount: result.processedCount,
        warningsCount: result.warnings?.length || 0,
        success: result.success
      });
    } catch {
      // Silent fail
    }

    return result;
  }

  /**
   * Gera previews de mensagens para múltiplos clientes
   */
  generatePreviews(clientIds: string[], templateId: string): BatchPreview[] {
    const previews: BatchPreview[] = [];
    const template = this.templateStore.getById(templateId);

    if (!template) {
      return previews;
    }

    // Gerar preview apenas para os primeiros 3 clientes (exemplo)
    const previewCount = Math.min(clientIds.length, 3);

    this.clientsStore.getClients().subscribe(clients => {
      for (let i = 0; i < previewCount; i++) {
        const clientId = clientIds[i];
        const client = clients.find(c => c.id === clientId);

        if (client) {
          const messagePreview = this.interpolateTemplate(template.body, client);
          previews.push({
            clientId,
            clientName: client.name,
            messagePreview
          });
        }
      }
    });

    return previews;
  }

  /**
   * Interpola placeholders do template com dados do cliente
   */
  private interpolateTemplate(templateBody: string, client: any): string {
    let result = templateBody;

    // Substituir placeholders comuns de cliente
    const firstName = client.name.split(' ')[0];
    // Double-curly format (frontend seed)
    result = result.replace(/\{\{primeiro_nome\}\}/g, firstName);
    result = result.replace(/\{\{nome_completo\}\}/g, client.name);
    result = result.replace(/\{\{nome\}\}/g, client.name);
    // Single-curly format (backend API)
    result = result.replace(/\{NomeCliente\}/gi, firstName);
    result = result.replace(/\{PrimeiroNome\}/gi, firstName);
    result = result.replace(/\{NomeCompleto\}/gi, client.name);
    result = result.replace(/\{Nome\}/gi, client.name);

    // Substituir placeholders de produto (se existirem)
    // Nota: Por enquanto, removemos as variáveis de produto não preenchidas
    // Para implementar corretamente, seria necessário passar dados do produto
    result = result.replace(/\{\{produto_nome\}\}/g, '');
    result = result.replace(/\{\{produto_preco\}\}/g, '');
    result = result.replace(/\{\{produto_categoria\}\}/g, '');
    result = result.replace(/\{\{produto_material\}\}/g, '');
    result = result.replace(/\{\{produto\}\}/g, '');
    result = result.replace(/\{\{preco\}\}/g, '');
    
    // Remover também formato backend (single-curly)
    result = result.replace(/\{ProdutoNome\}/gi, '');
    result = result.replace(/\{ProdutoPreco\}/gi, '');
    result = result.replace(/\{ProdutoCategoria\}/gi, '');
    result = result.replace(/\{ProdutoMaterial\}/gi, '');
    result = result.replace(/\{Produto\}/gi, '');
    result = result.replace(/\{Preco\}/gi, '');
    
    // Substituir link da vitrine (ambos os formatos)
    // Gerar link da vitrine pública (sem produto específico por enquanto)
    const workspaceSlug = this.getWorkspaceSlug();
    const vitrineLink = `${window.location.origin}/vitrine/${workspaceSlug}`;
    result = result.replace(/\{\{link_vitrine\}\}/g, vitrineLink);
    result = result.replace(/\{LinkVitrine\}/gi, vitrineLink);

    return result;
  }

  /**
   * Obtém o slug do workspace atual
   */
  private getWorkspaceSlug(): string {
    try {
      const workspaceJson = sessionStorage.getItem('currentWorkspace');
      if (workspaceJson) {
        const workspace = JSON.parse(workspaceJson);
        return workspace.slug || workspace.id || 'vitrine';
      }
    } catch (e) {
      console.warn('Erro ao obter workspace do sessionStorage:', e);
    }
    return 'vitrine';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
