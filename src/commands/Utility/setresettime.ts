import { SlashCommandBuilder, ChatInputCommandInteraction, Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '../../database/connect';
import { createSuccessEmbed, createErrorEmbed, COLORS } from '../../utils/embeds';

export const category = 'Utility';

export const data = new SlashCommandBuilder()
    .setName('setresettime')
    .setDescription('Customize reset times for voice and messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('dailyvoice')
            .setDescription('Set the daily voice reset time')
            .addStringOption(option => option.setName('time').setDescription('Time (e.g. 00:00)').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('weeklyvoice')
            .setDescription('Set the weekly voice reset time')
            .addStringOption(option => option.setName('time').setDescription('Time (e.g. Sunday 00:00)').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('dailymessage')
            .setDescription('Set the daily message reset time')
            .addStringOption(option => option.setName('time').setDescription('Time (e.g. 00:00)').setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('weeklymessage')
            .setDescription('Set the weekly message reset time')
            .addStringOption(option => option.setName('time').setDescription('Time (e.g. Sunday 00:00)').setRequired(true))
    );

export const prefixCommand = {
    name: 'setresettime',
    aliases: ['setreset', 'configreset'],
    description: 'Customize reset times for voice and messages',
    usage: 'setresettime <dailyvoice|weeklyvoice|dailymessage|weeklymessage> <time>',
    permissions: [PermissionFlagsBits.ManageGuild]
};

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const time = interaction.options.getString('time', true);
    const guildId = interaction.guildId!;

    if (subcommand === 'dailyvoice') {
        if (!/^\d{2}:\d{2}$/.test(time)) return interaction.reply({ embeds: [createErrorEmbed('Invalid format. Use HH:MM (e.g. 00:00)')] });
        await prisma.voiceConfig.upsert({
            where: { guildId },
            create: { guildId, dailyResetTime: time },
            update: { dailyResetTime: time }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Daily voice reset time set to **${time}**.`)] });
    } else if (subcommand === 'weeklyvoice') {
        if (!/^[A-Za-z]+ \d{2}:\d{2}$/.test(time)) return interaction.reply({ embeds: [createErrorEmbed('Invalid format. Use Day HH:MM (e.g. Sunday 00:00)')] });
        await prisma.voiceConfig.upsert({
            where: { guildId },
            create: { guildId, weeklyResetTime: time },
            update: { weeklyResetTime: time }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Weekly voice reset time set to **${time}**.`)] });
    } else if (subcommand === 'dailymessage') {
        if (!/^\d{2}:\d{2}$/.test(time)) return interaction.reply({ embeds: [createErrorEmbed('Invalid format. Use HH:MM (e.g. 00:00)')] });
        await prisma.messageConfig.upsert({
            where: { guildId },
            create: { guildId, dailyResetTime: time },
            update: { dailyResetTime: time }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Daily message reset time set to **${time}**.`)] });
    } else if (subcommand === 'weeklymessage') {
        if (!/^[A-Za-z]+ \d{2}:\d{2}$/.test(time)) return interaction.reply({ embeds: [createErrorEmbed('Invalid format. Use Day HH:MM (e.g. Sunday 00:00)')] });
        await prisma.messageConfig.upsert({
            where: { guildId },
            create: { guildId, weeklyResetTime: time },
            update: { weeklyResetTime: time }
        });
        await interaction.reply({ embeds: [createSuccessEmbed(`Weekly message reset time set to **${time}**.`)] });
    }
}

export const prefixExecute = async (message: Message, args: string[]) => {
    const guildId = message.guildId;
    if (!guildId) return;

    const type = args[0]?.toLowerCase();

    if (['dailyvoice', 'dv'].includes(type || '')) {
        const time = args[1];
        if (!time || !/^\d{2}:\d{2}$/.test(time)) return message.reply({ embeds: [createErrorEmbed('Usage: `,setresettime dailyvoice HH:MM`')] });
        await prisma.voiceConfig.upsert({
            where: { guildId },
            create: { guildId, dailyResetTime: time },
            update: { dailyResetTime: time }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Daily voice reset time set to **${time}**.`)] });
    } else if (['weeklyvoice', 'wv'].includes(type || '')) {
        const time = args.slice(1).join(' ');
        if (!time || !/^[A-Za-z]+ \d{2}:\d{2}$/.test(time)) return message.reply({ embeds: [createErrorEmbed('Usage: `,setresettime weeklyvoice Day HH:MM`')] });
        await prisma.voiceConfig.upsert({
            where: { guildId },
            create: { guildId, weeklyResetTime: time },
            update: { weeklyResetTime: time }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Weekly voice reset time set to **${time}**.`)] });
    } else if (['dailymessage', 'dm'].includes(type || '')) {
        const time = args[1];
        if (!time || !/^\d{2}:\d{2}$/.test(time)) return message.reply({ embeds: [createErrorEmbed('Usage: `,setresettime dailymessage HH:MM`')] });
        await prisma.messageConfig.upsert({
            where: { guildId },
            create: { guildId, dailyResetTime: time },
            update: { dailyResetTime: time }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Daily message reset time set to **${time}**.`)] });
    } else if (['weeklymessage', 'wm'].includes(type || '')) {
        const time = args.slice(1).join(' ');
        if (!time || !/^[A-Za-z]+ \d{2}:\d{2}$/.test(time)) return message.reply({ embeds: [createErrorEmbed('Usage: `,setresettime weeklymessage Day HH:MM`')] });
        await prisma.messageConfig.upsert({
            where: { guildId },
            create: { guildId, weeklyResetTime: time },
            update: { weeklyResetTime: time }
        });
        await message.reply({ embeds: [createSuccessEmbed(`Weekly message reset time set to **${time}**.`)] });
    } else {
        await message.reply({ embeds: [createErrorEmbed('Usage: `,setresettime <dailyvoice|weeklyvoice|dailymessage|weeklymessage> <time>`')] });
    }
};
