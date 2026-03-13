/**
 * Scheduled Message models and types
 */

export type ScheduledMessageStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';

export interface ScheduledMessage {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  templateId?: string;
  messageContent: string;
  plannedAt: string; // ISO date
  status: ScheduledMessageStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  cancelledAt?: string;
  meta?: Record<string, any>;
}

export interface CreateScheduledMessageDto {
  clientId: string;
  clientName: string;
  templateId?: string;
  messageContent: string;
  plannedAt: string;
  meta?: Record<string, any>;
}

export interface UpdateScheduledMessageDto {
  status?: ScheduledMessageStatus;
  plannedAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  meta?: Record<string, any>;
}

export const ScheduledMessageStatusLabels: Record<ScheduledMessageStatus, string> = {
  scheduled: 'Agendada',
  sent: 'Enviada',
  cancelled: 'Cancelada',
  failed: 'Falhou'
};

export const ScheduledMessageStatusColors: Record<ScheduledMessageStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-700'
};
