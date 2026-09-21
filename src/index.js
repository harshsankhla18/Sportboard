import express from 'express';
import {matchRouter} from "./routes/matches.routes.js";
import http from "http";
import {attachWebSocketServer} from "./ws/server.js";

const app = express();

const PORT  = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
const server = http.createServer(app);


const {broadcastMatchCreated} = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Sportboard server!' });
});
app.use('/matches', matchRouter);


server.listen(PORT, HOST, () => {
  const baseURL = (HOST === '0.0.0.0') ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server is running on ${baseURL}`);
  console.log(`Web Socket Server is running on ${baseURL.replace('http','ws')}/ws`);
});
