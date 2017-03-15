const path = require('path');

const nconf = require('nconf');
const WebSocketClient = require('uws');

const { error, warn, log } = require('steno').default.initSteno('zandbak-service');
const zandbak = require('zandbak');
const createPhoenix = require('phoenix');
const { parseMessage, arnaux, protocol: { stateService, sandboxService } } = require('message-factory');

const MESSAGE_NAME = sandboxService.MESSAGE_NAME;

/*
 * Example: export remote_uri='ws://localhost:9999/' && node ./app/zandbak-service.js
 */
nconf.argv().env({ separator: '_' }).file(path.resolve(__dirname, './config.json'));

log('ws connection to', nconf.get('remote:uri'));
log('zandbak sand', nconf.get('zandbakConfig:sand'));

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
        log('phoenix is alive');
        phoenix.send(arnaux.checkin(nconf.get('remote:indentity')));
    })
    .on('disconnected', () => {
        error('phoenix disconnected');
    })
    .on('message', (incomingMessage) => {
        const { message } = parseMessage(incomingMessage.data);

        switch (message.name) {
            case MESSAGE_NAME.sandboxSet:
                const filler = {
                    content: message.input,
                    options: {
                        reloadWorkers: message.settings.reloadWorkers,
                        refillWorkers: message.settings.refillWorkers,
                        taskTimeoutMs: message.settings.timeout,
                    }
                };
                return sandbox.resetWith(filler);
            case MESSAGE_NAME.sandboxReset:
                return sandbox.resetWith(null);
            case MESSAGE_NAME.solutionEvaluate:
                return sandbox.exec({ taskId: message.taskId, input: message.solution });
            case MESSAGE_NAME.destroy:
                return destroy();
            default:
                return warn('unknown message from sw server');
        }
    });

sandbox.on('solved', (task, error, result) => {
    const response = stateService.solutionEvaluated(task.taskId, result, error);

    phoenix.send(response);
});
