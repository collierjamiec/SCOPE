import { config } from '../../config/index.js';
import { startWebServer } from '../../web/server.js';

export function runServe(): void {
  startWebServer(config);
}
