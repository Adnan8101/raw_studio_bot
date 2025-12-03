

import { Client, Message } from 'discord.js';
import { AutoResponderService } from '../services/AutoResponderService';

export class AutoResponder {
  constructor(
    private client: Client,
    private autoResponderService: AutoResponderService
  ) {
    this.setupMessageListener();
  }

  
  private setupMessageListener(): void {
    this.client.on('messageCreate', async (message: Message) => {
      
      if (message.author.bot || !message.guild) {
        return;
      }

      try {
        
        const response = await this.autoResponderService.findMatch(
          message.guild.id,
          message.content
        );

        if (response) {
          await message.reply(response);
        }
      } catch (error) {
        console.error('Error in AutoResponder:', error);
      }
    });

    console.log('✔ AutoResponder message listener setup');
  }
}
