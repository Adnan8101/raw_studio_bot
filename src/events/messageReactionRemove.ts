import { Client, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { GiveawayManager } from '../services/GiveawayManager';

export const onMessageReactionRemove = async (client: Client, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;

    // Giveaway Handling
    await GiveawayManager.getInstance(client).handleReactionRemove(reaction, user);
};
