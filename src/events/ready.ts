import { Client, Collection } from 'discord.js';
import { connectDB } from '../database/connect';
import { registerCommands } from '../utils/commands';
export const onReady = async (client: Client, commands: Collection<string, any>) => {
    console.log(`✅ Logged in as ${client.user?.tag}!`);
    await connectDB();
    await registerCommands(client, commands);
    client.user?.setActivity('Watching you Rawshikaaa', { type: 4 });
};
