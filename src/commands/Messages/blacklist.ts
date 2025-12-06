import { SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed, createCustomEmbed, ICONS, COLORS } from '../../utils/embeds';

export const category = 'Messages';
export const permission = 'Manage Guild';
export const syntax = '/blacklist <channel|category|list> [target]';
export const example = '/blacklist channel #general';

export const data = new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage message blacklists')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('channel')
            .setDescription('Blacklist a channel')
            .addChannelOption(option => option.setName('channel').setDescription('The channel').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('category')
            .setDescription('Blacklist a category')
            .addChannelOption(option => option.setName('category').setDescription('The category').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List blacklisted channels and categories')
    );

export const prefixCommand = {
    name: 'blacklist',
    aliases: ['bl'],
    description: 'Manage message blacklists',
    usage: 'blacklist <channel|category|list> [target]',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    if (!guildId) return;

    if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        if (!channel) return;

        await prisma.messageBlacklist.upsert({
            where: { guildId_targetId: { guildId, targetId: channel.id } },
            update: {},
            create: { guildId, targetId: channel.id, type: 'CHANNEL' }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Blacklisted channel <#${channel.id}>.`)] });

    } else if (subcommand === 'category') {
        const category = interaction.options.getChannel('category');
        if (!category) return;

        await prisma.messageBlacklist.upsert({
            where: { guildId_targetId: { guildId, targetId: category.id } },
            update: {},
            create: { guildId, targetId: category.id, type: 'CATEGORY' }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Blacklisted category **${category.name}**.`)] });

    } else if (subcommand === 'list') {
        const blacklists = await prisma.messageBlacklist.findMany({ where: { guildId } });
        const channels = blacklists.filter(b => b.type === 'CHANNEL').map(b => `<#${b.targetId}>`).join(', ') || 'None';
        const categories = blacklists.filter(b => b.type === 'CATEGORY').map(b => `<#${b.targetId}>`).join(', ') || 'None';

        const embed = new EmbedBuilder()
            .setTitle('Message Blacklists')
            .addFields(
                { name: 'Channels', value: channels },
                { name: 'Categories', value: categories }
            )
            .setColor(COLORS.INFO);
        await interaction.reply({ embeds: [embed] });
    }
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const guildId = message.guildId;
    if (!guildId) return;

    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'channel') {
        const channel = message.mentions.channels.first() || message.guild?.channels.cache.get(args[1]);
        if (!channel) {
            await message.reply({ embeds: [createErrorEmbed('Please mention a channel or provide a valid ID.')] });
            return;
        }

        await prisma.messageBlacklist.upsert({
            where: { guildId_targetId: { guildId, targetId: channel.id } },
            update: {},
            create: { guildId, targetId: channel.id, type: 'CHANNEL' }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Blacklisted channel <#${channel.id}>.`)] });

    } else if (subcommand === 'category') {
        const categoryId = args[1];
        const category = message.guild?.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
            await message.reply({ embeds: [createErrorEmbed('Please provide a valid category ID.')] });
            return;
        }

        await prisma.messageBlacklist.upsert({
            where: { guildId_targetId: { guildId, targetId: category.id } },
            update: {},
            create: { guildId, targetId: category.id, type: 'CATEGORY' }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Blacklisted category **${category.name}**.`)] });

    } else if (subcommand === 'list') {
        const blacklists = await prisma.messageBlacklist.findMany({ where: { guildId } });
        const channels = blacklists.filter(b => b.type === 'CHANNEL').map(b => `<#${b.targetId}>`).join(', ') || 'None';
        const categories = blacklists.filter(b => b.type === 'CATEGORY').map(b => `<#${b.targetId}>`).join(', ') || 'None';

        const embed = new EmbedBuilder()
            .setTitle('Message Blacklists')
            .addFields(
                { name: 'Channels', value: channels },
                { name: 'Categories', value: categories }
            )
            .setColor(COLORS.INFO);
        await message.reply({ embeds: [embed] });
    } else {
        await message.reply({ embeds: [createErrorEmbed('Usage: `,blacklist <channel|category|list> [target]`')] });
    }
};
