import mongoose from "mongoose";

const RAW_MONGODB_URI = process.env.MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };
const cached = globalForMongoose.mongooseCache ?? { conn: null, promise: null };
globalForMongoose.mongooseCache = cached;

function normalizeMongoUri(raw?: string) {
  if (!raw) throw new Error("Missing MONGODB_URI environment variable");

  let uri = raw.trim();

  // Handle common dashboard copy/paste mistakes such as:
  // MONGODB_URI="mongodb+srv://..." or surrounding quotes.
  if (uri.startsWith("MONGODB_URI=")) uri = uri.slice("MONGODB_URI=".length).trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  const embeddedStart = uri.indexOf("mongodb");
  if (embeddedStart > 0) uri = uri.slice(embeddedStart).trim();

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("Invalid MONGODB_URI: value must begin with mongodb:// or mongodb+srv://");
  }

  return uri;
}

export async function connectMongoDB() {
  if (cached.conn) return cached.conn;

  const uri = normalizeMongoUri(RAW_MONGODB_URI);
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { dbName: "mabrig_academic" });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
