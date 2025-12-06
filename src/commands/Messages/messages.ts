import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { prisma } from '../../database/connect';
import { createCustomEmbed, ICONS, COLORS } from '../../utils/embeds';

export const category = 'Messages';
export const permission = 'None';
export const syntax = '/messages [user]';
export const example = '/messages @Tai';

export const data = new SlashCommandBuilder()
    .setName('messages')
    .setDescription('Displays the number of messages sent by you or a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check')
            .setRequired(false)
    );

export const prefixCommand = {
    name: 'messages',
    aliases: ['msg', 'msgs', 'm'],
    description: 'Displays the number of messages sent by you or a user',
    usage: 'messages [user]',
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) return;

    const stats = await prisma.userStats.findUnique({
        where: {
            guildId_userId: {
                guildId,
                userId: targetUser.id
            }
        }
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
        .setTitle(`${ICONS.INFO} Message Statistics`)
        .setDescription(`**Total Messages:** ${stats?.messageCount || 0}\n**Daily Messages:** ${stats?.dailyMessages || 0}\n**Weekly Messages:** ${stats?.weeklyMessages || 0}`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const targetUser = message.mentions.users.first() || message.author;
    const guildId = message.guildId;

    if (!guildId) return;

    const stats = await prisma.userStats.findUnique({
        where: {
            guildId_userId: {
                guildId,
                userId: targetUser.id
            }
        }
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
        .setTitle(`${ICONS.INFO} Message Statistics`)
        .setDescription(`**Total Messages:** ${stats?.messageCount || 0}\n**Daily Messages:** ${stats?.dailyMessages || 0}\n**Weekly Messages:** ${stats?.weeklyMessages || 0}`)
        .setTimestamp();

    await message.reply({ embeds: [embed] });
};
