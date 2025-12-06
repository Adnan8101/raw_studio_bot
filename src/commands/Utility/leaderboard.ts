import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js';
import { prisma } from '../../database/connect';
import { createCustomEmbed, createErrorEmbed, ICONS, COLORS } from '../../utils/embeds';

export const category = 'Utility';
export const permission = 'None';
export const syntax = '/leaderboard <type>';
export const example = '/leaderboard messages';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays server leaderboards')
    .addSubcommand(subcommand =>
        subcommand
            .setName('messages')
            .setDescription('Message leaderboard')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Type of leaderboard')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Total Messages', value: 'total' },
                        { name: 'Daily Messages', value: 'daily' },
                        { name: 'Weekly Messages', value: 'weekly' }
                    )
            )
    )
    .addSubcommand(subcommand =>
        subcommand.setName('invites').setDescription('Invite leaderboard')
    )
    .addSubcommand(subcommand =>
        subcommand.setName('voice').setDescription('All-time voice leaderboard')
    )
    .addSubcommand(subcommand =>
        subcommand.setName('dailyvoice').setDescription('Daily voice leaderboard')
    )
    .addSubcommand(subcommand =>
        subcommand.setName('weeklyvoice').setDescription('Weekly voice leaderboard')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === 'messages') {
        const type = interaction.options.getString('type') || 'total';
        await sendMessageLeaderboard(interaction, guildId, type);
    } else if (subcommand === 'invites') {
        await sendInviteLeaderboard(interaction, guildId);
    } else if (['voice', 'dailyvoice', 'weeklyvoice'].includes(subcommand)) {
        await sendVoiceLeaderboard(interaction, guildId, subcommand);
    }
}

export const prefixCommand = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    description: 'View server leaderboards',
    usage: 'leaderboard <type>',
    example: 'leaderboard messages',
    async execute(message: Message, args: string[]) {
        const guildId = message.guildId!;
        const type = args[0]?.toLowerCase();

        if (!type) {
            return message.reply({ embeds: [createErrorEmbed('Please specify a leaderboard type! Usage: `leaderboard <messages|invites|voice>`')] });
        }

        if (['messages', 'msg', 'text'].includes(type)) {
            const subType = args[1]?.toLowerCase() || 'total';
            let mappedType = 'total';
            if (['daily', 'd'].includes(subType)) mappedType = 'daily';
            if (['weekly', 'w'].includes(subType)) mappedType = 'weekly';
            await sendMessageLeaderboard(message, guildId, mappedType);
        } else if (['invites', 'inv'].includes(type)) {
            await sendInviteLeaderboard(message, guildId);
        } else if (['voice', 'vc'].includes(type)) {
            await sendVoiceLeaderboard(message, guildId, 'voice');
        } else if (['dailyvoice', 'dvc'].includes(type)) {
            await sendVoiceLeaderboard(message, guildId, 'dailyvoice');
        } else if (['weeklyvoice', 'wvc'].includes(type)) {
            await sendVoiceLeaderboard(message, guildId, 'weeklyvoice');
        } else {
            return message.reply({ embeds: [createErrorEmbed('Invalid leaderboard type! Usage: `leaderboard <messages|invites|voice>`')] });
        }
    }
};

async function sendMessageLeaderboard(source: ChatInputCommandInteraction | Message, guildId: string, type: string) {
    let orderBy: any = { messageCount: 'desc' };
    let title = 'Message Leaderboard';

    if (type === 'daily') {
        orderBy = { dailyMessages: 'desc' };
        title = 'Daily Message Leaderboard';
    } else if (type === 'weekly') {
        orderBy = { weeklyMessages: 'desc' };
        title = 'Weekly Message Leaderboard';
    }

    const topUsers = await prisma.userStats.findMany({
        where: { guildId },
        orderBy: orderBy,
        take: 10
    });

    if (topUsers.length === 0) {
        const embed = createCustomEmbed(ICONS.INFO, 'No data available yet.', COLORS.INFO);
        await reply(source, { embeds: [embed] });
        return;
    }

    const description = topUsers.map((user, index) => {
        const count = type === 'daily' ? user.dailyMessages : type === 'weekly' ? user.weeklyMessages : user.messageCount;
        return `**${index + 1}.** <@${user.userId}> - **${count}** messages`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`${ICONS.INFO} ${title}`)
        .setDescription(description)
        .setTimestamp();

    await reply(source, { embeds: [embed] });
}

async function sendInviteLeaderboard(source: ChatInputCommandInteraction | Message, guildId: string) {
    const guild = source.guild!;
    const topInviters = await prisma.inviteTracker.findMany({
        where: { guildId },
        take: 50
    });

    if (topInviters.length === 0) {
        await reply(source, { embeds: [createErrorEmbed('No invite data found for this server.')] });
        return;
    }

    const sorted = topInviters.map(tracker => ({
        ...tracker,
        netInvites: tracker.totalInvites - tracker.leftInvites - tracker.fakeInvites + tracker.bonusInvites
    })).sort((a, b) => b.netInvites - a.netInvites).slice(0, 10);

    const description = sorted.map((tracker, index) => {
        return `**${index + 1}.** <@${tracker.userId}> - **${tracker.netInvites}** invites ` +
            `(${tracker.totalInvites} regular, ${tracker.bonusInvites} bonus, ${tracker.leftInvites} left, ${tracker.fakeInvites} fake)`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`${ICONS.INFO} ${guild.name} Invite Leaderboard`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Top 10 Inviters' });

    await reply(source, { embeds: [embed] });
}

async function sendVoiceLeaderboard(source: ChatInputCommandInteraction | Message, guildId: string, type: string) {
    let stats;
    let title;
    let fieldName;

    if (type === 'voice') {
        stats = await prisma.userStats.findMany({
            where: { guildId, voiceTime: { gt: 0 } },
            orderBy: { voiceTime: 'desc' },
            take: 10
        });
        title = 'Voice Leaderboard (All Time)';
        fieldName = 'voiceTime';
    } else if (type === 'dailyvoice') {
        stats = await prisma.userStats.findMany({
            where: { guildId, dailyVoiceTime: { gt: 0 } },
            orderBy: { dailyVoiceTime: 'desc' },
            take: 10
        });
        title = 'Voice Leaderboard (Daily)';
        fieldName = 'dailyVoiceTime';
    } else {
        stats = await prisma.userStats.findMany({
            where: { guildId, weeklyVoiceTime: { gt: 0 } },
            orderBy: { weeklyVoiceTime: 'desc' },
            take: 10
        });
        title = 'Voice Leaderboard (Weekly)';
        fieldName = 'weeklyVoiceTime';
    }

    if (stats.length === 0) {
        await reply(source, { content: 'No voice stats found.', ephemeral: true });
        return;
    }

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    };

    const description = stats.map((stat, index) => {
        const time = Number(stat[fieldName as keyof typeof stat]);
        return `**${index + 1}.** <@${stat.userId}> - ${formatTime(time)}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`${ICONS.INFO} ${title}`)
        .setDescription(description)
        .setTimestamp();

    await reply(source, { embeds: [embed] });
}

async function reply(source: ChatInputCommandInteraction | Message, options: any) {
    if (source instanceof Message) {
        await source.reply(options);
    } else {
        await source.reply(options);
    }
}
