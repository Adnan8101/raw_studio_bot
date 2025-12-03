import { Client, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { createCanvas, registerFont } from 'canvas';

interface MathGameState {
    channelId: string;
    problem: string;
    answer: number;
    isActive: boolean;
    startTime: number;
    difficulty: string;
    displayTime: number;
}

export class MathGameManager {
    private activeGames: Map<string, MathGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    private generateProblem(difficulty: string): { problem: string, answer: number } {
        let problem = '';
        let answer = 0;

        if (difficulty === 'Easy') {
            
            const a = Math.floor(Math.random() * 151) + 50; 
            const b = Math.floor(Math.random() * 151) + 50; 
            const op = Math.random() > 0.5 ? '+' : '-';
            problem = `${a} ${op} ${b}`;
            answer = op === '+' ? a + b : a - b;
        } else if (difficulty === 'Medium') {
            
            const op = Math.random() > 0.5 ? '×' : '÷';
            if (op === '×') {
                const a = Math.floor(Math.random() * 41) + 10; 
                const b = Math.floor(Math.random() * 9) + 2;   
                problem = `${a} × ${b}`;
                answer = a * b;
            } else {
                
                const b = Math.floor(Math.random() * 19) + 2; 
                const result = Math.floor(Math.random() * 41) + 10; 
                const a = b * result;
                problem = `${a} ÷ ${b}`;
                answer = result;
            }
        } else { 
            
            
            const ops = ['+', '-', '×'];
            const op1 = ops[Math.floor(Math.random() * ops.length)];
            const op2 = ops[Math.floor(Math.random() * ops.length)];

            const a = Math.floor(Math.random() * 81) + 20; 
            const b = Math.floor(Math.random() * 31) + 5;  
            const c = Math.floor(Math.random() * 51) + 10; 

            let res1 = 0;
            if (op1 === '+') res1 = a + b;
            else if (op1 === '-') res1 = a - b;
            else res1 = a * b;

            problem = `(${a} ${op1} ${b}) ${op2} ${c}`;

            if (op2 === '+') answer = res1 + c;
            else if (op2 === '-') answer = res1 - c;
            else answer = res1 * c;
        }

        return { problem, answer };
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number): Promise<boolean> {
        const channelId = interaction.channelId;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const { problem, answer } = this.generateProblem(difficulty);

        
        const canvas = createCanvas(800, 300);
        const ctx = canvas.getContext('2d');

        
        ctx.fillStyle = '#2b2d31';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        
        ctx.strokeStyle = '#383a40';
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        
        ctx.font = 'bold 80px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        
        const angle = (Math.random() * 10 - 5) * (Math.PI / 180); // -5 to 5 degrees
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angle);
        ctx.fillText(problem, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0); 

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'math_problem.png' });

        const embed = new EmbedBuilder()
            .setDescription(`**Solve this! You have ${time} seconds to view it.**\n\n**Type the correct answer. First correct message wins!**`)
            .setImage('attachment://math_problem.png');

        await interaction.reply({
            embeds: [embed],
            files: [attachment]
        });

        const gameState: MathGameState = {
            channelId,
            problem,
            answer,
            isActive: true,
            startTime: Date.now(),
            difficulty,
            displayTime: time
        };

        this.activeGames.set(channelId, gameState);

        if (time > 0) {
            setTimeout(async () => {
                try {
                    
                    if (!this.activeGames.has(channelId)) return;

                    await interaction.deleteReply();
                } catch (error) {
                    console.error('Error in Math Game timeout:', error);
                    
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

        const answer = game.answer;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setDescription(`No correct answer received. The correct answer was: ${answer}`);

        const channel = interaction.channel;
        if (channel) {
            if (channel.isTextBased() && !(channel as any).isDMBased()) {
                await (channel as TextChannel).send({ embeds: [embed] });
            } else if ((channel as any).isDMBased()) {
                await (channel as any).send({ embeds: [embed] });
            }
        }

        return true;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const content = message.content.trim();
        const guess = parseInt(content);

        if (isNaN(guess)) return;

        if (guess === game.answer) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            await message.react('✅');

            const timeTaken = ((Date.now() - game.startTime) / 1000) - game.displayTime;

            const embed = new EmbedBuilder()
                .setTitle('Winner!')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Problem', value: game.problem, inline: true },
                    { name: 'Correct Answer', value: game.answer.toString(), inline: true },
                    { name: 'Answered In', value: `${timeTaken.toFixed(2)} seconds`, inline: false }
                );

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: MathGameManager;

export const getMathGameManager = (client: Client) => {
    if (!instance) {
        instance = new MathGameManager(client);
    }
    return instance;
};
