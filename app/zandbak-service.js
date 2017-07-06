const path = require('path');

const nconf = require('nconf');
const WebSocketClient = require('uws');

const { error, warn, log } = require('steno').initSteno('zandbak-service');
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
        workerOptions: {
            subworkersCount: nconf.get('zandbakConfig:subworkersCount'),
        },
        logs: '-error,+perf',
        validators: [
            { name: 'esprima' }
        ],
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: {
            width: 400,
            height: 400,
            show: false,
            webPreferences: {
                devTools: false,
                webgl: false,
                webaudio: false,
            }
        },
        urlOptions: { userAgent: '_qd-ua' },
        sand: nconf.get('zandbakConfig:sand'),
        logs: '-error,+perf',
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
        // TODO: send hello to state service
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

sandbox
    .on('solved', (task, error, result) => {
        const response = stateService.solutionEvaluated(task.taskId, result, error);

        phoenix.send(response);
    })
    .on('error', (err) => {
        error('Got an error from sandbox', err);
        error('Restarting...');

        destroy();
    });
