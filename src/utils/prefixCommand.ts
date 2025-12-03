

import { Message, ChatInputCommandInteraction, Guild, GuildMember, User, TextChannel } from 'discord.js';

export interface PrefixCommandOptions {
  getString(name: string, required?: boolean): string | null;
  getUser(name: string, required?: boolean): User | null;
  getRole(name: string, required?: boolean): any;
  getChannel(name: string, required?: boolean): any;
  getInteger(name: string, required?: boolean): number | null;
  getBoolean(name: string, required?: boolean): boolean | null;
  getSubcommand(throwOnEmpty?: boolean): string | null;
  getSubcommandGroup(throwOnEmpty?: boolean): string | null;
}

export interface PrefixInteraction {
  guild: Guild | null;
  guildId: string | null;
  member: GuildMember | null;
  user: User;
  channel: TextChannel;
  client: any;
  replied: boolean;
  deferred: boolean;
  options: PrefixCommandOptions;
  reply: (options: any) => Promise<Message>;
  editReply: (options: any) => Promise<Message>;
  followUp: (options: any) => Promise<Message>;
  deferReply: (options?: any) => Promise<Message | void>;
  inGuild: () => boolean;
  args: string[];
  message: Message;
  createdTimestamp: number;
}


function parseArgs(content: string, prefix: string): string[] {
  const withoutPrefix = content.slice(prefix.length).trim();
  const args: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < withoutPrefix.length; i++) {
    const char = withoutPrefix[i];

    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}


function parseUserId(arg: string): string | null {
  
  const userMention = arg.match(/^<@!?(\d+)>$/);
  if (userMention) return userMention[1];

  
  if (/^\d+$/.test(arg)) return arg;

  return null;
}

function parseRoleId(arg: string): string | null {
  
  const roleMention = arg.match(/^<@&(\d+)>$/);
  if (roleMention) return roleMention[1];

  
  if (/^\d+$/.test(arg)) return arg;

  return null;
}

function parseChannelId(arg: string): string | null {
  
  const channelMention = arg.match(/^<#(\d+)>$/);
  if (channelMention) return channelMention[1];

  
  if (/^\d+$/.test(arg)) return arg;

  return null;
}


export class ValidationError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}


function createOptions(message: Message, args: string[], commandName: string): PrefixCommandOptions {
  const parsedOptions: Map<string, any> = new Map();
  let subcommand: string | null = null;
  let subcommandGroup: string | null = null;

  
  
  if (args.length > 1 && commandName !== 'help') {
    const potentialSubcommand = args[1].toLowerCase();
    
    const commonSubcommands = ['add', 'remove', 'setup', 'list', 'view', 'config', 'lock', 'unlock', 'hide', 'unhide', 'slowmode', 'all', 'bots', 'human', 'enable', 'disable'];

    if (commonSubcommands.includes(potentialSubcommand) || (!args[1].match(/^<[@#&]/) && !args[1].match(/^\d+$/))) {
      
      const nextArg = args[2];
      if (!nextArg || nextArg.match(/^<[@#&]/) || nextArg.match(/^\d+$/) || nextArg.startsWith('-')) {
        subcommand = potentialSubcommand;
        args = [args[0], ...args.slice(2)]; 
      }
    }
  }

  
  if (commandName === 'purge') {
    if (args.length > 1) {
      const firstArg = args[1].toLowerCase();
      
      if (firstArg === 'bots' || firstArg === 'human' || firstArg === 'all') {
        subcommand = firstArg;
        parsedOptions.set('mode', firstArg);
        if (args.length > 2 && /^\d+$/.test(args[2])) {
          parsedOptions.set('amount', args[2]);
        }
      } else if (/^\d+$/.test(firstArg)) {
        subcommand = 'all';
        parsedOptions.set('amount', firstArg);
      }
    }
  }

  
  if (commandName === 'automod' && args.length > 1) {
    const firstArg = args[1].toLowerCase();
    if (['anti-spam', 'mass-mention'].includes(firstArg)) {
      subcommandGroup = firstArg;
      if (args.length > 2) {
        subcommand = args[2].toLowerCase();
        args = [args[0], ...args.slice(3)]; 
      }
    }
  }

  
  let argIndex = 1;

  
  const needsUser = ['ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'checkwarn', 'softban', 'nick', 'role'].includes(commandName) ||
    (commandName === 'quarantine' && ['add', 'remove'].includes(subcommand || ''));
  const needsRole = ['role'].includes(commandName) ||
    (commandName === 'quarantine' && subcommand === 'setup');
  const needsChannel = ['channel'].includes(commandName) ||
    (commandName === 'quarantine' && subcommand === 'setup');
  const needsDuration = ['mute', 'softban'].includes(commandName) ||
    (commandName === 'channel' && subcommand === 'slowmode');
  const needsString = ['setprefix', 'nick'].includes(commandName);
  const needsMessageId = ['gend', 'gcancel', 'greroll'].includes(commandName);

  
  if (commandName === 'automod') {
    if (subcommand === 'enable' || subcommand === 'disable') {
      
      if (argIndex < args.length) {
        parsedOptions.set('action', args[argIndex]);
        argIndex++;
      }
      if (subcommand === 'enable' && argIndex < args.length) {
        parsedOptions.set('punishment', args[argIndex]);
        argIndex++;
      }
      if (subcommand === 'enable' && argIndex < args.length) {
        parsedOptions.set('action_type', args[argIndex]);
        argIndex++;
      }
    } else if (subcommandGroup === 'anti-spam' && subcommand === 'limit') {
      
      if (argIndex < args.length) {
        parsedOptions.set('message', args[argIndex]);
        argIndex++;
      }
      if (argIndex < args.length) {
        parsedOptions.set('threshold_time', args[argIndex]);
        argIndex++;
      }
    } else if (subcommandGroup === 'mass-mention' && subcommand === 'limit') {
      
      if (argIndex < args.length) {
        parsedOptions.set('mentions_allowed', args[argIndex]);
        argIndex++;
      }
    }
  }

  
  if (commandName === 'antinuke') {
    if (subcommand === 'enable') {
      
      if (argIndex < args.length) {
        parsedOptions.set('actions', args[argIndex]);
        argIndex++;
      }
      if (argIndex < args.length) {
        parsedOptions.set('window_seconds', args[argIndex]);
        argIndex++;
      }
    } else if (subcommand === 'restore') {
      
      if (argIndex < args.length) {
        parsedOptions.set('mode', args[argIndex]);
        argIndex++;
      }
      if (argIndex < args.length) {
        parsedOptions.set('preview', args[argIndex]);
        argIndex++;
      }
    }
  }

  
  if (commandName === 'logging') {
    if (subcommand === 'enable') {
      
      if (argIndex < args.length) {
        const arg = args[argIndex];
        if (arg.startsWith('<#') || /^\d{17,19}$/.test(arg)) {
          parsedOptions.set('channel', arg);
          argIndex++;
        }
      }
    }
  }

  

  
  if (needsUser && argIndex < args.length) {
    const arg = args[argIndex];
    if (arg.startsWith('<@') || /^\d{17,19}$/.test(arg)) {
      parsedOptions.set('user', arg);
      argIndex++;
    }
  }

  
  if (needsRole && argIndex < args.length) {
    const arg = args[argIndex];
    if (arg.startsWith('<@&') || /^\d{17,19}$/.test(arg)) {
      parsedOptions.set('role', arg);
      argIndex++;
    }
  }

  
  if (needsChannel && argIndex < args.length) {
    const arg = args[argIndex];
    if (arg.startsWith('<#') || /^\d{17,19}$/.test(arg)) {
      parsedOptions.set('channel', arg);
      argIndex++;
    }
  }

  
  if (needsDuration && argIndex < args.length) {
    const arg = args[argIndex];
    
    if (/^\d+[smhd]$/i.test(arg) || arg === '0') {
      parsedOptions.set('duration', arg);
      argIndex++;
    }
  }

  
  if (needsString && argIndex < args.length) {
    const arg = args[argIndex];
    
    if (!arg.startsWith('<@') && !arg.startsWith('<#') && !arg.startsWith('<@&')) {
      parsedOptions.set('prefix', arg);
      parsedOptions.set('nickname', arg);
      argIndex++;
    }
  }

  
  if (commandName === 'help' && argIndex < args.length) {
    parsedOptions.set('command', args[argIndex]);
    argIndex++;
  }

  if (needsMessageId && argIndex < args.length) {
    parsedOptions.set('message_id', args[argIndex]);
    argIndex++;
  }

  if (commandName === 'ban' && argIndex < args.length) {
    const arg = args[argIndex];
    if (/^\d+$/.test(arg) && parseInt(arg) <= 7) {
      parsedOptions.set('delete_days', arg);
      argIndex++;
    }
  }

  
  if (argIndex < args.length) {
    parsedOptions.set('reason', args.slice(argIndex).join(' '));
  }

  
  if (commandName === 'unban' && parsedOptions.has('user')) {
    parsedOptions.set('user_id', parsedOptions.get('user'));
  }

  return {
    getString(name: string, required: boolean = false): string | null {
      const value = parsedOptions.get(name);
      if (required && !value) {
        throw new ValidationError(`Missing required option: ${name}`);
      }
      return value || null;
    },

    getUser(name: string, required: boolean = false): User | null {
      const value = parsedOptions.get(name);
      if (!value) {
        if (required) {
          throw new ValidationError('Please mention a user.');
        }
        return null;
      }

      const userId = parseUserId(value);
      if (!userId) {
        if (required) {
          throw new ValidationError('Please mention a user.');
        }
        return null;
      }

      
      
      return message.client.users.cache.get(userId) || ({ id: userId, toString: () => `<@${userId}>`, tag: 'Unknown User' } as User);
    },

    getRole(name: string, required: boolean = false): any {
      const value = parsedOptions.get(name);
      if (!value) {
        if (required) {
          throw new ValidationError('Please mention a role.');
        }
        return null;
      }

      const roleId = parseRoleId(value);
      if (!roleId || !message.guild) {
        if (required) {
          throw new ValidationError('Please mention a role.');
        }
        return null;
      }

      return message.guild.roles.cache.get(roleId) || null;
    },

    getChannel(name: string, required: boolean = false): any {
      const value = parsedOptions.get(name);
      if (!value) {
        if (required) throw new ValidationError(`Missing required option: ${name}`);
        return null;
      }

      const channelId = parseChannelId(value);
      if (!channelId || !message.guild) {
        if (required) throw new ValidationError(`Invalid channel: ${value}`);
        return null;
      }

      return message.guild.channels.cache.get(channelId) || null;
    },

    getInteger(name: string, required: boolean = false): number | null {
      const value = parsedOptions.get(name);
      if (!value) {
        if (required) throw new ValidationError(`Missing required option: ${name}`);
        return null;
      }

      const num = parseInt(value);
      if (isNaN(num)) {
        if (required) throw new ValidationError(`Invalid number: ${value}`);
        return null;
      }

      return num;
    },

    getBoolean(name: string, required: boolean = false): boolean | null {
      const value = parsedOptions.get(name);
      if (!value) {
        if (required) throw new ValidationError(`Missing required option: ${name}`);
        return null;
      }

      return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
    },

    getSubcommand(throwOnEmpty: boolean = false): string | null {
      if (throwOnEmpty && !subcommand) {
        throw new ValidationError('Missing subcommand');
      }
      return subcommand;
    },

    getSubcommandGroup(throwOnEmpty: boolean = false): string | null {
      return subcommandGroup;
    }
  };
}


export async function createPrefixInteraction(
  message: Message,
  prefix: string
): Promise<PrefixInteraction> {
  const args = parseArgs(message.content, prefix);
  const commandName = args[0]?.toLowerCase();

  let replyMessage: Message | null = null;
  let isDeferred = false;

  const interaction: PrefixInteraction = {
    guild: message.guild,
    guildId: message.guildId,
    member: message.member,
    user: message.author,
    channel: message.channel as TextChannel,
    client: message.client,
    replied: false,
    deferred: false,
    options: createOptions(message, args, commandName),
    args: args.slice(1), 
    message: message,
    createdTimestamp: message.createdTimestamp,

    async reply(options: any): Promise<Message> {
      if ('send' in message.channel) {
        if (typeof options === 'string') {
          replyMessage = await message.channel.send(options);
        } else {
          replyMessage = await message.channel.send(options);
        }
      }
      interaction.replied = true;
      return replyMessage!;
    },

    async editReply(options: any): Promise<Message> {
      if (!replyMessage) {
        return interaction.reply(options);
      }

      if (typeof options === 'string') {
        await replyMessage.edit({ content: options });
      } else {
        await replyMessage.edit(options);
      }
      return replyMessage;
    },

    async followUp(options: any): Promise<Message> {
      if ('send' in message.channel) {
        if (typeof options === 'string') {
          return await message.channel.send(options);
        }
        return await message.channel.send(options);
      }
      throw new Error('Channel does not support sending messages');
    },

    async deferReply(options?: any): Promise<Message | void> {
      
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping().catch(() => { });
      }
      isDeferred = true;
      interaction.deferred = true;

      if (options?.fetchReply) {
        if ('send' in message.channel) {
          replyMessage = await message.channel.send({ content: 'Thinking...' });
        }
        return replyMessage || undefined;
      }
    },

    inGuild(): boolean {
      return message.guild !== null;
    }
  };

  return interaction;
}
