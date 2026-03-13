/**
 * Message module models and types
 */

export type MessageChannel = 'whatsapp';
export type MessageProvider = 'simulator' | 'meta';
export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 'intent' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  workspaceId: string;
  clientId: string;
  channel: MessageChannel;
  provider: MessageProvider;
  direction: MessageDirection;
  templateId?: string;
  textPreview: string;
  status: MessageStatus;
  providerMessageId?: string; // ID retornado pelo provider (Meta/Simulator)
  createdAt: string;
  updatedAt: string;
  sentAt?: string; // Timestamp quando a mensagem foi enviada
  deliveredAt?: string; // Timestamp quando a mensagem foi entregue
  readAt?: string; // Timestamp quando a mensagem foi lida
  failedAt?: string; // Timestamp quando falhou
  failureReason?: string; // Motivo da falha
  meta?: Record<string, any>;
}

export interface MessageFilters {
  clientId?: string;
  status?: MessageStatus;
  channel?: MessageChannel;
  direction?: MessageDirection;
  provider?: MessageProvider;
  startDate?: string;
  endDate?: string;
}

export interface CreateMessageDto {
  clientId: string;
  channel: MessageChannel;
  provider: MessageProvider;
  direction: MessageDirection;
  text: string; // Campo obrigatório que o backend espera (minLength: 1, maxLength: 4096)
  templateId?: string;
  textPreview?: string;
  meta?: Record<string, any>;
}

export interface UpdateMessageDto {
  status?: MessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  providerMessageId?: string;
  meta?: Record<string, any>;
}

export const MessageStatusLabels: Record<MessageStatus, string> = {
  intent: 'Intenção',
  queued: 'Na fila',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou'
};

export const MessageStatusColors: Record<MessageStatus, string> = {
  intent: 'bg-purple-100 text-purple-700',
  queued: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700'
};

export const MessageDirectionLabels: Record<MessageDirection, string> = {
  outbound: 'Enviada',
  inbound: 'Recebida'
};

export const MessageProviderLabels: Record<MessageProvider, string> = {
  simulator: 'Simulador',
  meta: 'Meta'
};
