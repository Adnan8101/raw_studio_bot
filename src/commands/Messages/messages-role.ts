import { SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed, createCustomEmbed, ICONS, COLORS } from '../../utils/embeds';

export const category = 'Messages';

export const data = new SlashCommandBuilder()
    .setName('messages-role')
    .setDescription('Configure automatic role rewards for message counts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Set a role reward')
            .addRoleOption(option => option.setName('role').setDescription('The role to give').setRequired(true))
            .addIntegerOption(option => option.setName('count').setDescription('Message count required').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('unset')
            .setDescription('Remove a role reward')
            .addIntegerOption(option => option.setName('count').setDescription('Message count to remove').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View all message role rewards')
    );

export const prefixCommand = {
    name: 'messages-role',
    aliases: ['messagerole', 'msgrole', 'setmessagerole', 'unsetmessagerole', 'viewmessageroles'],
    description: 'Configure automatic role rewards for message counts',
    usage: 'messages-role <set|unset|view> [args]',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    if (!guildId) return;

    if (subcommand === 'set') {
        const role = interaction.options.getRole('role');
        const count = interaction.options.getInteger('count');
        if (!role || !count) return;

        await prisma.messageRole.upsert({
            where: { guildId_messageCount: { guildId, messageCount: count } },
            update: { roleId: role.id },
            create: { guildId, roleId: role.id, messageCount: count }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Set role ${role} for **${count}** messages.`)] });

    } else if (subcommand === 'unset') {
        const count = interaction.options.getInteger('count');
        if (!count) return;

        try {
            await prisma.messageRole.delete({
                where: { guildId_messageCount: { guildId, messageCount: count } }
            });
            await interaction.reply({ embeds: [createSuccessEmbed(`Removed role reward for **${count}** messages.`)] });
        } catch {
            await interaction.reply({ embeds: [createErrorEmbed(`No role reward found for **${count}** messages.`)] });
        }

    } else if (subcommand === 'view') {
        const roles = await prisma.messageRole.findMany({
            where: { guildId },
            orderBy: { messageCount: 'asc' }
        });

        if (roles.length === 0) {
            await interaction.reply({ embeds: [createCustomEmbed(ICONS.INFO, 'No message roles configured.', COLORS.INFO)] });
            return;
        }

        const description = roles.map(r => `**${r.messageCount}** messages: <@&${r.roleId}>`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('Message Role Rewards')
            .setDescription(description)
            .setColor(COLORS.INFO);
        await interaction.reply({ embeds: [embed] });
    }
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const guildId = message.guildId;
    if (!guildId) return;

    
    const commandName = message.content.split(' ')[0].slice(1).toLowerCase(); 
    
    

    let subcommand = args[0]?.toLowerCase();
    let shiftArgs = 1;

    
    if (commandName === 'setmessagerole') { subcommand = 'set'; shiftArgs = 0; }
    else if (commandName === 'unsetmessagerole') { subcommand = 'unset'; shiftArgs = 0; }
    else if (commandName === 'viewmessageroles') { subcommand = 'view'; shiftArgs = 0; }

    if (subcommand === 'set') {
        const role = message.mentions.roles.first();
        const count = parseInt(args[shiftArgs + 1]); 
        
        

        
        const roleArg = args[shiftArgs];
        const countArg = args[shiftArgs + 1];

        
        if (!role || isNaN(parseInt(countArg))) {
            await message.reply({ embeds: [createErrorEmbed('Usage: `messages-role set @role <count>`')] });
            return;
        }

        await prisma.messageRole.upsert({
            where: { guildId_messageCount: { guildId, messageCount: parseInt(countArg) } },
            update: { roleId: role.id },
            create: { guildId, roleId: role.id, messageCount: parseInt(countArg) }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Set role ${role} for **${countArg}** messages.`)] });

    } else if (subcommand === 'unset') {
        const count = parseInt(args[shiftArgs]);
        if (isNaN(count)) {
            await message.reply({ embeds: [createErrorEmbed('Usage: `messages-role unset <count>`')] });
            return;
        }

        try {
            await prisma.messageRole.delete({
                where: { guildId_messageCount: { guildId, messageCount: count } }
            });
            await message.reply({ embeds: [createSuccessEmbed(`Removed role reward for **${count}** messages.`)] });
        } catch {
            await message.reply({ embeds: [createErrorEmbed(`No role reward found for **${count}** messages.`)] });
        }

    } else if (subcommand === 'view') {
        const roles = await prisma.messageRole.findMany({
            where: { guildId },
            orderBy: { messageCount: 'asc' }
        });

        if (roles.length === 0) {
            await message.reply({ embeds: [createCustomEmbed(ICONS.INFO, 'No message roles configured.', COLORS.INFO)] });
            return;
        }

        const description = roles.map(r => `**${r.messageCount}** messages: <@&${r.roleId}>`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('Message Role Rewards')
            .setDescription(description)
            .setColor(COLORS.INFO);
        await message.reply({ embeds: [embed] });

    } else {
        await message.reply({ embeds: [createErrorEmbed('Usage: `messages-role <set|unset|view> [args]`')] });
    }
};
