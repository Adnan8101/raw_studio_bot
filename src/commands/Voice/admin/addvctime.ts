import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { VoiceService } from '../../../services/VoiceService';
import { createSuccessEmbed } from '../../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('addvctime')
    .setDescription('Add voice time to All time, daily and weekly fields of a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to add time to')
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('minutes')
            .setDescription('The amount of minutes to add')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixCommand = {
    name: 'addvctime',
    aliases: ['addvoicetime'],
    description: 'Add voice time to All time, daily and weekly fields of a user',
    usage: 'addvctime <user> <minutes>',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember;
    const minutes = interaction.options.getInteger('minutes', true);
    const guildId = interaction.guildId!;

    const ms = minutes * 60 * 1000;
    await VoiceService.addTime(targetUser.id, guildId, ms);

    const embed = createSuccessEmbed(`Added **${minutes} minutes** to ${targetUser}'s voice stats.`);

    await interaction.reply({ embeds: [embed] });
}
