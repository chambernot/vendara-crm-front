export type TelemetryEventType =
  | 'app_open'
  | 'login'
  | 'onboarding_complete'
  | 'workspace_selected'
  | 'client_created'
  | 'client_updated'
  | 'client_viewed'
  | 'product_created'
  | 'product_status_changed'
  | 'product_viewed'
  | 'consignation_created'
  | 'consignation_sold'
  | 'consignation_returned'
  | 'central_open'
  | 'central_generate'
  | 'central_batch_add_to_queue'
  | 'central_batch_schedule'
  | 'central_batch_send'
  | 'central_batch_complete_followup'
  | 'template_copied'
  | 'templates_seeded'
  | 'template_created'
  | 'template_updated'
  | 'template_toggled'
  | 'template_duplicated'
  | 'template_deleted'
  | 'whatsapp_opened'
  | 'whatsapp_sent_from_central'
  | 'whatsapp_sent_from_client'
  | 'whatsapp_sent_from_product'
  | 'whatsapp_api_send_attempt'
  | 'whatsapp_api_send_success'
  | 'whatsapp_api_send_fail'
  | 'export_done'
  | 'import_done';

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  at: string; // ISO 8601
  workspaceId: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface TelemetrySummary {
  total: number;
  byType: { type: string; count: number }[];
  lastEvents: TelemetryEvent[];
}

export interface TelemetryExport {
  version: string;
  exportedAt: string;
  workspaceId: string;
  workspaceName: string;
  events: TelemetryEvent[];
}
