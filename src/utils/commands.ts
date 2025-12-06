import { REST, Routes, SlashCommandBuilder, Client, Collection } from 'discord.js';
import { CONFIG } from '../config';

export const registerCommands = async (client: Client, commands: Collection<string, any>) => {
    const slashCommands: any[] = [];

    commands.forEach(cmd => {
        if (cmd.data) {
            try {
                slashCommands.push(cmd.data.toJSON());
            } catch (e) {
                // Ignore commands with invalid data or missing toJSON
            }
        }
    });

    console.log('Commands to deploy:', slashCommands.map((c, i) => `${i}: ${c.name}`).join(', '));

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);
    try {
        console.log(`Started refreshing ${slashCommands.length} application (/) commands.`);
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: slashCommands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
};
