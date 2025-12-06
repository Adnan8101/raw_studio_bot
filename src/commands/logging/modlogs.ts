

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embedHelpers';

interface ModLogsServices {
  prisma: any;
}

export const category = 'logging';
export const permission = 'Manage Guild';
export const syntax = '/moderation-logs channel:#logs';
export const example = '/moderation-logs channel:#mod-logs';

export const data = new SlashCommandBuilder()
  .setName('moderation-logs')
  .setDescription('Configure moderation action logging')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(opt =>
    opt
      .setName('channel')
      .setDescription('Channel to log moderation actions')
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { prisma: any }
) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const guildId = interaction.guild!.id;


  if (!channel.isTextBased()) {
    const errorEmbed = createErrorEmbed('Please select a text channel for moderation logs.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }


  const permissions = channel.permissionsFor(interaction.guild!.members.me!);
  if (!permissions?.has(PermissionFlagsBits.SendMessages) || !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
    const errorEmbed = createErrorEmbed(`I need **Send Messages** and **Embed Links** permissions in ${channel}!`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }


  await services.prisma.guildLogging.upsert({
    where: { guildId },
    create: {
      guildId,
      modChannel: channel.id,
    },
    update: {
      modChannel: channel.id,
    },
  });

  const embed = createSuccessEmbed('Moderation Logs Enabled')
    .setTitle(`${CustomEmojis.TICK} Moderation Logs Enabled`)
    .setDescription(
      `Moderation actions will now be logged to ${channel}!\n\n` +
      `**Actions Logged:**\n` +
      `${CustomEmojis.STAFF} Ban/Unban\n` +
      `${CustomEmojis.STAFF} Kick\n` +
      `${CustomEmojis.STAFF} Mute/Unmute\n` +
      `${CustomEmojis.STAFF} Warn\n` +
      `${CustomEmojis.STAFF} Softban\n` +
      `${CustomEmojis.STAFF} Quarantine\n` +
      `${CustomEmojis.CHANNEL} Purge`
    )
    .setFooter({ text: `Set by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });


  const testEmbed = createInfoEmbed(`${CustomEmojis.STAFF} Moderation Logging Activated`, `Moderation logging has been enabled by ${interaction.user}.\n\nThis channel will receive moderation action logs.`)
    .setTimestamp();

  await channel.send({ embeds: [testEmbed] });
}
