const { Client, Databases, Query } = require('node-appwrite');

// ─── Appwrite Server SDK Setup ───
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

module.exports = async (req, res) => {
  const { shortId } = req.query;

  if (!shortId) {
    res.status(400).send('Missing short ID');
    return;
  }

  try {
    const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal('shortId', shortId)
    ]);

    if (result.total === 0) {
      res.status(404).send('Link not found');
      return;
    }

    const doc = result.documents[0];
    const { headline, videoUrl, thumbnailUrl, websiteUrl } = doc;

    // Embed page - served in Twitter iframe when user clicks play
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline || 'Bunnyhub Video')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .video-container { width: 100%; max-width: 480px; position: relative; }
    video { width: 100%; height: auto; display: block; border-radius: 12px; }
    .click-overlay {
      position: absolute; bottom: 0; left: 0; right: 0; height: 60%;
      cursor: pointer; z-index: 10;
    }
    .cta-banner {
      position: absolute; bottom: 12px; left: 12px; right: 12px;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      color: #fff; padding: 10px 14px; border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px; display: flex; align-items: center; justify-content: space-between;
      z-index: 5; pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="video-container">
    <video
      id="player"
      poster="${thumbnailUrl || ''}"
      controls
      autoplay
      muted
      playsinline
      style="width:100%;"
    >
      <source src="${videoUrl}" type="video/mp4">
    </video>
    <!-- Click area below play button redirects to website URL -->
    <a href="${websiteUrl || '#'}" target="_blank" class="click-overlay" title="Visit website"></a>
    <div class="cta-banner">
      <span>🔗 ${escapeHtml(websiteUrl || 'bunnyhub.cc')}</span>
      <span style="opacity:0.7;font-size:11px;">Tap below to visit</span>
    </div>
  </div>
  <script>
    // Ensure video plays when loaded in iframe
    const vid = document.getElementById('player');
    vid.play().catch(() => {});
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Allow embedding in Twitter/X iframe
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://twitter.com https://x.com https://t.co');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://twitter.com https://x.com https://t.co;");
    res.status(200).send(html);

  } catch (error) {
    console.error('Embed handler error:', error);
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
