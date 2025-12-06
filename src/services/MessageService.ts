import { Client, Guild, GuildMember } from 'discord.js';
import { prisma } from '../database/connect';
import { DatabaseManager } from '../utils/DatabaseManager';

export class MessageService {
    private static instance: MessageService;

    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }


    async shouldCountMessage(guildId: string, channelId: string, categoryId: string | null): Promise<boolean> {

        const channelBlacklist = await prisma.messageBlacklist.findUnique({
            where: {
                guildId_targetId: {
                    guildId,
                    targetId: channelId
                }
            }
        });

        if (channelBlacklist) return false;


        if (categoryId) {
            const categoryBlacklist = await prisma.messageBlacklist.findUnique({
                where: {
                    guildId_targetId: {
                        guildId,
                        targetId: categoryId
                    }
                }
            });

            if (categoryBlacklist) return false;
        }

        return true;
    }


    async checkRoleRewards(client: Client, guildId: string, userId: string, messageCount: number): Promise<void> {
        try {
            const roles = await prisma.messageRole.findMany({
                where: {
                    guildId,
                    messageCount: {
                        lte: messageCount
                    }
                },
                orderBy: {
                    messageCount: 'desc'
                }
            });

            if (roles.length === 0) return;

            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) return;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            for (const roleConfig of roles) {
                if (!member.roles.cache.has(roleConfig.roleId)) {
                    await member.roles.add(roleConfig.roleId).catch(e => console.error(`Failed to add role ${roleConfig.roleId}:`, e));
                }
            }
        } catch (error) {
            console.error('Error checking role rewards:', error);
        }
    }


    async addMessage(guildId: string, userId: string, channelId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            // Update UserDailyStats
            await prisma.userDailyStats.upsert({
                where: {
                    guildId_userId_date: {
                        guildId,
                        userId,
                        date: today
                    }
                },
                update: {
                    messageCount: { increment: 1 }
                },
                create: {
                    guildId,
                    userId,
                    date: today,
                    messageCount: 1
                }
            });

            // Update UserChannelStats
            await prisma.userChannelStats.upsert({
                where: {
                    guildId_userId_channelId: {
                        guildId,
                        userId,
                        channelId
                    }
                },
                update: {
                    messageCount: { increment: 1 }
                },
                create: {
                    guildId,
                    userId,
                    channelId,
                    messageCount: 1
                }
            });
        } catch (error) {
            console.error('Error adding message stats:', error);
        }
    }

    async resetDailyMessages(guildId: string): Promise<void> {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { dailyMessages: 0 }
        });
    }


    async resetWeeklyMessages(guildId: string): Promise<void> {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { weeklyMessages: 0 }
        });
    }
}
