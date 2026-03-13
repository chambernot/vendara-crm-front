import { Injectable, inject, Injector } from '@angular/core';
import { TelemetryEvent, TelemetryEventType, TelemetrySummary, TelemetryExport } from './telemetry.models';
import { keyFor } from './telemetry.keys';
import { WorkspaceService } from '../workspace/workspace.service';

const MAX_EVENTS = 1000; // Keep only the last 1000 events per workspace

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private injector = inject(Injector);
  private _workspaceService: WorkspaceService | null = null;

  private get workspaceService(): WorkspaceService {
    if (!this._workspaceService) {
      this._workspaceService = this.injector.get(WorkspaceService);
    }
    return this._workspaceService;
  }

  /**
   * Log a telemetry event for the current workspace
   */
  log(type: TelemetryEventType, meta?: Record<string, string | number | boolean | null>): void {
    try {
      const workspace = this.workspaceService.requireActive();
      const event: TelemetryEvent = {
        id: this.generateId(),
        type,
        at: new Date().toISOString(),
        workspaceId: workspace.id,
        meta
      };

      const key = keyFor(workspace.id);
      const events = this.getEvents(workspace.id);
      events.push(event);

      // Keep only the last MAX_EVENTS
      const trimmedEvents = events.slice(-MAX_EVENTS);
      localStorage.setItem(key, JSON.stringify(trimmedEvents));
    } catch (error) {
      // Silent fail - telemetry should never break the app
      console.warn('Failed to log telemetry event:', error);
    }
  }

  /**
   * List telemetry events for the current workspace
   */
  list(limit = 500): TelemetryEvent[] {
    try {
      const workspace = this.workspaceService.requireActive();
      const events = this.getEvents(workspace.id);
      return events.slice(-limit).reverse(); // Most recent first
    } catch (error) {
      console.warn('Failed to list telemetry events:', error);
      return [];
    }
  }

  /**
   * Get telemetry summary for the last N days
   */
  getSummary(days = 7): TelemetrySummary {
    try {
      const workspace = this.workspaceService.requireActive();
      const events = this.getEvents(workspace.id);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentEvents = events.filter(e => new Date(e.at) >= cutoffDate);

      // Count by type
      const countsByType: Record<string, number> = {};
      recentEvents.forEach(e => {
        countsByType[e.type] = (countsByType[e.type] || 0) + 1;
      });

      const byType = Object.entries(countsByType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      return {
        total: recentEvents.length,
        byType,
        lastEvents: recentEvents.slice(-20).reverse()
      };
    } catch (error) {
      console.warn('Failed to get telemetry summary:', error);
      return { total: 0, byType: [], lastEvents: [] };
    }
  }

  /**
   * Clear all telemetry events for the current workspace
   */
  clear(): void {
    try {
      const workspace = this.workspaceService.requireActive();
      const key = keyFor(workspace.id);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear telemetry:', error);
    }
  }

  /**
   * Export telemetry events as JSON
   */
  exportEvents(): TelemetryExport | null {
    try {
      const workspace = this.workspaceService.requireActive();
      const events = this.getEvents(workspace.id);

      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        events
      };
    } catch (error) {
      console.warn('Failed to export telemetry:', error);
      return null;
    }
  }

  /**
   * Import telemetry events for a specific workspace
   */
  importEvents(workspaceId: string, events: TelemetryEvent[]): void {
    try {
      const key = keyFor(workspaceId);
      const trimmedEvents = events.slice(-MAX_EVENTS);
      localStorage.setItem(key, JSON.stringify(trimmedEvents));
    } catch (error) {
      console.warn('Failed to import telemetry:', error);
    }
  }

  /**
   * Get events for a specific workspace (internal)
   */
  private getEvents(workspaceId: string): TelemetryEvent[] {
    try {
      const key = keyFor(workspaceId);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('Failed to get events from storage:', error);
      return [];
    }
  }

  /**
   * Generate a unique ID for events
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
