import {WebSocket, WebSocketServer} from 'ws';
import {wsArcjet} from "../arcjet.js";
import arcjet from "@arcjet/node";

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

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });

    wss.on('connection', async (socket,req) => {
        if(wsArcjet){
            try{
                const decision = await wsArcjet.protect(req);
                if(decision.isDenied() == true){
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