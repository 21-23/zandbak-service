const { Server } = require('uws');
const { createMessage } = require('message-factory');

const wss = new Server({ port: 8081 });
console.log('[WebSocketServer:8081] Waiting for connections...');

let ZaaS;
let Editor;

const sandboxConfig = {
    content: [
        { name: 'Johnie', surname: 'Walker', age: 14 },
        { name: 'Johnie', surname: 'Walker', age: 20 },
        { name: 'Adam', surname: 'Smith', age: 99 },
        { name: 'Jack', surname: 'Daniels', age: 18 },
    ],
    options: {
        reloadWorkers: false,
        refillWorkers: false,
        taskTimeoutMs: 500,
    }
};

wss.on('connection', (ws) => {
    console.log(`${ws.upgradeReq.url} connected`);

    if (ws.upgradeReq.url.match(/zandbak/)) {
        ZaaS = ws;

        ZaaS.send(createMessage('ZaaS', 'resetWith', sandboxConfig));
        ZaaS.on('message', (message) => {
            console.log(`ZaaS: ${message}`);
            if (Editor) {
                Editor.send(message);
            }
        });
    } else {
        Editor = ws;

        Editor.on('message', (message) => {
            console.log(`Editor: ${message}`);
            if (ZaaS) {
                ZaaS.send(message);
            }
        });
    }
});
