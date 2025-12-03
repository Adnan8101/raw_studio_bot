import { Client } from 'discord.js';
import { prisma } from '../database/connect';
import { MessageService } from './MessageService';
import { VoiceService } from './VoiceService';
import moment from 'moment';

export class ResetService {
    private static instance: ResetService;
    private client: Client;

    constructor(client: Client) {
        this.client = client;
        this.startScheduler();
    }

    public static getInstance(client: Client): ResetService {
        if (!ResetService.instance) {
            ResetService.instance = new ResetService(client);
        }
        return ResetService.instance;
    }

    private startScheduler() {
        
        setInterval(() => this.checkResets(), 60000);
    }

    private async checkResets() {
        const now = moment();
        const currentDay = now.format('dddd');
        const currentTime = now.format('HH:mm');

        
        const messageConfigs = await prisma.messageConfig.findMany();
        for (const config of messageConfigs) {
            
            const [resetHour, resetMinute] = config.dailyResetTime.split(':').map(Number);
            const todayReset = moment().set({ hour: resetHour, minute: resetMinute, second: 0, millisecond: 0 });

            
            if (now.isSameOrAfter(todayReset)) {
                const lastReset = config.lastDailyReset ? moment(config.lastDailyReset) : null;
                if (!lastReset || lastReset.isBefore(todayReset)) {
                    await MessageService.getInstance().resetDailyMessages(config.guildId);
                    await prisma.messageConfig.update({
                        where: { id: config.id },
                        data: { lastDailyReset: new Date() }
                    });
                    console.log(`[ResetService] Reset daily messages for guild ${config.guildId}`);
                }
            }

            
            const [resetDay, resetTime] = config.weeklyResetTime.split(' ');
            const [weeklyResetHour, weeklyResetMinute] = resetTime.split(':').map(Number);

            
            
            
            
            

            let thisWeekReset = moment().day(resetDay).set({ hour: weeklyResetHour, minute: weeklyResetMinute, second: 0, millisecond: 0 });

            
            
            
            

            if (now.isBefore(thisWeekReset)) {
                
                
                
                
                
                
                
            }

            
            if (now.isBefore(thisWeekReset)) {
                thisWeekReset.subtract(7, 'days');
            }

            if (now.isSameOrAfter(thisWeekReset)) {
                const lastReset = config.lastWeeklyReset ? moment(config.lastWeeklyReset) : null;
                
                if (!lastReset || lastReset.isBefore(thisWeekReset)) {
                    await MessageService.getInstance().resetWeeklyMessages(config.guildId);
                    await prisma.messageConfig.update({
                        where: { id: config.id },
                        data: { lastWeeklyReset: new Date() }
                    });
                    console.log(`[ResetService] Reset weekly messages for guild ${config.guildId}`);
                }
            }
        }

        
        const voiceConfigs = await prisma.voiceConfig.findMany();
        for (const config of voiceConfigs) {
            
            const [resetHour, resetMinute] = config.dailyResetTime.split(':').map(Number);
            const todayReset = moment().set({ hour: resetHour, minute: resetMinute, second: 0, millisecond: 0 });

            if (now.isSameOrAfter(todayReset)) {
                const lastReset = config.lastDailyReset ? moment(config.lastDailyReset) : null;
                if (!lastReset || lastReset.isBefore(todayReset)) {
                    await VoiceService.resetDailyVoice(config.guildId);
                    await prisma.voiceConfig.update({
                        where: { id: config.id },
                        data: { lastDailyReset: new Date() }
                    });
                    console.log(`[ResetService] Reset daily voice time for guild ${config.guildId}`);
                }
            }

            
            const [resetDay, resetTime] = config.weeklyResetTime.split(' ');
            const [weeklyResetHour, weeklyResetMinute] = resetTime.split(':').map(Number);
            let thisWeekReset = moment().day(resetDay).set({ hour: weeklyResetHour, minute: weeklyResetMinute, second: 0, millisecond: 0 });

            if (now.isBefore(thisWeekReset)) {
                thisWeekReset.subtract(7, 'days');
            }

            if (now.isSameOrAfter(thisWeekReset)) {
                const lastReset = config.lastWeeklyReset ? moment(config.lastWeeklyReset) : null;
                if (!lastReset || lastReset.isBefore(thisWeekReset)) {
                    await VoiceService.resetWeeklyVoice(config.guildId);
                    await prisma.voiceConfig.update({
                        where: { id: config.id },
                        data: { lastWeeklyReset: new Date() }
                    });
                    console.log(`[ResetService] Reset weekly voice time for guild ${config.guildId}`);
                }
            }
        }
    }
}
