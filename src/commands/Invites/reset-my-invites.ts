import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';

export const category = 'Invites';
export const permission = 'None';
export const syntax = '/resetmyinvites';
export const example = '/resetmyinvites';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('resetmyinvites')
        .setDescription('Reset your own invite statistics to zero'),
    category: 'invites_welcome',
    syntax: '/resetmyinvites',
    permission: 'None',
    example: '/resetmyinvites',

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const resetResult = await db.resetUserInvites(guild.id, interaction.user.id);

            const embed = createSuccessEmbed(
                `You have successfully reset your invite statistics.\n\n` +
                `**Previous Normal Invites:** ${resetResult.regular}\n` +
                `**Previous Bonus Invites:** ${resetResult.bonus}\n` +
                `**Previous Left Invites:** ${resetResult.left}\n` +
                `**Previous Fake Invites:** ${resetResult.fake}\n\n` +
                `**Current Invites:** 0`
            ).setTitle('🔄 Invites Reset');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error resetting own invites:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('An error occurred while resetting your invites.')],
                ephemeral: true
            });
        }
    },
};

const prefixCommand: PrefixCommand = {
    name: 'resetmyinvites',
    aliases: ['reset-my-invites', 'clearmyinvites'],
    description: 'Reset your own invite statistics to zero',
    usage: 'resetmyinvites',
    example: 'resetmyinvites',

    async execute(message: Message, args: string[]): Promise<void> {
        const guild = message.guild;
        if (!guild) {
            await message.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')] });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const resetResult = await db.resetUserInvites(guild.id, message.author.id);

            const embed = createSuccessEmbed(
                `You have successfully reset your invite statistics.\n\n` +
                `**Previous Normal Invites:** ${resetResult.regular}\n` +
                `**Previous Bonus Invites:** ${resetResult.bonus}\n` +
                `**Previous Left Invites:** ${resetResult.left}\n` +
                `**Previous Fake Invites:** ${resetResult.fake}\n\n` +
                `**Current Invites:** 0`
            ).setTitle('🔄 Invites Reset');

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error resetting own invites:', error);
            await message.reply({ embeds: [createErrorEmbed('An error occurred while resetting your invites.')] });
        }
    },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
