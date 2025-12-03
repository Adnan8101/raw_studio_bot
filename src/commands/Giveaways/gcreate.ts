
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder, MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { parseDuration } from '../../utils/time';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { PrefixCommand } from '../../types';

export const category = 'giveaways';

export const data = new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Start a new giveaway')
    .addStringOption(option =>
        option.setName('prize')
            .setDescription('The prize to give away')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('winners')
            .setDescription('Number of winners')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('duration')
            .setDescription('Duration (e.g. 10m, 1h, 2d)')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to host the giveaway in (default: current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false))
    .addRoleOption(option =>
        option.setName('role_requirement')
            .setDescription('Required role to enter')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('invite_requirement')
            .setDescription('Minimum invites required')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('account_age')
            .setDescription('Minimum account age in days')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('server_age')
            .setDescription('Minimum days in server')
            .setRequired(false))
    .addBooleanOption(option =>
        option.setName('captcha')
            .setDescription('Require captcha verification')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('message_required')
            .setDescription('Minimum messages required to enter')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('voice')
            .setDescription('Minimum voice minutes required')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('custom_message')
            .setDescription('Custom message to display in giveaway')
            .setRequired(false))

    .addRoleOption(option =>
        option.setName('assign_role')
            .setDescription('Role to assign to participants')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('thumbnail')
            .setDescription('URL for giveaway thumbnail')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('emoji')
            .setDescription('Custom emoji for reaction (default: 🎉)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixExecute = async (interaction: any) => {
    const args = interaction.args;
    const message = interaction.message;

    const helpEmbed = new EmbedBuilder()
        .setTitle('🎉 Quick Giveaway Help')
        .setDescription('Start a giveaway quickly with a single command.')
        .addFields(
            { name: 'Usage', value: '`!gstart <prize> <winners> <duration>`' },
            { name: 'Examples', value: '`!gstart Nitro 1 1h`\n`!gstart Mystery Box 5 30m`\n`!gstart $10 Gift Card 2 1d`' },
            { name: 'Arguments', value: '• **Prize:** What you are giving away (can be multiple words)\n• **Winners:** Number of winners (must be at least 1)\n• **Duration:** How long the giveaway lasts (e.g., 10m, 1h, 2d)' }
        )
        .setColor('#2f3136')
        .setFooter({ text: 'Tip: Duration must be the last argument!' });

    if (args.length < 3) {
        await interaction.reply({ embeds: [helpEmbed] });
        return;
    }

    const durationStr = args[args.length - 1];
    const winnersStr = args[args.length - 2];
    const prize = args.slice(0, args.length - 2).join(' ');

    if (!durationStr || !winnersStr || !prize) {
        await interaction.reply({ embeds: [helpEmbed] });
        return;
    }

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
        await interaction.reply({ content: '❌ Invalid duration format. Use 10m, 1h, 2d, etc.', embeds: [helpEmbed] });
        return;
    }

    const winners = parseInt(winnersStr);
    if (isNaN(winners) || winners < 1) {
        await interaction.reply({ content: '❌ Invalid number of winners.', embeds: [helpEmbed] });
        return;
    }

    const endTime = new Date(Date.now() + durationSeconds * 1000);
    const db = DatabaseManager.getInstance();

    const embed = new EmbedBuilder()
        .setTitle(prize)
        .setDescription(`React with 🎉 to enter!\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R> (<t:${Math.floor(endTime.getTime() / 1000)}:f>)\nHosted by: ${interaction.user}`)
        .addFields(
            { name: 'Winners', value: `${winners}`, inline: true },
            { name: 'Host', value: `${interaction.user}`, inline: true }
        )
        .setColor('#2f3136')
        .setTimestamp(endTime)
        .setFooter({ text: `Ends at` });

    try {
        const channel = message.channel as TextChannel;
        const giveawayMessage = await channel.send({ embeds: [embed] });
        await giveawayMessage.react('🎉');

        await db.createGiveaway({
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: message.guild!.id,
            hostId: message.author.id,
            prize,
            winnersCount: winners,
            endTime,
            roleRequirement: null,
            inviteRequirement: null,
            accountAgeRequirement: null,
            serverAgeRequirement: null,
            captchaRequirement: false,
            messageRequirement: null,
            voiceRequirement: null,
            customMessage: null,
            assignRole: null,
            thumbnail: null,
            emoji: '🎉'
        });

        await interaction.message.delete().catch(() => { });
    } catch (error) {
        console.error('Failed to create giveaway:', error);
        const channel = message.channel as TextChannel;
        await channel.send('Failed to create giveaway.');
    }
};

export const prefixCommand: PrefixCommand = {
    name: 'gcreate',
    description: 'Start a new giveaway',
    usage: 'gcreate <prize> <winners> <duration>',
    aliases: ['gstart', 'gquick'],
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: prefixExecute
};
