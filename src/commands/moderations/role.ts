

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  Message,
} from 'discord.js';
import { prisma } from '../../database/connect';
import { EmbedColors } from '../../types';
import { CustomEmojis } from '../../utils/emoji';
import { LoggingService } from '../../services/LoggingService';
import { createErrorEmbed, createModerationEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Manage roles and aliases')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName('manage')
      .setDescription('Add or remove a role from a member')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The member to modify')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('The role to add/remove (select from list)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('role_name')
          .setDescription('The role name or alias (fuzzy match)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for the role change')
          .setRequired(false)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('aliases')
      .setDescription('Manage role aliases')
      .addSubcommand(subcommand =>
        subcommand
          .setName('setup')
          .setDescription('Setup or edit aliases for a role')
          .addRoleOption(option =>
            option
              .setName('role')
              .setDescription('The role to manage aliases for')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all role aliases')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription('Delete a specific alias')
          .addStringOption(option =>
            option
              .setName('alias')
              .setDescription('The alias to delete')
              .setRequired(true)
          )
      )
  );

export const category = 'moderation';
export const syntax = '/role manage <user> <role|role_name> [reason] OR /role aliases ...';
export const example = '/role manage user:@Tai role:@Member reason:Promotion';
export const permission = 'Manage Roles';


export const prefixCommand = {
  aliases: ['role'],
  description: 'Manage roles and aliases',
  usage: '!role <user> <role_name> [reason]',
  permissions: [PermissionFlagsBits.ManageRoles]
};

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: { loggingService: LoggingService }
): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false);
  const group = interaction.options.getSubcommandGroup(false);

  
  
  
  
  

  if (group === 'aliases') {
    switch (subcommand) {
      case 'setup':
        await handleSetup(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
    }
    return;
  }


  await handleManage(interaction, services);
}

import { resolveRole } from '../../utils/resolver';

async function handleManage(
  interaction: ChatInputCommandInteraction | any, 
  services: { loggingService: LoggingService }
): Promise<void> {
  
  const isSlash = interaction.isChatInputCommand?.();

  let user;
  let role;
  let roleNameInput;
  let reason = 'No reason provided';
  let guild = interaction.guild!;
  let moderator = interaction.member as any;

  if (isSlash) {
    await interaction.deferReply();
    user = interaction.options.getUser('user', true);
    role = interaction.options.getRole('role');
    roleNameInput = interaction.options.getString('role_name');
    reason = interaction.options.getString('reason') || 'No reason provided';
  } else {
    
    
    
    const message = interaction.message as Message;
    if (!message) return;

    const content = message.content.trim();
    const parts = content.split(/ +/);
    parts.shift(); 

    if (parts.length < 2) {
      await interaction.reply({ embeds: [createErrorEmbed('Usage: !role <user> <role_name> [reason]')] });
      return;
    }

    const userArg = parts.shift()!;
    
    if (message.mentions.members && message.mentions.members.size > 0) {
      user = message.mentions.members.first()?.user;
    } else {
      try {
        const fetchedMember = await guild.members.fetch(userArg);
        user = fetchedMember.user;
      } catch (e) { }
    }

    if (!user) {
      await interaction.reply({ embeds: [createErrorEmbed('User not found.')] });
      return;
    }

    
    
    
    
    

    const remaining = parts.join(' ');
    
    
    

    
    
    

    
    
    
    

    
    
    

    let bestRole = await resolveRole(remaining, guild);
    if (bestRole) {
      role = bestRole;
      
    } else {
      
      const splitParts = remaining.split(' ');
      if (splitParts.length > 1) {
        const potentialReason = splitParts.pop();
        const potentialRoleName = splitParts.join(' ');
        const roleMatch = await resolveRole(potentialRoleName, guild);
        if (roleMatch) {
          role = roleMatch;
          reason = potentialReason!;
        }
      }
    }

    if (!role) {
      
      const firstWord = parts[0];
      const roleMatch = await resolveRole(firstWord, guild);
      if (roleMatch) {
        role = roleMatch;
        reason = parts.slice(1).join(' ') || 'No reason provided';
      }
    }
  }

  
  if (!role && roleNameInput) {
    role = await resolveRole(roleNameInput, guild);
  }

  if (!role) {
    const errorEmbed = createErrorEmbed('Role not found. Please provide a valid role or alias.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  
  if (role.id === guild.roles.everyone.id) {
    const errorEmbed = createErrorEmbed('Cannot modify the @everyone role.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  if (role.position >= moderator.roles.highest.position && moderator.id !== guild.ownerId) {
    const errorEmbed = createErrorEmbed('You cannot manage a role equal to or higher than your highest role.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const botMember = guild.members.me!;
  if (role.position >= botMember.roles.highest.position) {
    const errorEmbed = createErrorEmbed('I cannot manage a role equal to or higher than my highest role.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  
  let target;
  try {
    target = await guild.members.fetch(user.id);
  } catch {
    const errorEmbed = createErrorEmbed('User is not a member of this server.');
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  
  await modifyRole(interaction, target, role, reason, services, isSlash);
}

async function modifyRole(
  interaction: ChatInputCommandInteraction | any,
  target: any,
  role: any,
  reason: string,
  services: { loggingService: LoggingService },
  isSlash: boolean = true
) {
  const hasRole = target.roles.cache.has(role.id);
  const action = hasRole ? 'remove' : 'add';

  try {
    if (hasRole) {
      await target.roles.remove(role.id, reason);
    } else {
      await target.roles.add(role.id, reason);
    }

    const embed = createModerationEmbed(
      hasRole ? `Removed ${role} from` : `Added ${role} to`,
      target.user,
      interaction.user,
      reason
    );

    if (isSlash) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed] });
    }

    
    await services.loggingService.logModeration(interaction.guildId!, {
      action: hasRole ? 'Role Removed' : 'Role Added',
      target: target.user,
      moderator: interaction.user,
      reason: `${role.name}`,
    });
  } catch (error: any) {
    const errorEmbed = createErrorEmbed(`Failed to ${action} role: ${error.message}`);
    if (isSlash) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed] });
    }
  }
}

async function handleSetup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const role = interaction.options.getRole('role', true);
  const guildId = interaction.guildId!;

  
  const allAliases = await prisma.roleAlias.findMany({ where: { guildId } });
  const roleAliases = allAliases
    .filter(a => a.roleId === role.id)
    .map(a => a.alias);

  const modalId = `role_alias_setup_${interaction.id}`;
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle(`Aliases for ${role.name.slice(0, 20)}`);

  const aliasesInput = new TextInputBuilder()
    .setCustomId('aliases')
    .setLabel('Aliases (comma or new line separated)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('staff, mod, admin\nmoderator')
    .setValue(roleAliases.join(', '))
    .setRequired(false);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(aliasesInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);

  try {
    const submission = await interaction.awaitModalSubmit({
      filter: i => i.customId === modalId,
      time: 300000 
    });

    await submission.deferReply();

    const aliasesText = submission.fields.getTextInputValue('aliases');
    const newAliases = aliasesText
      .split(/[\n,]+/)
      .map(a => a.trim())
      .filter(a => a.length > 0);

    const toAdd = newAliases.filter(a => !roleAliases.includes(a));
    const toRemove = roleAliases.filter(a => !newAliases.includes(a));

    let addedCount = 0;
    let removedCount = 0;
    let errors = 0;

    for (const alias of toAdd) {
      try {
        await prisma.roleAlias.create({ data: { guildId, roleId: role.id, alias } });
        addedCount++;
      } catch (e) {
        errors++;
      }
    }

    for (const alias of toRemove) {
      try {
        await prisma.roleAlias.deleteMany({ where: { guildId, alias } });
        removedCount++;
      } catch (e) {
        errors++;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('Role Aliases Updated')
      .setDescription(`Updated aliases for ${role}`)
      .addFields(
        { name: 'Added', value: toAdd.length > 0 ? toAdd.join(', ') : 'None', inline: true },
        { name: 'Removed', value: toRemove.length > 0 ? toRemove.join(', ') : 'None', inline: true }
      );

    if (errors > 0) {
      embed.setFooter({ text: `${errors} errors occurred.` });
    }

    await submission.editReply({ embeds: [embed] });

  } catch (error) {
    if (error instanceof Error && !error.message.includes('time')) {
      console.error('Error in role alias setup:', error);
    }
  }
}

async function handleList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();
  const guildId = interaction.guildId!;

  const aliases = await prisma.roleAlias.findMany({ where: { guildId } });

  if (aliases.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription('No role aliases found.')
      ]
    });
    return;
  }

  const byRole = new Map<string, string[]>();
  for (const { alias, roleId } of aliases) {
    if (!byRole.has(roleId)) {
      byRole.set(roleId, []);
    }
    byRole.get(roleId)!.push(alias);
  }

  const fields = [];
  for (const [roleId, roleAliases] of byRole) {
    fields.push({
      name: `Role: <@&${roleId}>`,
      value: roleAliases.map(a => `\`${a}\``).join(', '),
      inline: false
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('Role Aliases')
    .addFields(fields.slice(0, 25));

  if (fields.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${fields.length} roles.` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();
  const alias = interaction.options.getString('alias', true);
  const guildId = interaction.guildId!;

  const result = await prisma.roleAlias.deleteMany({ where: { guildId, alias } });

  if (result.count > 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`Successfully deleted alias \`${alias}\`.`)
      ]
    });
  } else {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`Alias \`${alias}\` not found.`)
      ]
    });
  }
}
