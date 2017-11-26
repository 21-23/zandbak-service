const path = require('path');

const nconf = require('nconf');
const WebSocketClient = require('uws');

const { error, warn, log } = require('steno').initSteno('zandbak-service', 'all');
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

// TODO: parametrize validators
function getValidators(sand) {
    if (sand === 'css') {
        return [
            { name: 'banned-chars' },
        ];
    }

    return [
        { name: 'esprima' },
    ];
}

const phoenix = createPhoenix(WebSocketClient, { uri: nconf.get('remote:uri'), timeout: 500 });
const sandbox = zandbak({
    logLevel: nconf.get('logLevel'),
    validators: getValidators(nconf.get('zandbakConfig:sand')),
    workers: {
        count: nconf.get('zandbakConfig:workersCount'),
        options: {
            subworkersCount: nconf.get('zandbakConfig:subworkersCount'),
        }
    },
}, {
    type: nconf.get('zandbakConfig:backend'),
    options: {
        sand: nconf.get('zandbakConfig:sand'),
        logLevel: nconf.get('logLevel'),
        browserWindow: { show: false },
        showDevTools: false,
        urlOptions: { userAgent: '_qd-ua' },
    }
});

function destroy() {
    phoenix.destroy();
    sandbox.destroy();
}

phoenix
    .on('connected', () => {
        log('phoenix is alive');
        phoenix.send(arnaux.checkin(nconf.get('remote:identity')));
        phoenix.send(stateService.sandboxConnected());
    })
    .on('disconnected', () => {
        error('phoenix disconnected');
    })
    .on('message', (incomingMessage) => {
        const { message } = parseMessage(incomingMessage.data);

        switch (message.name) {
            case MESSAGE_NAME.sandboxSet:
                return sandbox.resetWith({
                    content: {
                        input: message.input,
                        expected: message.expected,
                        hidden: message.hidden,
                    },
                    options: {
                        sandbox: {
                            reloadWorkers: !!message.sandboxSettings.reloadWorkers,
                            refillWorkers: !!message.sandboxSettings.refillWorkers,
                            taskTimeoutMs: message.sandboxSettings.timeout,
                            inputCopies: message.sandboxSettings.inputCopies,
                        },
                        filler: message.puzzleOptions,
                    }
                });
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
    .on('solved', ({ task, error, result, correct }) => {
        const response = stateService.solutionEvaluated(task.taskId, result, error, correct);

        phoenix.send(response);
    })
    .on('error', (err) => {
        error('Got an error from sandbox', err);
        error('Restarting...');

        destroy();
    });
