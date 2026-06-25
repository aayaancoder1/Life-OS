import { processPendingCaptures } from './modules/processing/processor.js';
import dotenv from 'dotenv';
dotenv.config();
const POLL_INTERVAL_MS = 5000; // 5 seconds
let isRunning = false;
async function runWorkerLoop() {
    if (isRunning)
        return;
    isRunning = true;
    try {
        const processed = await processPendingCaptures();
        if (processed > 0) {
            console.log(`Worker processed ${processed} capture(s).`);
        }
    }
    catch (err) {
        console.error('Error in worker processing loop:', err);
    }
    finally {
        isRunning = false;
    }
}
console.log('Student OS Background Processing Worker started.');
console.log(`Polling intervals: ${POLL_INTERVAL_MS}ms`);
// Run immediately on start, then intervals
runWorkerLoop();
setInterval(runWorkerLoop, POLL_INTERVAL_MS);
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Gracefully shutting down worker...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Gracefully shutting down worker...');
    process.exit(0);
});
