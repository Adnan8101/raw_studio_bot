import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from 'discord.js';
import { CONFIG } from './config';
import { onReady } from './events/ready';
import { onMessageCreate } from './events/messageCreate';
import { onGuildMemberUpdate } from './events/guildMemberUpdate';
import { onMessageReactionAdd } from './events/messageReactionAdd';
import { onInteractionCreate } from './events/interactionCreate';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';


import { ConfigService } from './services/ConfigService';
import { WhitelistService } from './services/WhitelistService';
import { LoggingService } from './services/LoggingService';
import { CaseService } from './services/CaseService';
import { AutoResponderService } from './services/AutoResponderService';
import { ModerationService } from './services/ModerationService';
import { GuildConfigService } from './services/GuildConfigService';
import { AutoModService } from './services/AutoModService';
import { InviteService } from './services/InviteService';
import { StatsService } from './services/StatsService';
import { GiveawayManager } from './services/GiveawayManager';
import { ResetService } from './services/ResetService';


import { ActionLimiter } from './modules/ActionLimiter';
import { Executor } from './modules/Executor';
import { AuditLogMonitor } from './modules/AuditLogMonitor';
import { RecoveryManager } from './modules/RecoveryManager';
import { AutoResponder } from './modules/AutoResponder';
import { LoggingMonitor } from './modules/LoggingMonitor';
import { QuarantineMonitor } from './modules/QuarantineMonitor';


import { createUsageEmbed } from './utils/embedHelpers';
import { DatabaseManager } from './utils/DatabaseManager';
import { createPrefixInteraction } from './utils/prefixCommand';
import { createErrorEmbed } from './utils/embedHelpers';
import { CommandLoader } from './utils/CommandLoader';
import { onVoiceStateUpdate } from './events/voiceStateUpdate';


dotenv.config();


const prisma = new PrismaClient({
    log: ['error', 'warn'],
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});



export const commands = new Collection<string, any>();
export const commandLoader = new CommandLoader();


const configService = new ConfigService(prisma);
const whitelistService = new WhitelistService(prisma);
const loggingService = new LoggingService(prisma, client);
const caseService = new CaseService(prisma);
const autoResponderService = new AutoResponderService(prisma);
const moderationService = new ModerationService(prisma);
const guildConfigService = new GuildConfigService(prisma);
const autoModService = new AutoModService(prisma);
const inviteService = new InviteService();
const statsService = StatsService.getInstance(client);
const resetService = ResetService.getInstance(client);


import PostgresDB from './core/db/postgresDB';
import { router } from './core/interactionRouter';
import { SetupWizardHandler } from './modules/ticket/setupWizard';
import { TicketHandler } from './modules/ticket/ticketHandler';
import { PanelHandler } from './modules/panel/panelHandler';
import { ErrorHandler } from './core/errorHandler';
import { EmbedController } from './core/embedController';


const ticketDB = new PostgresDB(process.env.DATABASE_URL);
(client as any).db = ticketDB; 


router.register('wizard', new SetupWizardHandler());
router.register('ticket', new TicketHandler());
router.register('panel', new PanelHandler());


const actionLimiter = new ActionLimiter(prisma, configService);
const executor = new Executor(prisma, client, configService, caseService, loggingService, actionLimiter);
const recoveryManager = new RecoveryManager(prisma, client, caseService, loggingService);
const auditLogMonitor = new AuditLogMonitor(
    client,
    configService,
    whitelistService,
    actionLimiter,
    executor
);
const autoResponder = new AutoResponder(client, autoResponderService);
const loggingMonitor = new LoggingMonitor(client, prisma);
const quarantineMonitor = new QuarantineMonitor(client, moderationService);


let autoModMonitor: any = null;


export const services = {
    configService,
    whitelistService,
    loggingService,
    caseService,
    actionLimiter,
    executor,
    recoveryManager,
    autoResponderService,
    moderationService,
    guildConfigService,
    autoModService,
    prisma,
    commands,
    ticketDB 
};


async function deployCommands() {
    const commandsData = Array.from(commands.values())
        .filter(cmd => cmd.data)
        .map(cmd => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    try {
        console.log('🔄 Deploying slash commands...');

        if (!CONFIG.CLIENT_ID) {
            console.error('✖ CLIENT_ID is missing in config/env');
            return;
        }

        if (CONFIG.GUILD_ID) {
            console.log(`🔄 Deploying to guild: ${CONFIG.GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
                { body: commandsData }
            );
            console.log('✔ Successfully deployed slash commands to guild');
        } else {
            console.log('🔄 Deploying globally...');
            await rest.put(
                Routes.applicationCommands(CONFIG.CLIENT_ID),
                { body: commandsData }
            );
            console.log('✔ Successfully deployed slash commands globally');
        }
    } catch (error) {
        console.error('✖ Failed to deploy commands:', error);
    }
}


function startPeriodicTasks() {
    
    setInterval(async () => {
        try {
            const deleted = await actionLimiter.cleanupOldActions(30);
            console.log(`🧹 Cleaned up ${deleted} old action records`);
        } catch (error) {
            console.error('Failed to cleanup old actions:', error);
        }
    }, 6 * 60 * 60 * 1000); 

    
    setInterval(async () => {
        try {
            await recoveryManager.cleanupOldBackups(7);
            console.log('🧹 Cleaned up old backups');
        } catch (error) {
            console.error('Failed to cleanup old backups:', error);
        }
    }, 24 * 60 * 60 * 1000); 

    
    setInterval(async () => {
        try {
            const promises = Array.from(client.guilds.cache.keys()).map(guildId =>
                recoveryManager.createSnapshot(guildId).catch(e => console.error(`Failed to create snapshot for ${guildId}:`, e))
            );
            await Promise.allSettled(promises);
            console.log('📸 Created guild snapshots');
        } catch (error) {
            console.error('Failed to create snapshots:', error);
        }
    }, 12 * 60 * 60 * 1000); 

    
    setInterval(async () => {
        try {
            console.log('🔄 Updating server stats...');
            const promises = Array.from(client.guilds.cache.values()).map(async guild => {
                try {
                    const serverStatsCommand = commands.get('server-stats');
                    if (serverStatsCommand && serverStatsCommand.updateServerStats) {
                        const { updated } = await serverStatsCommand.updateServerStats(guild);
                        return updated;
                    }
                    return 0;
                } catch (error) {
                    console.error(`Failed to update stats for guild ${guild.id}:`, error);
                    return 0;
                }
            });

            const results = await Promise.allSettled(promises);
            const totalUpdated = results.reduce((acc, res) =>
                acc + (res.status === 'fulfilled' ? res.value : 0), 0);

            if (totalUpdated > 0) {
                console.log(`📊 Updated ${totalUpdated} stats panels`);
            }
        } catch (error) {
            console.error('Failed to update server stats:', error);
        }
    }, 30 * 60 * 1000); 

    console.log('✔ Periodic tasks started');
}


client.once('clientReady', async () => {
    const startTime = Date.now();
    console.log('🚀 Starting bot...');

    
    const commandsPath = path.join(__dirname, 'commands');
    await commandLoader.loadCommands(commandsPath);

    
    commandLoader.commands.forEach((cmd, name) => {
        commands.set(name, cmd);
    });
    console.log(`✔ Loaded ${commands.size} commands`);

    
    await onReady(client);

    
    console.log(`✔ Bot logged in as ${client.user?.tag}`);
    console.log(` Serving ${client.guilds.cache.size} guilds`);

    
    
    const { AutoModMonitor } = await import('./modules/AutoModMonitor');
    autoModMonitor = new AutoModMonitor(client, autoModService, moderationService, loggingService);
    console.log('✔ AutoMod Monitor started - watching all channels 24/7');

    
    
    

    
    startPeriodicTasks();

    
    GiveawayManager.getInstance(client).startTicker();
    console.log('✔ Giveaway Ticker started');

    
    console.log('🔄 Caching invites in background...');
    (async () => {
        const invitePromises = Array.from(client.guilds.cache.values()).map(async guild => {
            try {
                await inviteService.cacheGuildInvites(guild);
                return true;
            } catch (error: any) {
                console.error(`Failed to cache invites for guild ${guild.id}:`, error);
                return false;
            }
        });
        const inviteResults = await Promise.allSettled(invitePromises);
        const cachedGuilds = inviteResults.filter(r => r.status === 'fulfilled' && r.value).length;
        console.log(`✔ Cached invites for ${cachedGuilds}/${client.guilds.cache.size} guilds`);
    })();

    console.log(`✨ Startup took ${Date.now() - startTime}ms`);
});

client.on('messageCreate', async (message) => {
    
    await onMessageCreate(client, message);

    
    if (message.author.bot || !message.guild) return;

    
    const prefix = await guildConfigService.getPrefix(message.guild.id);
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    let command = commands.get(commandName);
    if (!command) {
        
        command = commandLoader.getCommandByAlias(commandName);
    }
    if (!command) return;

    
    if (command.data?.default_member_permissions) {
        const member = message.member!;
        const requiredPerms = BigInt(command.data.default_member_permissions);

        if (!member.permissions.has(requiredPerms)) {
            return;
        }
    }

    try {
        const interaction = await createPrefixInteraction(message, prefix);
        await command.execute(interaction as any, services);
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const errorEmbed = createErrorEmbed(error.message);
            await message.reply({ embeds: [errorEmbed] });
        } else {
            console.error(`Error executing prefix command ${commandName}:`, error);
            const errorEmbed = createErrorEmbed('An error occurred while executing this command.');
            await message.reply({ embeds: [errorEmbed] });
        }
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => onGuildMemberUpdate(client, oldMember, newMember));
client.on('messageReactionAdd', (reaction, user) => onMessageReactionAdd(client, reaction as any, user as any));
client.on('voiceStateUpdate', (oldState, newState) => onVoiceStateUpdate(client, oldState, newState));

client.on('interactionCreate', async (interaction) => {
    
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);

        if (command) {
            
            if (interaction.inGuild() && command.data.default_member_permissions) {
                const member = interaction.member as any;
                const requiredPerms = BigInt(command.data.default_member_permissions);

                if (!member.permissions.has(requiredPerms)) {
                    return;
                }
            }

            try {
                await command.execute(interaction, services);
            } catch (error: any) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
            }
        } else {
            
            await onInteractionCreate(client, interaction);
        }
        return;
    }

    

    
    await onInteractionCreate(client, interaction);

    
    if (interaction.isButton() || interaction.isStringSelectMenu() ||
        interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {

        try {
            
            
            if ('customId' in interaction &&
                (interaction.customId.startsWith('help_category_') ||
                    interaction.customId.startsWith('steal_'))) {
                return;
            }

            await router.route(interaction, client as any);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Interaction handler');
        }
    }
});


client.on('guildCreate', async guild => {
    try {
        await inviteService.cacheGuildInvites(guild);
        console.log(`✔ Cached invites for new guild: ${guild.name}`);
    } catch (error) {
        console.error(`Failed to cache invites for guild ${guild.id}:`, error);
    }
});

client.on('inviteCreate', async invite => {
    try {
        if (invite.guild && 'invites' in invite.guild) {
            await inviteService.updateInviteCache(invite.guild);
        }
    } catch (error) {
        console.error('Failed to update invite cache on create:', error);
    }
});

client.on('inviteDelete', async invite => {
    try {
        if (invite.guild && 'invites' in invite.guild) {
            await inviteService.updateInviteCache(invite.guild);
        }
    } catch (error) {
        console.error('Failed to update invite cache on delete:', error);
    }
});

client.on('guildBanAdd', async ban => {
    
    const serverStatsCommand = commands.get('server-stats');
    if (serverStatsCommand && serverStatsCommand.updateServerStats) {
        await serverStatsCommand.updateServerStats(ban.guild).catch(console.error);
    }
});

client.on('guildBanRemove', async ban => {
    const serverStatsCommand = commands.get('server-stats');
    if (serverStatsCommand && serverStatsCommand.updateServerStats) {
        await serverStatsCommand.updateServerStats(ban.guild).catch(console.error);
    }
});

client.on('guildMemberAdd', async member => {
    try {
        const db = DatabaseManager.getInstance();
        const config = await db.getWelcomeConfig(member.guild.id);

        
        let inviterInfo = '';
        let inviteData = {
            inviterId: null as string | null,
            inviterTag: null as string | null,
            inviteCode: null as string | null,
            joinType: 'unknown' as 'invite' | 'vanity' | 'unknown' | 'oauth'
        };

        try {
            const newInvites = await member.guild.invites.fetch();
            inviteData = await inviteService.findUsedInvite(member.guild.id, newInvites);
            await inviteService.updateInviteCache(member.guild);

            if (member.user.bot) {
                inviterInfo = `${member} has been added as an **Integration** 🤖.`;
            } else if (inviteData.joinType === 'invite' && inviteData.inviterId && inviteData.inviterTag) {
                const totalInvites = await inviteService.incrementInvites(member.guild, inviteData.inviterId);
                inviterInfo = `${member} has been invited by **${inviteData.inviterTag}** who now has **${totalInvites}** invite${totalInvites !== 1 ? 's' : ''}.`;
            } else if (inviteData.joinType === 'vanity') {
                inviterInfo = `${member} has joined **${member.guild.name}** via **vanity URL**.`;
            } else {
                inviterInfo = `${member} has been invited via **unknown link**.`;
            }

            await inviteService.storeMemberJoin(
                member.guild.id,
                member.id,
                inviteData.inviterId,
                inviteData.inviterTag,
                inviteData.inviteCode,
                inviteData.joinType
            );
        } catch (inviteError: any) {
            if (inviteError.code === 50013) {
                console.warn(`⚠️ Missing permissions to track invites in guild ${member.guild.name} (${member.guild.id})`);
            } else {
                console.error('Error tracking invite:', inviteError);
            }
            inviterInfo = `${member} has been invited via **unknown link**.`;
        }

        if (config.welcomeChannelId && config.welcomeEnabled) {
            const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (welcomeChannel && welcomeChannel.isTextBased()) {
                const message = config.message || inviterInfo;
                await welcomeChannel.send(message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name));
            }
        }

        const serverStatsCommand = commands.get('server-stats');
        if (serverStatsCommand && serverStatsCommand.updateServerStats) {
            await serverStatsCommand.updateServerStats(member.guild).catch(console.error);
        }
    } catch (error) {
        console.error('Error handling member join:', error);
    }
});

client.on('guildMemberRemove', async member => {
    try {
        const db = DatabaseManager.getInstance();
        const config = await db.getWelcomeConfig(member.guild.id);

        if (config.leaveChannelId && config.leaveEnabled) {
            const leaveChannel = member.guild.channels.cache.get(config.leaveChannelId);
            if (leaveChannel && leaveChannel.isTextBased()) {
                const joinInfo = await inviteService.getMemberJoinData(member.guild.id, member.id);
                let leaveMessage = '';

                if (member.user.bot) {
                    let action = 'left';
                    try {
                        const auditLogs = await member.guild.fetchAuditLogs({ limit: 5 });
                        const entry = auditLogs.entries.find(e => e.targetId === member.id && (e.action === 20 || e.action === 22));
                        if (entry) {
                            if (entry.action === 20) action = 'was kicked';
                            if (entry.action === 22) action = 'was banned';
                            if (Date.now() - entry.createdTimestamp > 30000) action = 'left';
                        }
                    } catch (e) {
                        console.error('Failed to fetch audit logs for bot leave:', e);
                    }
                    leaveMessage = `${member.user.tag} ${action} the server.`;
                } else if (joinInfo) {
                    if (joinInfo.joinType === 'invite' && joinInfo.inviterId && joinInfo.inviterTag) {
                        try {
                            const totalInvites = await inviteService.decrementInvites(member.guild.id, joinInfo.inviterId);
                            leaveMessage = `${member.user.tag} left the server. They were invited by **${joinInfo.inviterTag}** who now has **${totalInvites}** invite${totalInvites !== 1 ? 's' : ''}.`;
                        } catch (error) {
                            leaveMessage = `${member.user.tag} left the server. They were invited by **${joinInfo.inviterTag}**.`;
                        }
                    } else if (joinInfo.joinType === 'vanity') {
                        leaveMessage = `${member.user.tag} left the server. They joined using **vanity URL**.`;
                    } else {
                        leaveMessage = `${member.user.tag} left the server. They joined using **unknown link**.`;
                    }
                    await inviteService.deleteMemberJoinData(member.guild.id, member.id);
                } else {
                    leaveMessage = `${member.user.tag} left the server. They joined using **unknown link**.`;
                }

                const finalMessage = config.leaveMessage || leaveMessage;
                await leaveChannel.send(finalMessage.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name));
            }
        }

        const serverStatsCommand = commands.get('server-stats');
        if (serverStatsCommand && serverStatsCommand.updateServerStats) {
            await serverStatsCommand.updateServerStats(member.guild).catch(console.error);
        }
    } catch (error) {
        console.error('Error handling member leave:', error);
    }
});

client.login(CONFIG.BOT_TOKEN);
