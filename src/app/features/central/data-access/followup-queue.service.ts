import { Injectable, inject } from '@angular/core';
import { AiEngineService, AiContextSignal } from '../../../core/ai';
import { ClientsStore, Client } from '../../clients/data-access';
import { MessageStore } from '../../messages/data-access/message.store';
import { FollowupStore } from './followup.store';

/**
 * Serviço responsável por popular a fila de follow-ups
 * baseado nas recomendações da IA
 * 
 * REGRAS DE NEGÓCIO:
 * - Máximo 1 follow-up ATIVO por cliente (open ou scheduled)
 * - Aplicar threshold (TODAY_THRESHOLD=60, SCHEDULE_THRESHOLD=40)
 * - Motivos "anti-ação" viram cooldown (não cria follow-up)
 * - Limitar a 8 itens por geração manual
 */
@Injectable({
  providedIn: 'root'
})
export class FollowupQueueService {
  private aiEngine = inject(AiEngineService);
  private clientsStore = inject(ClientsStore);
  private messageStore = inject(MessageStore);
  private followupStore = inject(FollowupStore);

  private readonly MAX_ITEMS_PER_GENERATION = 8;

  /**
   * Analisa todos os clientes e popula a fila de follow-ups
   * baseado nas recomendações da IA
   * Limita a 8 itens por geração
   */
  populateQueue(): void {
    this.clientsStore.getClients().subscribe(clients => {
      // Filtrar apenas clientes com WhatsApp
      const clientsWithWhatsapp = clients.filter(c => c.whatsapp);
      
      if (clientsWithWhatsapp.length === 0) {
        console.log('[FollowupQueue] Nenhum cliente com WhatsApp cadastrado');
        return;
      }

      // Limitar a MAX_ITEMS_PER_GENERATION clientes
      const clientsToProcess = clientsWithWhatsapp.slice(0, this.MAX_ITEMS_PER_GENERATION);
      
      let createdCount = 0;
      for (const client of clientsToProcess) {
        const created = this.analyzeClientAndCreateFollowup(client);
        if (created) {
          createdCount++;
        }
      }
      
      console.log(`[FollowupQueue] ${createdCount} follow-ups criados/atualizados de ${clientsToProcess.length} clientes processados`);
    });
  }

  /**
   * Analisa um cliente específico e cria/atualiza followup se necessário
   * Retorna true se criou/atualizou, false se não criou (cooldown ou threshold baixo)
   */
  analyzeClientAndCreateFollowup(client: Client): boolean {
    // Buscar mensagens do cliente
    const messages = this.messageStore.getByClientId(client.id);
    
    // Inferir lifetimeValue baseado em tags e histórico
    const lifetimeValue = client.tags.includes('vip') ? 1000 : 0;
    const hasBoughtBefore = client.tags.includes('cliente');
    
    // Construir sinais de contexto para a IA
    const signals: AiContextSignal = {
      daysSinceLastContact: this.calculateDaysSinceLastContact(client.lastContactAt),
      hasNegotiatingTag: client.tags.includes('negociando'),
      hasBoughtBefore: hasBoughtBefore,
      lifetimeValue: lifetimeValue,
      lastMessageIntent: this.inferLastMessageIntent(messages.length > 0 ? messages[messages.length - 1]?.textPreview : '')
    };

    // Construir candidato a follow-up usando a nova função da IA
    const candidate = this.aiEngine.buildFollowupCandidate(signals);

    // Usar upsertFromCandidate que já aplica threshold e cooldown
    const followup = this.followupStore.upsertFromCandidate(client.id, candidate, 'today');
    
    return followup !== null;
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
   * Infere a intenção da última mensagem (simplificado)
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
}
