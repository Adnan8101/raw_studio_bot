import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from 'discord.js';
import { BotClient } from '../../core/client';
import { TicketData, PanelData } from '../../core/db/postgresDB';
import { EmbedController } from '../../core/embedController';
import { InteractionHandler } from '../../core/interactionRouter';
import { ErrorHandler } from '../../core/errorHandler';
import { PermissionHelper } from '../../core/permissionHelper';
import { generateProfessionalTranscript, createTranscriptEmbed, generateTicketNumber, TranscriptOptions } from './transcriptGenerator';
import { SetupWizardHandler } from './setupWizard';

export class TicketHandler implements InteractionHandler {
  
  private static lastChannelOperation: Map<string, number> = new Map();

  
  private async safeChannelOperation<T>(
    channelId: string,
    operation: () => Promise<T>,
    operationName: string,
    minDelay: number = 500
  ): Promise<{ success: boolean; result: T | null; error?: any }> {
    try {
      
      const lastOp = TicketHandler.lastChannelOperation.get(channelId);
      if (lastOp) {
        const timeSinceLastOp = Date.now() - lastOp;
        if (timeSinceLastOp < minDelay) {
          const waitTime = minDelay - timeSinceLastOp;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out after 10 seconds')), 10000)
      );

      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      
      TicketHandler.lastChannelOperation.set(channelId, Date.now());

      return { success: true, result };
    } catch (error: any) {

      
      if (error.code === 50013 || error.code === 50035 || error.message?.includes('rate limit') || error.message?.includes('timed out')) {
      }

      return { success: false, result: null, error };
    }
  }

  async execute(interaction: any, client: BotClient, parts: string[]): Promise<void> {
    const action = parts[1];
    const panelOrTicketId = parts.length > 3 ? `${parts[2]}:${parts[3]}` : parts[2];

    try {
      switch (action) {
        case 'open':
          await this.openTicket(interaction, client, panelOrTicketId);
          break;
        case 'answer':
          await this.handleQuestionModal(interaction, client, panelOrTicketId);
          break;
        case 'close':
          await this.closeTicket(interaction, client, panelOrTicketId);
          break;
        case 'delete':
          await this.handleDeleteTicket(interaction, client, panelOrTicketId);
          break;
        case 'reopen':
          await this.reopenTicket(interaction, client, panelOrTicketId);
          break;
        case 'claim':
          await this.claimTicket(interaction, client, panelOrTicketId);
          break;
        case 'unclaim':
          await this.unclaimTicket(interaction, client, panelOrTicketId);
          break;
        case 'transcript':
          await this.generateTranscript(interaction, client, panelOrTicketId);
          break;
        case 'edit-select':
          await this.handleEditSelect(interaction, client);
          break;
        case 'delete-select':
          await this.handleDeleteSelect(interaction, client);
          break;
        case 'clear-select':
          await this.handleClearSelect(interaction, client);
          break;
        case 'clear-all':
          await this.handleClearAll(interaction, client);
          break;
        case 'clear-cancel':
          await this.handleClearCancel(interaction);
          break;
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'TicketHandler');
      await ErrorHandler.sendError(interaction);
    }
  }

  async openTicket(interaction: any, client: BotClient, panelId: string): Promise<void> {
    const panel = await client.db.get<PanelData>(panelId);
    if (!panel) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> Panel not found. It may have been deleted.',
        flags: 1 << 6 
      });
      return;
    }

    const guild = interaction.guild;
    const user = interaction.user;

    
    const existingTickets = await client.db.getOpenTicketsForUser(user.id, panelId);

    if (existingTickets.length > 0) {
      const existingChannel = existingTickets[0].channelId;
      await interaction.reply({
        content: `<:tcet_cross:1437995480754946178> You already have an open ticket for this panel: <#${existingChannel}>`,
        flags: 1 << 6 
      });
      return;
    }

    
    const hasQuestions = (panel.customQuestions && panel.customQuestions.length > 0) ||
      (panel.questions && panel.questions.length > 0);

    if (hasQuestions) {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');

      type TextInputBuilderType = InstanceType<typeof TextInputBuilder>;

      const modal = new ModalBuilder()
        .setCustomId(`ticket:answer:${panelId}`)
        .setTitle('Ticket Information');

      
      let questionsToShow: Array<{ text: string; type: 'primary' | 'optional' }> = [];

      if (panel.customQuestions && panel.customQuestions.length > 0) {
        
        const primary = panel.customQuestions.filter(q => q.type === 'primary');
        const optional = panel.customQuestions.filter(q => q.type === 'optional');
        questionsToShow = [...primary, ...optional].slice(0, 5);
      } else if (panel.questions && panel.questions.length > 0) {
        
        questionsToShow = panel.questions.slice(0, 5).map(q => ({ text: q, type: 'primary' as const }));
      }

      for (let i = 0; i < questionsToShow.length; i++) {
        const q = questionsToShow[i];
        const textInput = new TextInputBuilder()
          .setCustomId(`question_${i}`)
          .setLabel(q.text.substring(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(q.type === 'primary') 
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder<TextInputBuilderType>().addComponents(textInput));
      }

      await interaction.showModal(modal);
      return;
    }

    
    await interaction.reply({ content: ' Creating your ticket...', flags: 1 << 6 }); 
    await this.createTicketChannel(interaction, client, panelId, panel, user, guild, {});
  }

  async handleQuestionModal(interaction: any, client: BotClient, panelId: string): Promise<void> {
    const panel = await client.db.get<PanelData>(panelId);
    if (!panel) return;

    const user = interaction.user;
    const guild = interaction.guild;

    const answers: Record<string, string> = {};

    
    let questionsToShow: Array<{ text: string; type: 'primary' | 'optional' }> = [];

    if (panel.customQuestions && panel.customQuestions.length > 0) {
      
      const primary = panel.customQuestions.filter(q => q.type === 'primary');
      const optional = panel.customQuestions.filter(q => q.type === 'optional');
      questionsToShow = [...primary, ...optional].slice(0, 5);
    } else if (panel.questions && panel.questions.length > 0) {
      
      questionsToShow = panel.questions.slice(0, 5).map(q => ({ text: q, type: 'primary' as const }));
    }

    for (let i = 0; i < questionsToShow.length; i++) {
      const answer = interaction.fields.getTextInputValue(`question_${i}`);
      if (answer) { 
        answers[questionsToShow[i].text] = answer;
      }
    }

    await interaction.reply({ content: ' Creating your ticket...', flags: 1 << 6 }); 
    await this.createTicketChannel(interaction, client, panelId, panel, user, guild, answers);
  }

  private async createTicketChannel(
    interaction: any,
    client: BotClient,
    panelId: string,
    panel: PanelData,
    user: any,
    guild: any,
    answers: Record<string, string>
  ): Promise<void> {
    try {
      const ticketId = await client.db.generateTicketId();
      const ticketNumber = ticketId.split(':')[1];

      const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');


      
      const permissionOverwrites: any[] = [
        {
          id: guild.id, 
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.MentionEveryone,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
            PermissionFlagsBits.SendMessagesInThreads,
            PermissionFlagsBits.UseApplicationCommands,
          ],
        },
        
        {
          id: client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.AddReactions,
          ],
        },
      ];


      
      const userPermissions = panel.userPermissions || [];
      if (userPermissions.length > 0) {
        const userPerms = PermissionHelper.mapPermissionsToFlags(userPermissions);
        permissionOverwrites.push({
          id: user.id,
          allow: userPerms,
        });
        userPermissions.forEach(perm => {
        });
      } else {
        
        permissionOverwrites.push({
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      
      const staffPermissions = panel.staffPermissions || [];
      if (staffPermissions.length > 0) {
        const staffPerms = PermissionHelper.mapPermissionsToFlags(staffPermissions);
        permissionOverwrites.push({
          id: panel.staffRole,
          allow: staffPerms,
        });
        staffPermissions.forEach(perm => {
        });
      } else {
        
        permissionOverwrites.push({
          id: panel.staffRole,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        });
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: panel.openCategory,
        topic: `Ticket #${ticketNumber} | Owner: ${user.tag} | Panel: ${panel.name}`,
        permissionOverwrites,
      });


      const ticket: TicketData = {
        id: ticketId,
        type: 'ticket',
        owner: user.id,
        panelId: panelId,
        channelId: channel.id,
        state: 'open',
        createdAt: new Date().toISOString(),
      };

      await client.db.save(ticket);

      panel.ticketsCreated = (panel.ticketsCreated || 0) + 1;
      await client.db.save(panel);

      const welcomeEmbed = EmbedController.createTicketWelcomeEmbed(
        user.id,
        panel.staffRole || '',
        panel,
        ticketId
      );

      if (Object.keys(answers).length > 0) {
        for (const [question, answer] of Object.entries(answers)) {
          welcomeEmbed.addFields({
            name: `${question}`,
            value: `\`\`\`${answer}\`\`\``,
            inline: false
          });
        }
      }

      const welcomeMsg = await channel.send({
        content: `<@${user.id}> <@&${panel.staffRole}>`,
        embeds: [welcomeEmbed],
        components: this.createTicketButtons(ticketId, panel), 
      });

      ticket.welcomeMessageId = welcomeMsg.id;
      await client.db.save(ticket);


      if (panel.logsChannel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle(' New Ticket Created')
              .setColor(null)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'User', value: `<@${user.id}>`, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Log ticket creation');
        }
      }

      await interaction.followUp({
        content: `<:tcet_tick:1437995479567962184> Ticket created: <#${channel.id}>`,
        flags: 1 << 6 
      });
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Create ticket channel');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to create ticket. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async closeTicket(interaction: any, client: BotClient, ticketId: string): Promise<void> {

    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      }
      return;
    }


    
    const currentState = ticket.state as string;
    if (currentState === 'closed') {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> This ticket is already closed.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> This ticket is already closed.',
          flags: 1 << 6 
        });
      }
      return;
    }

    const panel = await client.db.get<PanelData>(ticket.panelId);
    if (!panel) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    const member = interaction.member as any;
    const hasManageChannels = interaction.memberPermissions?.has('ManageChannels') || false;

    
    if (!PermissionHelper.canCloseTicket(interaction.user.id, ticket.owner, member, panel, hasManageChannels)) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> **Only staff members can close this ticket.**\n\nIf you need assistance, please wait for a staff member.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> **Only staff members can close this ticket.**\n\nIf you need assistance, please wait for a staff member.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    try {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket channel not found.',
          flags: 1 << 6 
        });
        return;
      }

      
      let ownerName = ticket.owner;
      try {
        const ownerUser = await client.users.fetch(ticket.owner);
        ownerName = ownerUser.username;
      } catch (e) {
        
      }

      
      const sanitizedUsername = ownerName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
      const newName = `closed-${sanitizedUsername}`;

      
      const renameResult = await this.safeChannelOperation(
        channel.id,
        () => channel.setName(newName),
        'CLOSE_RENAME'
      );

      ticket.state = 'closed';
      ticket.closedAt = new Date().toISOString();

      
      await this.updateWelcomeMessageForClosed(channel, ticket, interaction.user.username, client.user?.username);

      
      const closeEmbed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`Ticket closed by <@${interaction.user.id}>`)
        .setColor(0xED4245)
        .setFooter({ text: `Closed by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:delete:${ticket.id}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId(`ticket:reopen:${ticket.id}`)
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓')
        );

      const closeMsg = await channel.send({
        embeds: [closeEmbed],
        components: [row]
      });

      ticket.closeMessageId = closeMsg.id;
      await client.db.save(ticket);

      
      let responseMessage = '<:tcet_tick:1437995479567962184> Ticket closed successfully.';
      if (!renameResult.success) {
        responseMessage += '\n⚠️ Note: Channel rename was rate-limited by Discord.';
      }

      await interaction.followUp({
        content: responseMessage,
        flags: 1 << 6 
      });

      if (panel.logsChannel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('<:tcet_cross:1437995480754946178> Ticket Closed')
              .setColor(0xED4245)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
                { name: 'Ticket ID', value: `\`${ticket.id}\``, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Log ticket closure');
        }
      }

      setImmediate(async () => {
        try {
          if (channel instanceof TextChannel) {
            await this.autoGenerateTranscript(channel, ticket, panel, client);
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Auto-generate transcript');
        }
      });

    } catch (error) {
      ErrorHandler.handle(error as Error, 'Close ticket');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to close ticket. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async reopenTicket(interaction: any, client: BotClient, ticketId: string): Promise<void> {

    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      }
      return;
    }


    
    if (ticket.state === 'open') {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> This ticket is already open.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> This ticket is already open.',
          flags: 1 << 6 
        });
      }
      return;
    }

    const panel = await client.db.get<PanelData>(ticket.panelId);
    if (!panel) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    try {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket channel not found.',
          flags: 1 << 6 
        });
        return;
      }

      
      let ownerName = ticket.owner;
      try {
        const ownerUser = await client.users.fetch(ticket.owner);
        ownerName = ownerUser.username;
      } catch (e) {
        
      }

      const sanitizedUsername = ownerName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
      const newName = `ticket-${sanitizedUsername}`;

      
      const renameResult = await this.safeChannelOperation(
        channel.id,
        () => channel.setName(newName),
        'REOPEN_RENAME'
      );

      
      if (ticket.closeMessageId) {
        try {
          const closeMsg = await channel.messages.fetch(ticket.closeMessageId);
          if (closeMsg) {
            await closeMsg.delete();
          }
        } catch (e) {
          
        }
      }

      ticket.state = 'open';
      ticket.closedAt = undefined;
      ticket.closeMessageId = undefined;
      await client.db.save(ticket);

      
      await this.updateWelcomeMessageButtons(channel, ticket, panel);

      
      const reopenEmbed = new EmbedBuilder()
        .setDescription(`<:tcet_tick:1437995479567962184> **Reopening ticket...**`)
        .setColor(0x57F287)
        .setTimestamp();

      const reopenMsg = await channel.send({ embeds: [reopenEmbed] });

      
      setTimeout(async () => {
        try {
          await reopenMsg.delete();
        } catch (error) {
          
        }
      }, 3000);

      
      let responseMessage = '<:tcet_tick:1437995479567962184> Ticket reopened successfully.';
      if (!renameResult.success) {
        responseMessage += '\n⚠️ Note: Channel rename was rate-limited by Discord.';
      }

      await interaction.followUp({
        content: responseMessage,
        flags: 1 << 6 
      });

      
      if (panel.logsChannel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('<:tcet_tick:1437995479567962184> Ticket Reopened')
              .setColor(0x57F287)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'Reopened By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
                { name: 'Ticket ID', value: `\`${ticket.id}\``, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Log ticket reopen');
        }
      }

    } catch (error) {
      ErrorHandler.handle(error as Error, 'Reopen ticket');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to reopen ticket. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async claimTicket(interaction: any, client: BotClient, ticketId: string): Promise<void> {
    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    if (ticket.claimedBy) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: `<:tcet_cross:1437995480754946178> This ticket has already been claimed by <@${ticket.claimedBy}>`,
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: `<:tcet_cross:1437995480754946178> This ticket has already been claimed by <@${ticket.claimedBy}>`,
          flags: 1 << 6 
        });
      }
      return;
    }

    const panel = await client.db.get<PanelData>(ticket.panelId);
    if (!panel) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    const member = interaction.member as any;
    const hasManageChannels = interaction.memberPermissions?.has('ManageChannels') || false;

    if (!PermissionHelper.isStaff(member, panel, hasManageChannels)) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> **Only staff members can claim tickets.**\n\nYou must have the staff role to claim this ticket.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> **Only staff members can claim tickets.**\n\nYou must have the staff role to claim this ticket.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    ticket.claimedBy = interaction.user.id;
    await client.db.save(ticket);

    try {
      const channel = await client.channels.fetch(ticket.channelId);
      if (channel?.isTextBased() && 'send' in channel) {
        if ('setName' in channel) {
          const newName = `claimed-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          try {
            await channel.setName(newName);
          } catch (error) {
          }
        }

        const claimEmbed = new EmbedBuilder()
          .setTitle('<:tcet_tick:1437995479567962184> Ticket Claimed')
          .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
          .setColor(0x5865F2)
          .setTimestamp();

        await channel.send({ embeds: [claimEmbed] });
      }

      
      if (panel.logsChannel && channel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('<:tcet_tick:1437995479567962184> Ticket Claimed')
              .setColor(0x5865F2)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
                { name: 'Ticket ID', value: `\`${ticketId}\``, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Log ticket claim');
        }
      }

      await interaction.followUp({
        content: '<:tcet_tick:1437995479567962184> You have claimed this ticket.',
        flags: 1 << 6 
      });
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Claim ticket');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to claim ticket. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async unclaimTicket(interaction: any, client: BotClient, ticketId: string): Promise<void> {
    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    if (!ticket.claimedBy) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> This ticket is not claimed.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> This ticket is not claimed.',
          flags: 1 << 6 
        });
      }
      return;
    }

    if (ticket.claimedBy !== interaction.user.id && !interaction.memberPermissions?.has('ManageChannels')) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> You can only unclaim tickets that you claimed.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> You can only unclaim tickets that you claimed.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const claimedByUser = ticket.claimedBy;

    ticket.claimedBy = undefined;
    await client.db.save(ticket);

    try {
      const channel = await client.channels.fetch(ticket.channelId);
      const owner = await client.users.fetch(ticket.owner);

      if (channel?.isTextBased() && 'send' in channel) {
        if ('setName' in channel) {
          const newName = `ticket-${owner.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          try {
            await channel.setName(newName);
          } catch (error) {
          }
        }

        const unclaimEmbed = new EmbedBuilder()
          .setTitle('<:tcet_tick:1437995479567962184> Ticket Unclaimed')
          .setDescription(`This ticket has been unclaimed by <@${claimedByUser}>`)
          .setColor(0xFEE75C)
          .setTimestamp();

        await channel.send({ embeds: [unclaimEmbed] });
      }

      
      const panel = await client.db.get<PanelData>(ticket.panelId);

      
      if (panel?.logsChannel && channel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('<:caution:1437997212008185866> Ticket Unclaimed')
              .setColor(0xFEE75C)
              .addFields(
                { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
                { name: 'Unclaimed By', value: `<@${claimedByUser}>`, inline: true },
                { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
                { name: 'Ticket ID', value: `\`${ticketId}\``, inline: true },
                { name: 'Panel', value: panel.name || 'Unknown', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Log ticket unclaim');
        }
      }

      await interaction.followUp({
        content: '<:tcet_tick:1437995479567962184> You have unclaimed this ticket.',
        flags: 1 << 6 
      });
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Unclaim ticket');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to unclaim ticket. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async generateTranscript(interaction: any, client: BotClient, ticketId: string): Promise<void> {
    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Ticket not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    const panel = await client.db.get<PanelData>(ticket.panelId);
    if (!panel) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: '⏳ Generating transcript... This may take a moment.',
        flags: 1 << 6 
      });
    } else {
      await interaction.reply({
        content: '⏳ Generating transcript... This may take a moment.',
        flags: 1 << 6 
      });
    }

    try {
      const channel = await client.channels.fetch(ticket.channelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Ticket channel not found.',
          flags: 1 << 6 
        });
        return;
      }

      if (!(channel instanceof TextChannel)) {
        throw new Error('Channel is not a text channel');
      }

      
      const ticketNumber = parseInt(ticket.id.split(':')[1]);
      const owner = await client.users.fetch(ticket.owner);

      let staffName: string | undefined;
      let staffId: string | undefined;
      if (ticket.claimedBy) {
        try {
          const staff = await client.users.fetch(ticket.claimedBy);
          staffName = staff.username;
          staffId = staff.id;
        } catch (error) {
        }
      }

      const transcriptOptions: TranscriptOptions = {
        ticketId: ticket.id,
        ticketNumber,
        username: owner.username,
        userId: owner.id,
        staffName,
        staffId,
        panelName: panel.name || 'Unknown Panel',
        createdAt: new Date(ticket.createdAt),
        closedAt: ticket.closedAt ? new Date(ticket.closedAt) : undefined
      };

      const attachment = await generateProfessionalTranscript(channel, transcriptOptions);
      const transcriptEmbed = createTranscriptEmbed(transcriptOptions);

      if (panel.transcriptChannel) {
        try {
          const transcriptChannel = await client.channels.fetch(panel.transcriptChannel);
          if (transcriptChannel?.isTextBased() && 'send' in transcriptChannel) {
            await transcriptChannel.send({ embeds: [transcriptEmbed], files: [attachment] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Send transcript to channel');
        }
      }

      if (panel.logsChannel) {
        try {
          const logChannel = await client.channels.fetch(panel.logsChannel);
          if (logChannel?.isTextBased() && 'send' in logChannel) {
            await logChannel.send({ embeds: [transcriptEmbed], files: [attachment] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Send transcript to logs');
        }
      }

      try {
        const owner = await client.users.fetch(ticket.owner);
        await owner.send({
          content: `<:module:1437997093753983038> Here is the transcript of your ticket from **${interaction.guild?.name}**:`,
          files: [attachment],
        });
      } catch (error) {
        ErrorHandler.warn('Could not DM transcript to ticket owner');
      }

      await interaction.followUp({
        content: '<:tcet_tick:1437995479567962184> Transcript generated and saved successfully!',
        flags: 1 << 6 
      });
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Generate transcript');
      await interaction.followUp({
        content: '<:tcet_cross:1437995480754946178> Failed to generate transcript. Please try again.',
        flags: 1 << 6 
      });
    }
  }

  async handleEditSelect(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
    const panelId = interaction.values[0];
    const userId = interaction.user.id;

    const wizardHandler = new SetupWizardHandler();
    await wizardHandler.handleEditSelect(interaction, client, userId);
  }

  async handleDeleteSelect(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
    const panelId = interaction.values[0];
    const panel = await client.db.get<PanelData>(panelId);

    if (!panel) {
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      } else {
        await interaction.reply({
          content: '<:tcet_cross:1437995480754946178> Panel not found.',
          flags: 1 << 6 
        });
      }
      return;
    }

    if (panel.messageId && panel.channel) {
      try {
        const channel = await client.channels.fetch(panel.channel);
        if (channel?.isTextBased() && 'messages' in channel) {
          const message = await channel.messages.fetch(panel.messageId);
          await message.delete();
        }
      } catch (error) {
        ErrorHandler.warn('Could not delete panel message');
      }
    }

    await client.db.delete(panelId);

    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: `<:tcet_tick:1437995479567962184> **Panel "${panel.name}" deleted successfully!**`,
        flags: 1 << 6 
      });
    } else {
      await interaction.reply({
        content: `<:tcet_tick:1437995479567962184> **Panel "${panel.name}" deleted successfully!**`,
        flags: 1 << 6 
      });
    }
  }

  private async autoGenerateTranscript(
    channel: TextChannel,
    ticket: TicketData,
    panel: PanelData,
    client: BotClient
  ): Promise<void> {
    try {
      
      const ticketNumber = parseInt(ticket.id.split(':')[1]);
      const owner = await client.users.fetch(ticket.owner);

      let staffName: string | undefined;
      let staffId: string | undefined;
      if (ticket.claimedBy) {
        try {
          const staff = await client.users.fetch(ticket.claimedBy);
          staffName = staff.username;
          staffId = staff.id;
        } catch (error) {
        }
      }

      const transcriptOptions: TranscriptOptions = {
        ticketId: ticket.id,
        ticketNumber,
        username: owner.username,
        userId: owner.id,
        staffName,
        staffId,
        panelName: panel.name || 'Unknown Panel',
        createdAt: new Date(ticket.createdAt),
        closedAt: ticket.closedAt ? new Date(ticket.closedAt) : undefined
      };

      const attachment = await generateProfessionalTranscript(channel, transcriptOptions);
      const transcriptEmbed = createTranscriptEmbed(transcriptOptions);

      if (panel.transcriptChannel) {
        try {
          const transcriptChannel = await client.channels.fetch(panel.transcriptChannel);
          if (transcriptChannel?.isTextBased() && 'send' in transcriptChannel) {
            await transcriptChannel.send({ embeds: [transcriptEmbed], files: [attachment] });
          }
        } catch (error) {
          ErrorHandler.handle(error as Error, 'Send transcript to channel');
        }
      }

      
      

      try {
        const owner = await client.users.fetch(ticket.owner);
        await owner.send({
          content: `<:module:1437997093753983038> Your ticket has been closed. Here is the transcript:`,
          embeds: [transcriptEmbed],
          files: [attachment],
        });
      } catch (error) {
        ErrorHandler.warn('Could not DM transcript to ticket owner');
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, 'Auto-generate transcript');
    }
  }

  private createTicketButtons(ticketId: string, panel: PanelData): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticketId}`)
        .setLabel('Close')
        .setEmoji('<:tcet_cross:1437995480754946178>')
        .setStyle(ButtonStyle.Danger)
    );

    if (panel.claimable) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:claim:${ticketId}`)
          .setLabel('Claim')
          .setEmoji('<:tcet_tick:1437995479567962184>')
          .setStyle(ButtonStyle.Primary)
      );
    }

    return [row];
  }

  private createClosedTicketButtons(ticketId: string): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:reopen:${ticketId}`)
        .setLabel('Reopen')
        .setEmoji('<:tcet_tick:1437995479567962184>')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:delete:${ticketId}`)
        .setLabel('Delete')
        .setEmoji('<:tcet_cross:1437995480754946178>')
        .setStyle(ButtonStyle.Danger)
    );

    return [row];
  }

  private async cleanupTicketMessages(channel: any, ticket: TicketData): Promise<void> {
    try {

      
      const messages = await channel.messages.fetch({ limit: 100 });

      
      const messagesToDelete = messages.filter((msg: any) => {
        
        if (ticket.welcomeMessageId && msg.id === ticket.welcomeMessageId) {
          return false;
        }
        
        const messageAge = Date.now() - msg.createdTimestamp;
        if (messageAge > 14 * 24 * 60 * 60 * 1000) {
          return false;
        }
        return true;
      });


      
      if (messagesToDelete.size > 0) {
        await channel.bulkDelete(messagesToDelete, true).catch(() => {
          
          messagesToDelete.forEach(async (msg: any) => {
            await msg.delete().catch(() => { });
          });
        });
      }

    } catch (error) {
      
      ErrorHandler.warn('Could not cleanup ticket messages');
    }
  }

  private async updateWelcomeMessageButtons(channel: any, ticket: TicketData, panel: PanelData): Promise<void> {
    try {

      if (!ticket.welcomeMessageId) {
        return;
      }

      const welcomeMsg = await channel.messages.fetch(ticket.welcomeMessageId).catch((err: any) => {
        return null;
      });

      if (!welcomeMsg) {
        return;
      }

      
      const buttons = this.createTicketButtons(ticket.id, panel);
      await welcomeMsg.edit({ components: buttons }).catch((err: any) => {
      });
    } catch (error) {
      ErrorHandler.warn('Could not update welcome message buttons');
    }
  }

  private async updateWelcomeMessageForClosed(channel: any, ticket: TicketData, closedByUsername: string, botUsername?: string): Promise<void> {
    try {

      if (!ticket.welcomeMessageId) {
        return;
      }

      const welcomeMsg = await channel.messages.fetch(ticket.welcomeMessageId).catch((err: any) => {
        return null;
      });

      if (!welcomeMsg) {
        return;
      }

      
      const originalEmbed = welcomeMsg.embeds[0];
      if (!originalEmbed) return;

      const closedEmbed = new EmbedBuilder(originalEmbed.data)
        .setColor(0xED4245) 
        .setFooter({ text: `Closed by ${closedByUsername} • ${new Date().toLocaleDateString()}`, iconURL: originalEmbed.footer?.iconURL });

      
      
      

      await welcomeMsg.edit({ embeds: [closedEmbed], components: [] }).catch((err: any) => {
      });
    } catch (error) {
      ErrorHandler.warn('Could not update welcome message for closed');
    }
  }

  
  async handleClearSelect(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
    const userId = interaction.customId.split(':')[2];
    const ticketIds = interaction.values;

    
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    let deletedChannels = 0;
    let deletedData = 0;

    for (const ticketId of ticketIds) {
      const ticket = await client.db.get(ticketId) as TicketData | null;
      if (!ticket) continue;

      
      try {
        const channel = await client.channels.fetch(ticket.channelId);
        if (channel) {
          await channel.delete();
          deletedChannels++;
        }
      } catch (error) {
        ErrorHandler.handle(error as Error, `Delete channel ${ticket.channelId}`);
      }

      
      await client.db.delete(ticketId);
      deletedData++;
    }

    await interaction.editReply({
      content: `<:tcet_tick:1437995479567962184> **Cleared ${deletedData} ticket(s)**\n\n` +
        `<:k9logging:1437996243803705354> Channels deleted: ${deletedChannels}\n` +
        `🗑️ Database entries removed: ${deletedData}`,
      embeds: [],
      components: [],
    });
  }

  
  async handleClearAll(interaction: ButtonInteraction, client: BotClient): Promise<void> {
    const userId = interaction.customId.split(':')[2];

    
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    
    const allTickets = await client.db.getAllTickets();
    const userTickets = allTickets.filter((t: any) => t.owner === userId);

    let deletedChannels = 0;
    let deletedData = 0;

    for (const ticket of userTickets) {
      
      try {
        const channel = await client.channels.fetch(ticket.channelId);
        if (channel) {
          await channel.delete();
          deletedChannels++;
        }
      } catch (error) {
        ErrorHandler.handle(error as Error, `Delete channel ${ticket.channelId}`);
      }

      
      await client.db.delete(ticket.id);
      deletedData++;
    }

    await interaction.editReply({
      content: `<:tcet_tick:1437995479567962184> **Cleared all ${deletedData} ticket(s)**\n\n` +
        `<:k9logging:1437996243803705354> Channels deleted: ${deletedChannels}\n` +
        `🗑️ Database entries removed: ${deletedData}`,
      embeds: [],
      components: [],
    });
  }

  
  async handleClearCancel(interaction: ButtonInteraction): Promise<void> {
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: '<:tcet_cross:1437995480754946178> Operation cancelled.',
        embeds: [],
        components: [],
      });
    } else {
      await interaction.update({
        content: '<:tcet_cross:1437995480754946178> Operation cancelled.',
        embeds: [],
        components: [],
      });
    }
  }
  async handleDeleteTicket(interaction: any, client: BotClient, ticketId: string): Promise<void> {
    const ticket = await client.db.get<TicketData>(ticketId);
    if (!ticket) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> Ticket not found.',
        flags: 1 << 6 
      });
      return;
    }

    const panel = await client.db.get<PanelData>(ticket.panelId);
    if (!panel) return;

    
    const member = interaction.member as any;
    const isStaff = member.roles.cache.has(panel.staffRole) || member.permissions.has(PermissionFlagsBits.ManageChannels);
    const isOwner = interaction.user.id === ticket.owner;

    if (!isStaff && !isOwner) {
      await interaction.reply({
        content: '<:tcet_cross:1437995480754946178> You do not have permission to delete this ticket.',
        flags: 1 << 6 
      });
      return;
    }

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: '<:tcet_tick:1437995479567962184> Deleting ticket...', flags: 1 << 6 });
    } else {
      await interaction.reply({ content: '<:tcet_tick:1437995479567962184> Deleting ticket...', flags: 1 << 6 });
    }

    const channel = interaction.channel as TextChannel;
    if (!channel) return;

    
    await this.generateTranscript(interaction, client, ticketId);

    
    if (panel.logsChannel) {
      try {
        const logChannel = await client.channels.fetch(panel.logsChannel);
        if (logChannel?.isTextBased() && 'send' in logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('<:tcet_cross:1437995480754946178> Ticket Deleted')
            .setColor(0xED4245)
            .addFields(
              { name: 'Ticket', value: channel.name, inline: true },
              { name: 'Deleted By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Owner', value: `<@${ticket.owner}>`, inline: true },
              { name: 'Panel', value: panel.name || 'Unknown', inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Log ticket deletion');
      }
    }

    
    setTimeout(async () => {
      try {
        await channel.delete();
        await client.db.delete(ticketId);
      } catch (error) {
        ErrorHandler.handle(error as Error, 'Delete ticket channel');
      }
    }, 5000);
  }
}
