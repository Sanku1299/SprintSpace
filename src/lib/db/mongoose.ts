import "server-only";

import mongoose from "mongoose";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  return uri;
}

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = (globalThis.mongooseCache ??= {
  connection: null,
  promise: null,
});

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.connection && mongoose.connection.readyState === 1) {
    return cached.connection;
  }

  if (mongoose.connection.readyState === 0) {
    cached.connection = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const mongoUri = getMongoUri();
    cached.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5_000,
      })
      .catch((error: unknown) => {
        cached.connection = null;
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}

export async function verifyDatabaseConnection(): Promise<boolean> {
  await connectToDatabase();
  return mongoose.connection.readyState === 1;
}
