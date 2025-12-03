

import { PrismaClient } from '@prisma/client';
import { SecurityEvent, ProtectionAction } from '../types';
import { ConfigService } from '../services/ConfigService';

export class ActionLimiter {
  private memoryCache: Map<string, number[]> = new Map();

  constructor(
    private prisma: PrismaClient,
    private configService: ConfigService
  ) { }

  
  async recordAndCheck(event: SecurityEvent): Promise<{ count: number; limitExceeded: boolean; limit?: number; resetTime?: number }> {
    
    const limitConfig = await this.configService.getLimit(event.guildId, event.action);

    if (!limitConfig) {
      
      this.recordActionAsync(event);
      return { count: 1, limitExceeded: false };
    }

    const now = event.timestamp.getTime();
    const windowStart = now - limitConfig.windowMs;
    const cacheKey = `${event.guildId}:${event.userId}:${event.action}`;

    
    let timestamps = this.memoryCache.get(cacheKey) || [];
    timestamps.push(now);

    
    timestamps = timestamps.filter(t => t >= windowStart);
    this.memoryCache.set(cacheKey, timestamps);

    const count = timestamps.length;
    const limitExceeded = count > limitConfig.limitCount;

    
    
    
    
    
    
    

    const oldestTimestamp = timestamps[0] || now;
    const resetTime = oldestTimestamp + limitConfig.windowMs;

    
    this.recordActionAsync(event);

    return {
      count,
      limitExceeded,
      limit: limitConfig.limitCount,
      resetTime
    };
  }

  private async recordActionAsync(event: SecurityEvent): Promise<void> {
    try {
      await this.prisma.antiNukeAction.create({
        data: {
          guildId: event.guildId,
          userId: event.userId,
          action: event.action,
          targetId: event.targetId,
          timestamp: event.timestamp,
          auditLogId: event.auditLogId,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to record action to DB:', error);
    }
  }

  
  async getActionCount(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs);

    return await this.prisma.antiNukeAction.count({
      where: {
        guildId,
        userId,
        action,
        timestamp: {
          gte: windowStart,
        },
      },
    });
  }

  
  async getActionsByUser(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<SecurityEvent[]> {
    const windowStart = new Date(Date.now() - windowMs);

    const actions = await this.prisma.antiNukeAction.findMany({
      where: {
        guildId,
        userId,
        action,
        timestamp: {
          gte: windowStart,
        },
      },
    });

    return actions.map(action => ({
      guildId: action.guildId,
      userId: action.userId,
      action: action.action as ProtectionAction,
      targetId: action.targetId ?? undefined,
      auditLogId: action.auditLogId ?? undefined,
      timestamp: action.timestamp,
      metadata: action.metadata ? JSON.parse(action.metadata) : undefined,
    }));
  }

  
  async getRecentActions(guildId: string, limit: number = 10): Promise<SecurityEvent[]> {
    const actions = await this.prisma.antiNukeAction.findMany({
      where: { guildId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return actions.map(action => ({
      guildId: action.guildId,
      userId: action.userId,
      action: action.action as ProtectionAction,
      targetId: action.targetId ?? undefined,
      auditLogId: action.auditLogId ?? undefined,
      timestamp: action.timestamp,
      metadata: action.metadata ? JSON.parse(action.metadata) : undefined,
    }));
  }

  
  async cleanupOldActions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.antiNukeAction.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  
  async clearAllActions(guildId: string): Promise<void> {
    await this.prisma.antiNukeAction.deleteMany({
      where: { guildId },
    });

    
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        this.memoryCache.delete(key);
      }
    }
  }
}
