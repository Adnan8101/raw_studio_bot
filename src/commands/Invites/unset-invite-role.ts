import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    PermissionFlagsBits
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('unsetinviterole')
        .setDescription('Remove invite role reward')
        .addIntegerOption(option =>
            option.setName('invites')
                .setDescription('Number of invites to remove reward for')
                .setRequired(true)
                .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    category: 'invites_welcome',
    syntax: '/unsetinviterole <invites>',
    permission: 'Administrator',
    example: '/unsetinviterole 10',

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const invites = interaction.options.getInteger('invites', true);
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const removed = await db.removeInviteRole(guild.id, invites);

            if (removed) {
                const embed = createSuccessEmbed(`Successfully removed invite role reward for **${invites}** invites.`)
                    .setTitle('Invite Role Removed');

                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [createErrorEmbed(`No invite role found for **${invites}** invites.`)], ephemeral: true });
            }
        } catch (error) {
            console.error('Error removing invite role:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('An error occurred while removing the invite role.')],
                ephemeral: true
            });
        }
    },
};

const prefixCommand: PrefixCommand = {
    name: 'unsetinviterole',
    aliases: ['unset-invite-role', 'removeinviterole'],
    description: 'Remove invite role reward',
    usage: 'unsetinviterole <invites>',
    example: 'unsetinviterole 10',
    permissions: [PermissionFlagsBits.Administrator],

    async execute(message: Message, args: string[]): Promise<void> {
        const guild = message.guild;
        if (!guild) {
            await message.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')] });
            return;
        }

        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await message.reply({ embeds: [createErrorEmbed('You need Administrator permissions to use this command!')] });
            return;
        }

        if (args.length < 1) {
            await message.reply({ embeds: [createErrorEmbed('Please provide the number of invites! Usage: `unsetinviterole <invites>`')] });
            return;
        }

        const invites = parseInt(args[0]);

        if (isNaN(invites) || invites < 1) {
            await message.reply({ embeds: [createErrorEmbed('Please provide a valid number of invites (minimum 1)!')] });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const removed = await db.removeInviteRole(guild.id, invites);

            if (removed) {
                const embed = createSuccessEmbed(`Successfully removed invite role reward for **${invites}** invites.`)
                    .setTitle('Invite Role Removed');

                await message.reply({ embeds: [embed] });
            } else {
                await message.reply({ embeds: [createErrorEmbed(`No invite role found for **${invites}** invites.`)] });
            }
        } catch (error) {
            console.error('Error removing invite role:', error);
            await message.reply({ embeds: [createErrorEmbed('An error occurred while removing the invite role.')] });
        }
    },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
