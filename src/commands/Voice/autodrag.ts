
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ChannelType, VoiceChannel, Message, GuildMember, VoiceBasedChannel } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { resolveChannel } from '../../utils/resolver';
import { CustomEmojis } from '../../utils/emoji';

export const category = 'Voice';
export const permission = 'Move Members';
export const syntax = '/autodrag <user> [channel]';
export const example = '/autodrag @Tai';

export const data = new SlashCommandBuilder()
    .setName('autodrag')
    .setDescription('Automatically drag a user to a voice channel')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to drag')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to drag them to (defaults to your current channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers);

export const prefixCommand = {
    aliases: ['ad'],
    description: 'Auto drag a user to a voice channel',
    usage: '!ad <user> [channel]',
    permissions: [PermissionFlagsBits.MoveMembers]
};

export async function execute(interaction: ChatInputCommandInteraction | any) {

    const isSlash = interaction.isChatInputCommand?.();
    const db = DatabaseManager.getInstance();

    let targetUser;
    let targetChannelId: string | undefined;
    let member: GuildMember;

    if (isSlash) {
        targetUser = interaction.options.getUser('user', true);
        const channelOption = interaction.options.getChannel('channel');

        member = await interaction.guild?.members.fetch(interaction.user.id)!;

        if (channelOption) {
            targetChannelId = channelOption.id;
        } else if (member?.voice.channel) {
            targetChannelId = member.voice.channelId!;
        } else {
            await interaction.reply({ embeds: [createErrorEmbed('You must be in a voice channel or specify a target channel.')] });
            return;
        }
    } else {

        const message = interaction.message as Message;
        if (!message) return;

        member = message.member!;
        const content = message.content.trim();
        const args = content.split(/ +/);
        args.shift();

        if (args.length === 0 && !message.reference) {
            await interaction.reply({ embeds: [createErrorEmbed('Usage: !ad <user> [channel]')] });
            return;
        }

        let userArg: string | undefined;
        let channelArg: string | undefined;


        if (message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.member) {
                    targetUser = repliedMessage.member.user;
                }
            } catch (e) { }
        }


        if (targetUser) {

            channelArg = args.join(' ');
        } else {

            if (args.length > 0) {
                userArg = args[0];


                const isId = userArg.match(/^\d{17,19}$/);
                const isMention = userArg.match(/^<@!?(\d{17,19})>$/);

                if (isId || isMention) {

                    try {
                        const id = isId ? userArg : isMention![1];
                        const fetchedMember = await message.guild!.members.fetch(id);
                        targetUser = fetchedMember.user;
                        args.shift();
                        channelArg = args.join(' ');
                    } catch (e) { }
                } else {


                    try {

                        const fetchedMember = await message.guild!.members.fetch({ query: userArg, limit: 1 });
                        if (fetchedMember.size > 0) {
                            targetUser = fetchedMember.first()!.user;
                            args.shift();
                            channelArg = args.join(' ');
                        }
                    } catch (e) { }
                }
            }
        }

        if (!targetUser) {
            await interaction.reply({ embeds: [createErrorEmbed('User not found. Please mention a user, provide their ID, or reply to their message.')] });
            return;
        }


        if (channelArg) {
            const resolved = await resolveChannel(channelArg, message.guild!);
            if (resolved) targetChannelId = resolved.id;
        } else {
            if (member.voice.channel) {
                targetChannelId = member.voice.channelId!;
            } else {

                await interaction.reply({ content: 'Which voice channel should I drag them to?' });
                try {
                    const channel = message.channel as any;
                    if (!channel.awaitMessages) {
                        await interaction.followUp({ content: 'Cannot interact in this channel type.' });
                        return;
                    }

                    const collected = await channel.awaitMessages({
                        filter: (m: Message) => m.author.id === message.author.id,
                        max: 1,
                        time: 30000,
                        errors: ['time']
                    });

                    const response = collected.first();
                    if (response) {
                        const resolved = await resolveChannel(response.content, message.guild!);
                        if (resolved) targetChannelId = resolved.id;
                    }
                } catch (e) {
                    await interaction.followUp({ content: 'Timed out waiting for channel selection.' });
                    return;
                }
            }
        }

        if (!targetChannelId) {
            await interaction.reply({ embeds: [createErrorEmbed('Voice channel not found.')] });
            return;
        }
    }


    const targetMember = await interaction.guild?.members.fetch(targetUser.id);
    if (!targetMember) return;

    if (targetMember.voice.channel) {

        try {
            await targetMember.voice.setChannel(targetChannelId);
            const channel = interaction.guild?.channels.cache.get(targetChannelId);
            if (isSlash) {
                await interaction.reply({ content: CustomEmojis.TICK });
            } else {
                await interaction.reply({ content: CustomEmojis.TICK });
            }
        } catch (error) {
            const msg = 'Failed to move user. Check permissions.';
            if (isSlash) {
                await interaction.reply({ embeds: [createErrorEmbed(msg)] });
            } else {
                await interaction.reply({ embeds: [createErrorEmbed(msg)] });
            }
        }
    } else {

        await db.createAutoDragRule(interaction.guildId!, targetUser.id, targetChannelId!, interaction.user.id);
        const channel = interaction.guild?.channels.cache.get(targetChannelId!);
        const msg = `${CustomEmojis.TICK} I will drag ${targetUser} to **${channel?.name || 'the channel'}** when they join a voice channel.`;

        if (isSlash) {
            await interaction.reply({ content: msg });
        } else {
            await interaction.reply({ content: msg });
        }
    }
}
