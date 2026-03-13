import { Injectable } from '@angular/core';
import { Message } from '../../messages/data-access/message.models';

/**
 * Score constants (MVP values, adjustable)
 */
export const SCORE_CONSTANTS = {
  BASE_SCORE: 20,
  RECENCY_MAX: 20,
  ENGAGEMENT_MAX: 20,
  FAILURE_PENALTY: -10,
  ANTI_SPAM_PENALTY: -30,
  ANTI_SPAM_WINDOW_HOURS: 24,
  SCORE_MIN: 0,
  SCORE_MAX: 100,
  
  // Recency thresholds (days)
  RECENCY_TODAY: 0,
  RECENCY_1_2_DAYS: 2,
  RECENCY_3_5_DAYS: 5,
  RECENCY_6_10_DAYS: 10,
  
  // Engagement thresholds (days)
  ENGAGEMENT_RECENT: 7,
  ENGAGEMENT_MEDIUM: 14,
  
  // Failure window (days)
  FAILURE_WINDOW_DAYS: 7,
};

/**
 * Client insights computed from message activity
 */
export interface ComputedInsights {
  lastOutboundAt?: string;
  lastInboundAt?: string;
  lastContactAt?: string;
  daysSinceLastContact: number;
  hasRecentFailure: boolean;
  isAntiSpamPenalty: boolean;
}

/**
 * Service responsible for computing client insights based on message activity
 * Calculates recency, engagement, anti-spam, and failure metrics
 */
@Injectable({ providedIn: 'root' })
export class ClientInsightsService {

  /**
   * Compute all insights for a client based on their message history
   * @param messages Array of messages for the client (already filtered by clientId)
   */
  computeClientInsights(messages: Message[]): ComputedInsights {
    const now = new Date();

    // Find last outbound message (sent, delivered, read, or queued)
    const outboundMessages = messages.filter(
      (m: Message) => m.direction === 'outbound' && 
      ['sent', 'delivered', 'read', 'queued'].includes(m.status)
    );
    const lastOutbound = outboundMessages.length > 0 ? outboundMessages[0] : null;
    const lastOutboundAt = lastOutbound ? lastOutbound.createdAt : undefined;

    // Find last inbound message
    const inboundMessages = messages.filter((m: Message) => m.direction === 'inbound');
    const lastInbound = inboundMessages.length > 0 ? inboundMessages[0] : null;
    const lastInboundAt = lastInbound ? lastInbound.createdAt : undefined;

    // Determine last contact (max of outbound/inbound)
    let lastContactAt: string | undefined;
    if (lastOutboundAt && lastInboundAt) {
      lastContactAt = new Date(lastOutboundAt) > new Date(lastInboundAt) 
        ? lastOutboundAt 
        : lastInboundAt;
    } else if (lastOutboundAt) {
      lastContactAt = lastOutboundAt;
    } else if (lastInboundAt) {
      lastContactAt = lastInboundAt;
    }

    // Calculate days since last contact
    const daysSinceLastContact = lastContactAt 
      ? Math.floor((now.getTime() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Check for recent failures (last 7 days)
    const failureWindowMs = SCORE_CONSTANTS.FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const hasRecentFailure = messages.some(
      (m: Message) => m.direction === 'outbound' && 
      m.status === 'failed' &&
      (now.getTime() - new Date(m.createdAt).getTime()) < failureWindowMs
    );

    // Check anti-spam penalty (last outbound within 24 hours)
    const antiSpamWindowMs = SCORE_CONSTANTS.ANTI_SPAM_WINDOW_HOURS * 60 * 60 * 1000;
    const isAntiSpamPenalty = lastOutboundAt 
      ? (now.getTime() - new Date(lastOutboundAt).getTime()) < antiSpamWindowMs
      : false;

    return {
      lastOutboundAt,
      lastInboundAt,
      lastContactAt,
      daysSinceLastContact,
      hasRecentFailure,
      isAntiSpamPenalty,
    };
  }

  /**
   * Calculate recency points based on last contact date
   */
  computeRecencyPoints(daysSinceLastContact: number): number {
    if (daysSinceLastContact === 0) {
      return 20; // Today
    } else if (daysSinceLastContact <= SCORE_CONSTANTS.RECENCY_1_2_DAYS) {
      return 15; // 1-2 days
    } else if (daysSinceLastContact <= SCORE_CONSTANTS.RECENCY_3_5_DAYS) {
      return 10; // 3-5 days
    } else if (daysSinceLastContact <= SCORE_CONSTANTS.RECENCY_6_10_DAYS) {
      return 5; // 6-10 days
    } else {
      return 0; // >10 days
    }
  }

  /**
   * Calculate engagement points based on last inbound message
   */
  computeEngagementPoints(lastInboundAt?: string): number {
    if (!lastInboundAt) {
      return 0; // No inbound messages
    }

    const now = new Date();
    const daysSinceInbound = Math.floor(
      (now.getTime() - new Date(lastInboundAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceInbound <= SCORE_CONSTANTS.ENGAGEMENT_RECENT) {
      return 20; // Recent engagement (last 7 days)
    } else if (daysSinceInbound <= SCORE_CONSTANTS.ENGAGEMENT_MEDIUM) {
      return 10; // Medium engagement (8-14 days)
    } else {
      return 0; // No recent engagement
    }
  }

  /**
   * Get anti-spam penalty
   */
  getAntiSpamPenalty(isAntiSpamPenalty: boolean): number {
    return isAntiSpamPenalty ? SCORE_CONSTANTS.ANTI_SPAM_PENALTY : 0;
  }

  /**
   * Get failure penalty
   */
  getFailurePenalty(hasRecentFailure: boolean): number {
    return hasRecentFailure ? SCORE_CONSTANTS.FAILURE_PENALTY : 0;
  }

  /**
   * Get a human-readable recency label
   */
  getRecencyLabel(daysSinceLastContact: number): string {
    if (daysSinceLastContact === 0) {
      return 'Hoje';
    } else if (daysSinceLastContact === 1) {
      return 'Ontem';
    } else if (daysSinceLastContact <= 7) {
      return `${daysSinceLastContact} dias atrás`;
    } else if (daysSinceLastContact <= 30) {
      const weeks = Math.floor(daysSinceLastContact / 7);
      return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`;
    } else if (daysSinceLastContact <= 365) {
      const months = Math.floor(daysSinceLastContact / 30);
      return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
    } else {
      return 'Há mais de 1 ano';
    }
  }
}
