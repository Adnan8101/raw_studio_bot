

import { Message, Client, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { AutoModService } from '../services/AutoModService';
import { ModerationService } from '../services/ModerationService';
import { LoggingService } from '../services/LoggingService';
import { EmbedColors } from '../types';
import { CustomEmojis } from '../utils/emoji';

export class AutoModMonitor {
  private messageCache: Map<string, { count: number; timestamps: number[]; lines: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private client: Client,
    private autoModService: AutoModService,
    private moderationService: ModerationService,
    private loggingService: LoggingService
  ) {
    this.setupMessageListener();

    
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000);

    console.log('✔ AutoMod Monitor initialized');
  }

  private setupMessageListener() {
    this.client.on('messageCreate', async (message: Message) => {
      
      if (!message.guild || message.author.id === this.client.user?.id) return;

      const guildId = message.guild.id;
      const userId = message.author.id;
      const channelId = message.channel.id;

      try {
        
        await this.checkAntiSpam(message, guildId, userId);

        
        await this.checkMassMention(message, guildId, userId);

        
        await this.checkServerInvite(message, guildId, userId, channelId);

        
        await this.checkAntiLink(message, guildId, userId, channelId);
      } catch (error) {
        console.error('AutoMod error:', error);
      }
    });
  }

  private violationTracker: Map<string, { count: number; lastViolation: number }> = new Map();

  private async checkAntiSpam(message: Message, guildId: string, userId: string) {
    const config = await this.autoModService.getConfig(guildId, 'anti_spam');
    if (!config?.enabled) return;

    
    if (await this.isWhitelisted(message.guild!, 'anti_spam', userId, message.member!, message.channel.id)) {
      return;
    }

    const member = message.member!;

    const cacheKey = `${guildId}:${userId}`;
    const now = Date.now();
    const timeSpan = config.timeSpanMs || 5000;

    let cache = this.messageCache.get(cacheKey);
    if (!cache) {
      cache = { count: 0, timestamps: [], lines: 0 };
      this.messageCache.set(cacheKey, cache);
    }

    
    cache.timestamps = cache.timestamps.filter(ts => now - ts < timeSpan);

    
    cache.timestamps.push(now);
    cache.count = cache.timestamps.length;

    
    const currentLines = (message.content.match(/\n/g) || []).length + 1;

    
    const maxMessages = config.maxMessages || 5;
    const maxLines = config.maxLines || 10;

    let isViolation = false;
    let violationReason = '';

    if (cache.count > maxMessages) {
      isViolation = true;
      violationReason = `Anti-spam: ${cache.count} messages in ${timeSpan / 1000}s`;
    } else if (currentLines > maxLines) {
      isViolation = true;
      violationReason = `Anti-spam: ${currentLines} lines in single message`;
    }

    if (isViolation) {
      await this.handleViolation(
        message,
        config.punishmentType || 'timeout',
        config.actionType || 'delete',
        violationReason,
        config.punishmentDuration || 600000
      );

      
      this.messageCache.delete(cacheKey);
    }
  }

  private async checkMassMention(message: Message, guildId: string, userId: string) {
    const config = await this.autoModService.getConfig(guildId, 'mass_mention');
    if (!config?.enabled) return;

    
    if (await this.isWhitelisted(message.guild!, 'mass_mention', userId, message.member!, message.channel.id)) {
      return;
    }

    const mentions = message.mentions.users.size + message.mentions.roles.size;
    const maxMentions = config.maxMentions || 5;

    if (mentions > maxMentions) {
      await this.handleViolation(
        message,
        config.punishmentType || 'timeout',
        config.actionType || 'delete',
        `Mass mention violation (${mentions} mentions)`,
        config.punishmentDuration || 600000
      );
    }
  }

  private async checkServerInvite(message: Message, guildId: string, userId: string, channelId: string) {
    const config = await this.autoModService.getConfig(guildId, 'server_invite');
    if (!config?.enabled) return;

    
    if (await this.isWhitelisted(message.guild!, 'server_invite', userId, message.member!, channelId)) {
      return;
    }

    
    const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li|com)\/(?:invite\/)?|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9-]{2,32}/gi;

    if (inviteRegex.test(message.content)) {
      await this.handleViolation(
        message,
        config.punishmentType || 'kick',
        config.actionType || 'delete',
        'Server invite link detected',
        config.punishmentDuration || 600000
      );
    }
  }

  private async checkAntiLink(message: Message, guildId: string, userId: string, channelId: string) {
    const config = await this.autoModService.getConfig(guildId, 'anti_link');
    if (!config?.enabled) return;

    
    if (await this.isWhitelisted(message.guild!, 'anti_link', userId, message.member!, channelId)) {
      return;
    }

    
    
    const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li|com)\/(?:invite\/)?|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9-]{2,32}/gi;
    if (inviteRegex.test(message.content)) {
      return; 
    }

    
    
    
    
    
    
    
    
    const urlRegex = /((?:https?:\/\/)[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,5}(?::[0-9]{1,5})?(?:\/[^\s]*)?)|(?:www\.[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,5}(?::[0-9]{1,5})?(?:\/[^\s]*)?)/gi;

    if (urlRegex.test(message.content)) {
      await this.handleViolation(
        message,
        config.punishmentType || 'timeout',
        config.actionType || 'delete',
        'External link detected',
        config.punishmentDuration || 600000
      );
    }
  }

  private async isWhitelisted(
    guild: import('discord.js').Guild,
    feature: string,
    userId: string,
    member: GuildMember | null,
    channelId: string
  ): Promise<boolean> {
    
    if (userId === guild.ownerId) {
      return true;
    }

    
    


    
    const allWhitelists = await this.autoModService.getAllWhitelists(guild.id, feature);

    
    if (allWhitelists.some((w: any) => w.targetType === 'user' && w.targetId === userId)) {
      return true;
    }

    
    if (member) {
      for (const roleId of Array.from(member.roles.cache.keys())) {
        if (allWhitelists.some((w: any) => w.targetType === 'role' && w.targetId === roleId)) {
          return true;
        }
      }
    }

    
    if (allWhitelists.some((w: any) => w.targetType === 'channel' && w.targetId === channelId)) {
      return true;
    }

    return false;
  }

  private async handleViolation(
    message: Message,
    punishment: string,
    actionType: string,
    reason: string,
    duration: number
  ) {
    const member = message.member;
    if (!member) return;

    const botMember = message.guild!.members.me;
    if (!botMember) return;

    try {
      
      switch (actionType) {
        case 'delete':
          await message.delete().catch(() => { });
          await this.takePunishment(message, member, botMember, punishment, reason, duration);
          break;

        case 'warn':
          await this.warnUser(message, member, reason);
          break;

        case 'delete_warn':
          await message.delete().catch(() => { });
          await this.warnUser(message, member, reason);
          await this.takePunishment(message, member, botMember, punishment, reason, duration);
          break;

        default:
          await message.delete().catch(() => { });
          await this.takePunishment(message, member, botMember, punishment, reason, duration);
      }

      
      await this.sendPunishmentNotification(message, member, reason, actionType);
    } catch (error) {
      console.error('Failed to handle automod violation:', error);
    }
  }

  private async sendPunishmentNotification(
    message: Message,
    member: GuildMember,
    reason: string,
    actionType: string
  ) {
    try {
      if (!message.channel.isSendable()) return;

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${CustomEmojis.CAUTION} User Punished`)
        .setDescription(
          `${CustomEmojis.USER} **Name:** ${member.user.tag}\n` +
          `${CustomEmojis.FILES} **Rule Break:** ${reason}\n` +
          `${CustomEmojis.SETTING} **Action:** ${actionType.replace('_', ' & ')}`
        )
        .setTimestamp();

      const notificationMsg = await message.channel.send({ embeds: [embed] });

      
      setTimeout(() => {
        notificationMsg.delete().catch(() => { });
      }, 5000);
    } catch (error) {
      console.error('Failed to send punishment notification:', error);
    }
  }



  private async warnUser(message: Message, member: GuildMember, reason: string) {
    try {
      
      await this.moderationService.addWarn(
        message.guild!.id,
        member.id,
        this.client.user!.id,
        `AutoMod: ${reason}`
      );

      
      const warnCount = await this.moderationService.getWarnCount(
        message.guild!.id,
        member.id
      );

      
      try {
        await member.send(
          `⚠️ **Warning in ${message.guild!.name}**\n\n` +
          `**Reason:** ${reason}\n` +
          `**Total Warnings:** ${warnCount}\n\n` +
          `Please follow the server rules to avoid further action.`
        );
      } catch {
        
      }
    } catch (error) {
      console.error('Failed to warn user:', error);
    }
  }

  private async takePunishment(
    message: Message,
    member: GuildMember,
    botMember: GuildMember,
    punishment: string,
    reason: string,
    duration: number
  ) {
    try {
      
      await this.tryDMUser(member, punishment, reason, duration);

      switch (punishment) {
        case 'timeout':
          if (botMember.permissions.has('ModerateMembers')) {
            await member.timeout(duration, `AutoMod: ${reason}`);
          }
          break;

        case 'kick':
          if (botMember.permissions.has('KickMembers') && member.kickable) {
            await member.kick(`AutoMod: ${reason}`);
          }
          break;

        case 'ban':
          if (botMember.permissions.has('BanMembers') && member.bannable) {
            await member.ban({ reason: `AutoMod: ${reason}` });
          }
          break;
      }

      
      await this.loggingService.logModeration(member.guild.id, {
        action: `AutoMod ${punishment.charAt(0).toUpperCase() + punishment.slice(1)}`,
        target: { tag: member.user.tag, id: member.id },
        moderator: { tag: this.client.user!.tag, id: this.client.user!.id },
        reason: reason,
        duration: punishment === 'timeout' ? `${Math.round(duration / 60000)}m` : undefined
      });

    } catch (error) {
      console.error('Failed to take punishment:', error);
    }
  }



  private async tryDMUser(member: GuildMember, punishment: string, reason: string, duration: number = 600000): Promise<boolean> {
    try {
      let message = `⚠️ **AutoMod Action in ${member.guild.name}**\n\n`;
      message += `**Action:** ${punishment}\n`;
      message += `**Reason:** ${reason}\n\n`;

      if (punishment === 'timeout') {
        const minutes = Math.round(duration / 60000);
        message += `You have been timed out for ${minutes} minutes. Please follow server rules.`;
      } else if (punishment === 'kick') {
        message += `You have been kicked from the server. You can rejoin, but please follow the rules.`;
      } else if (punishment === 'ban') {
        message += `You have been banned from the server.`;
      }

      await member.send(message);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupCache() {
    const now = Date.now();
    const maxAge = 60000; 

    for (const [key, cache] of Array.from(this.messageCache.entries())) {
      if (cache.timestamps.length === 0 || now - cache.timestamps[cache.timestamps.length - 1] > maxAge) {
        this.messageCache.delete(key);
      }
    }

    
    for (const [key, tracker] of Array.from(this.violationTracker.entries())) {
      if (now - tracker.lastViolation > 120000) {
        this.violationTracker.delete(key);
      }
    }
  }

  public destroy() {
    clearInterval(this.cleanupInterval);
  }
}
