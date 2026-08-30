const { Client, Databases, Query } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const diagnostics = {
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    headers: {
      host: req.headers.host,
      'user-agent': req.headers['user-agent'],
    },
    query: req.query,
    env: {
      hasEndpoint: !!process.env.APPWRITE_ENDPOINT,
      hasProjectId: !!process.env.APPWRITE_PROJECT_ID,
      hasApiKey: !!process.env.APPWRITE_API_KEY,
      hasDatabaseId: !!process.env.APPWRITE_DATABASE_ID,
      hasCollectionId: !!process.env.APPWRITE_COLLECTION_ID,
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasCloudKey: !!process.env.CLOUDINARY_API_KEY,
      hasCloudSecret: !!process.env.CLOUDINARY_API_SECRET,
      customDomain: process.env.CUSTOM_DOMAIN || 'not set',
    }
  };

  // Try to fetch a test document
  try {
    if (DATABASE_ID && COLLECTION_ID) {
      const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [Query.limit(1)]);
      diagnostics.appwriteConnection = 'OK';
      diagnostics.documentCount = result.total;
    } else {
      diagnostics.appwriteConnection = 'SKIPPED - missing DB or Collection ID';
    }
  } catch (error) {
    diagnostics.appwriteConnection = 'FAILED';
    diagnostics.appwriteError = error.message;
  }

  res.status(200).json(diagnostics);
};
