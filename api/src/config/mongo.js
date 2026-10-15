import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
let db;

export async function connectMongo() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.MONGO_DATABASE || 'medical_db');
    console.log('MongoDB connected');
  }
  return db;
}

export function getMongoDb() {
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

export async function closeMongo() {
  await client.close();
}
