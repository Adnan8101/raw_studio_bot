

import { PrismaClient } from '@prisma/client';
import { ProtectionAction, AntiNukeConfiguration, LimitConfiguration, PunishmentConfiguration } from '../types';

export class ConfigService {
  private cache: Map<string, AntiNukeConfiguration> = new Map();
  private limitsCache: Map<string, Map<ProtectionAction, LimitConfiguration>> = new Map();
  private punishmentsCache: Map<string, Map<ProtectionAction, PunishmentConfiguration>> = new Map();

  constructor(private prisma: PrismaClient) {
    this.setupNotificationListeners();
  }

  
  private async setupNotificationListeners(): Promise<void> {
    
    
    return;
  }

  
  async getConfig(guildId: string): Promise<AntiNukeConfiguration | null> {
    
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    
    const config = await this.prisma.antiNukeConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return null;
    }

    const parsed: AntiNukeConfiguration = {
      guildId: config.guildId,
      enabled: config.enabled,
      protections: JSON.parse(config.protections) as ProtectionAction[],
    };

    
    this.cache.set(guildId, parsed);
    return parsed;
  }

  
  async enableAntiNuke(guildId: string, protections: ProtectionAction[]): Promise<void> {
    await this.prisma.antiNukeConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        enabled: true,
        protections: JSON.stringify(protections),
      },
      update: {
        enabled: true,
        protections: JSON.stringify(protections),
      },
    });

    
    this.cache.delete(guildId);

    
    await this.notifyConfigChange(guildId);
  }

  
  async disableAntiNuke(guildId: string): Promise<void> {
    await this.prisma.antiNukeConfig.update({
      where: { guildId },
      data: { enabled: false },
    });

    
    this.cache.delete(guildId);

    
    await this.notifyConfigChange(guildId);
  }

  
  async isEnabled(guildId: string): Promise<boolean> {
    const config = await this.getConfig(guildId);
    return config?.enabled ?? false;
  }

  
  async isProtectionEnabled(guildId: string, action: ProtectionAction): Promise<boolean> {
    const config = await this.getConfig(guildId);
    return config?.protections.includes(action) ?? false;
  }

  
  async setLimit(guildId: string, action: ProtectionAction, limitCount: number, windowMs: number = 10000): Promise<void> {
    await this.prisma.antiNukeLimit.upsert({
      where: {
        guildId_action: { guildId, action },
      },
      create: {
        guildId,
        action,
        limitCount,
        windowMs,
      },
      update: {
        limitCount,
        windowMs,
      },
    });

    
    this.limitsCache.delete(guildId);

    
    await this.notifyLimitsChange(guildId);
  }

  
  async getLimit(guildId: string, action: ProtectionAction): Promise<LimitConfiguration | null> {
    
    const guildLimits = this.limitsCache.get(guildId);
    if (guildLimits?.has(action)) {
      return guildLimits.get(action)!;
    }

    
    const limit = await this.prisma.antiNukeLimit.findUnique({
      where: {
        guildId_action: { guildId, action },
      },
    });

    if (!limit) {
      return null;
    }

    const config: LimitConfiguration = {
      action: action,
      limitCount: limit.limitCount,
      windowMs: limit.windowMs,
    };

    
    if (!this.limitsCache.has(guildId)) {
      this.limitsCache.set(guildId, new Map());
    }
    this.limitsCache.get(guildId)!.set(action, config);

    return config;
  }

  
  async setPunishment(guildId: string, config: PunishmentConfiguration): Promise<void> {
    await this.prisma.antiNukePunishment.upsert({
      where: {
        guildId_action: { guildId, action: config.action },
      },
      create: {
        guildId,
        action: config.action,
        punishment: config.punishment,
        durationSeconds: config.durationSeconds,
      },
      update: {
        punishment: config.punishment,
        durationSeconds: config.durationSeconds,
      },
    });

    
    this.punishmentsCache.delete(guildId);

    
    await this.notifyPunishmentsChange(guildId);
  }

  
  async getPunishment(guildId: string, action: ProtectionAction): Promise<PunishmentConfiguration | null> {
    
    const guildPunishments = this.punishmentsCache.get(guildId);
    if (guildPunishments?.has(action)) {
      return guildPunishments.get(action)!;
    }

    
    const punishment = await this.prisma.antiNukePunishment.findUnique({
      where: {
        guildId_action: { guildId, action },
      },
    });

    if (!punishment) {
      return null;
    }

    const config: PunishmentConfiguration = {
      action: action,
      punishment: punishment.punishment as any,
      durationSeconds: punishment.durationSeconds ?? undefined,
    };

    
    if (!this.punishmentsCache.has(guildId)) {
      this.punishmentsCache.set(guildId, new Map());
    }
    this.punishmentsCache.get(guildId)!.set(action, config);

    return config;
  }

  
  async getAllPunishments(guildId: string): Promise<PunishmentConfiguration[]> {
    
    const punishments = await this.prisma.antiNukePunishment.findMany({
      where: { guildId },
    });

    return punishments.map(p => ({
      action: p.action as ProtectionAction,
      punishment: p.punishment as any,
      durationSeconds: p.durationSeconds ?? undefined,
    }));
  }

  
  private async notifyConfigChange(guildId: string): Promise<void> {
    
    return;
  }

  
  private async notifyLimitsChange(guildId: string): Promise<void> {
    
    return;
  }

  
  private async notifyPunishmentsChange(guildId: string): Promise<void> {
    
    return;
  }

  
  async reloadGuildCache(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    this.limitsCache.delete(guildId);
    this.punishmentsCache.delete(guildId);
    
    
    await this.getConfig(guildId);
  }

  
  async resetGuild(guildId: string): Promise<void> {
    
    await this.prisma.antiNukeConfig.deleteMany({ where: { guildId } });
    await this.prisma.antiNukeLimit.deleteMany({ where: { guildId } });
    await this.prisma.antiNukePunishment.deleteMany({ where: { guildId } });

    
    this.cache.delete(guildId);
    this.limitsCache.delete(guildId);
    this.punishmentsCache.delete(guildId);

    
    await this.notifyConfigChange(guildId);
  }
}
