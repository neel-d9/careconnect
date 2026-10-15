import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'}));
app.use(express.json());
app.get('/api/health',(req,res)=>res.json({success:true,status:'ok'}));
app.use('/api',routes);
app.use(notFound);
app.use(errorHandler);
