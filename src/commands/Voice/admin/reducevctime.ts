import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { VoiceService } from '../../../services/VoiceService';
import { createSuccessEmbed } from '../../../utils/embeds';

export const category = 'Voice';
export const permission = 'Manage Guild';
export const syntax = '/reducevctime <user> <minutes>';
export const example = '/reducevctime @Tai 30';

export const data = new SlashCommandBuilder()
    .setName('reducevctime')
    .setDescription('Reduce voice time from All time, daily and weekly fields to a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to reduce time from')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('minutes')
            .setDescription('The amount of minutes to reduce')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixCommand = {
    name: 'reducevctime',
    aliases: ['reducevoicetime', 'removevctime'],
    description: 'Reduce voice time from All time, daily and weekly fields to a user',
    usage: 'reducevctime <user> <minutes>',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const minutes = interaction.options.getInteger('minutes', true);
    const guildId = interaction.guildId!;

    const ms = minutes * 60 * 1000;
    await VoiceService.removeTime(targetUser.id, guildId, ms);

    const embed = createSuccessEmbed(`Reduced **${minutes} minutes** from ${targetUser}'s voice stats.`);

    await interaction.reply({ embeds: [embed] });
}
