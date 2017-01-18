const WebSocketClient = require('uws');

const zandbak = require('zandbak');

const { wsServerConfig, zandbakConfig } = require('./config');


console.log('[zandbak-service]', 'ws connection to', wsServerConfig.uri);
console.log('[zandbak-service]', 'zandbak sand', zandbakConfig.sand);

const wsClient = new WebSocketClient(wsServerConfig.uri);
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
    wsClient.close();
    sandbox.destroy();
}

wsClient
    .on('open', () => {
        console.log('[zandbak-service]', 'ws connection is opened');
    })
    .on('error', () => {
        // TODO: why there is no error as a parameter???
        console.error('[zandbak-service]', 'ws error');
    })
    .on('message', (message) => {
        const { type, payload } = message;

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
    // TODO: EPIPE, mother fucker!
    wsClient.send({ task, error, result });
});
