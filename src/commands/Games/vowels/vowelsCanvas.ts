import { createCanvas, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export class VowelsCanvas {
    public static async generateImage(text: string): Promise<AttachmentBuilder> {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, width, height);

        
        ctx.fillStyle = '#e0e0e0';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const s = Math.random() * 3;
            ctx.fillRect(x, y, s, s);
        }

        
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#000000'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        
        const startX = width / 2 - (ctx.measureText(text).width / 2);
        const centerY = height / 2;

        let currentX = startX;

        
        
        
        const totalWidth = ctx.measureText(text).width;
        if (totalWidth > width - 100) {
            const scale = (width - 100) / totalWidth;
            ctx.scale(scale, scale);
            
            
            
            ctx.font = 'bold 40px sans-serif';
            
            currentX = width / 2 - (ctx.measureText(text).width / 2);
        }

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charWidth = ctx.measureText(char).width;

            
            const offsetX = (Math.random() - 0.5) * 5;
            const offsetY = (Math.random() - 0.5) * 5;
            const angle = (Math.random() - 0.5) * 0.1; 

            ctx.save();
            ctx.translate(currentX + charWidth / 2 + offsetX, centerY + offsetY);
            ctx.rotate(angle);
            ctx.fillText(char, 0, 0);
            ctx.restore();

            currentX += charWidth + 2; 
        }

        
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * height);
            ctx.lineTo(width, Math.random() * height);
            ctx.stroke();
        }

        return new AttachmentBuilder(canvas.toBuffer(), { name: 'vowels_challenge.png' });
    }
}
