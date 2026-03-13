import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MessagesService } from '../../features/messages/data-access/messages.service';

/**
 * Serviço para gerenciar notificações de mensagens não lidas
 * Monitora quando há novas mensagens e exibe badges discretos
 */
@Injectable({
  providedIn: 'root'
})
export class MessageNotificationService {
  private messagesService = inject(MessagesService);
  private router = inject(Router);

  // Estado
  private isOnMessagesPage = signal(false);
  private lastCheckTime = signal<number>(Date.now());
  private originalTitle = 'Vendara CRM';
  private titleInterval?: any;
  
  // Contador de mensagens não lidas
  unreadCount = computed(() => {
    const conversations = this.messagesService.conversations();
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  });

  // Há novas mensagens?
  hasUnreadMessages = computed(() => this.unreadCount() > 0);

  constructor() {
    // Monitorar navegação para saber se está na página de mensagens
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const onMessagesPage = event.url.startsWith('/app/mensagens');
        this.isOnMessagesPage.set(onMessagesPage);
        
        // Se entrou na página de mensagens, parar de piscar o título
        if (onMessagesPage) {
          this.stopTitleNotification();
        }
      });

    // Carregar conversas inicialmente
    this.initializePolling();

    // Effect para notificações quando há mensagens novas
    effect(() => {
      const count = this.unreadCount();
      const onMessagesPage = this.isOnMessagesPage();
      
      // Se houver mensagens não lidas e não estiver na página de mensagens
      if (count > 0 && !onMessagesPage) {
        this.startTitleNotification(count);
      } else {
        this.stopTitleNotification();
      }
    });
  }

  /**
   * Inicia polling para verificar novas mensagens periodicamente
   */
  private initializePolling(): void {
    // Carregar conversas imediatamente
    setTimeout(() => {
      this.messagesService.loadConversations();
    }, 1000);

    // Polling a cada 30 segundos
    setInterval(() => {
      // Só fazer polling se não estiver na página de mensagens
      // (quando estiver na página, ela mesma faz o refresh)
      if (!this.isOnMessagesPage()) {
        this.messagesService.loadConversations();
      }
    }, 30000); // 30 segundos
  }

  /**
   * Inicia notificação no título da página (piscar)
   */
  private startTitleNotification(count: number): void {
    // Se já está piscando, não precisa reiniciar
    if (this.titleInterval) return;

    let showNotification = true;
    const notificationText = `(${count}) Nova${count > 1 ? 's' : ''} mensagem${count > 1 ? 'ns' : ''}`;

    this.titleInterval = setInterval(() => {
      document.title = showNotification ? notificationText : this.originalTitle;
      showNotification = !showNotification;
    }, 1500); // Alterna a cada 1.5 segundos
  }

  /**
   * Para notificação no título da página
   */
  private stopTitleNotification(): void {
    if (this.titleInterval) {
      clearInterval(this.titleInterval);
      this.titleInterval = undefined;
      document.title = this.originalTitle;
    }
  }

  /**
   * Marca uma conversa como lida (quando o usuário abre)
   */
  markConversationAsRead(clientId: string): void {
    this.messagesService.markConversationAsViewed(clientId);
  }

  /**
   * Formata o contador de mensagens para exibição
   */
  getUnreadBadgeText(): string {
    const count = this.unreadCount();
    if (count === 0) return '';
    if (count > 99) return '99+';
    return count.toString();
  }
}

