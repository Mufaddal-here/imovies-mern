import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import routes from './routes.js';
import { errorHandler } from './middleware.js';

const app = express(), server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', s => s.on('watch', id => s.join(String(id))));
app.set('io', io);
app.use(cors(), express.json(), morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }), routes);
app.use(errorHandler);
mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(process.env.PORT || 5000, () => console.log('API on :' + (process.env.PORT || 5000))))
  .catch(e => { console.error(e.message); process.exit(1); });
