import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export const category = 'Messages';
export const permission = 'Manage Guild';
export const syntax = '/managemessages <add|remove> <user> <amount>';
export const example = '/managemessages add @Tai 100';

export const data = new SlashCommandBuilder()
    .setName('managemessages')
    .setDescription('Manage user message counts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add messages to a user')
            .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
            .addIntegerOption(option => option.setName('amount').setDescription('Amount to add').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove messages from a user')
            .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
            .addIntegerOption(option => option.setName('amount').setDescription('Amount to remove').setRequired(true))
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    if (!guildId || !targetUser || !amount) return;

    if (subcommand === 'add') {
        await prisma.userStats.upsert({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
            update: { messageCount: { increment: amount } },
            create: { guildId, userId: targetUser.id, messageCount: amount }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Added **${amount}** messages to ${targetUser}.`)] });
    } else if (subcommand === 'remove') {
        await prisma.userStats.upsert({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
            update: { messageCount: { decrement: amount } },
            create: { guildId, userId: targetUser.id, messageCount: 0 }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Removed **${amount}** messages from ${targetUser}.`)] });
    }
}

export const prefixExecute = async (message: Message, args: string[]) => {













};
