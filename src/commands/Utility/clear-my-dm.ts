import { SlashCommandBuilder, ChatInputCommandInteraction, DMChannel, MessageFlags } from 'discord.js';
import { SlashCommand } from '../../types';

const slashCommand: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('clear-my-dm')
        .setDescription('Clear bot messages in your DM'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.channel?.isDMBased()) {
            await interaction.editReply('This command can only be used in DMs.');
            return;
        }

        try {
            const channel = interaction.channel as DMChannel;
            const messages = await channel.messages.fetch({ limit: 100 });
            const botMessages = messages.filter(m => m.author.id === interaction.client.user?.id);

            if (botMessages.size === 0) {
                await interaction.editReply('No messages found to delete.');
                return;
            }

            await interaction.editReply(`Found ${botMessages.size} messages. Deleting...`);

            for (const msg of botMessages.values()) {
                try {
                    await msg.delete();
                } catch (e) {
                    console.error(`Failed to delete message ${msg.id}: `, e);
                }
            }

            await interaction.followUp({ content: '✅ **Cleared all my messages.**', flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Error clearing DMs:', error);
            await interaction.editReply('❌ An error occurred while clearing messages.');
        }
    }
};

export const data = slashCommand.data;
export const execute = slashCommand.execute;
