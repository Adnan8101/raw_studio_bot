
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, VoiceChannel, EmbedBuilder, ChannelType, Message } from 'discord.js';
import { createInfoEmbed, createErrorEmbed } from '../../utils/embedHelpers';

export const category = 'Voice';
export const permission = 'Manage Messages';
export const syntax = '/wv [channel]';
export const example = '/wv';

export const data = new SlashCommandBuilder()
    .setName('wv')
    .setDescription('Who is in voice? List members in a channel')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The voice channel to check (defaults to your current channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const channelOption = interaction.options.getChannel('channel');

    let channel: VoiceChannel | null = null;

    if (channelOption) {
        channel = channelOption as VoiceChannel;
    } else if (member?.voice.channel) {
        channel = member.voice.channel as VoiceChannel;
    } else {





        const message = (interaction as any).message as Message;
        if (message && message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.member && repliedMessage.member.voice.channel) {
                    channel = repliedMessage.member.voice.channel as VoiceChannel;
                }
            } catch (e) { }
        }

        if (!channel) {
            await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel, reply to a user in a VC, or specify a channel to check.')] });
            return;
        }
    }

    const members = channel.members;

    if (members.size === 0) {
        await interaction.reply({ embeds: [createErrorEmbed(`No one is in ${channel.name}.`)] });
        return;
    }
    await interaction.reply({
        content: `<#${channel.id}>`
    });
}
