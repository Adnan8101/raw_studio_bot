import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { VoiceService } from '../../../services/VoiceService';
import { createSuccessEmbed } from '../../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('clearvoice')
    .setDescription('Resets everyone\'s voice state stats or a user\'s voice state stats in this guild')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to reset stats for (optional, defaults to everyone)')
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const prefixCommand = {
    name: 'clearvoice',
    aliases: ['resetvoice'],
    description: 'Resets everyone\'s voice state stats or a user\'s voice state stats in this guild',
    usage: 'clearvoice [user]',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember | null;
    const guildId = interaction.guildId!;

    if (targetUser) {
        await VoiceService.resetStats(guildId, targetUser.id);
        const embed = createSuccessEmbed(`Reset voice stats for ${targetUser}.`);
        await interaction.reply({ embeds: [embed] });
    } else {
        await VoiceService.resetStats(guildId);
        const embed = createSuccessEmbed(`Reset voice stats for **everyone** in this guild.`);
        await interaction.reply({ embeds: [embed] });
    }
}
