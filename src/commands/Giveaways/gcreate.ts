
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder, MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { parseDuration } from '../../utils/time';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { PrefixCommand } from '../../types';

export const category = 'Giveaways';
export const permission = 'Manage Guild';
export const syntax = '/gcreate <prize> <winners> <duration> [options]';
export const example = '/gcreate prize:Nitro winners:1 duration:1h';

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

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners', true);
    const durationStr = interaction.options.getString('duration', true);
    const channel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;

    // Optional requirements
    const roleRequirement = interaction.options.getRole('role_requirement');
    const inviteRequirement = interaction.options.getInteger('invite_requirement');
    const accountAge = interaction.options.getInteger('account_age');
    const serverAge = interaction.options.getInteger('server_age');
    const captcha = interaction.options.getBoolean('captcha') || false;
    const messageRequired = interaction.options.getInteger('message_required');
    const voiceRequired = interaction.options.getInteger('voice');
    const customMessage = interaction.options.getString('custom_message');
    const assignRole = interaction.options.getRole('assign_role');
    const thumbnail = interaction.options.getString('thumbnail');
    const emoji = interaction.options.getString('emoji') || '🎉';

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
        await interaction.reply({ content: '❌ Invalid duration format. Use 10m, 1h, 2d, etc.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (winners < 1) {
        await interaction.reply({ content: '❌ Winners must be at least 1.', flags: MessageFlags.Ephemeral });
        return;
    }

    const endTime = new Date(Date.now() + durationSeconds * 1000);
    const db = DatabaseManager.getInstance();

    const embed = new EmbedBuilder()
        .setTitle(prize)
        .setDescription(`${customMessage ? customMessage + '\n\n' : ''}React with ${emoji} to enter!\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R> (<t:${Math.floor(endTime.getTime() / 1000)}:f>)\nHosted by: ${interaction.user}`)
        .addFields(
            { name: 'Winners', value: `${winners}`, inline: true },
            { name: 'Host', value: `${interaction.user}`, inline: true }
        )
        .setColor('#2f3136')
        .setTimestamp(endTime)
        .setFooter({ text: `Ends at` });

    if (thumbnail) {
        embed.setThumbnail(thumbnail);
    }

    const requirements: string[] = [];
    if (roleRequirement) requirements.push(`• Role: ${roleRequirement}`);
    if (inviteRequirement) requirements.push(`• Invites: ${inviteRequirement}`);
    if (accountAge) requirements.push(`• Account Age: ${accountAge} days`);
    if (serverAge) requirements.push(`• Server Age: ${serverAge} days`);
    if (messageRequired) requirements.push(`• Messages: ${messageRequired}`);
    if (voiceRequired) requirements.push(`• Voice: ${voiceRequired} mins`);
    if (captcha) requirements.push(`• Captcha Verification`);

    if (requirements.length > 0) {
        embed.addFields({ name: 'Requirements', value: requirements.join('\n'), inline: false });
    }

    try {
        const giveawayMessage = await channel.send({ embeds: [embed] });
        await giveawayMessage.react(emoji);

        await db.createGiveaway({
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: interaction.guildId!,
            hostId: interaction.user.id,
            prize,
            winnersCount: winners,
            endTime,
            roleRequirement: roleRequirement?.id || null,
            inviteRequirement: inviteRequirement || null,
            accountAgeRequirement: accountAge || null,
            serverAgeRequirement: serverAge || null,
            captchaRequirement: captcha,
            messageRequirement: messageRequired || null,
            voiceRequirement: voiceRequired || null,
            customMessage: customMessage || null,
            assignRole: assignRole?.id || null,
            thumbnail: thumbnail || null,
            emoji: emoji
        });

        await interaction.reply({ content: `🎉 Giveaway created in ${channel}!`, flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Failed to create giveaway:', error);
        await interaction.reply({ content: 'Failed to create giveaway.', flags: MessageFlags.Ephemeral });
    }
};

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
    let prize = args.slice(0, args.length - 2).join(' ');

    // Parse flags
    const flags: any = {};
    const flagRegex = /--([\w-]+)\s+("([^"]+)"|'([^']+)'|(\S+))/g;
    let match;
    let prizeWithoutFlags = prize;

    // Remove flags from prize string and parse them
    while ((match = flagRegex.exec(prize)) !== null) {
        const flagName = match[1];
        const flagValue = match[3] || match[4] || match[5];
        flags[flagName] = flagValue;
        prizeWithoutFlags = prizeWithoutFlags.replace(match[0], '').trim();
    }
    prize = prizeWithoutFlags;

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

    // Process flags
    const roleRequirement = flags['role'] ? message.guild!.roles.cache.find((r: any) => r.name === flags['role'] || r.id === flags['role'].replace(/[<@&>]/g, '')) : null;
    const assignRole = flags['assign-role'] ? message.guild!.roles.cache.find((r: any) => r.name === flags['assign-role'] || r.id === flags['assign-role'].replace(/[<@&>]/g, '')) : null;
    const inviteRequirement = flags['invites'] ? parseInt(flags['invites']) : null;
    const accountAge = flags['age'] ? parseInt(flags['age']) : null;
    const serverAge = flags['server-age'] ? parseInt(flags['server-age']) : null;
    const messageRequired = flags['messages'] ? parseInt(flags['messages']) : null;
    const voiceRequired = flags['voice'] ? parseInt(flags['voice']) : null;
    const captcha = flags['captcha'] === 'true';
    const emoji = flags['emoji'] || '🎉';
    const thumbnail = flags['thumb'] || null;

    const embed = new EmbedBuilder()
        .setTitle(prize)
        .setDescription(`React with ${emoji} to enter!\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R> (<t:${Math.floor(endTime.getTime() / 1000)}:f>)\nHosted by: ${interaction.user}`)
        .addFields(
            { name: 'Winners', value: `${winners}`, inline: true },
            { name: 'Host', value: `${interaction.user}`, inline: true }
        )
        .setColor('#2f3136')
        .setTimestamp(endTime)
        .setFooter({ text: `Ends at` });

    if (thumbnail) embed.setThumbnail(thumbnail);

    const requirements: string[] = [];
    if (roleRequirement) requirements.push(`• Role: ${roleRequirement}`);
    if (inviteRequirement) requirements.push(`• Invites: ${inviteRequirement}`);
    if (accountAge) requirements.push(`• Account Age: ${accountAge} days`);
    if (serverAge) requirements.push(`• Server Age: ${serverAge} days`);
    if (messageRequired) requirements.push(`• Messages: ${messageRequired}`);
    if (voiceRequired) requirements.push(`• Voice: ${voiceRequired} mins`);
    if (captcha) requirements.push(`• Captcha Verification`);

    if (requirements.length > 0) {
        embed.addFields({ name: 'Requirements', value: requirements.join('\n'), inline: false });
    }

    try {
        const channel = message.channel as TextChannel;
        const giveawayMessage = await channel.send({ embeds: [embed] });
        await giveawayMessage.react(emoji);

        await db.createGiveaway({
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: message.guild!.id,
            hostId: message.author.id,
            prize,
            winnersCount: winners,
            endTime,
            roleRequirement: roleRequirement?.id || null,
            inviteRequirement: inviteRequirement || null,
            accountAgeRequirement: accountAge || null,
            serverAgeRequirement: serverAge || null,
            captchaRequirement: captcha,
            messageRequirement: messageRequired || null,
            voiceRequirement: voiceRequired || null,
            customMessage: null,
            assignRole: assignRole?.id || null,
            thumbnail: thumbnail || null,
            emoji: emoji
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
