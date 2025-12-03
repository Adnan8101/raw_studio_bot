import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import PostgresDB from './db/postgresDB';

export interface BotClient extends Client {
  db: PostgresDB;
  commands: Collection<string, any>;
}

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.User,
      Partials.GuildMember,
    ],
  }) as BotClient;

  
  client.db = new PostgresDB();
  
  
  client.commands = new Collection();

  return client;
}
