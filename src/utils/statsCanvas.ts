import { AttachmentBuilder, GuildMember } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// Register fonts (assuming they are available, otherwise canvas uses default)
// registerFont(path.join(__dirname, '../../assets/fonts/Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });
// registerFont(path.join(__dirname, '../../assets/fonts/Inter-Regular.ttf'), { family: 'Inter', weight: 'regular' });

interface StatsData {
    user: any;
    guildName: string;
    joinedAt: Date | null;
    ranks: {
        message: number;
        voice: number;
        invite: number;
    };
    messages: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    voice: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    invites: {
        total: number;
        regular: number;
        bonus: number;
        left: number;
        fake: number;
    };
    topChannels: {
        text: {
            name: string;
            count: number;
        };
        voice: {
            name: string;
            time: number;
        };
    };
    history: {
        messages: number[];
        voice: number[];
    };
}

export async function generateStatsImage(data: StatsData): Promise<AttachmentBuilder> {
    const canvas = createCanvas(1000, 520); // Increased height slightly to fit invite rank comfortably if needed, but 520 is standard
    const ctx = canvas.getContext('2d');

    // --- Colors & Styles ---
    const colors = {
        bg: '#111111', // Darker background
        cardBg: '#1a1a1a', // Slightly lighter card bg
        text: '#ffffff',
        subText: '#a0a0a0',
        accentMessage: '#00ff9d', // Neon Green
        accentVoice: '#ff0055',   // Hot Pink/Red
        accentInvite: '#00ccff',  // Cyan for Invites
        border: '#333333'
    };

    const fonts = {
        header: 'bold 24px Sans',
        subHeader: 'bold 18px Sans',
        body: '16px Sans',
        small: '14px Sans',
        rank: 'bold 20px Sans'
    };

    // --- Background ---
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Helper Functions ---
    const drawCard = (x: number, y: number, w: number, h: number, title: string, icon?: string) => {
        ctx.fillStyle = colors.cardBg;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 15);
        ctx.fill();
        // ctx.strokeStyle = colors.border;
        // ctx.lineWidth = 1;
        // ctx.stroke();

        if (title) {
            ctx.fillStyle = colors.text;
            ctx.font = fonts.subHeader;
            ctx.fillText(title, x + 20, y + 30);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
    };

    const formatTime = (ms: number) => {
        const hours = ms / (1000 * 60 * 60);
        return `${hours.toFixed(2)} hours`;
    };

    // --- Header (User Info) ---
    drawCard(20, 20, 450, 100, '');

    // Avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(70, 70, 40, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try {
        const avatar = await loadImage(data.user.displayAvatarURL({ extension: 'png', size: 128 }));
        ctx.drawImage(avatar, 30, 30, 80, 80);
    } catch (e) {
        ctx.fillStyle = '#555';
        ctx.fill();
    }
    ctx.restore();

    // User Details
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 28px Sans';
    ctx.fillText(data.user.username, 130, 60);

    ctx.fillStyle = colors.subText;
    ctx.font = fonts.body;
    ctx.fillText(data.guildName, 130, 90);

    // Dates (Created/Joined) - Top Right
    drawCard(490, 20, 235, 100, '');
    ctx.fillStyle = colors.subText;
    ctx.font = fonts.small;
    ctx.fillText('Created On', 510, 50);
    ctx.fillStyle = colors.text;
    ctx.font = fonts.body;
    ctx.fillText(data.user.createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 510, 80);

    drawCard(745, 20, 235, 100, '');
    ctx.fillStyle = colors.subText;
    ctx.font = fonts.small;
    ctx.fillText('Joined On', 765, 50);
    ctx.fillStyle = colors.text;
    ctx.font = fonts.body;
    ctx.fillText(data.joinedAt ? data.joinedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown', 765, 80);


    // --- Server Ranks ---
    drawCard(20, 140, 320, 180, 'Server Ranks 🏆'); // Increased height for Invite Rank

    const drawRankRow = (label: string, rank: number, y: number, color: string) => {
        ctx.fillStyle = '#252525'; // Darker row bg
        ctx.beginPath();
        ctx.roundRect(40, y - 20, 280, 40, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = fonts.body;
        ctx.fillText(label, 55, y + 5);

        ctx.fillStyle = color; // Rank color
        ctx.font = fonts.rank;
        ctx.textAlign = 'right';
        ctx.fillText(`#${rank}`, 310, y + 5);
        ctx.textAlign = 'left';
    };

    drawRankRow('Message', data.ranks.message, 190, colors.accentMessage);
    drawRankRow('Voice', data.ranks.voice, 240, colors.accentVoice);
    drawRankRow('Invite', data.ranks.invite, 290, colors.accentInvite);


    // --- Message Stats ---
    drawCard(360, 140, 300, 180, 'Messages 💬');

    const drawStatRow = (label: string, value: string, y: number, xStart: number) => {
        ctx.fillStyle = '#252525';
        ctx.beginPath();
        ctx.roundRect(xStart + 20, y - 20, 260, 40, 8);
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 16px Sans';
        ctx.fillText(label, xStart + 35, y + 5);

        ctx.fillStyle = colors.subText;
        ctx.font = '16px Sans';
        ctx.textAlign = 'right';
        ctx.fillText(value, xStart + 270, y + 5);
        ctx.textAlign = 'left';
    };

    drawStatRow('1d', `${formatNumber(data.messages.daily)} messages`, 190, 360);
    drawStatRow('7d', `${formatNumber(data.messages.weekly)} messages`, 240, 360);
    drawStatRow('14d', `${formatNumber(data.messages.monthly)} messages`, 290, 360); // Using monthly as 14d total for now based on logic

    // --- Voice Stats ---
    drawCard(680, 140, 300, 180, 'Voice Activity 🔊');

    drawStatRow('1d', formatTime(data.voice.daily), 190, 680);
    drawStatRow('7d', formatTime(data.voice.weekly), 240, 680);
    drawStatRow('14d', formatTime(data.voice.monthly), 290, 680);


    // --- Top Channels ---
    drawCard(20, 340, 480, 160, 'Top Channels & Applications 📊');

    const drawChannelRow = (icon: string, name: string, value: string, y: number) => {
        ctx.fillStyle = '#252525';
        ctx.beginPath();
        ctx.roundRect(40, y - 25, 440, 50, 10);
        ctx.fill();

        ctx.fillStyle = colors.subText;
        ctx.font = '24px Sans';
        ctx.fillText(icon, 55, y + 8);

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 18px Sans';
        ctx.fillText(name.length > 20 ? name.substring(0, 20) + '...' : name, 90, y + 8);

        ctx.fillStyle = colors.subText;
        ctx.font = '16px Sans';
        ctx.textAlign = 'right';
        ctx.fillText(value, 470, y + 8);
        ctx.textAlign = 'left';
    };

    drawChannelRow('#', data.topChannels.text.name, `${formatNumber(data.topChannels.text.count)} messages`, 400);
    drawChannelRow('🔊', data.topChannels.voice.name, formatTime(data.topChannels.voice.time), 460);


    // --- Charts (The 100/100 Overhaul) ---
    drawCard(520, 340, 460, 160, 'Activity Chart'); // Removed emoji to fix rendering issue

    // Legend
    ctx.fillStyle = colors.accentVoice;
    ctx.beginPath(); ctx.arc(860, 365, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.subText; ctx.fillText('Voice', 870, 370);


    const chartX = 540;
    const chartY = 390;
    const chartW = 420;
    const chartH = 90;

    // Draw Grid (Neon Tech Style)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical Grid Lines
    for (let i = 0; i <= 6; i++) {
        const x = chartX + (chartW / 6) * i;
        ctx.moveTo(x, chartY);
        ctx.lineTo(x, chartY + chartH);
    }

    // Horizontal Grid Lines
    for (let i = 0; i <= 4; i++) {
        const y = chartY + (chartH / 4) * i;
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartW, y);
    }
    ctx.stroke();

    // Data Normalization
    const maxMsg = Math.max(...data.history.messages, 10); // Min 10 to avoid flatline at 0
    const maxVoice = Math.max(...data.history.voice, 1000 * 60 * 60); // Min 1 hour

    const drawNeonLine = (dataPoints: number[], maxVal: number, color: string) => {
        if (dataPoints.length < 2) return;

        const stepX = chartW / (dataPoints.length - 1);

        // Path creation
        ctx.beginPath();
        ctx.moveTo(chartX, chartY + chartH - (dataPoints[0] / maxVal) * chartH);

        for (let i = 0; i < dataPoints.length - 1; i++) {
            const x1 = chartX + i * stepX;
            const y1 = chartY + chartH - (dataPoints[i] / maxVal) * chartH;
            const x2 = chartX + (i + 1) * stepX;
            const y2 = chartY + chartH - (dataPoints[i + 1] / maxVal) * chartH;

            // Bezier Control Points for smoothing
            const cp1x = x1 + (x2 - x1) / 2;
            const cp1y = y1;
            const cp2x = x1 + (x2 - x1) / 2;
            const cp2y = y2;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        }

        // Neon Glow Effect (Multiple strokes)
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner Core (White/Bright)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.stroke();

        ctx.restore();

        // Gradient Fill
        ctx.lineTo(chartX + chartW, chartY + chartH);
        ctx.lineTo(chartX, chartY + chartH);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
        gradient.addColorStop(0, color + '60'); // 37% opacity (stronger)
        gradient.addColorStop(1, color + '00'); // 0% opacity
        ctx.fillStyle = gradient;
        ctx.fill();
    };

    drawNeonLine(data.history.messages, maxMsg, colors.accentMessage);
    drawNeonLine(data.history.voice, maxVoice, colors.accentVoice);


    return new AttachmentBuilder(canvas.toBuffer(), { name: 'stats.png' });
}
