import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed } from '../../utils/embeds';

export const category = 'Messages';
export const permission = 'None';
export const syntax = '/resetmymessages';
export const example = '/resetmymessages';

export const data = new SlashCommandBuilder()
    .setName('resetmymessages')
    .setDescription('Resets your own message stats in this guild');

export const prefixCommand = {
    name: 'resetmymessages',
    aliases: ['resetmymsgs'],
    description: 'Resets your own message stats in this guild',
    usage: 'resetmymessages',
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    await prisma.userStats.update({
        where: { guildId_userId: { guildId, userId: interaction.user.id } },
        data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
    });
    await interaction.reply({ embeds: [createSuccessEmbed('Reset your message stats.')] });
}

export const prefixExecute = async (message: Message) => {
    const guildId = message.guildId;
    if (!guildId) return;

    await prisma.userStats.update({
        where: { guildId_userId: { guildId, userId: message.author.id } },
        data: { messageCount: 0, dailyMessages: 0, weeklyMessages: 0 }
    });
    await message.reply({ embeds: [createSuccessEmbed('Reset your message stats.')] });
};
