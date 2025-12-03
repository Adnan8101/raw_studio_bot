import { BotClient } from './client';

export class StartupLoader {
  
  static async load(client: BotClient): Promise<void> {

    try {
      
      console.log('🔄 Running panel migration...');
      await client.db.migratePanelsWithGuildId(client);
      
      
      const panels = await client.db.getAllPanels();
      console.log(`📂 Loaded ${panels.length} panel(s)`);

      
      const tickets = await client.db.getAllTickets();
      console.log(`🎫 Loaded ${tickets.length} ticket(s)`);

      
      let restored = 0;
      let missing = 0;

      for (const panel of panels) {
        if (!panel.enabled) continue;
        if (!panel.channel || !panel.messageId) continue;

        try {
          const channel = await client.channels.fetch(panel.channel);
          if (!channel || !channel.isTextBased()) {
            missing++;
            continue;
          }

          
          const message = await channel.messages.fetch(panel.messageId);
          if (message) {
            restored++;
          }
        } catch (error) {
          missing++;
        }
      }
      
      console.log(`✅ Verified ${restored} active panel message(s), ${missing} missing`);
      console.log(`👍 Startup cache warm-up complete`);

    } catch (error) {
      console.error('❌ Startup loader error:', error);
    }
  }

  
  static async verifyTickets(client: BotClient): Promise<void> {
    const tickets = await client.db.getAllTickets();
    
    for (const ticket of tickets) {
      try {
        const channel = await client.channels.fetch(ticket.channelId);
        if (!channel) {
          
        }
      } catch (error) {
      }
    }
  }
}
