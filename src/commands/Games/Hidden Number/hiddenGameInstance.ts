import { Client, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { createCanvas } from 'canvas';

interface HiddenNumberGameState {
    channelId: string;
    missingNumber: number;
    isActive: boolean;
    startTime: number;
}

export class HiddenNumberGameManager {
    private activeGames: Map<string, HiddenNumberGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number, targetChannel: any): Promise<boolean> {
        const channelId = targetChannel.id;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let minRange = 10;
        let maxRange = 99;
        let chunkSize = 45;

        if (difficulty === 'Medium') {
            minRange = 100;
            maxRange = 999;
            chunkSize = 80;
        } else if (difficulty === 'Hard') {
            minRange = 1000;
            maxRange = 9999;
            chunkSize = 110;
        }

        
        
        
        const maxStart = maxRange - chunkSize;
        
        let startNumber = Math.floor(Math.random() * (maxStart - minRange + 1)) + minRange;

        
        if (startNumber % 2 === 0) {
            startNumber++;
        }

        
        const numbers: number[] = [];
        for (let i = 0; i < chunkSize; i++) {
            numbers.push(startNumber + i);
        }

        
        
        const oddIndices = numbers
            .map((num, index) => (num % 2 !== 0 ? index : -1))
            .filter(index => index !== -1);

        const missingIndex = oddIndices[Math.floor(Math.random() * oddIndices.length)];
        const missingNumber = numbers[missingIndex];
        numbers.splice(missingIndex, 1); 

        
        try {
            await interaction.user.send(`Hidden Number (${difficulty}):\n|| ${missingNumber} ||`);
        } catch (error) {
            await interaction.editReply({ content: '❌ I could not DM you the hidden number. Please enable DMs and try again.' });
            return true;
        }

        
        
        
        
        
        
        
        
        

        
        const count = numbers.length; 
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        
        
        const padding = 40;

        
        
        let cellWidth = 100;
        if (difficulty === 'Hard') {
            cellWidth = 140;
        } else if (difficulty === 'Medium') {
            cellWidth = 120;
        }

        const cellHeight = 80;

        const width = (cols * cellWidth) + (padding * 2);
        const height = (rows * cellHeight) + (padding * 2);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        
        ctx.fillStyle = '#2b2d31'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < numbers.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);

            
            const x = padding + (col * cellWidth) + (cellWidth / 2);
            const y = padding + (row * cellHeight) + (cellHeight / 2);

            ctx.fillText(numbers[i].toString(), x, y);
        }

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'hidden_grid.png' });

        const embed = new EmbedBuilder()
            .setDescription(`**One number is missing from this sequence. First correct answer wins.**\nDifficulty: **${difficulty}**${time > 0 ? `\nImage will be deleted in ${time} seconds.` : ''}\n\n**Type the missing number. First correct answer wins.**`)
            .setImage('attachment://hidden_grid.png')
            .setColor(null); 

        await interaction.editReply({
            content: `✅ **Game Created in <#${channelId}>!** Check your DMs for the hidden number.`
        });

        let sentMessage: Message | undefined;

        if (targetChannel && targetChannel.isTextBased && targetChannel.isTextBased()) {
            
            if (!targetChannel.isDMBased()) {
                sentMessage = await (targetChannel as TextChannel).send({
                    embeds: [embed],
                    files: [attachment]
                });
            } else {
                
                const dm = targetChannel as any;
                if (dm.send) {
                    sentMessage = await dm.send({
                        embeds: [embed],
                        files: [attachment]
                    });
                }
            }
        }

        const gameState: HiddenNumberGameState = {
            channelId,
            missingNumber,
            isActive: true,
            startTime: Date.now()
        };

        this.activeGames.set(channelId, gameState);

        
        if (time > 0 && sentMessage) {
            setTimeout(async () => {
                try {
                    
                    if (!this.activeGames.has(channelId)) return;

                    if (sentMessage && sentMessage.deletable) {
                        await sentMessage.delete();
                    }

                } catch (error) {
                    console.error('Error in Hidden Number Game timeout:', error);
                }
            }, time * 1000);
        }

        return true;
    }

    public async stopGame(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const channelId = interaction.channelId;
        const game = this.activeGames.get(channelId);

        if (!game) {
            return false;
        }

        const missingNumber = game.missingNumber;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setTitle('Game Ended')
            .setDescription(`Missing number was: **${missingNumber}**`)
            .setColor(null);

        await interaction.reply({ embeds: [embed] });
        return true;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const content = message.content.trim();

        
        if (content === game.missingNumber.toString()) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            try {
                await message.react('✔️');
            } catch (e) {
                console.error('Failed to react:', e);
            }

            const embed = new EmbedBuilder()
                .setTitle('Hidden Number — Winner')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: false },
                    { name: 'Missing Number', value: game.missingNumber.toString(), inline: false }
                )
                .setFooter({ text: 'Game Completed' })
                .setColor(null);

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: HiddenNumberGameManager;

export const getHiddenNumberGameManager = (client: Client) => {
    if (!instance) {
        instance = new HiddenNumberGameManager(client);
    }
    return instance;
};
