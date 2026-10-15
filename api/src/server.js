import dotenv from 'dotenv';
dotenv.config();
import { app } from './app.js';
import { pool } from './config/postgres.js';
import { connectMongo, closeMongo } from './config/mongo.js';
const port=Number(process.env.PORT||5000);
try {
  await pool.query('SELECT 1');
  console.log('PostgreSQL connected');
  await connectMongo();
  
  const server=app.listen(port,()=>console.log(`CareConnect API listening on http://localhost:${port}`));

  const shutdown=async()=>{server.close(async()=>{await pool.end();await closeMongo();process.exit(0);})};

  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
} 
catch(err)
{
  console.error('Startup failed:',err);process.exit(1);
}
