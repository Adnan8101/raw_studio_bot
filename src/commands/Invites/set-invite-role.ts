import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    PermissionFlagsBits,
    Role
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('setinviterole')
        .setDescription('Setup invite role reward')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('invites')
                .setDescription('Number of invites required')
                .setRequired(true)
                .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    category: 'invites_welcome',
    syntax: '/setinviterole <role> <invites>',
    permission: 'Administrator',
    example: '/setinviterole @VIP 10',

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const role = interaction.options.getRole('role', true) as Role;
        const invites = interaction.options.getInteger('invites', true);
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
            return;
        }

        
        if (role.position >= (guild.members.me?.roles.highest.position || 0)) {
            await interaction.reply({ embeds: [createErrorEmbed('I cannot assign this role because it is higher than or equal to my highest role!')], ephemeral: true });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            await db.addInviteRole(guild.id, role.id, invites);

            const embed = createSuccessEmbed(`Successfully configured invite role reward.\n\n**Role:** ${role.toString()}\n**Invites Required:** ${invites}`)
                .setTitle('Invite Role Set');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting invite role:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('An error occurred while setting the invite role.')],
                ephemeral: true
            });
        }
    },
};

const prefixCommand: PrefixCommand = {
    name: 'setinviterole',
    aliases: ['set-invite-role', 'addinviterole'],
    description: 'Setup invite role reward',
    usage: 'setinviterole <role> <invites>',
    example: 'setinviterole @VIP 10',
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

        if (args.length < 2) {
            await message.reply({ embeds: [createErrorEmbed('Please provide a role and number of invites! Usage: `setinviterole <role> <invites>`')] });
            return;
        }

        const roleMention = args[0];
        const invites = parseInt(args[1]);
        const roleId = roleMention.replace(/[<@&>]/g, '');
        const role = guild.roles.cache.get(roleId);

        if (!role) {
            await message.reply({ embeds: [createErrorEmbed('Invalid role mentioned!')] });
            return;
        }

        if (isNaN(invites) || invites < 1) {
            await message.reply({ embeds: [createErrorEmbed('Please provide a valid number of invites (minimum 1)!')] });
            return;
        }

        
        if (role.position >= (guild.members.me?.roles.highest.position || 0)) {
            await message.reply({ embeds: [createErrorEmbed('I cannot assign this role because it is higher than or equal to my highest role!')] });
            return;
        }

        try {
            const db = DatabaseManager.getInstance();
            await db.addInviteRole(guild.id, role.id, invites);

            const embed = createSuccessEmbed(`Successfully configured invite role reward.\n\n**Role:** ${role.toString()}\n**Invites Required:** ${invites}`)
                .setTitle('Invite Role Set');

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting invite role:', error);
            await message.reply({ embeds: [createErrorEmbed('An error occurred while setting the invite role.')] });
        }
    },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
