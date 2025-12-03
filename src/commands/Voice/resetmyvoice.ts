import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { VoiceService } from '../../services/VoiceService';
import { createSuccessEmbed } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('resetmyvoice')
    .setDescription('Resets your own voice state record in this guild');

export const prefixCommand = {
    name: 'resetmyvoice',
    aliases: ['resetmyvc'],
    description: 'Resets your own voice state record in this guild',
    usage: 'resetmyvoice',
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    await VoiceService.resetStats(guildId, userId);

    const embed = createSuccessEmbed('Your voice stats have been reset.');

    await interaction.reply({ embeds: [embed] });
}
