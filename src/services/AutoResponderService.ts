

import { PrismaClient } from '@prisma/client';

export interface AutoResponderEntry {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AutoResponderService {
  private cache: Map<string, AutoResponderEntry[]> = new Map();

  constructor(private prisma: PrismaClient) {}

  
  async addAutoResponder(
    guildId: string,
    trigger: string,
    response: string,
    createdBy: string
  ): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.create({
      data: {
        guildId,
        trigger: trigger.toLowerCase(), 
        response,
        createdBy,
        enabled: true,
      },
    });

    
    this.cache.delete(guildId);

    return this.mapToEntry(entry);
  }

  
  async getAutoResponder(id: string): Promise<AutoResponderEntry | null> {
    const entry = await this.prisma.autoResponder.findUnique({
      where: { id },
    });

    return entry ? this.mapToEntry(entry) : null;
  }

  
  async getAllAutoResponders(guildId: string): Promise<AutoResponderEntry[]> {
    
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId)!;
    }

    
    const entries = await this.prisma.autoResponder.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = entries.map(e => this.mapToEntry(e));

    
    this.cache.set(guildId, mapped);

    return mapped;
  }

  
  async getEnabledAutoResponders(guildId: string): Promise<AutoResponderEntry[]> {
    const all = await this.getAllAutoResponders(guildId);
    return all.filter(ar => ar.enabled);
  }

  
  async updateAutoResponder(
    id: string,
    trigger: string,
    response: string
  ): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.update({
      where: { id },
      data: {
        trigger: trigger.toLowerCase(),
        response,
      },
    });

    
    this.cache.delete(entry.guildId);

    return this.mapToEntry(entry);
  }

  
  async toggleAutoResponder(id: string, enabled: boolean): Promise<AutoResponderEntry> {
    const entry = await this.prisma.autoResponder.update({
      where: { id },
      data: { enabled },
    });

    
    this.cache.delete(entry.guildId);

    return this.mapToEntry(entry);
  }

  
  async deleteAutoResponder(id: string): Promise<void> {
    const entry = await this.prisma.autoResponder.findUnique({
      where: { id },
    });

    if (entry) {
      await this.prisma.autoResponder.delete({
        where: { id },
      });

      
      this.cache.delete(entry.guildId);
    }
  }

  
  async findMatch(guildId: string, messageContent: string): Promise<string | null> {
    const autoResponders = await this.getEnabledAutoResponders(guildId);
    const lowerContent = messageContent.toLowerCase();

    
    for (const ar of autoResponders) {
      if (lowerContent.includes(ar.trigger)) {
        return ar.response;
      }
    }

    return null;
  }

  
  async clearAll(guildId: string): Promise<number> {
    const result = await this.prisma.autoResponder.deleteMany({
      where: { guildId },
    });

    
    this.cache.delete(guildId);

    return result.count;
  }

  
  private mapToEntry(entry: any): AutoResponderEntry {
    return {
      id: entry.id,
      guildId: entry.guildId,
      trigger: entry.trigger,
      response: entry.response,
      enabled: entry.enabled,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
