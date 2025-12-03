

import { PrismaClient } from '@prisma/client';
import { ModCase } from '../types';

export class CaseService {
  constructor(private prisma: PrismaClient) {}

  
  async createCase(data: {
    guildId: string;
    targetId: string;
    moderatorId: string;
    action: string;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<ModCase> {
    
    const lastCase = await this.prisma.moderationCase.findFirst({
      where: { guildId: data.guildId },
      orderBy: { caseNumber: 'desc' },
    });

    const caseNumber = (lastCase?.caseNumber ?? 0) + 1;

    const modCase = await this.prisma.moderationCase.create({
      data: {
        caseNumber,
        guildId: data.guildId,
        targetId: data.targetId,
        moderatorId: data.moderatorId,
        action: data.action,
        reason: data.reason,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });

    return {
      caseNumber: modCase.caseNumber,
      guildId: modCase.guildId,
      targetId: modCase.targetId,
      moderatorId: modCase.moderatorId,
      action: modCase.action,
      reason: modCase.reason ?? undefined,
      metadata: modCase.metadata ? JSON.parse(modCase.metadata) : undefined,
      overturned: modCase.overturned,
      createdAt: modCase.createdAt,
    };
  }

  
  async getCase(guildId: string, caseNumber: number): Promise<ModCase | null> {
    const modCase = await this.prisma.moderationCase.findUnique({
      where: {
        guildId_caseNumber: { guildId, caseNumber },
      },
    });

    if (!modCase) {
      return null;
    }

    return {
      caseNumber: modCase.caseNumber,
      guildId: modCase.guildId,
      targetId: modCase.targetId,
      moderatorId: modCase.moderatorId,
      action: modCase.action,
      reason: modCase.reason ?? undefined,
      metadata: modCase.metadata ? JSON.parse(modCase.metadata) : undefined,
      overturned: modCase.overturned,
      createdAt: modCase.createdAt,
    };
  }

  
  async getCasesForUser(guildId: string, userId: string, limit: number = 10): Promise<ModCase[]> {
    const cases = await this.prisma.moderationCase.findMany({
      where: {
        guildId,
        targetId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return cases.map(modCase => ({
      caseNumber: modCase.caseNumber,
      guildId: modCase.guildId,
      targetId: modCase.targetId,
      moderatorId: modCase.moderatorId,
      action: modCase.action,
      reason: modCase.reason ?? undefined,
      metadata: modCase.metadata ? JSON.parse(modCase.metadata) : undefined,
      overturned: modCase.overturned,
      createdAt: modCase.createdAt,
    }));
  }

  
  async overturnCase(guildId: string, caseNumber: number, overturnedBy: string): Promise<void> {
    await this.prisma.moderationCase.update({
      where: {
        guildId_caseNumber: { guildId, caseNumber },
      },
      data: {
        overturned: true,
        overturnedBy,
        overturnedAt: new Date(),
      },
    });
  }

  
  async getRecentCases(guildId: string, limit: number = 5): Promise<ModCase[]> {
    const cases = await this.prisma.moderationCase.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return cases.map(modCase => ({
      caseNumber: modCase.caseNumber,
      guildId: modCase.guildId,
      targetId: modCase.targetId,
      moderatorId: modCase.moderatorId,
      action: modCase.action,
      reason: modCase.reason ?? undefined,
      metadata: modCase.metadata ? JSON.parse(modCase.metadata) : undefined,
      overturned: modCase.overturned,
      createdAt: modCase.createdAt,
    }));
  }
}
