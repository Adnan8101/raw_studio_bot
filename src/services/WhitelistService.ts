

import { PrismaClient } from '@prisma/client';
import { WhitelistCategory, WhitelistEntry } from '../types';

export class WhitelistService {
  
  private cache: Map<string, Map<string, Set<WhitelistCategory>>> = new Map();

  constructor(private prisma: PrismaClient) {
    this.setupNotificationListeners();
  }

  
  private async setupNotificationListeners(): Promise<void> {
    
    return;
  }

  
  async isWhitelisted(
    guildId: string,
    userId: string,
    roleIds: string[],
    action: WhitelistCategory
  ): Promise<boolean> {
    
    await this.ensureGuildCacheLoaded(guildId);

    const guildWhitelist = this.cache.get(guildId);
    if (!guildWhitelist) {
      return false;
    }

    
    const userCategories = guildWhitelist.get(userId);
    if (userCategories?.has(WhitelistCategory.ALL)) {
      return true;
    }

    
    if (userCategories?.has(action)) {
      return true;
    }

    
    for (const roleId of roleIds) {
      const roleCategories = guildWhitelist.get(roleId);
      
      
      if (roleCategories?.has(WhitelistCategory.ALL)) {
        return true;
      }

      
      if (roleCategories?.has(action)) {
        return true;
      }
    }

    return false;
  }

  
  async addRole(
    guildId: string,
    roleId: string,
    categories: WhitelistCategory[],
    addedBy: string
  ): Promise<void> {
    
    for (const category of categories) {
      await this.prisma.whitelist.upsert({
        where: {
          guildId_targetId_category: {
            guildId,
            targetId: roleId,
            category,
          },
        },
        create: {
          guildId,
          targetId: roleId,
          isRole: true,
          category,
          createdBy: addedBy,
        },
        update: {},
      });
    }

    
    this.cache.delete(guildId);

    
    await this.notifyWhitelistChange(guildId);
  }

  
  async addUser(
    guildId: string,
    userId: string,
    categories: WhitelistCategory[],
    addedBy: string
  ): Promise<void> {
    
    for (const category of categories) {
      await this.prisma.whitelist.upsert({
        where: {
          guildId_targetId_category: {
            guildId,
            targetId: userId,
            category,
          },
        },
        create: {
          guildId,
          targetId: userId,
          isRole: false,
          category,
          createdBy: addedBy,
        },
        update: {},
      });
    }

    
    this.cache.delete(guildId);

    
    await this.notifyWhitelistChange(guildId);
  }

  
  async removeRole(
    guildId: string,
    roleId: string,
    categories: WhitelistCategory[] | 'ALL'
  ): Promise<void> {
    if (categories === 'ALL') {
      
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: roleId,
          isRole: true,
        },
      });
    } else {
      
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: roleId,
          isRole: true,
          category: { in: categories },
        },
      });
    }

    
    this.cache.delete(guildId);

    
    await this.notifyWhitelistChange(guildId);
  }

  
  async removeUser(
    guildId: string,
    userId: string,
    categories: WhitelistCategory[] | 'ALL'
  ): Promise<void> {
    if (categories === 'ALL') {
      
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: userId,
          isRole: false,
        },
      });
    } else {
      
      await this.prisma.whitelist.deleteMany({
        where: {
          guildId,
          targetId: userId,
          isRole: false,
          category: { in: categories },
        },
      });
    }

    
    this.cache.delete(guildId);

    
    await this.notifyWhitelistChange(guildId);
  }

  
  async getEntriesForTarget(guildId: string, targetId: string): Promise<WhitelistEntry[]> {
    const entries = await this.prisma.whitelist.findMany({
      where: {
        guildId,
        targetId,
      },
    });

    return entries.map(entry => ({
      targetId: entry.targetId,
      isRole: entry.isRole,
      category: entry.category as WhitelistCategory,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    }));
  }

  
  async listAll(guildId: string, filter?: 'role' | 'user'): Promise<WhitelistEntry[]> {
    const where: any = { guildId };
    
    if (filter === 'role') {
      where.isRole = true;
    } else if (filter === 'user') {
      where.isRole = false;
    }

    const entries = await this.prisma.whitelist.findMany({ where });

    return entries.map(entry => ({
      targetId: entry.targetId,
      isRole: entry.isRole,
      category: entry.category as WhitelistCategory,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    }));
  }

  
  async reset(guildId: string): Promise<void> {
    await this.prisma.whitelist.deleteMany({
      where: { guildId },
    });

    
    this.cache.delete(guildId);

    
    await this.notifyWhitelistChange(guildId);
  }

  
  async clearAllWhitelist(guildId: string): Promise<void> {
    await this.reset(guildId);
  }

  
  private async ensureGuildCacheLoaded(guildId: string): Promise<void> {
    if (this.cache.has(guildId)) {
      return;
    }

    const entries = await this.prisma.whitelist.findMany({
      where: { guildId },
    });

    const guildMap = new Map<string, Set<WhitelistCategory>>();

    for (const entry of entries) {
      if (!guildMap.has(entry.targetId)) {
        guildMap.set(entry.targetId, new Set());
      }
      guildMap.get(entry.targetId)!.add(entry.category as WhitelistCategory);
    }

    this.cache.set(guildId, guildMap);
  }

  
  private async notifyWhitelistChange(guildId: string): Promise<void> {
    
    return;
  }

  
  async reloadGuildCache(guildId: string): Promise<void> {
    this.cache.delete(guildId);
    await this.ensureGuildCacheLoaded(guildId);
  }
}
