import "server-only";

import mongoose from "mongoose";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  return uri;
}

const MONGODB_URI = getMongoUri();

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
  if (cached.connection) {
    return cached.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .catch((error: unknown) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}
