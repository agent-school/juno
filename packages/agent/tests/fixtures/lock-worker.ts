import { RunStore } from '../../src/store.js';
const store = new RunStore(process.argv[2]!);
const release = store.acquire();
process.on('message', message => { if (message === 'release') { release(); store.close(); process.disconnect?.(); } });
process.send?.('locked');
