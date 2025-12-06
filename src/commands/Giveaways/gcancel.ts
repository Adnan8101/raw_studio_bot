import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, TextChannel } from 'discord.js';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { PrefixCommand } from '../../types';

export const category = 'Giveaways';
export const permission = 'Manage Guild';
export const syntax = '/gcancel <message_id>';
export const example = '/gcancel message_id:123456789';

export const data = new SlashCommandBuilder()
    .setName('gcancel')
    .setDescription('Cancel a giveaway')
    .addStringOption(option =>
        option.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const db = DatabaseManager.getInstance();
    const giveaway = await db.getGiveaway(messageId);

    if (!giveaway) {
        await interaction.editReply({ embeds: [createErrorEmbed('Giveaway not found.')] });
        return;
    }

    if (giveaway.ended) {
        await interaction.editReply({ embeds: [createErrorEmbed('Giveaway already ended.')] });
        return;
    }

    await db.endGiveaway(messageId);


    try {
        const channel = await interaction.guild?.channels.fetch(giveaway.channelId) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId);
            if (msg) await msg.delete();
        }
    } catch (e) {

    }

    await interaction.editReply({ embeds: [createSuccessEmbed('Giveaway cancelled.')] });
}

export const prefixExecute = async (interaction: any) => {
    const args = interaction.args;
    if (args.length < 1) {
        await interaction.reply({ embeds: [createErrorEmbed('Usage: `!gcancel <message_id>`')] });
        return;
    }

    const messageId = args[0];
    const db = DatabaseManager.getInstance();
    const giveaway = await db.getGiveaway(messageId);

    if (!giveaway) {
        await interaction.reply({ embeds: [createErrorEmbed('Giveaway not found.')] });
        return;
    }

    if (giveaway.ended) {
        await interaction.reply({ embeds: [createErrorEmbed('Giveaway already ended.')] });
        return;
    }

    await db.endGiveaway(messageId);


    try {
        const channel = await interaction.message.guild?.channels.fetch(giveaway.channelId) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId);
            if (msg) await msg.delete();
        }
    } catch (e) {

    }

    await interaction.reply({ embeds: [createSuccessEmbed('Giveaway cancelled.')] });
};

export const prefixCommand: PrefixCommand = {
    name: 'gcancel',
    description: 'Cancel a giveaway',
    usage: 'gcancel <message_id>',
    aliases: ['gstop'],
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: prefixExecute
};
