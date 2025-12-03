import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, Message } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export const category = 'Messages';

export const data = new SlashCommandBuilder()
    .setName('removemessages')
    .setDescription('Removes the specified number of messages from a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to remove messages from')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription('The number of messages to remove')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixCommand = {
    name: 'removemessages',
    description: 'Removes the specified number of messages from a user',
    usage: 'removemessages <user> <amount>',
    permissions: [PermissionFlagsBits.ManageGuild],
    aliases: ['removemsg']
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const guildId = interaction.guildId!;

    await prisma.userStats.upsert({
        where: { guildId_userId: { guildId, userId: targetUser.id } },
        update: { messageCount: { decrement: amount } },
        create: { guildId, userId: targetUser.id, messageCount: 0 }
    });

    await interaction.reply({ embeds: [createSuccessEmbed(`Removed **${amount}** messages from ${targetUser}.`)] });
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!targetUser || isNaN(amount)) {
        await message.reply({ embeds: [createErrorEmbed('Usage: `,removemessages @user <amount>`')] });
        return;
    }

    const guildId = message.guildId;
    if (!guildId) return;

    await prisma.userStats.upsert({
        where: { guildId_userId: { guildId, userId: targetUser.id } },
        update: { messageCount: { decrement: amount } },
        create: { guildId, userId: targetUser.id, messageCount: 0 }
    });

    await message.reply({ embeds: [createSuccessEmbed(`Removed **${amount}** messages from ${targetUser}.`)] });
};
