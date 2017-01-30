const WebSocketClient = require('uws');

const zandbak = require('zandbak');
const createPhoenix = require('phoenix');

const { createMessage, parseMessage } = require('message-factory');

const { wsServerConfig, zandbakConfig } = require('./config');


console.log('[zandbak-service]', 'ws connection to', wsServerConfig.uri);
console.log('[zandbak-service]', 'zandbak sand', zandbakConfig.sand);

const phoenix = createPhoenix(WebSocketClient, { uri: wsServerConfig.uri, timeout: 500 });
const sandbox = zandbak({
    zandbakOptions: {
        workersCount: zandbakConfig.workersCount,
        maxWorkersCount: zandbakConfig.maxWorkersCount,
        logs: '-error,-warn,-log,+perf',
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: zandbakConfig.sand,
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
    })
    .on('disconnected', () => {
        console.error('[zandbak-service]', 'phoenix disconnected');
    })
    .on('message', (message) => {
        const { type, payload } = parseMessage(message.data, true);

        switch (type) {
            case 'resetWith':
                return sandbox.resetWith(payload);
            case 'exec':
                return sandbox.exec(payload);
            case 'destroy':
                return destroy();
            default:
                return console.warn('[zandbak-service]', 'unknown message from sw server');
        }
    });

sandbox.on('solved', (task, error, result) => {
    const response = createMessage('state-service', 'solution', { task, error, result });

    phoenix.send(response);
});
