import fs from "node:fs/promises";
import sharp from "sharp";

const source = "public/publiclogo.jpg";
await fs.mkdir("public/icons", { recursive: true });

// Optimized brand crop used throughout the UI.
await sharp(source)
  .resize(1024, 1024)
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile("public/logo.jpg");

await sharp(source)
  .resize(512, 512)
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile("public/logo-512.jpg");

// PWA icons
for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`public/icons/icon-${size}.png`);
}

// Maskable icon: logo inset inside an abyss field.
const maskableLogo = await sharp(source).resize(410, 410).toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: "#050B14",
  },
})
  .composite([{ input: maskableLogo, gravity: "center" }])
  .png()
  .toFile("public/icons/maskable-512.png");

await sharp(source)
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");

await sharp(source).resize(64, 64).png().toFile("src/app/icon.png");
await sharp(source).resize(180, 180).png().toFile("src/app/apple-icon.png");

// Open Graph card (1200 x 630)
const ogLogo = await sharp(source).resize(340, 340).toBuffer();
const ogSvg = Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="18%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#0D6EFD" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#0D6EFD" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#050B14" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#081426"/>
      <stop offset="100%" stop-color="#050B14"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#050B14"/>
  <rect width="1200" height="630" fill="url(#field)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g opacity="0.16" stroke="#FFFFFF">
    ${Array.from({ length: 18 }, (_, i) => `<line x1="${-80 + i * 76}" y1="630" x2="${210 + i * 76}" y2="0" stroke-width="1"/>`).join("")}
  </g>
  <text x="470" y="248" font-family="Georgia, 'Times New Roman', serif" font-size="86" fill="#F8FAFC">Leo Academy</text>
  <text x="472" y="310" font-family="Helvetica, Arial, sans-serif" font-size="21" letter-spacing="7" fill="#38BDF8">PIANO · TEORÍA · ARMONÍA</text>
  <text x="472" y="392" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" fill="#8FA6C4">El sendero del zafiro</text>
  <text x="472" y="530" font-family="Helvetica, Arial, sans-serif" font-size="16" letter-spacing="3" fill="#5D7492">ACADEMIA DE MÚSICA · PWA OFFLINE</text>
  <rect x="470" y="560" width="120" height="2" fill="#0D6EFD"/>
</svg>`);

await sharp(ogSvg)
  .composite([{ input: ogLogo, left: 90, top: 145 }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile("public/og.jpg");

console.log("Leo Academy brand assets generated.");
