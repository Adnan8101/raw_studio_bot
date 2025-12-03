

import { PrismaClient } from '@prisma/client';

export interface WarnEntry {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason?: string;
  createdAt: Date;
}

export interface QuarantineConfigData {
  roleId: string;
  accessChannelId: string;
}

export class ModerationService {
  constructor(private prisma: PrismaClient) {}

  
  async addWarn(guildId: string, userId: string, moderatorId: string, reason?: string): Promise<WarnEntry> {
    const warn = await this.prisma.warn.create({
      data: {
        guildId,
        userId,
        moderatorId,
        reason,
      },
    });

    return {
      id: warn.id,
      guildId: warn.guildId,
      userId: warn.userId,
      moderatorId: warn.moderatorId,
      reason: warn.reason ?? undefined,
      createdAt: warn.createdAt,
    };
  }

  
  async getWarns(guildId: string, userId: string): Promise<WarnEntry[]> {
    const warns = await this.prisma.warn.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return warns.map(w => ({
      id: w.id,
      guildId: w.guildId,
      userId: w.userId,
      moderatorId: w.moderatorId,
      reason: w.reason ?? undefined,
      createdAt: w.createdAt,
    }));
  }

  
  async getWarnCount(guildId: string, userId: string): Promise<number> {
    return await this.prisma.warn.count({
      where: { guildId, userId },
    });
  }

  
  async removeWarn(warnId: string): Promise<boolean> {
    try {
      await this.prisma.warn.delete({
        where: { id: warnId },
      });
      return true;
    } catch {
      return false;
    }
  }

  
  async clearWarns(guildId: string, userId: string): Promise<number> {
    const result = await this.prisma.warn.deleteMany({
      where: { guildId, userId },
    });
    return result.count;
  }

  
  async setupQuarantine(guildId: string, roleId: string, accessChannelId: string): Promise<void> {
    await this.prisma.quarantineConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        roleId,
        accessChannelId,
      },
      update: {
        roleId,
        accessChannelId,
      },
    });
  }

  
  async getQuarantineConfig(guildId: string): Promise<QuarantineConfigData | null> {
    const config = await this.prisma.quarantineConfig.findUnique({
      where: { guildId },
    });

    if (!config) return null;

    return {
      roleId: config.roleId,
      accessChannelId: config.accessChannelId,
    };
  }

  
  async removeQuarantineConfig(guildId: string): Promise<boolean> {
    try {
      await this.prisma.quarantineConfig.delete({
        where: { guildId },
      });
      return true;
    } catch {
      return false;
    }
  }
}
