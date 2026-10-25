import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import express from 'express';
import {matchRouter} from "./routes/matches.routes.js";
import http from "http";
import {attachWebSocketServer} from "./ws/server.js";
import {securityMiddleware} from "./arcjet.js";

const app = express();

const PORT  = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// CORS — allow all origins so the frontend can reach the API from any host
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sportboard API",
      version: "1.0.0",
      description: "API documentation for Sportboard",
    },
    servers: [
      { url: "https://sportboard.onrender.com" },
    ],
  },
  apis: ["./src/routes/*.js"],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// app.use(securityMiddleware())
const server = http.createServer(app);


const {
  broadcastMatchCreated,
  broadcastMatchScoreUpdated,
  broadcastCommentary,
} = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastMatchScoreUpdated = broadcastMatchScoreUpdated;
app.locals.broadcastCommentary = broadcastCommentary;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Sportboard server!' });
});
app.use('/matches', matchRouter);


server.listen(PORT, HOST, () => {
  const baseURL = (HOST === '0.0.0.0') ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server is running on ${baseURL}`);
  console.log(`Web Socket Server is running on ${baseURL.replace('http','ws')}/ws`);
});
