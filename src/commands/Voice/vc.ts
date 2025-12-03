import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { VoiceService } from '../../services/VoiceService';
import { COLORS, ICONS } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Displays the voice state stats of a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check stats for')
            .setRequired(false)
    );

export const prefixCommand = {
    name: 'vc',
    aliases: ['voice', 'voicestats'],
    description: 'Displays the voice state stats of a user',
    usage: 'vc [user]',
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getMember('user') as GuildMember || interaction.member as GuildMember;
    const guildId = interaction.guildId!;

    const stats = await VoiceService.getStats(targetUser.id, guildId);

    if (!stats) {
        return interaction.reply({
            content: `${targetUser} has no voice stats recorded.`,
            ephemeral: true
        });
    }

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    };

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${targetUser.user.username}'s Voice Stats`, iconURL: targetUser.user.displayAvatarURL() })
        .setTitle(`${ICONS.INFO} Voice Statistics`)
        .setDescription(`**Total Time:** ${formatTime(stats.voiceTime)}\n**Daily Time:** ${formatTime(stats.dailyVoiceTime)}\n**Weekly Time:** ${formatTime(stats.weeklyVoiceTime)}`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
