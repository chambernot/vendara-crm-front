import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Router } from '@angular/router';
import { ClientsStore } from '../../clients/data-access';
import { FollowupItemVm, FollowupReason } from './central.models';
import { TemplateStore } from './template.store';

@Injectable({ providedIn: 'root' })
export class CentralService {
  private router = inject(Router);
  private clientsStore = inject(ClientsStore);
  private templateStore = inject(TemplateStore);

  /**
   * Retorna lista de follow-ups recomendados baseado em:
   * - Clientes sem contato há 3+ dias
   * - Clientes com score >= 70
   * - Clientes com tag "negociando"
   */
  getFollowups(): Observable<FollowupItemVm[]> {
    return this.clientsStore.getClients().pipe(
      map((clients) => {
        const now = Date.now();
        const followups: FollowupItemVm[] = [];

        for (const client of clients) {
          const lastContact = new Date(client.lastContactAt).getTime();
          const daysSinceLastContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));

          // Filtrar clientes que precisam de follow-up
          const needsFollowup =
            daysSinceLastContact >= 3 ||
            client.score >= 70 ||
            client.tags.includes('negociando');

          if (!needsFollowup) continue;

          // Determinar reason baseado em heurísticas
          let reason: FollowupReason;
          let suggestedTemplateId: string = '';

          if (daysSinceLastContact >= 7) {
            reason = 'sumiu';
          } else if (client.tags.includes('negociando')) {
            reason = 'pediu_preco';
          } else if (client.tags.includes('presente') || client.tags.includes('casamento')) {
            reason = 'presente';
          } else if (client.score >= 70) {
            reason = 'novidades';
          } else {
            reason = 'pos_venda';
          }

          // Buscar template com essa tag
          const matchingTemplates = this.templateStore.getByTag(reason);
          if (matchingTemplates.length > 0) {
            suggestedTemplateId = matchingTemplates[0].id;
          }

          followups.push({
            clientId: client.id,
            clientName: client.name,
            score: client.score,
            daysSinceLastContact,
            reason,
            suggestedTemplateId,
          });
        }

        // Ordenar por score desc, depois por days desc
        return followups.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return b.daysSinceLastContact - a.daysSinceLastContact;
        });
      })
    );
  }

  /**
   * Navega para tela de mensagens com o cliente
   */
  openWhatsApp(clientId: string): void {
    // Navega para a tela de mensagens com o cliente
    this.router.navigate(['/app/mensagens', clientId]);
  }

  /**
   * Retorna o telefone WhatsApp do cliente (apenas números)
   */
  getClientPhone(clientId: string): Observable<string | null> {
    return this.clientsStore.getClients().pipe(
      map((clients) => {
        const client = clients.find((c) => c.id === clientId);
        if (!client || !client.whatsapp) {
          return null;
        }
        // Remover caracteres não numéricos
        return client.whatsapp.replace(/\D/g, '');
      })
    );
  }

  /**
   * Copia texto para a área de transferência
   */
  async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Erro ao copiar para clipboard:', err);
        // Fallback: criar elemento temporário
        this.fallbackCopyToClipboard(text);
      }
    } else {
      // Fallback para navegadores mais antigos
      this.fallbackCopyToClipboard(text);
    }
  }

  /**
   * Fallback para copiar texto em navegadores sem Clipboard API
   */
  private fallbackCopyToClipboard(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Erro ao copiar (fallback):', err);
    }
    document.body.removeChild(textarea);
  }
}
