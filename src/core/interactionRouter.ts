import { Interaction, InteractionType, ComponentType } from 'discord.js';
import { BotClient } from './client';

export interface InteractionHandler {
  execute(interaction: Interaction, client: BotClient, parts: string[]): Promise<void>;
}

export class InteractionRouter {
  private handlers: Map<string, InteractionHandler> = new Map();

  
  register(pattern: string, handler: InteractionHandler): void {
    this.handlers.set(pattern, handler);
  }

  
  async route(interaction: Interaction, client: BotClient): Promise<void> {
    try {
      
      let customId: string;
      if (interaction.isButton()) {
        customId = interaction.customId;
      } else if (interaction.isStringSelectMenu()) {
        customId = interaction.customId;
      } else if (interaction.isModalSubmit()) {
        customId = interaction.customId;
      } else {
        return; 
      }

      const parts = customId.split(':');
      const system = parts[0];
      const action = parts[1];

      
      const modalActions = ['set-name', 'set-description', 'set-openmessage', 'add-question', 'set-label', 'set-color', 'set-embed-color'];
      const shouldShowModal = modalActions.includes(action);

      
      const ephemeralActions = ['open'];
      const shouldUseEphemeral = ephemeralActions.includes(action);

      
      
      if (!shouldShowModal && !shouldUseEphemeral && !interaction.isModalSubmit()) {
        if ((interaction.isButton() || interaction.isStringSelectMenu()) && !interaction.replied && !interaction.deferred) {
          await interaction.deferUpdate().catch((err) => {
            console.warn('[Router] Failed to defer:', err.message);
          });
        }
      }

      
      const handler = this.handlers.get(system);
      if (handler) {
        await handler.execute(interaction, client, parts);
      } else {
        console.warn(`[Router] No handler found for system: ${system}`);
      }
    } catch (error: any) {
      console.error('[Router] Error:', error.message, error.stack);

      
      try {
        const errorMessage = 'Something went wrong. Please try again or contact support.';

        if (interaction.isRepliable()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: errorMessage, components: [], embeds: [] }).catch((err) => {
              console.error('[Router] Failed to edit reply:', err.message);
            });
          } else {
            await interaction.reply({ content: errorMessage, flags: 1 << 6 }).catch((err) => {
              console.error('[Router] Failed to reply:', err.message);
            });
          }
        }
      } catch (replyError: any) {
        console.error('[Router] Failed to send error message:', replyError.message);
      }
    }
  }

  
  getHandlers(): Map<string, InteractionHandler> {
    return this.handlers;
  }
}

export const router = new InteractionRouter();
