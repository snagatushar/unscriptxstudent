import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'public', 'events');
const hookPath = path.join(process.cwd(), 'src', 'hooks', 'useAwsData.ts');

async function compressImages() {
    const files = fs.readdirSync(eventsDir);
    let hookContent = fs.readFileSync(hookPath, 'utf8');

    for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
            const inputPath = path.join(eventsDir, file);
            const newFile = file.replace(/\.[^/.]+$/, ".webp");
            const outputPath = path.join(eventsDir, newFile);
            
            try {
                await sharp(inputPath)
                    .resize({ width: 600 })
                    .webp({ quality: 75 })
                    .toFile(outputPath);
                
                // Delete original big file
                fs.unlinkSync(inputPath);
                
                // Update hook
                hookContent = hookContent.replaceAll(`/events/${file}`, `/events/${newFile}`);
                console.log(`✅ Compressed ${file} -> ${newFile}`);
            } catch (err) {
                console.error(`❌ Failed to compress ${file}:`, err);
            }
        }
    }

    fs.writeFileSync(hookPath, hookContent, 'utf8');
    console.log("All images compressed and useAwsData.ts updated successfully!");
}

compressImages();
