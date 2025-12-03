import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../../types';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and WebSocket ping'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const sent = await interaction.deferReply({ fetchReply: true });

        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle(' Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${botLatency}ms`, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
