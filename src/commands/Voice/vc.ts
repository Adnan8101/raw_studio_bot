import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { VoiceService } from '../../services/VoiceService';
import { COLORS, ICONS } from '../../utils/embeds';

export const category = 'Voice';
export const permission = 'None';
export const syntax = '/vc [user]';
export const example = '/vc @Tai';

export const data = new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Displays the voice state stats of a user')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to check stats for')
            .setRequired(false)
    );

export const prefixExecute = async (interaction: any) => {
    const args = interaction.args;
    const message = interaction.message;
    const guildId = message.guild!.id;

    let targetUser: GuildMember;

    if (args.length > 0) {
        const userInput = args[0].replace(/[<@!>]/g, '');
        try {
            targetUser = await message.guild!.members.fetch(userInput);
        } catch (error) {
            await message.reply('❌ User not found.');
            return;
        }
    } else {
        targetUser = message.member as GuildMember;
    }

    const stats = await VoiceService.getStats(targetUser.id, guildId);

    if (!stats) {
        return message.reply({
            content: `${targetUser} has no voice stats recorded.`
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

    await message.reply({ embeds: [embed] });
};

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) return;

    const targetUser = await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (!targetUser) {
        await interaction.editReply({ content: '❌ User not found.' });
        return;
    }

    const stats = await VoiceService.getStats(targetUser.id, guildId);

    if (!stats) {
        await interaction.editReply({
            content: `${targetUser} has no voice stats recorded.`
        });
        return;
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

    await interaction.editReply({ embeds: [embed] });
}

export const prefixCommand = {
    name: 'vc',
    aliases: ['voice', 'voicestats'],
    description: 'Displays the voice state stats of a user',
    usage: 'vc [user]',
    execute: prefixExecute
};
