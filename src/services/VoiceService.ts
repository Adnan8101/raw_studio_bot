import { PrismaClient } from '@prisma/client';
import { VoiceState } from 'discord.js';

const prisma = new PrismaClient();

export class VoiceService {
    public static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const userId = newState.member?.id || oldState.member?.id;
        const guildId = newState.guild.id;

        if (!userId) return;
        if (newState.member?.user.bot) return;

        
        if (!oldState.channelId && newState.channelId) {
            await this.join(userId, guildId);
        }
        
        else if (oldState.channelId && !newState.channelId) {
            await this.leave(userId, guildId);
        }
        
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            
            
            
            
            
            
            
            
        }
    }

    private static async join(userId: string, guildId: string) {
        try {
            await prisma.userStats.upsert({
                where: {
                    guildId_userId: {
                        guildId,
                        userId
                    }
                },
                update: {
                    lastVoiceJoin: new Date()
                },
                create: {
                    guildId,
                    userId,
                    lastVoiceJoin: new Date()
                }
            });
        } catch (error) {
            console.error(`Error in VoiceService.join for user ${userId}:`, error);
        }
    }

    private static async leave(userId: string, guildId: string) {
        try {
            const stats = await prisma.userStats.findUnique({
                where: {
                    guildId_userId: {
                        guildId,
                        userId
                    }
                }
            });

            if (!stats || !stats.lastVoiceJoin) return;

            const joinTime = new Date(stats.lastVoiceJoin).getTime();
            const leaveTime = Date.now();
            const duration = leaveTime - joinTime;

            if (duration <= 0) return;

            await prisma.userStats.update({
                where: {
                    guildId_userId: {
                        guildId,
                        userId
                    }
                },
                data: {
                    voiceTime: { increment: duration },
                    dailyVoiceTime: { increment: duration },
                    weeklyVoiceTime: { increment: duration },
                    lastVoiceJoin: null
                }
            });
        } catch (error) {
            console.error(`Error in VoiceService.leave for user ${userId}:`, error);
        }
    }

    public static async getStats(userId: string, guildId: string) {
        const stats = await prisma.userStats.findUnique({
            where: {
                guildId_userId: {
                    guildId,
                    userId
                }
            }
        });

        if (!stats) return null;

        
        let currentSession = 0;
        if (stats.lastVoiceJoin) {
            currentSession = Date.now() - new Date(stats.lastVoiceJoin).getTime();
        }

        return {
            voiceTime: Number(stats.voiceTime) + currentSession,
            dailyVoiceTime: Number(stats.dailyVoiceTime) + currentSession,
            weeklyVoiceTime: Number(stats.weeklyVoiceTime) + currentSession
        };
    }

    public static async addTime(userId: string, guildId: string, ms: number) {
        await prisma.userStats.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: {
                guildId,
                userId,
                voiceTime: ms,
                dailyVoiceTime: ms,
                weeklyVoiceTime: ms
            },
            update: {
                voiceTime: { increment: ms },
                dailyVoiceTime: { increment: ms },
                weeklyVoiceTime: { increment: ms }
            }
        });
    }

    public static async removeTime(userId: string, guildId: string, ms: number) {
        
        
        
        
        
        const stats = await prisma.userStats.findUnique({
            where: { guildId_userId: { guildId, userId } }
        });

        if (!stats) return;

        const newVoiceTime = BigInt(Math.max(0, Number(stats.voiceTime) - ms));
        const newDaily = BigInt(Math.max(0, Number(stats.dailyVoiceTime) - ms));
        const newWeekly = BigInt(Math.max(0, Number(stats.weeklyVoiceTime) - ms));

        await prisma.userStats.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
                voiceTime: newVoiceTime,
                dailyVoiceTime: newDaily,
                weeklyVoiceTime: newWeekly
            }
        });
    }

    public static async resetDailyVoice(guildId: string) {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { dailyVoiceTime: 0 }
        });
    }

    public static async resetWeeklyVoice(guildId: string) {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { weeklyVoiceTime: 0 }
        });
    }

    public static async resetStats(guildId: string, userId?: string) {
        if (userId) {
            await prisma.userStats.update({
                where: { guildId_userId: { guildId, userId } },
                data: {
                    voiceTime: 0,
                    dailyVoiceTime: 0,
                    weeklyVoiceTime: 0,
                    lastVoiceJoin: null 
                    
                }
            });
        } else {
            await prisma.userStats.updateMany({
                where: { guildId },
                data: {
                    voiceTime: 0,
                    dailyVoiceTime: 0,
                    weeklyVoiceTime: 0
                }
            });
        }
    }
}
