
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayManager } from '../../services/GiveawayManager';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embedHelpers';
import { PrefixCommand } from '../../types';

export const category = 'Giveaways';
export const permission = 'Manage Guild';
export const syntax = '/gend <message_id>';
export const example = '/gend message_id:123456789';

export const data = new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway immediately')
    .addStringOption(option =>
        option.setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const manager = GiveawayManager.getInstance(interaction.client);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const winners = await manager.endGiveaway(messageId);

    if (winners.length > 0) {
        await interaction.editReply({ embeds: [createSuccessEmbed(`Giveaway ended. Winners: ${winners.map(id => `<@${id}>`).join(', ')}`)] });
    } else {
        await interaction.editReply({ embeds: [createSuccessEmbed('Giveaway ended (no winners or already ended).')] });
    }
}

export const prefixExecute = async (interaction: any) => {
    const args = interaction.args;
    if (args.length < 1) {
        await interaction.reply({ embeds: [createErrorEmbed('Usage: `!gend <message_id>`')] });
        return;
    }

    const messageId = args[0];
    const manager = GiveawayManager.getInstance(interaction.client);

    const winners = await manager.endGiveaway(messageId);

    if (winners.length > 0) {
        await interaction.reply({ embeds: [createSuccessEmbed(`Giveaway ended. Winners: ${winners.map((id: string) => `<@${id}>`).join(', ')}`)] });
    } else {
        await interaction.reply({ embeds: [createSuccessEmbed('Giveaway ended (no winners or already ended).')] });
    }
};

export const prefixCommand: PrefixCommand = {
    name: 'gend',
    description: 'End a giveaway immediately',
    usage: 'gend <message_id>',
    aliases: ['gfinish'],
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: prefixExecute
};
