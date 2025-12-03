

import { PrismaClient } from '@prisma/client';
import { Client, Guild, GuildMember, PermissionsBitField } from 'discord.js';
import { PunishmentType, SecurityEvent, ProtectionAction } from '../types';
import { ConfigService } from '../services/ConfigService';
import { CaseService } from '../services/CaseService';
import { LoggingService } from '../services/LoggingService';

import { ActionLimiter } from './ActionLimiter';

export class Executor {
  
  private activeLocks: Set<string> = new Set();

  constructor(
    private prisma: PrismaClient,
    private client: Client,
    private configService: ConfigService,
    private caseService: CaseService,
    private loggingService: LoggingService,
    private actionLimiter: ActionLimiter
  ) { }

  
  async executePunishment(event: SecurityEvent, count: number, limit: number, resetTime?: number): Promise<void> {
    const lockKey = `${event.guildId}:${event.userId}`;

    
    if (this.activeLocks.has(lockKey)) {
      console.log(`Skipping duplicate punishment for ${lockKey}`);
      return;
    }

    
    if (event.userId === this.client.user?.id) {
      console.log('🛡️ Prevented bot self-punishment');
      return;
    }

    try {
      
      this.activeLocks.add(lockKey);

      
      

      
      let punishmentConfig = await this.configService.getPunishment(event.guildId, event.action);

      if (!punishmentConfig) {
        console.log(`No punishment configured for ${event.action} in guild ${event.guildId}, defaulting to BAN`);
        
        punishmentConfig = {
          action: event.action,
          punishment: PunishmentType.BAN,
        };
      }

      
      const guild = await this.client.guilds.fetch(event.guildId);
      const member = await guild.members.fetch(event.userId).catch(() => null);

      if (!member) {
        console.log(`Member ${event.userId} not found in guild ${event.guildId}`);
        return;
      }

      
      if (member.id === guild.ownerId) {
        console.log(`Skipping punishment for guild owner ${member.id}`);
        return;
      }

      
      if (!this.canPunishMember(guild, member)) {
        console.log(`Cannot punish ${member.id} due to role hierarchy`);
        return;
      }

      
      let success = false;
      let reason = `Anti-Nuke: ${event.action} limit exceeded (${count}/${limit})`;

      switch (punishmentConfig.punishment) {
        case PunishmentType.BAN:
          success = await this.banMember(guild, member, reason);
          break;
        case PunishmentType.KICK:
          success = await this.kickMember(guild, member, reason);
          break;
        case PunishmentType.TIMEOUT:
          success = await this.timeoutMember(guild, member, reason, punishmentConfig.durationSeconds ?? 600);
          break;
      }

      if (success) {
        
        const modCase = await this.caseService.createCase({
          guildId: event.guildId,
          targetId: event.userId,
          moderatorId: this.client.user!.id,
          action: punishmentConfig.punishment,
          reason,
          metadata: {
            antiNuke: true,
            triggerAction: event.action,
            count,
            limit,
            auditLogId: event.auditLogId,
          },
        });

        
        const embed = this.loggingService.createSecurityActionEmbed({
          title: '🚨 Anti-Nuke Action — User Punished',
          executorId: event.userId,
          executorTag: member.user.tag,
          action: event.action,
          limit,
          count,
          punishment: punishmentConfig.punishment,
          caseId: modCase.caseNumber,
          resetTime
        });

        await this.loggingService.logSecurity(event.guildId, embed);

        
        await this.revertRecentActions(event.guildId, event.userId, event.action, 60000); 
      }

      
    } finally {
      
      this.activeLocks.delete(lockKey);
    }
  }

  
  async revertRecentActions(
    guildId: string,
    userId: string,
    action: ProtectionAction,
    windowMs: number
  ): Promise<void> {
    try {
      const actions = await this.actionLimiter.getActionsByUser(guildId, userId, action, windowMs);

      if (actions.length === 0) return;

      console.log(`Reverting ${actions.length} actions for ${userId} in ${guildId}`);

      let revertedCount = 0;
      for (const event of actions) {
        const success = await this.revertAction(event);
        if (success) revertedCount++;
      }

      if (revertedCount > 0) {
        
        const embed = this.loggingService.createSecurityActionEmbed({
          title: '♻️ Anti-Nuke Reversion',
          executorId: userId,
          executorTag: 'System',
          action: action,
          limit: 0,
          count: revertedCount,
          punishment: PunishmentType.BAN, 
          caseId: 0,
        });

        
        embed.setDescription(`**Reverted ${revertedCount} actions** of type \`${action}\` performed by <@${userId}>.`);

        await this.loggingService.logSecurity(guildId, embed);
      }

    } catch (error) {
      console.error('Error reverting actions:', error);
    }
  }

  
  async revertAction(event: SecurityEvent): Promise<boolean> {
    if (!event.targetId) return false;

    try {
      const guild = await this.client.guilds.fetch(event.guildId);

      switch (event.action) {
        case ProtectionAction.CREATE_CHANNELS:
          const channel = await guild.channels.fetch(event.targetId).catch(() => null);
          if (channel) {
            await channel.delete('Anti-Nuke: Reverting channel creation');
            return true;
          }
          break;

        case ProtectionAction.CREATE_ROLES:
          const role = await guild.roles.fetch(event.targetId).catch(() => null);
          if (role) {
            await role.delete('Anti-Nuke: Reverting role creation');
            return true;
          }
          break;

        case ProtectionAction.ADD_BOTS:
          const bot = await guild.members.fetch(event.targetId).catch(() => null);
          if (bot) {
            await bot.ban({ reason: 'Anti-Nuke: Reverting bot addition' });
            return true;
          }
          break;

        case ProtectionAction.GIVE_ADMIN_ROLE:
          const member = await guild.members.fetch(event.targetId).catch(() => null);
          if (member && event.metadata?.adminRoles) {
            
            
            
            
            
            await this.removeDangerousRoles(event.guildId, event.targetId);
            return true;
          }
          break;

        case ProtectionAction.DANGEROUS_PERMS:
          
          
          
          
          const dangerousRole = await guild.roles.fetch(event.targetId).catch(() => null);
          if (dangerousRole) {
            const permissions = dangerousRole.permissions;
            const newPermissions = permissions.remove([
              PermissionsBitField.Flags.Administrator,
              PermissionsBitField.Flags.ManageGuild,
              PermissionsBitField.Flags.ManageRoles,
              PermissionsBitField.Flags.BanMembers,
              PermissionsBitField.Flags.KickMembers,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageWebhooks
            ]);
            await dangerousRole.setPermissions(newPermissions, 'Anti-Nuke: Reverting dangerous permissions');
            return true;
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to revert action ${event.action} on target ${event.targetId}:`, error);
    }
    return false;
  }

  
  private async banMember(guild: Guild, member: GuildMember, reason: string): Promise<boolean> {
    try {
      await guild.members.ban(member, { reason });
      return true;
    } catch (error) {
      console.error(`Failed to ban ${member.id}:`, error);
      return false;
    }
  }

  
  private async kickMember(guild: Guild, member: GuildMember, reason: string): Promise<boolean> {
    try {
      await member.kick(reason);
      return true;
    } catch (error) {
      console.error(`Failed to kick ${member.id}:`, error);
      return false;
    }
  }

  
  private async timeoutMember(
    guild: Guild,
    member: GuildMember,
    reason: string,
    durationSeconds: number
  ): Promise<boolean> {
    try {
      const timeoutUntil = new Date(Date.now() + durationSeconds * 1000);
      await member.timeout(timeoutUntil.getTime() - Date.now(), reason);
      return true;
    } catch (error) {
      console.error(`Failed to timeout ${member.id}:`, error);
      return false;
    }
  }

  
  private canPunishMember(guild: Guild, member: GuildMember): boolean {
    const botMember = guild.members.me;
    if (!botMember) return false;

    
    if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return false;
    }

    
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return false;
    }

    return true;
  }

  
  async kickRecentBots(guildId: string, exceptBotId?: string): Promise<number> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const members = await guild.members.fetch();

      let kickCount = 0;
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      for (const [_, member] of members) {
        if (
          member.user.bot &&
          member.id !== this.client.user!.id &&
          member.id !== exceptBotId &&
          member.joinedTimestamp &&
          member.joinedTimestamp > fiveMinutesAgo
        ) {
          try {
            await member.kick('Anti-Nuke: Unauthorized bot addition');
            kickCount++;
          } catch (error) {
            console.error(`Failed to kick bot ${member.id}:`, error);
          }
        }
      }

      return kickCount;
    } catch (error) {
      console.error(`Failed to kick bots in guild ${guildId}:`, error);
      return 0;
    }
  }

  
  async removeDangerousRoles(guildId: string, userId: string): Promise<number> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      let removeCount = 0;

      for (const [_, role] of member.roles.cache) {
        if (
          role.permissions.has(PermissionsBitField.Flags.Administrator) ||
          role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
          role.permissions.has(PermissionsBitField.Flags.ManageRoles)
        ) {
          try {
            await member.roles.remove(role, 'Anti-Nuke: Dangerous role detected');
            removeCount++;
          } catch (error) {
            console.error(`Failed to remove role ${role.id}:`, error);
          }
        }
      }

      return removeCount;
    } catch (error) {
      console.error(`Failed to remove dangerous roles from ${userId}:`, error);
      return 0;
    }
  }
}
