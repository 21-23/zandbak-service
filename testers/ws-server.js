const WebSocketServer = require('uws').Server;

const { createMessage } = require('message-factory');

const wss = new WebSocketServer({ port: 8081 });


wss.on('connection', (ws) => {
    console.log('ws client connected');

    const message = createMessage('zandback-service', 'test-msg');
    ws.send(message);

    setTimeout(() => {
        const message = createMessage('zandback-service', 'destroy');
        ws.send(message);
    }, 1000);
});
