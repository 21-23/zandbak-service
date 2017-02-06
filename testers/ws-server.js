const WebSocketServer = require('uws').Server;

const { createMessage } = require('message-factory');

const wss = new WebSocketServer({ port: 8888 });


wss.on('connection', (ws) => {
    console.log('ws client connected');

    const message = createMessage('zandback-service', {
        name: 'resetWith',
        filler: {
            content: [
                { name: 'Johnie', surname: 'Walker', age: 14 },
                { name: 'Johnie', surname: 'Walker', age: 20 },
                { name: 'Adam', surname: 'Smith', age: 99 },
            ],
            options: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
            }
        },
    });
    ws.send(message);

    setTimeout(() => {
        const message = createMessage('zandback-service', {
            name: 'solution.evaluate',
            solution: 'map((i) => i.a',
            taskId: 'task-0',
        });
        ws.send(message);
    }, 5000);
    setTimeout(() => {
        const message = createMessage('zandback-service', 'destroy');
        ws.send(message);
    }, 6000);
});
