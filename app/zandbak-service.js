const zandbak = require('zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 2,
        maxWorkersCount: 5,
        logs: '-error,-warn,-log,+perf',
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: 'lodash',
        logs: '-error,-warn,-log',
    }
});

sandbox.resetWith(null);

setTimeout(sandbox.destroy, 2000);
