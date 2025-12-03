import { SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

export const category = 'Messages';

export const data = new SlashCommandBuilder()
    .setName('resetmessages')
    .setDescription('Reset message counts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Reset a user\'s messages')
            .addUserOption(option => option.setName('user').setDescription('The user').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('all')
            .setDescription('Reset everyone\'s messages in this guild')
    );

export const prefixCommand = {
    name: 'resetmessages',
    aliases: ['clearmsgs', 'resetmsgs'],
    description: 'Resets everyone\'s messages or a user\'s messages in this guild',
    usage: 'clearmsgs <@user|all>',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    if (!guildId) return;

    if (subcommand === 'user') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) return;

        await prisma.userStats.update({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
            data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Reset messages for ${targetUser}.`)] });

    } else if (subcommand === 'all') {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
        });
        await interaction.reply({ embeds: [createSuccessEmbed('Reset all message counts in this guild.')] });
    }
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const guildId = message.guildId;
    if (!guildId) return;

    const targetUser = message.mentions.users.first();

    if (targetUser) {
        await prisma.userStats.update({
            where: { guildId_userId: { guildId, userId: targetUser.id } },
            data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Reset messages for ${targetUser}.`)] });
    } else if (args[0]?.toLowerCase() === 'all') {
        await prisma.userStats.updateMany({
            where: { guildId },
            data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
        });
        await message.reply({ embeds: [createSuccessEmbed('Reset all message counts in this guild.')] });
    } else {
        await message.reply({ embeds: [createErrorEmbed('Usage: `,clearmsgs @user` or `,clearmsgs all`')] });
    }
};
