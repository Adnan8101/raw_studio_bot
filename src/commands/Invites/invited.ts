import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    User
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { InviteService } from '../../services/InviteService';
import { createErrorEmbed, createInfoEmbed, COLORS, ICONS } from '../../utils/embeds';

const inviteService = new InviteService();

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('invited')
        .setDescription('View the list of members invited by a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check invited members for (optional)')
                .setRequired(false)),
    category: 'invites_welcome',
    syntax: '/invited [user]',
    permission: 'None',
    example: '/invited @Tai',

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
            return;
        }

        try {
            const invitedMembers = await inviteService.getMembersInvitedBy(guild.id, targetUser.id);

            if (invitedMembers.length === 0) {
                const embed = createErrorEmbed('No invited members found.')
                    .setAuthor({
                        name: targetUser.username,
                        iconURL: targetUser.displayAvatarURL()
                    })
                    .setFooter({ text: 'Invited Members' });

                await interaction.reply({ embeds: [embed] });
                return;
            }

            
            
            

            const fields = invitedMembers.map((memberData, index) => {
                return {
                    name: `Member ${index + 1}`,
                    value: `<@${memberData.userId}> (${memberData.userId})\nJoined: <t:${Math.floor(new Date(memberData.joinedAt).getTime() / 1000)}:R>`,
                    inline: true
                };
            });

            
            const embedsToSend: EmbedBuilder[] = [];
            const fieldsPerEmbed = 24; 

            for (let i = 0; i < fields.length; i += fieldsPerEmbed) {
                const currentFields = fields.slice(i, i + fieldsPerEmbed);

                const embed = new EmbedBuilder()
                    .setColor(COLORS.INFO)
                    .setAuthor({
                        name: `${targetUser.username}'s Invited Members`,
                        iconURL: targetUser.displayAvatarURL()
                    })
                    .addFields(currentFields)
                    .setTimestamp()
                    .setFooter({ text: `Page ${Math.floor(i / fieldsPerEmbed) + 1}` });

                if (i === 0) {
                    embed.setDescription(`${ICONS.USER} **Total Invited Members:** ${invitedMembers.length}`);
                }

                embedsToSend.push(embed);
            }

            
            
            
            
            await interaction.reply({ embeds: embedsToSend.slice(0, 2) });
            if (embedsToSend.length > 2) {
                await interaction.followUp({ content: `...and ${embedsToSend.length - 2} more pages.`, ephemeral: true });
            }

        } catch (error) {
            console.error('Error fetching invited members:', error);
            await interaction.reply({
                embeds: [createErrorEmbed('An error occurred while fetching invited members.')],
                ephemeral: true
            });
        }
    },
};

const prefixCommand: PrefixCommand = {
    name: 'invited',
    aliases: ['invitedlist'],
    description: 'View the list of members invited by a user',
    usage: 'invited [user]',
    example: 'invited @Tai',

    async execute(message: Message, args: string[]): Promise<void> {
        const guild = message.guild;
        if (!guild) {
            await message.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')] });
            return;
        }

        let targetUser = message.author;

        if (args.length > 0) {
            const userMention = args[0];
            const userId = userMention.replace(/[<@!>]/g, '');

            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    targetUser = member.user;
                } else {
                    await message.reply({ embeds: [createErrorEmbed('User not found in this server!')] });
                    return;
                }
            } catch (error) {
                await message.reply({ embeds: [createErrorEmbed('Invalid user mentioned!')] });
                return;
            }
        }

        try {
            const invitedMembers = await inviteService.getMembersInvitedBy(guild.id, targetUser.id);

            if (invitedMembers.length === 0) {
                const embed = createErrorEmbed('No invited members found.')
                    .setAuthor({
                        name: targetUser.username,
                        iconURL: targetUser.displayAvatarURL()
                    })
                    .setFooter({ text: 'Invited Members' });

                await message.reply({ embeds: [embed] });
                return;
            }

            const fields = invitedMembers.map((memberData, index) => {
                return {
                    name: `Member ${index + 1}`,
                    value: `<@${memberData.userId}> (${memberData.userId})\nJoined: <t:${Math.floor(new Date(memberData.joinedAt).getTime() / 1000)}:R>`,
                    inline: true
                };
            });

            const embedsToSend: EmbedBuilder[] = [];
            const fieldsPerEmbed = 24;

            for (let i = 0; i < fields.length; i += fieldsPerEmbed) {
                const currentFields = fields.slice(i, i + fieldsPerEmbed);

                const embed = new EmbedBuilder()
                    .setColor(COLORS.INFO)
                    .setAuthor({
                        name: `${targetUser.username}'s Invited Members`,
                        iconURL: targetUser.displayAvatarURL()
                    })
                    .addFields(currentFields)
                    .setTimestamp()
                    .setFooter({ text: `Page ${Math.floor(i / fieldsPerEmbed) + 1}` });

                if (i === 0) {
                    embed.setDescription(`${ICONS.USER} **Total Invited Members:** ${invitedMembers.length}`);
                }

                embedsToSend.push(embed);
            }

            await message.reply({ embeds: embedsToSend.slice(0, 2) });

        } catch (error) {
            console.error('Error fetching invited members:', error);
            await message.reply({ embeds: [createErrorEmbed('An error occurred while fetching invited members.')] });
        }
    },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
