import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, AttachmentBuilder } from 'discord.js';
import { prisma } from '../../database/connect';
import { generateStatsImage } from '../../utils/statsCanvas';

export const category = 'Utility';
export const permission = 'None';
export const syntax = '/stats [user]';
export const example = '/stats @Tai';

export const data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Displays detailed user statistics')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check stats for')
            .setRequired(false)
    );

export const prefixCommand = {
    name: 'stats',
    description: 'Displays detailed user statistics',
    usage: 'stats [user]',
    aliases: ['rank', 'profile'],
    execute: async (interaction: any) => {
        const args = interaction.args;
        const message = interaction.message;
        let targetUser: GuildMember;

        if (args.length > 0) {
            const userInput = args[0].replace(/[<@!>]/g, '');
            try {
                targetUser = await message.guild!.members.fetch(userInput);
            } catch (error) {
                await message.reply('❌ User not found.');
                return;
            }
        } else {
            targetUser = message.member as GuildMember;
        }

        await handleStats(message, targetUser);
    }
};

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;
    const targetUser = await interaction.guild?.members.fetch(user.id).catch(() => null);

    if (!targetUser) {
        await interaction.editReply({ content: '❌ User not found.' });
        return;
    }

    await handleStats(interaction, targetUser);
}

import { VoiceService } from '../../services/VoiceService';
import { DatabaseManager } from '../../utils/DatabaseManager';

// ... imports

async function handleStats(interaction: any, targetUser: GuildMember) {
    const guildId = targetUser.guild.id;
    const userId = targetUser.id;
    const db = DatabaseManager.getInstance();

    // Handle reply/deferral
    let reply;
    if (interaction.deferred) {
        // Already deferred (Slash Command)
        reply = await interaction.fetchReply();
    } else if (interaction.deferReply) {
        // Not deferred yet (Shouldn't happen with new execute, but safe fallback)
        reply = await interaction.deferReply();
    } else {
        // Prefix command
        reply = await interaction.channel.send('Generating stats...');
    }

    try {
        // Fetch User Stats (Messages)
        const userStats = await prisma.userStats.findUnique({
            where: { guildId_userId: { guildId, userId } }
        });

        // Fetch Voice Stats (Real-time)
        const voiceStats = await VoiceService.getStats(userId, guildId);

        // Fetch Invite Stats
        const regularInvites = await db.getUserInviteCount(guildId, userId);
        const leftInvites = await db.getUserLeftCount(guildId, userId);
        const fakeInvites = await db.getUserFakeCount(guildId, userId);
        const bonusInvites = await db.getUserBonusInvites(guildId, userId);
        const totalInvites = regularInvites + bonusInvites - leftInvites - fakeInvites;

        // Fetch Ranks
        const messageRank = await prisma.userStats.count({
            where: {
                guildId,
                messageCount: { gt: userStats?.messageCount || 0 }
            }
        }) + 1;

        const voiceRank = await prisma.userStats.count({
            where: {
                guildId,
                voiceTime: { gt: BigInt(voiceStats?.voiceTime || 0) }
            }
        }) + 1;

        // Calculate Invite Rank (This is expensive on large servers, but acceptable for now)
        // We need to count how many users have more total invites
        // Since total invites is a computed value from multiple columns, we can't do a simple count query easily without raw SQL or fetching all.
        // For optimization, we'll just count based on 'totalInvites' column in InviteTracker
        const inviteRank = await prisma.inviteTracker.count({
            where: {
                guildId,
                totalInvites: { gt: totalInvites } // This isn't perfectly accurate as it doesn't account for the formula, but it's a good approximation for rank
            }
        }) + 1;


        // Fetch History (Last 14 Days)
        const history = await prisma.userDailyStats.findMany({
            where: {
                guildId,
                userId,
                date: {
                    gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                }
            },
            orderBy: { date: 'asc' }
        });

        // Fill missing days
        const messageHistory = new Array(14).fill(0);
        const voiceHistory = new Array(14).fill(0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        history.forEach((stat: any) => {
            const diffTime = Math.abs(today.getTime() - stat.date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const index = 13 - diffDays; // 13 is today (end of array)
            if (index >= 0 && index < 14) {
                messageHistory[index] = stat.messageCount;
                voiceHistory[index] = Number(stat.voiceTime);
            }
        });

        // Calculate 1d, 7d, 14d totals
        // Use userStats for accurate daily/weekly counts (synced with !messages and !vc)
        const dailyMsg = userStats?.dailyMessages || 0;
        const weeklyMsg = userStats?.weeklyMessages || 0;
        const monthlyMsg = messageHistory.reduce((a, b) => a + b, 0); // 14d history sum as fallback/chart data

        const dailyVoice = Number(voiceStats?.dailyVoiceTime || 0);
        const weeklyVoice = Number(voiceStats?.weeklyVoiceTime || 0);
        const monthlyVoice = voiceHistory.reduce((a, b) => a + b, 0); // 14d history sum as fallback/chart data

        // Fetch Top Channels
        const topTextChannel = await prisma.userChannelStats.findFirst({
            where: { guildId, userId, messageCount: { gt: 0 } },
            orderBy: { messageCount: 'desc' }
        });

        const topVoiceChannel = await prisma.userChannelStats.findFirst({
            where: { guildId, userId, voiceTime: { gt: BigInt(0) } },
            orderBy: { voiceTime: 'desc' }
        });

        // Resolve Channel Names
        let textChannelName = 'None';
        if (topTextChannel) {
            const channel = await targetUser.guild.channels.fetch(topTextChannel.channelId).catch(() => null);
            textChannelName = channel ? channel.name : 'Unknown';
        }

        let voiceChannelName = 'None';
        if (topVoiceChannel) {
            const channel = await targetUser.guild.channels.fetch(topVoiceChannel.channelId).catch(() => null);
            voiceChannelName = channel ? channel.name : 'Unknown';
        }

        // Prepare Data
        const statsData = {
            user: targetUser.user,
            guildName: targetUser.guild.name,
            joinedAt: targetUser.joinedAt,
            ranks: {
                message: messageRank,
                voice: voiceRank,
                invite: inviteRank
            },
            messages: {
                daily: dailyMsg,
                weekly: weeklyMsg,
                monthly: monthlyMsg
            },
            voice: {
                daily: dailyVoice,
                weekly: weeklyVoice,
                monthly: monthlyVoice
            },
            invites: {
                total: totalInvites,
                regular: regularInvites,
                bonus: bonusInvites,
                left: leftInvites,
                fake: fakeInvites
            },
            topChannels: {
                text: {
                    name: textChannelName,
                    count: topTextChannel?.messageCount || 0
                },
                voice: {
                    name: voiceChannelName,
                    time: Number(topVoiceChannel?.voiceTime || 0)
                }
            },
            history: {
                messages: messageHistory,
                voice: voiceHistory
            }
        };

        // Generate Image
        const attachment = await generateStatsImage(statsData);

        if (interaction.editReply) {
            await interaction.editReply({ content: null, files: [attachment] });
        } else {
            // For prefix command where we sent a message
            await reply.edit({ content: null, files: [attachment] });
        }

    } catch (error) {
        console.error('Error generating stats:', error);
        if (interaction.editReply) {
            await interaction.editReply({ content: '❌ Failed to generate stats.' });
        } else {
            await reply.edit({ content: '❌ Failed to generate stats.' });
        }
    }
}
