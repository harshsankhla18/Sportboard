import {WebSocket, WebSocketServer} from 'ws';
import {wsArcjet} from "../arcjet.js";
// import arcjet from "@arcjet/node";
const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if(!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    for(const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function sendJson(socket, payload) {
    if(socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}
function broadcastToAll(wss,payload) {
    for(const client of wss.clients) {
        if(client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload));
    }
}
function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for(const client of subscribers) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}
function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
    }

    if(message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
        return;
    }

    if(message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    }
}
export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });

    wss.on('connection', async (socket,req,res) => {
        if(wsArcjet){
            try{
                const decision = await wsArcjet.protect(req);
                
                if (decision.isErrored()){
                    console.error('Arcjet returned ERROR conclusion');
                    return res.status(503).json({
                        error: 'Service Unavailable'
                    });
                }

                if(decision.isDenied() === true){
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit() ? 'Rate limit reached' : 'Access Denied';
                    socket.close(code, reason);
                    return;
                }
            }catch (e) {
                    console.error('WS Connection Error : ', e);
                    socket.close(1011, 'Server Security Error');
            }
        }
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });
        sendJson(socket, {type : "welcome"});
        socket.on('error', console.error);
    });
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if(ws.isAlive == false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        })
    },30000);
    const clearLivenessInterval = () => clearInterval(interval);
    wss.on('close', clearLivenessInterval);
    server.on('close', clearLivenessInterval);
    function broadcastMatchCreated(match){
     broadcastToAll(wss, {type:"match_created",data:match});
    }
    return {broadcastMatchCreated};
}