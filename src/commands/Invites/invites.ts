import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  User,
  MessageFlags
} from 'discord.js';
import { SlashCommand, PrefixCommand } from '../../types';
import { DatabaseManager } from '../../utils/DatabaseManager';
import { createInfoEmbed, createErrorEmbed, COLORS, ICONS } from '../../utils/embeds';
import { CustomEmojis } from '../../utils/emoji';

const slashCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check your invite statistics')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check invites for (optional)')
        .setRequired(false)),
  category: 'Invites',
  syntax: '/invites [user]',
  permission: 'None',
  example: '/invites @Tai',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a server!')], flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await interaction.deferReply();
    } catch (error: any) {
      if (error.code !== 40060) {
        console.error('Error deferring reply:', error);
        return;
      }
      // Interaction already acknowledged, continue
    }

    try {
      const db = DatabaseManager.getInstance();

      const regularInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const leftInvites = await db.getUserLeftCount(guild.id, targetUser.id);
      const fakeInvites = await db.getUserFakeCount(guild.id, targetUser.id);
      const bonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const totalInvites = regularInvites + bonusInvites - leftInvites - fakeInvites;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${targetUser.username}'s Invites`,
          iconURL: targetUser.displayAvatarURL()
        })
        .setDescription(`**Total Invites:** ${totalInvites}\n**Regular:** ${regularInvites}\n**Bonus:** ${bonusInvites}\n**Left:** ${leftInvites}\n**Fake:** ${fakeInvites}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      // If editReply fails, try followUp
      try {
        await interaction.editReply({
          embeds: [createErrorEmbed('An error occurred while fetching invite statistics.')]
        });
      } catch (e) {
        await interaction.followUp({
          embeds: [createErrorEmbed('An error occurred while fetching invite statistics.')],
          flags: MessageFlags.Ephemeral
        }).catch(() => { });
      }
    }
  },
};

const prefixCommand: PrefixCommand = {
  name: 'invites',
  aliases: ['inv', 'invitecount'],
  description: 'Check your invite statistics',
  usage: 'invites [user]',
  example: 'invites @Tai',

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
      const db = DatabaseManager.getInstance();

      const regularInvites = await db.getUserInviteCount(guild.id, targetUser.id);
      const leftInvites = await db.getUserLeftCount(guild.id, targetUser.id);
      const fakeInvites = await db.getUserFakeCount(guild.id, targetUser.id);
      const bonusInvites = await db.getUserBonusInvites(guild.id, targetUser.id);
      const totalInvites = regularInvites + bonusInvites - leftInvites - fakeInvites;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${targetUser.username}'s Invites`,
          iconURL: targetUser.displayAvatarURL()
        })
        .setDescription(`**Total Invites:** ${totalInvites}\n**Regular:** ${regularInvites}\n**Bonus:** ${bonusInvites}\n**Left:** ${leftInvites}\n**Fake:** ${fakeInvites}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching invite data:', error);
      await message.reply({ embeds: [createErrorEmbed('An error occurred while fetching invite statistics.')] });
    }
  },
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
export { slashCommand, prefixCommand };
