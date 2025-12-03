

import { PrismaClient } from '@prisma/client';

export class GuildConfigService {
  private prefixCache: Map<string, string> = new Map();

  constructor(private prisma: PrismaClient) {}

  
  async getPrefix(guildId: string): Promise<string> {
    
    if (this.prefixCache.has(guildId)) {
      return this.prefixCache.get(guildId)!;
    }

    
    const config = await this.prisma.guildConfig.findUnique({
      where: { guildId },
    });

    const prefix = config?.prefix || '!';
    this.prefixCache.set(guildId, prefix);
    return prefix;
  }

  
  async setPrefix(guildId: string, prefix: string): Promise<void> {
    await this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, prefix },
      update: { prefix },
    });

    
    this.prefixCache.set(guildId, prefix);
  }

  
  async resetPrefix(guildId: string): Promise<void> {
    await this.setPrefix(guildId, '!');
  }

  
  clearCache(guildId: string): void {
    this.prefixCache.delete(guildId);
  }
}
