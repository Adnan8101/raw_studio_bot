
import { Client, VoiceState } from 'discord.js';
import { DatabaseManager } from '../utils/DatabaseManager';
import { VoiceService } from '../services/VoiceService';

export const onVoiceStateUpdate = async (client: Client, oldState: VoiceState, newState: VoiceState) => {
    const db = DatabaseManager.getInstance();
    const userId = newState.id;
    const guildId = newState.guild.id;

    
    if (newState.channelId && newState.channelId !== oldState.channelId) {
        const targetChannelId = await db.getAutoDragRule(guildId, userId);
        if (targetChannelId && targetChannelId !== newState.channelId) {
            try {
                
                const member = await newState.guild.members.fetch(userId).catch(() => null);
                if (member && member.voice.channelId) {
                    
                    setTimeout(async () => {
                        try {
                            
                            if (member.voice.channelId) {
                                await member.voice.setChannel(targetChannelId);
                                
                                await db.deleteAutoDragRule(guildId, userId);
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                                
                            }
                        } catch (innerError) {
                            console.error(`Failed to move user ${userId} in timeout:`, innerError);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error(`Failed to auto-drag user ${userId}:`, e);
            }
        }
    }

    
    await VoiceService.handleVoiceStateUpdate(oldState, newState);
};
