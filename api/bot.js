const { Client, Databases, Query } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

function isTwitterBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ua.includes('twitterbot') || ua.includes('twitterbot/1.0') || ua.includes('twitterbot/0.1');
}

function getBaseDomain(req) {
  const host = req.headers.host || '';
  return process.env.CUSTOM_DOMAIN ? `https://${process.env.CUSTOM_DOMAIN}` : `https://${host}`;
}

module.exports = async (req, res) => {
  let shortId = req.query.shortId;
  if (!shortId && req.url) {
    const match = req.url.match(/\/v\/([a-zA-Z0-9_-]+)/);
    if (match) shortId = match[1];
  }

  const userAgent = req.headers['user-agent'] || '';
  const baseDomain = getBaseDomain(req);

  // ALWAYS set Content-Type first
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!DATABASE_ID || !COLLECTION_ID) {
    return res.status(500).send('<!DOCTYPE html><html><head><title>Error</title></head><body>Config error</body></html>');
  }

  if (!shortId) {
    return res.status(400).send('<!DOCTYPE html><html><head><title>Error</title></head><body>Missing ID</body></html>');
  }

  try {
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.equal('shortId', shortId)]);

    if (result.total === 0) {
      return res.status(404).send('<!DOCTYPE html><html><head><title>Not Found</title></head><body>Link not found</body></html>');
    }

    const doc = result.documents[0];
    const { headline, description, websiteUrl, videoUrl, thumbnailUrl } = doc;

    const cardTitle = headline || 'Bunnyhub Video';
    const cardDesc = description || 'Watch this video on Bunnyhub';
    const posterImage = thumbnailUrl || `${baseDomain}/assets/default-poster.jpg`;
    const playerUrl = `${baseDomain}/embed/${shortId}`;

    // ─── TWITTER BOT: Serve full meta tags ───
    if (isTwitterBot(userAgent)) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(cardTitle)}</title>
  <meta name="description" content="${escapeHtml(cardDesc)}">
  
  <!-- Twitter Player Card -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:site" content="@bunnyhub">
  <meta name="twitter:creator" content="@bunnyhub">
  <meta name="twitter:title" content="${escapeHtml(cardTitle)}">
  <meta name="twitter:description" content="${escapeHtml(cardDesc)}">
  <meta name="twitter:image" content="${posterImage}">
  <meta name="twitter:image:alt" content="${escapeHtml(cardTitle)}">
  <meta name="twitter:image:width" content="1200">
  <meta name="twitter:image:height" content="628">
  <meta name="twitter:player" content="${playerUrl}">
  <meta name="twitter:player:width" content="480">
  <meta name="twitter:player:height" content="854">
  <meta name="twitter:player:stream" content="${videoUrl}">
  <meta name="twitter:player:stream:content_type" content="video/mp4">
  
  <!-- OpenGraph -->
  <meta property="og:site_name" content="Bunnyhub">
  <meta property="og:title" content="${escapeHtml(cardTitle)}">
  <meta property="og:description" content="${escapeHtml(cardDesc)}">
  <meta property="og:image" content="${posterImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="628">
  <meta property="og:image:alt" content="${escapeHtml(cardTitle)}">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${baseDomain}/v/${shortId}">
  <meta property="og:video" content="${videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="480">
  <meta property="og:video:height" content="854">
  <meta property="og:video:secure_url" content="${videoUrl}">
  
  <style>body{margin:0;background:#000;}</style>
</head>
<body>
  <video poster="${posterImage}" style="width:100%;height:100vh;object-fit:contain;" controls autoplay muted playsinline>
    <source src="${videoUrl}" type="video/mp4">
  </video>
</body>
</html>`;

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(html);
    }

    // ─── HUMAN: 302 redirect ───
    res.writeHead(302, { 'Location': websiteUrl || baseDomain });
    res.end();

  } catch (error) {
    console.error('Bot handler error:', error);
    res.status(500).send('<!DOCTYPE html><html><head><title>Error</title></head><body>Server Error</body></html>');
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
