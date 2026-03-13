import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client.service';
import { Router } from '@angular/router';
import { AiSuggestion, SuggestionApplicationEffects } from './ai.models';
import { ClientsStore } from '../../features/clients/data-access/clients.store';
import { FollowupStore } from '../../features/central/data-access/followup.store';
import { CreateFollowupDto } from '../../features/central/data-access/followup.models';
import { SuggestionApplicationsService } from './suggestion-applications.service';
import { MessageStore } from '../../features/messages/data-access/message.store';
import { CreateMessageDto } from '../../features/messages/data-access/message.models';
import { SimulatorWhatsAppProvider } from '../whatsapp-api/simulator-whatsapp-provider.service';

/**
 * Resultado da aplicação de uma sugestão
 */
export interface ApplySuggestionResult {
  success: boolean;
  message: string;
  actions: string[]; // Lista de ações executadas
  followupId?: string;
  composerUrl?: string;
  sentMessageId?: string; // ID da mensagem enviada (se aplicável)
}

/**
 * Serviço responsável por executar ações das sugestões da IA
 */
@Injectable({
  providedIn: 'root'
})
export class AiSuggestionActionsService {
  private clientsStore = inject(ClientsStore);
  private followupStore = inject(FollowupStore);
  private router = inject(Router);
  private suggestionApplicationsService = inject(SuggestionApplicationsService);
  private messageStore = inject(MessageStore);
  private simulatorProvider = inject(SimulatorWhatsAppProvider);
  private apiClient = inject(ApiClient);

  /**
   * Aplica uma sugestão da IA executando todas as ações configuradas
   */
  async applySuggestion(clientId: string, suggestion: AiSuggestion): Promise<ApplySuggestionResult> {
    console.log('🔧 [AiSuggestionActions] Aplicando sugestão:', suggestion);
    console.log('🔧 [AiSuggestionActions] Payload:', suggestion.payload);
    
    const actions: string[] = [];
    let followupId: string | undefined;
    let composerUrl: string | undefined;
    let sentMessageId: string | undefined;
    const tagsAdded: string[] = [];
    const updatedClientFields: Partial<{ waitingReply: boolean; lastContactAt: string }> = {};

    try {
      // 1. Aplicar tag (se configurado)
      if (suggestion.payload?.tag) {
        console.log('🏷️ [AiSuggestionActions] Aplicando tag:', suggestion.payload.tag.name);
        this.clientsStore.addTag(clientId, suggestion.payload.tag.name);
        tagsAdded.push(suggestion.payload.tag.name);
        actions.push(`Tag "${suggestion.payload.tag.name}" aplicada`);
      }

      // 2. Marcar cliente como aguardando resposta (para ação 'wait')
      if (suggestion.action === 'wait') {
        console.log('⏳ [AiSuggestionActions] Marcando cliente como aguardando resposta');
        this.clientsStore.updateClient(clientId, { waitingReply: true });
        updatedClientFields.waitingReply = true;
        actions.push('Cliente marcado como aguardando resposta');
      }

      // 3. Criar follow-up (se configurado)
      let followupStatus: 'IN_PROGRESS' | 'DONE' = 'IN_PROGRESS';
      if (suggestion.payload?.followup) {
        console.log('📅 [AiSuggestionActions] Criando follow-up:', suggestion.payload.followup);
        const dueDate = this.parseDueDate(suggestion.payload.followup.dueAt);
        const priorityScore = this.getPriorityScore(suggestion.payload.followup.priority);

        const dto: CreateFollowupDto = {
          clientId,
          dueDate,
          priorityScore,
          reasons: [suggestion.payload.followup.reason],
          recommendedTemplateId: suggestion.payload.followup.templateId,
          suggestionId: suggestion.id
        };

        console.log('📅 [AiSuggestionActions] Follow-up DTO:', dto);
        const followup = this.followupStore.create(dto);
        followupId = followup.id;
        console.log('✅ [AiSuggestionActions] Follow-up criado:', followup);
        actions.push(`Follow-up criado para ${this.formatDueDate(dueDate)}`);
      }

      // 4. Enviar mensagem ou abrir composer (se configurado)
      if (suggestion.payload?.composer) {
        console.log('✉️ [AiSuggestionActions] Processando composer:', suggestion.payload.composer);
        
        // Obter o cliente para validar WhatsApp de forma síncrona
        let client: any = null;
        this.clientsStore.getClients().subscribe(clients => {
          client = clients.find(c => c.id === clientId);
        });
        
        if (client?.whatsapp) {
          // Cliente tem WhatsApp - enviar mensagem automaticamente
          try {
            console.log('📤 [AiSuggestionActions] Enviando mensagem automaticamente...');
            sentMessageId = await this.sendMessage(clientId, suggestion.payload.composer.templateId);
            
            // Atualizar lastContactAt e recalcular score
            const now = new Date().toISOString();
            this.clientsStore.updateLastOutbound(clientId, now);
            updatedClientFields.lastContactAt = now;
            
            actions.push('Mensagem enviada automaticamente');
            

            // Marcar follow-up como DONE se mensagem foi enviada
            if (followupId) {
              this.followupStore.complete(followupId);
              followupStatus = 'DONE';
              console.log('✅ [AiSuggestionActions] Follow-up marcado como DONE (local)');
              // Chamar API para concluir follow-up no backend
              try {
                // Corrigir endpoint para o correto do backend: PUT /api/FollowUps/{id}/done
                await this.apiClient.put(`/FollowUps/${followupId}/done`, {}).toPromise();
                console.log('✅ [AiSuggestionActions] Follow-up marcado como DONE no backend');
              } catch (apiError) {
                console.error('❌ [AiSuggestionActions] Erro ao concluir follow-up no backend:', apiError);
              }
            }
            
            console.log('✅ [AiSuggestionActions] Mensagem enviada com ID:', sentMessageId);
          } catch (error) {
            console.error('❌ [AiSuggestionActions] Erro ao enviar mensagem:', error);
            // Se falhar o envio, abrir composer como fallback
            composerUrl = `/app/central/followups?clientId=${clientId}&templateId=${suggestion.payload.composer.templateId}`;
            actions.push('Erro ao enviar - Composer preparado');
          }
        } else {
          // Cliente não tem WhatsApp - preparar URL do composer
          console.log('⚠️ [AiSuggestionActions] Cliente sem WhatsApp, preparando composer...');
          composerUrl = `/app/central/followups?clientId=${clientId}&templateId=${suggestion.payload.composer.templateId}`;
          actions.push('Composer preparado (cliente sem WhatsApp)');
        }
      }

      // 5. Registrar aplicação da sugestão (persistência)
      const effects: SuggestionApplicationEffects = {
        createdFollowupId: followupId,
        openedComposer: !!composerUrl,
        sentMessageId,
        tagsAdded: tagsAdded.length > 0 ? tagsAdded : undefined,
        updatedClientFields: Object.keys(updatedClientFields).length > 0 ? updatedClientFields : undefined,
        followupStatus: followupId ? followupStatus : undefined
      };

      this.suggestionApplicationsService.markApplied(clientId, suggestion, effects);
      console.log('💾 [AiSuggestionActions] Aplicação persistida:', effects);

      console.log('✅ [AiSuggestionActions] Resultado:', { success: true, actions, followupId, composerUrl, sentMessageId });
      return {
        success: true,
        message: actions.length > 0 
          ? 'Sugestão aplicada com sucesso!' 
          : 'Nenhuma ação configurada',
        actions,
        followupId,
        composerUrl,
        sentMessageId
      };
    } catch (error) {
      console.error('❌ [AiSuggestionActions] Erro ao aplicar sugestão:', error);
      
      // Registrar falha
      this.suggestionApplicationsService.markFailed(
        clientId,
        suggestion.id,
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      return {
        success: false,
        message: 'Erro ao aplicar sugestão',
        actions
      };
    }
  }

  /**
   * Envia uma mensagem usando o template especificado
   * Retorna o ID da mensagem criada
   */
  private async sendMessage(clientId: string, templateId: string): Promise<string> {
    console.log('📤 [AiSuggestionActions] Enviando mensagem - clientId:', clientId, 'templateId:', templateId);
    
    // Criar mensagem no store
    const messageText = `Mensagem enviada via sugestão (template: ${templateId})`;
    const dto: CreateMessageDto = {
      clientId,
      channel: 'whatsapp',
      provider: 'simulator', // MVP: usar simulator por padrão
      direction: 'outbound',
      text: messageText,
      textPreview: messageText,
      templateId,
      meta: {
        source: 'ai_suggestion',
        autoSent: true
      }
    };

    const message = this.messageStore.create(dto);
    console.log('✅ [AiSuggestionActions] Mensagem criada no store:', message.id);

    // Simular envio (transições de status realistas)
    try {
      await this.simulatorProvider.simulateSend(message.id);
      console.log('✅ [AiSuggestionActions] Simulação de envio concluída');
    } catch (error) {
      console.error('❌ [AiSuggestionActions] Erro na simulação:', error);
      throw error;
    }

    return message.id;
  }

  /**
   * Converte string de prazo para data ISO (yyyy-mm-dd)
   */
  private parseDueDate(dueAt: string): string {
    const now = new Date();
    
    if (dueAt === 'hoje') {
      return this.toISODate(now);
    }
    
    // Parse '+X dias' format
    const match = dueAt.match(/\+(\d+)\s*dias?/);
    if (match) {
      const daysToAdd = parseInt(match[1], 10);
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + daysToAdd);
      return this.toISODate(dueDate);
    }
    
    // Fallback: hoje
    return this.toISODate(now);
  }

  /**
   * Converte Date para formato ISO date (yyyy-mm-dd)
   */
  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Converte prioridade em score numérico
   */
  private getPriorityScore(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 90;
      case 'medium': return 60;
      case 'low': return 30;
    }
  }

  /**
   * Formata data de forma amigável
   */
  private formatDueDate(isoDate: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = new Date(isoDate);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return 'hoje';
    }
    if (date.getTime() === tomorrow.getTime()) {
      return 'amanhã';
    }

    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 7) {
      return `+${diffDays} dias`;
    }

    return date.toLocaleDateString('pt-BR');
  }
}
