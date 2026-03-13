/**
 * Batch Mode models and types for Central
 */

export interface BatchModeState {
  isActive: boolean;
  selectedClientIds: Set<string>;
  searchTerm: string;
}

export type BatchActionType = 'add-to-queue' | 'schedule' | 'send-template' | 'complete-followup';

export interface BatchAction {
  type: BatchActionType;
  clientIds: string[];
  metadata?: any;
}

export interface BatchActionAddToQueue extends BatchAction {
  type: 'add-to-queue';
  metadata: {
    dueDate: string; // ISO date
  };
}

export interface BatchActionSchedule extends BatchAction {
  type: 'schedule';
  metadata: {
    templateId: string;
    plannedAt: string; // ISO date
  };
}

export interface BatchActionSendTemplate extends BatchAction {
  type: 'send-template';
  metadata: {
    templateId: string;
  };
}

export interface BatchActionCompleteFollowup extends BatchAction {
  type: 'complete-followup';
}

export interface BatchActionResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ clientId: string; error: string }>;
  warnings?: Array<{ clientId: string; warning: string }>; // Para clientes sem followup aberto
}

export interface BatchPreview {
  clientId: string;
  clientName: string;
  messagePreview: string;
}
