import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  PermissionFlagsBits
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed, COLORS, ICONS } from '../../utils/embeds';
import { CustomEmojis } from '../../utils/emoji';
export const category = 'Invites';
export const permission = 'Manage Messages';
export const syntax = '/inviter <user>';
export const example = '/inviter @Tai';
const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('inviter')
    .setDescription('Check who invited a specific user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check inviter for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: 'Invites',
  syntax: '/inviter <user>',
  permission: 'ManageMessages',
  example: '/inviter @Tai',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], ephemeral: true });
      return;
    }

    try {
      const db = DatabaseManager.getInstance();
      const inviteData = await db.getInviteData(guild.id, user.id);

      if (!inviteData || !inviteData.inviterId) {
        await interaction.reply({ embeds: [createErrorEmbed(`${user.toString()} joined through an unknown invite or vanity URL.`)] });
        return;
      }

      const inviter = await guild.members.fetch(inviteData.inviterId).catch(() => null);
      const inviterName = inviter ? inviter.user.username : 'Unknown User';
      const inviteCode = inviteData.inviteCode || 'unknown';

      const embed = createInfoEmbed('')
        .setAuthor({
          name: `Inviter Info`,
          iconURL: user.displayAvatarURL()
        })
        .setDescription(
          `${CustomEmojis.TICK} **${user.username}** was invited by **${inviterName}**\n` +
          `**Code:** \`${inviteCode}\``
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching inviter data:', error);
      await interaction.reply({
        embeds: [createErrorEmbed('An error occurred while fetching inviter information.')],
        ephemeral: true
      });
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'inviter',
  aliases: ['who-invited'],
  description: 'Check who invited a specific user',
  usage: 'inviter <user>',
  example: 'inviter @Tai',

  async execute(message: Message, args: string[]): Promise<void> {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return;
    }

    if (args.length === 0) {
      await message.reply({ embeds: [createErrorEmbed('Please provide a user to check! Usage: `inviter <user>`')] });
      return;
    }

    const guild = message.guild;
    if (!guild) {
      await message.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')] });
      return;
    }

    const userMention = args[0];
    const userId = userMention.replace(/[<@!>]/g, '');

    try {
      const user = await guild.members.fetch(userId).catch(() => null);
      if (!user) {
        await message.reply({ embeds: [createErrorEmbed('User not found in this server!')] });
        return;
      }

      const db = DatabaseManager.getInstance();
      const inviteData = await db.getInviteData(guild.id, user.id);

      if (!inviteData || !inviteData.inviterId) {
        await message.reply({ embeds: [createErrorEmbed(`${user.toString()} joined through an unknown invite or vanity URL.`)] });
        return;
      }

      const inviter = await guild.members.fetch(inviteData.inviterId).catch(() => null);
      const inviterName = inviter ? inviter.user.username : 'Unknown User';
      const inviteCode = inviteData.inviteCode || 'unknown';

      const embed = createInfoEmbed('')
        .setAuthor({
          name: `Inviter Info`,
          iconURL: user.user.displayAvatarURL()
        })
        .setDescription(
          `${CustomEmojis.TICK} **${user.user.username}** was invited by **${inviterName}**\n` +
          `**Code:** \`${inviteCode}\``
        )
        .setThumbnail(user.user.displayAvatarURL())
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching inviter data:', error);
      await message.reply({ embeds: [createErrorEmbed('An error occurred while fetching inviter information.')] });
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
