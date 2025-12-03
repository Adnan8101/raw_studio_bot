import { Interaction, EmbedBuilder } from 'discord.js';

export class ErrorHandler {
  
  static handle(error: Error, context?: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${context ? `[${context}]` : ''} Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }

  
  static async sendError(
    interaction: Interaction,
    message: string = 'An error occurred. try again later.'
  ): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('<:tcet_cross:1437995480754946178> Error')
        .setDescription(message)
        .setColor(0xED4245)
        .setTimestamp();

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          await interaction.reply({ embeds: [embed] }); 
        }
      }
    } catch (error) {
      console.error('[ErrorHandler] Failed to send error message:', error);
    }
  }

  
  static info(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`);
  }

  
  static warn(message: string): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`);
  }
}
