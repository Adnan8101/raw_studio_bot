import { Client, Message, VoiceState, Events } from 'discord.js';
import { DatabaseManager } from '../utils/DatabaseManager';

export class StatsService {
    private static instance: StatsService;
    private client: Client;
    private db: DatabaseManager;
    private voiceJoinTimes: Map<string, number> = new Map(); 

    private constructor(client: Client) {
        this.client = client;
        this.db = DatabaseManager.getInstance();
        this.initialize();
    }

    public static getInstance(client: Client): StatsService {
        if (!StatsService.instance) {
            StatsService.instance = new StatsService(client);
        }
        return StatsService.instance;
    }

    private initialize() {
        this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
        this.client.on(Events.VoiceStateUpdate, this.handleVoiceStateUpdate.bind(this));

        
        setInterval(this.saveVoiceStats.bind(this), 5 * 60 * 1000);
    }

    private async handleMessage(message: Message) {
        if (message.author.bot || !message.guild) return;

        await this.db.incrementMessageCount(message.guild.id, message.author.id);
    }

    private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const key = `${member.guild.id}-${member.id}`;
        const now = Date.now();

        
        if (!oldState.channelId && newState.channelId) {
            this.voiceJoinTimes.set(key, now);
        }
        
        else if (oldState.channelId && !newState.channelId) {
            await this.processVoiceLeave(key, now, member.guild.id, member.id);
        }
        
        
        
        
        
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await this.processVoiceLeave(key, now, member.guild.id, member.id);
            this.voiceJoinTimes.set(key, now);
        }
    }

    private async processVoiceLeave(key: string, leaveTime: number, guildId: string, userId: string) {
        const joinTime = this.voiceJoinTimes.get(key);
        if (joinTime) {
            const durationMs = leaveTime - joinTime;
            const minutes = Math.floor(durationMs / 1000 / 60);

            if (minutes > 0) {
                await this.db.addVoiceMinutes(guildId, userId, minutes);
            }

            this.voiceJoinTimes.delete(key);
        }
    }

    private async saveVoiceStats() {
        const now = Date.now();
        for (const [key, joinTime] of this.voiceJoinTimes.entries()) {
            const [guildId, userId] = key.split('-');
            const durationMs = now - joinTime;
            const minutes = Math.floor(durationMs / 1000 / 60);

            if (minutes > 0) {
                await this.db.addVoiceMinutes(guildId, userId, minutes);
                
                this.voiceJoinTimes.set(key, now);
            }
        }
    }
}
