const WebSocketServer = require('uws').Server;

const { createMessage } = require('message-factory');

const wss = new WebSocketServer({ port: 8888 });


wss.on('connection', (ws) => {
    console.log('ws client connected');

    ws.on('message', (data) => {
        console.log(data);
    });

    const message = createMessage('sandbox-service', {
        name: 'sandbox.set',
        input: [
            { name: 'Johnie', surname: 'Walker', age: 14 },
            { name: 'Johnie', surname: 'Walker', age: 20 },
            { name: 'Adam', surname: 'Smith', age: 99 },
        ],
        settings: {
            reloadWorkers: false,
            refillWorkers: false,
            timeout: 500,
        }
    });
    ws.send(message);

    setTimeout(() => {
        const message = createMessage('sandbox-service', {
            name: 'solution.evaluate',
            solution: 'map((i) => i.age)',
            taskId: 'task-0',
        });
        ws.send(message);
    }, 4000);
    setTimeout(() => {
        const message = createMessage('sandbox-service', {
            name: 'sandbox.reset',
        });
        ws.send(message);
    }, 5000);
    setTimeout(() => {
        const message = createMessage('sandbox-service', {
            name: 'destroy',
        });
        ws.send(message);
    }, 6000);
});
