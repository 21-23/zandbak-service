const path = require('path');

const nconf = require('nconf');
const WebSocketClient = require('uws');

const zandbak = require('zandbak');
const createPhoenix = require('phoenix');
const { createMessage, parseMessage, arnaux } = require('message-factory');

/*
 * Example: export remote_uri='ws://localhost:9999/' && node ./app/zandbak-service.js
 */
nconf.argv().env({ separator: '_' }).file(path.resolve(__dirname, './config.json'));

console.log('[zandbak-service]', 'ws connection to', nconf.get('remote:uri'));
console.log('[zandbak-service]', 'zandbak sand', nconf.get('zandbakConfig:sand'));

const phoenix = createPhoenix(WebSocketClient, { uri: nconf.get('remote:uri'), timeout: 500 });
const sandbox = zandbak({
    zandbakOptions: {
        workersCount: nconf.get('zandbakConfig:workersCount'),
        maxWorkersCount: nconf.get('zandbakConfig:maxWorkersCount'),
        logs: '-error,-warn,-log,+perf',
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: nconf.get('zandbakConfig:sand'),
        logs: '-error,-warn,-log',
    }
});

function destroy() {
    phoenix.destroy();
    sandbox.destroy();
}

phoenix
    .on('connected', () => {
        console.log('[zandbak-service]', 'phoenix is alive');
        phoenix.send(arnaux.checkin(nconf.get('remote:indentity')));
    })
    .on('disconnected', () => {
        console.error('[zandbak-service]', 'phoenix disconnected');
    })
    .on('message', (incomingMessage) => {
        const { message } = parseMessage(incomingMessage.data);

        switch (message.name) {
            case 'resetWith':
                return sandbox.resetWith(message.filler);
            case 'solution.evaluate':
                return sandbox.exec({ taskId: message.taskId, input: message.solution });
            case 'destroy':
                return destroy();
            default:
                return console.warn('[zandbak-service]', 'unknown message from sw server');
        }
    });

sandbox.on('solved', (task, error, result) => {
    const response = createMessage('state-service', { name: 'solution.evaluated', taskId: task.taskId, error, result });

    phoenix.send(response);
});
