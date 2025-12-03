

import { Collection, Guild, Invite } from 'discord.js';
import { prisma } from '../database/connect';

export class InviteService {
  constructor() { }

  
  async cacheGuildInvites(guild: Guild): Promise<void> {
    try {
      const invites = await guild.invites.fetch();

      
      await prisma.inviteCache.deleteMany({ where: { guildId: guild.id } });

      
      const inviteData = invites.map(invite => ({
        guildId: guild.id,
        code: invite.code,
        inviterId: invite.inviter?.id || 'unknown',
        inviterTag: invite.inviter?.tag || 'unknown',
        uses: invite.uses || 0,
        maxUses: invite.maxUses || 0,
        createdAt: invite.createdAt || new Date()
      }));

      if (inviteData.length > 0) {
        await prisma.inviteCache.createMany({ data: inviteData });
      }
    } catch (error: any) {
      if (error.code === 50013) {
        console.warn(`⚠️ Missing permissions to cache invites for guild ${guild.name} (${guild.id})`);
      } else {
        console.error('Error caching guild invites:', error);
      }
    }
  }

  
  async updateInviteCache(guild: Guild): Promise<void> {
    await this.cacheGuildInvites(guild);
  }

  
  async findUsedInvite(guildId: string, newInvites: Collection<string, Invite>): Promise<{
    inviterId: string | null;
    inviterTag: string | null;
    inviteCode: string | null;
    joinType: 'invite' | 'vanity' | 'unknown' | 'oauth';
  }> {
    try {
      
      const cachedInvites = await prisma.inviteCache.findMany({ where: { guildId } });

      
      const oldInvitesMap = new Map(
        cachedInvites.map(inv => [inv.code, inv])
      );

      
      for (const [code, newInvite] of newInvites) {
        const oldInvite = oldInvitesMap.get(code);

        if (oldInvite && newInvite.uses! > oldInvite.uses) {
          
          return {
            inviterId: newInvite.inviter?.id || null,
            inviterTag: newInvite.inviter?.tag || null,
            inviteCode: code,
            joinType: code === newInvite.guild?.vanityURLCode ? 'vanity' : 'invite'
          };
        } else if (!oldInvite && newInvite.uses! > 0) {
          
          return {
            inviterId: newInvite.inviter?.id || null,
            inviterTag: newInvite.inviter?.tag || null,
            inviteCode: code,
            joinType: 'invite'
          };
        }
      }

      
      const guild = newInvites.first()?.guild;
      if (guild && 'vanityURLCode' in guild && guild.vanityURLCode) {
        const vanityInvite = newInvites.find(inv => inv.code === guild.vanityURLCode);
        const oldVanity = oldInvitesMap.get(guild.vanityURLCode);

        if (vanityInvite && oldVanity && vanityInvite.uses! > oldVanity.uses) {
          return {
            inviterId: null,
            inviterTag: null,
            inviteCode: guild.vanityURLCode,
            joinType: 'vanity'
          };
        }
      }

      
      return {
        inviterId: null,
        inviterTag: null,
        inviteCode: null,
        joinType: 'unknown'
      };
    } catch (error) {
      console.error('Error finding used invite:', error);
      return {
        inviterId: null,
        inviterTag: null,
        inviteCode: null,
        joinType: 'unknown'
      };
    }
  }

  
  async storeMemberJoin(
    guildId: string,
    userId: string,
    inviterId: string | null,
    inviterTag: string | null,
    inviteCode: string | null,
    joinType: 'invite' | 'vanity' | 'unknown' | 'oauth'
  ): Promise<void> {
    await prisma.memberJoinData.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: {
        inviterId,
        inviterTag,
        inviteCode,
        joinType
      },
      create: {
        guildId,
        userId,
        inviterId,
        inviterTag,
        inviteCode,
        joinType
      }
    });
  }

  
  async getMemberJoinData(guildId: string, userId: string) {
    return await prisma.memberJoinData.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }

  
  async deleteMemberJoinData(guildId: string, userId: string): Promise<void> {
    try {
      await prisma.memberJoinData.delete({ where: { guildId_userId: { guildId, userId } } });
    } catch (error) {
      
    }
  }

  
  async getUserInviteCount(guildId: string, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.findUnique({ where: { guildId_userId: { guildId, userId } } });

    if (!tracker) return 0;

    return tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;
  }

  
  async incrementInvites(guild: Guild, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.upsert({
      where: { guildId_userId: { guildId: guild.id, userId } },
      update: { totalInvites: { increment: 1 } },
      create: { guildId: guild.id, userId, totalInvites: 1 }
    });

    const totalInvites = tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;

    
    try {
      const roleReward = await prisma.inviteRole.findUnique({
        where: { guildId_invites: { guildId: guild.id, invites: totalInvites } }
      });

      if (roleReward) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          await member.roles.add(roleReward.roleId).catch(err =>
            console.error(`Failed to add invite role ${roleReward.roleId} to ${userId}:`, err)
          );
        }
      }
    } catch (error) {
      console.error('Error checking/awarding invite role:', error);
    }

    return totalInvites;
  }

  
  async decrementInvites(guildId: string, userId: string): Promise<number> {
    const tracker = await prisma.inviteTracker.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { leftInvites: { increment: 1 } },
      create: { guildId, userId, leftInvites: 1 }
    });

    return tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites;
  }

  
  async getMembersInvitedBy(guildId: string, inviterId: string) {
    return await prisma.memberJoinData.findMany({
      where: {
        guildId,
        inviterId,
        joinType: 'invite'
      }
    });
  }

  
  async getInviteStats(guildId: string, userId: string) {
    return await prisma.inviteTracker.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }
}
