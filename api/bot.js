const { Client, Databases, Query } = require('node-appwrite');

// ─── Appwrite Server SDK Setup ───
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

// ─── Twitter Bot Detection ───
function isTwitterBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ua.includes('twitterbot') || ua.includes('twitterbot/1.0') || ua.includes('twitterbot/0.1');
}

// ─── Helper: Get Base Domain ───
function getBaseDomain(req) {
  const host = req.headers.host || '';
  return process.env.CUSTOM_DOMAIN
    ? `https://${process.env.CUSTOM_DOMAIN}`
    : `https://${host}`;
}

// ─── Main Handler ───
module.exports = async (req, res) => {
  // Vercel passes route params via req.query when using file-based routing
  // But with rewrites, the param might be in the URL path
  // We need to extract shortId from the path since vercel.json rewrites /v/:shortId

  let shortId = req.query.shortId;

  // If not in query, extract from URL path (e.g., /v/abc123 or /api/bot?shortId=abc123)
  if (!shortId && req.url) {
    const match = req.url.match(/\/v\/([a-zA-Z0-9_-]+)/);
    if (match) shortId = match[1];
  }

  const userAgent = req.headers['user-agent'] || '';
  const baseDomain = getBaseDomain(req);

  // ─── VALIDATE ENV VARS ───
  if (!DATABASE_ID || !COLLECTION_ID) {
    console.error('Missing env vars: DATABASE_ID or COLLECTION_ID');
    return res.status(500).send('Server configuration error');
  }

  if (!shortId) {
    console.error('Missing shortId. URL:', req.url, 'Query:', JSON.stringify(req.query));
    return res.status(400).send('Missing short ID');
  }

  try {
    // Fetch the link data from Appwrite
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal('shortId', shortId)
    ]);

    if (result.total === 0) {
      console.error('Link not found:', shortId);
      return res.status(404).send('Link not found');
    }

    const doc = result.documents[0];
    const { headline, description, websiteUrl, videoUrl, thumbnailUrl, creativeType } = doc;

    // ─── TWITTER BOT: Serve meta tags ───
    if (isTwitterBot(userAgent)) {
      const playerUrl = `${baseDomain}/embed/${shortId}`;
      const cardTitle = headline || 'Bunnyhub Video';
      const cardDesc = description || 'Watch this video on Bunnyhub';
      const posterImage = thumbnailUrl || `${baseDomain}/assets/default-poster.jpg`;

      // Player Card meta tags for Twitter
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(cardTitle)}</title>

  <!-- Twitter Player Card Meta Tags -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:site" content="@bunnyhub">
  <meta name="twitter:title" content="${escapeHtml(cardTitle)}">
  <meta name="twitter:description" content="${escapeHtml(cardDesc)}">
  <meta name="twitter:image" content="${posterImage}">
  <meta name="twitter:image:alt" content="${escapeHtml(cardTitle)}">
  <meta name="twitter:player" content="${playerUrl}">
  <meta name="twitter:player:width" content="480">
  <meta name="twitter:player:height" content="854">
  <meta name="twitter:player:stream" content="${videoUrl}">
  <meta name="twitter:player:stream:content_type" content="video/mp4">

  <!-- OpenGraph Fallback -->
  <meta property="og:title" content="${escapeHtml(cardTitle)}">
  <meta property="og:description" content="${escapeHtml(cardDesc)}">
  <meta property="og:image" content="${posterImage}">
  <meta property="og:type" content="video.other">
  <meta property="og:video" content="${videoUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="480">
  <meta property="og:video:height" content="854">

  <style>body{margin:0;background:#000;}</style>
</head>
<body>
  <video poster="${posterImage}" style="width:100%;height:100%;object-fit:cover;" controls autoplay muted playsinline>
    <source src="${videoUrl}" type="video/mp4">
  </video>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
      return;
    }

    // ─── HUMAN: Redirect to website URL ───
    res.writeHead(302, { Location: websiteUrl || baseDomain });
    res.end();

  } catch (error) {
    console.error('Bot handler error:', error.message, error.stack);
    res.status(500).send('Internal Server Error');
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
