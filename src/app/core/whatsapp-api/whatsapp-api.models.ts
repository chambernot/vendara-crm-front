/**
 * WhatsApp API Models
 * Modelos para integração com a API do WhatsApp (backend)
 */

export type MessageType = 'text' | 'template';

export interface SendWhatsAppMessageRequest {
  to: string;
  type: MessageType;
  text?: string;
  templateName?: string;
  templateParams?: string[];
}

export interface SendWhatsAppMessageResponse {
  messageId: string;
  status: string;
  provider: string;
  timestamp?: string;
}

export interface MessageStatusResponse {
  messageId: string;
  status: string;
  timestamps?: {
    sent?: string;
    delivered?: string;
    read?: string;
  };
}

export interface WhatsAppError {
  code: string;
  message: string;
  details?: any;
}
