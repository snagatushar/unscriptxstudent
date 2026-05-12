import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const hookPath = path.join(process.cwd(), 'src', 'hooks', 'useAwsData.ts');
const publicEventsDir = path.join(process.cwd(), 'public', 'events');

if (!fs.existsSync(publicEventsDir)) {
    fs.mkdirSync(publicEventsDir, { recursive: true });
}

let fileContent = fs.readFileSync(hookPath, 'utf8');

// Regex to find image_url with /api/storage-hub
const regex = /"image_url":\s*"\/api\/storage-hub\?action=view&key=events%2F([^"]+)"/g;

let match;
const downloads = [];

while ((match = regex.exec(fileContent)) !== null) {
    const originalUrl = match[0];
    const encodedFilename = match[1];
    const decodedFilename = decodeURIComponent(encodedFilename);
    // Sanitize filename for local OS
    const localFilename = decodedFilename.replace(/[^a-zA-Z0-9.\- ]/g, '_');
    
    // Construct production URL to download
    const downloadUrl = `https://unscriptx.com/api/storage-hub?action=view&key=events%2F${encodedFilename}`;
    const localPath = path.join(publicEventsDir, localFilename);
    const newImageUrl = `/events/${localFilename}`;

    downloads.push({ originalUrl, downloadUrl, localPath, newImageUrl });
}

async function downloadImage(url, dest) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
}

async function processDownloads() {
    console.log(`Found ${downloads.length} images to download...`);
    for (const item of downloads) {
        console.log(`Downloading ${item.newImageUrl}...`);
        try {
            await downloadImage(item.downloadUrl, item.localPath);
            // Replace in file content
            fileContent = fileContent.replace(
                item.originalUrl,
                `"image_url": "${item.newImageUrl}"`
            );
        } catch (err) {
            console.error(`Failed to download ${item.downloadUrl}`, err);
        }
    }

    fs.writeFileSync(hookPath, fileContent, 'utf8');
    console.log("✅ All images downloaded and useAwsData.ts updated with local hardcoded paths!");
}

processDownloads();
