import { MongoMemoryServer } from 'mongodb-memory-server';

async function start() {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  
  // Dummy env vars to prevent crashes
  process.env.CLOUDINARY_CLOUD_NAME = 'dummy';
  process.env.CLOUDINARY_API_KEY = 'dummy';
  process.env.CLOUDINARY_API_SECRET = 'dummy';
  process.env.GROQ_API_KEY = 'dummy';

  console.log('✅ Started isolated local mongodb-memory-server for development at', process.env.MONGO_URI);
  
  await import('./server.js');
}

start().catch(console.error);

