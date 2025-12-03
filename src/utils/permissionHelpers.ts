import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { EmbedColors } from '../types';
import { CustomEmojis } from './emoji';

interface PermissionOptions {
    ownerOnly?: boolean;
}


export async function checkCommandPermission(
    interaction: ChatInputCommandInteraction,
    options: PermissionOptions = {}
): Promise<boolean> {
    const { ownerOnly = false } = options;
    const guild = interaction.guild!;
    const user = interaction.user;
    const member = interaction.member as import('discord.js').GuildMember;
    const botMember = guild.members.me!;

    
    if (user.id === guild.ownerId) {
        return true;
    }

    
    if (ownerOnly) {
        const errorEmbed = new EmbedBuilder()
            .setColor(EmbedColors.ERROR)
            .setDescription(`${CustomEmojis.CROSS} Only the **Server Owner** can use this command.`);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        return false;
    }

    
    
    if (member.roles.highest.position <= botMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
            .setColor(EmbedColors.ERROR)
            .setTitle('Permission Denied')
            .setDescription(
                `${CustomEmojis.CROSS} **Role Hierarchy Error**\n\n` +
                `You cannot use this command because your highest role is **lower than or equal to** my highest role.\n` +
                `Please ask the Server Owner or a higher-ranked Admin to manage this.`
            );

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        return false;
    }

    return true;
}
