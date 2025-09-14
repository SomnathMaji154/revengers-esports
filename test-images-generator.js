const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Create test images directory
const testImagesDir = path.join(__dirname, 'test-images');
if (!fs.existsSync(testImagesDir)) {
    fs.mkdirSync(testImagesDir);
}

// Generate random color
function getRandomColor() {
    return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
    };
}

// Generate random gradient
function generateRandomGradient(width, height) {
    const color1 = getRandomColor();
    const color2 = getRandomColor();
    
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:rgb(${color1.r},${color1.g},${color1.b});stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgb(${color2.r},${color2.g},${color2.b});stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad)" />
            <text x="50%" y="30%" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle" fill="white" stroke="black" stroke-width="1">
                TEST IMAGE
            </text>
            <text x="50%" y="50%" font-family="Arial" font-size="18" text-anchor="middle" fill="white" stroke="black" stroke-width="1">
                ${width}x${height}
            </text>
            <text x="50%" y="70%" font-family="Arial" font-size="16" text-anchor="middle" fill="white" stroke="black" stroke-width="1">
                ID: ${crypto.randomBytes(4).toString('hex').toUpperCase()}
            </text>
        </svg>`;
    
    return Buffer.from(svg);
}

// Generate test images with different dimensions and formats
async function generateTestImages() {
    console.log('Generating test images...');
    
    const imageConfigs = [
        { name: 'player-test-1', width: 800, height: 1200, format: 'jpeg' },
        { name: 'player-test-2', width: 600, height: 900, format: 'png' },
        { name: 'player-test-3', width: 1000, height: 1500, format: 'webp' },
        { name: 'manager-test-1', width: 720, height: 1080, format: 'jpeg' },
        { name: 'manager-test-2', width: 900, height: 1200, format: 'png' },
        { name: 'trophy-test-1', width: 1200, height: 800, format: 'jpeg' },
        { name: 'trophy-test-2', width: 1000, height: 750, format: 'png' },
        { name: 'square-test', width: 800, height: 800, format: 'jpeg' },
        { name: 'wide-test', width: 1600, height: 400, format: 'png' },
        { name: 'tall-test', width: 400, height: 1600, format: 'webp' }
    ];
    
    for (const config of imageConfigs) {
        try {
            const svgBuffer = generateRandomGradient(config.width, config.height);
            const outputPath = path.join(testImagesDir, `${config.name}.${config.format}`);
            
            let sharpInstance = sharp(svgBuffer);
            
            switch (config.format) {
                case 'jpeg':
                    sharpInstance = sharpInstance.jpeg({ quality: 85 });
                    break;
                case 'png':
                    sharpInstance = sharpInstance.png({ quality: 85 });
                    break;
                case 'webp':
                    sharpInstance = sharpInstance.webp({ quality: 85 });
                    break;
            }
            
            await sharpInstance.toFile(outputPath);
            console.log(`✓ Generated: ${config.name}.${config.format} (${config.width}x${config.height})`);
        } catch (error) {
            console.error(`✗ Failed to generate ${config.name}:`, error.message);
        }
    }
    
    console.log('\nTest images generated successfully!');
    console.log(`Location: ${testImagesDir}`);
    console.log('\nYou can now use these images to test the cropping functionality.');
}

// Run the generator
generateTestImages().catch(console.error);