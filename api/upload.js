const cloudinary = require('cloudinary').v2;
const { Client, Databases, ID } = require('node-appwrite');

// ─── Cloudinary Config ───
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ─── Appwrite Server SDK ───
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

module.exports = async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { videoBase64, headline, description, websiteUrl, postText, userId, destination, mediaType, creativeType } = req.body;

    if (!videoBase64) {
      res.status(400).json({ error: 'No video provided' });
      return;
    }

    // ─── Upload video to Cloudinary with eager thumbnail generation ───
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(videoBase64, {
        resource_type: 'video',
        folder: 'bunnyhub/videos',
        // Eager transformations: generate thumbnail + optimize video
        eager: [
          {
            // Optimized MP4 (H.264) for Twitter
            quality: 'auto:good',
            bit_rate: '2m',
            format: 'mp4',
            video_codec: 'h264'
          },
          {
            // Thumbnail/poster image
            width: 1200,
            height: 628,
            crop: 'fill',
            gravity: 'auto',
            format: 'jpg',
            quality: 'auto:good'
          }
        ],
        eager_async: false // Wait for transformations to complete
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    const videoUrl = uploadResult.secure_url;
    const publicId = uploadResult.public_id;

    // Generate thumbnail URL from the eager transformation
    const thumbnailUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      width: 1200,
      height: 628,
      crop: 'fill',
      gravity: 'auto',
      format: 'jpg',
      quality: 'auto:good'
    });

    // Generate short ID
    const shortId = generateShortId();

    // ─── Save to Appwrite Database ───
    const docData = {
      shortId,
      userId: userId || 'anonymous',
      headline: headline || '',
      description: description || postText || '',
      websiteUrl: websiteUrl || '',
      videoUrl,
      thumbnailUrl,
      publicId,
      destination: destination || 'website',
      mediaType: mediaType || 'single',
      creativeType: creativeType || 'Media',
      createdAt: new Date().toISOString(),
      clicks: 0
    };

    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      docData,
      [] // permissions - adjust as needed
    );

    // Determine base domain for short link
    const host = req.headers.host || '';
    const baseDomain = process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : `https://${host}`;

    const shortLink = `${baseDomain}/v/${shortId}`;

    res.status(200).json({
      success: true,
      shortId,
      shortLink,
      videoUrl,
      thumbnailUrl,
      documentId: doc.$id
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
