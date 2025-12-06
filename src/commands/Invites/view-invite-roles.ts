import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    PermissionFlagsBits
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createErrorEmbed, createInfoEmbed, COLORS } from '../../utils/embeds';

export const category = 'Invites';
export const permission = 'Manage Roles';
export const syntax = '/viewinviteroles';
export const example = '/viewinviteroles';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('viewinviteroles')
        .setDescription('View configured invite role rewards')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    category: 'invites_welcome',
    syntax: '/viewinviteroles',
    permission: 'ManageRoles',
    example: '/viewinviteroles',

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const inviteRoles = await db.getInviteRoles(guild.id);

            if (inviteRoles.length === 0) {
                const embed = createErrorEmbed('No invite role rewards configured.')
                    .setTitle('📋 Invite Role Rewards');

                await interaction.reply({ embeds: [embed] });
                return;
            }

            const description = inviteRoles.map(ir => {
                return `**${ir.invites} Invites:** <@&${ir.roleId}>`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('📋 Invite Role Rewards')
                .setDescription(description)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching invite roles:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('An error occurred while fetching invite roles.')],
                ephemeral: true
            });
        }
    },
};

const prefixCommand: PrefixCommand = {
    name: 'viewinviteroles',
    aliases: ['view-invite-roles', 'inviteroles'],
    description: 'View configured invite role rewards',
    usage: 'viewinviteroles',
    example: 'viewinviteroles',
    permissions: [PermissionFlagsBits.ManageRoles],

    async execute(message: Message, args: string[]): Promise<void> {
        const guild = message.guild;
        if (!guild) {
            await message.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')] });
            return;
        }

        if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await message.reply({ embeds: [createErrorEmbed('You need Manage Roles permissions to use this command!')] });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            const inviteRoles = await db.getInviteRoles(guild.id);

            if (inviteRoles.length === 0) {
                const embed = createErrorEmbed('No invite role rewards configured.')
                    .setTitle('📋 Invite Role Rewards');

                await message.reply({ embeds: [embed] });
                return;
            }

            const description = inviteRoles.map(ir => {
                return `**${ir.invites} Invites:** <@&${ir.roleId}>`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(COLORS.INFO)
                .setTitle('📋 Invite Role Rewards')
                .setDescription(description)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching invite roles:', error);
            await message.reply({ embeds: [createErrorEmbed('An error occurred while fetching invite roles.')] });
        }
    },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
