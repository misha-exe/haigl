const cloudinary = require('cloudinary').v2;
const { Client, Databases, ID } = require('node-appwrite');

function validateEnv() {
  const required = [
    'APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY',
    'APPWRITE_DATABASE_ID', 'APPWRITE_COLLECTION_ID',
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    validateEnv();
  } catch (envError) {
    console.error('ENV ERROR:', envError.message);
    return res.status(500).json({ error: envError.message });
  }

  try {
    const { videoBase64, headline, description, websiteUrl, postText, userId, destination, mediaType, creativeType } = req.body;

    if (!videoBase64) {
      return res.status(400).json({ error: 'No video provided' });
    }

    if (!videoBase64.startsWith('data:video/')) {
      return res.status(400).json({ error: 'Invalid video format. Must be base64 data URI.' });
    }

    console.log('Starting Cloudinary upload...');
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(videoBase64, {
        resource_type: 'video',
        folder: 'bunnyhub/videos',
        eager: [
          {
            quality: 'auto:good',
            bit_rate: '2m',
            format: 'mp4',
            video_codec: 'h264'
          },
          {
            width: 1200,
            height: 628,
            crop: 'fill',
            gravity: 'auto',
            format: 'jpg',
            quality: 'auto:good',
            secure: true
          }
        ],
        eager_async: false
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    console.log('Cloudinary upload success:', uploadResult.public_id);

    const videoUrl = uploadResult.secure_url;
    const publicId = uploadResult.public_id;

    const thumbnailUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      width: 1200,
      height: 628,
      crop: 'fill',
      gravity: 'auto',
      format: 'jpg',
      quality: 'auto:good'
    });

    const shortId = generateShortId();

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

    console.log('Saving to Appwrite:', shortId);
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      docData,
      []
    );

    console.log('Appwrite save success:', doc.$id);

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
    console.error('Upload error:', error.message, error.stack);
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
