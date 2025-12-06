import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, Message } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export const category = 'Messages';
export const permission = 'Manage Guild';
export const syntax = '/addmessages <user> <amount>';
export const example = '/addmessages @Tai 100';

export const data = new SlashCommandBuilder()
    .setName('addmessages')
    .setDescription('Adds the specified number of messages to a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to add messages to')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription('The number of messages to add')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixCommand = {
    name: 'addmessages',
    description: 'Adds the specified number of messages to a user',
    usage: 'addmessages <user> <amount>',
    permissions: [PermissionFlagsBits.ManageGuild],
    aliases: ['addmsg']
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const guildId = interaction.guildId!;

    await prisma.userStats.upsert({
        where: { guildId_userId: { guildId, userId: targetUser.id } },
        update: { messageCount: { increment: amount } },
        create: { guildId, userId: targetUser.id, messageCount: amount }
    });

    await interaction.reply({ embeds: [createSuccessEmbed(`Added **${amount}** messages to ${targetUser}.`)] });
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!targetUser || isNaN(amount)) {
        await message.reply({ embeds: [createErrorEmbed('Usage: `,addmessages @user <amount>`')] });
        return;
    }

    const guildId = message.guildId;
    if (!guildId) return;

    await prisma.userStats.upsert({
        where: { guildId_userId: { guildId, userId: targetUser.id } },
        update: { messageCount: { increment: amount } },
        create: { guildId, userId: targetUser.id, messageCount: amount }
    });

    await message.reply({ embeds: [createSuccessEmbed(`Added **${amount}** messages to ${targetUser}.`)] });
};
