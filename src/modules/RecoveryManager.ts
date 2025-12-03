

import { PrismaClient } from '@prisma/client';
import { Client, Guild, PermissionsBitField, ChannelType } from 'discord.js';
import { RecoveryMode } from '../types';
import { CaseService } from '../services/CaseService';
import { LoggingService } from '../services/LoggingService';

interface RecoveryResult {
  success: boolean;
  rolesRestored: number;
  channelsRestored: number;
  errors: string[];
}

export class RecoveryManager {
  constructor(
    private prisma: PrismaClient,
    private client: Client,
    private caseService: CaseService,
    private loggingService: LoggingService
  ) { }

  
  async createSnapshot(guildId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);

      
      await this.snapshotRoles(guild);

      
      await this.snapshotChannels(guild);

      console.log(`✔ Snapshot created for guild ${guild.name}`);
    } catch (error) {
      console.error(`Failed to create snapshot for guild ${guildId}:`, error);
    }
  }

  
  private async snapshotRoles(guild: Guild): Promise<void> {
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.roles.everyone.id) 
      .sort((a, b) => a.position - b.position); 

    for (const [_, role] of roles) {
      await this.prisma.roleBackup.create({
        data: {
          guildId: guild.id,
          roleId: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          hoist: role.hoist,
          mentionable: role.mentionable,
          icon: role.icon ?? null,
          metadata: JSON.stringify({
            hexColor: role.hexColor,
            tags: role.tags ? {
              botId: role.tags.botId,
              integrationId: role.tags.integrationId,
              premiumSubscriberRole: role.tags.premiumSubscriberRole,
            } : null,
          }),
        },
      });
    }

    console.log(`Snapshotted ${roles.size} roles`);
  }

  
  private async snapshotChannels(guild: Guild): Promise<void> {
    const channels = guild.channels.cache
      .filter(c => !c.isThread()) 
      .sort((a, b) => a.position - b.position);

    for (const [_, channel] of channels) {
      
      const overwrites = channel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString(),
      }));

      await this.prisma.channelBackup.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parentId: channel.parentId,
          topic: channel.isTextBased() && 'topic' in channel ? channel.topic : null,
          nsfw: 'nsfw' in channel ? channel.nsfw : false,
          permissionOverwrites: JSON.stringify(overwrites),
          metadata: JSON.stringify({
            rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : null,
            bitrate: 'bitrate' in channel ? channel.bitrate : null,
            userLimit: 'userLimit' in channel ? channel.userLimit : null,
          }),
        },
      });
    }

    console.log(`Snapshotted ${channels.size} channels`);
  }

  
  async restore(guildId: string, mode: RecoveryMode, preview: boolean = false): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      rolesRestored: 0,
      channelsRestored: 0,
      errors: [],
    };

    try {
      const guild = await this.client.guilds.fetch(guildId);

      if (preview) {
        
        const roleCount = await this.prisma.roleBackup.count({
          where: { guildId },
        });
        const channelCount = await this.prisma.channelBackup.count({
          where: { guildId },
        });

        result.success = true;
        result.rolesRestored = roleCount;
        result.channelsRestored = channelCount;
        return result;
      }

      
      if (mode === RecoveryMode.FULL) {
        
        await this.restoreRoles(guild, result);
        await this.restoreChannels(guild, result);
      } else {
        
        await this.restoreRoles(guild, result, true);
      }

      result.success = result.errors.length === 0;

      
      await this.caseService.createCase({
        guildId,
        targetId: guildId,
        moderatorId: this.client.user!.id,
        action: 'restore',
        reason: `${mode} recovery executed`,
        metadata: {
          rolesRestored: result.rolesRestored,
          channelsRestored: result.channelsRestored,
          errors: result.errors,
        },
      });

      
      const embed = this.loggingService.createModActionEmbed({
        title: '🔄 Server Restoration Complete',
        targetId: guildId,
        targetTag: guild.name,
        moderatorId: this.client.user!.id,
        moderatorTag: this.client.user!.tag,
        action: `${mode} restoration`,
        reason: `Roles: ${result.rolesRestored}, Channels: ${result.channelsRestored}`,
      });

      if (result.errors.length > 0) {
        embed.addFields({
          name: '⚠️ Errors',
          value: result.errors.slice(0, 5).join('\n'),
          inline: false,
        });
      }

      await this.loggingService.logSecurity(guildId, embed);

    } catch (error) {
      result.errors.push(`Fatal error: ${error}`);
      console.error('Recovery failed:', error);
    }

    return result;
  }

  
  private async restoreRoles(guild: Guild, result: RecoveryResult, criticalOnly: boolean = false): Promise<void> {
    
    const backups = await this.prisma.roleBackup.findMany({
      where: { guildId: guild.id },
      orderBy: { createdAt: 'desc' },
    });

    
    const latestBackups = new Map<string, typeof backups[0]>();
    for (const backup of backups) {
      if (!latestBackups.has(backup.roleId)) {
        latestBackups.set(backup.roleId, backup);
      }
    }

    
    const sortedBackups = Array.from(latestBackups.values())
      .sort((a, b) => a.position - b.position);

    for (const backup of sortedBackups) {
      try {
        
        const existingRole = guild.roles.cache.get(backup.roleId);
        if (existingRole) {
          console.log(`Role ${backup.name} already exists, skipping`);
          continue;
        }

        
        if (criticalOnly) {
          const permissions = new PermissionsBitField(BigInt(backup.permissions));
          const isCritical = permissions.has([
            PermissionsBitField.Flags.Administrator,
            PermissionsBitField.Flags.ManageGuild,
            PermissionsBitField.Flags.ManageRoles,
          ], false); 

          if (!isCritical) continue;
        }

        
        const newRole = await guild.roles.create({
          name: backup.name,
          color: backup.color,
          permissions: new PermissionsBitField(BigInt(backup.permissions)),
          hoist: backup.hoist,
          mentionable: backup.mentionable,
          reason: 'Anti-Nuke recovery',
        });

        result.rolesRestored++;
        console.log(`✔ Restored role: ${backup.name}`);

      } catch (error) {
        const errorMsg = `Failed to restore role ${backup.name}: ${error}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  
  private async restoreChannels(guild: Guild, result: RecoveryResult): Promise<void> {
    
    const backups = await this.prisma.channelBackup.findMany({
      where: { guildId: guild.id },
      orderBy: { createdAt: 'desc' },
    });

    
    const latestBackups = new Map<string, typeof backups[0]>();
    for (const backup of backups) {
      if (!latestBackups.has(backup.channelId)) {
        latestBackups.set(backup.channelId, backup);
      }
    }

    
    const categories = Array.from(latestBackups.values())
      .filter(b => b.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    const categoryIdMap = new Map<string, string>(); 

    for (const backup of categories) {
      try {
        const existing = guild.channels.cache.get(backup.channelId);
        if (existing) continue;

        const newCategory = await guild.channels.create({
          name: backup.name,
          type: ChannelType.GuildCategory,
          position: backup.position,
          reason: 'Anti-Nuke recovery',
        });

        categoryIdMap.set(backup.channelId, newCategory.id);
        result.channelsRestored++;
        console.log(`✔ Restored category: ${backup.name}`);

      } catch (error) {
        result.errors.push(`Failed to restore category ${backup.name}: ${error}`);
      }
    }

    
    const otherChannels = Array.from(latestBackups.values())
      .filter(b => b.type !== ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    for (const backup of otherChannels) {
      try {
        const existing = guild.channels.cache.get(backup.channelId);
        if (existing) continue;

        
        const parentId = backup.parentId && categoryIdMap.has(backup.parentId)
          ? categoryIdMap.get(backup.parentId)
          : null;

        const channelData: any = {
          name: backup.name,
          type: backup.type,
          position: backup.position,
          parent: parentId,
          reason: 'Anti-Nuke recovery',
        };

        if (backup.topic) {
          channelData.topic = backup.topic;
        }

        if (backup.type === ChannelType.GuildText || backup.type === ChannelType.GuildNews) {
          channelData.nsfw = backup.nsfw;
        }

        const newChannel = await guild.channels.create(channelData);

        
        if (backup.permissionOverwrites) {
          const overwrites = JSON.parse(backup.permissionOverwrites) as any[];
          for (const overwrite of overwrites) {
            try {
              
              
              const target = overwrite.type === 0 ? guild.roles.cache.get(overwrite.id) : guild.members.cache.get(overwrite.id);
              if (target) {
                await newChannel.permissionOverwrites.create(overwrite.id, {}, { reason: 'Recovery' });
              }
            } catch (error) {
              console.error(`Failed to restore permission overwrite for ${backup.name}:`, error);
            }
          }
        }

        result.channelsRestored++;
        console.log(`✔ Restored channel: ${backup.name}`);

      } catch (error) {
        result.errors.push(`Failed to restore channel ${backup.name}: ${error}`);
      }
    }
  }

  
  async cleanupOldBackups(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const rolesDeleted = await this.prisma.roleBackup.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    const channelsDeleted = await this.prisma.channelBackup.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`Cleaned up ${rolesDeleted.count} role backups and ${channelsDeleted.count} channel backups`);
  }
}
