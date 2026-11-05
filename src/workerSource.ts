import rawWorkerSource from '../worker.js?raw';

export const WORKER_JS_SOURCE: string = rawWorkerSource;

export function buildWranglerToml(config: {
  botToken: string;
  ownerId: string;
  supportUsername: string;
  forceChannel: string;
}) {
  return `name = "zenox-telegram-worker"
main = "worker.js"
compatibility_date = "2025-02-01"

# Bind Cloudflare KV Namespace as env.DB
[[kv_namespaces]]
binding = "DB"
id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"

[vars]
BOT_TOKEN = "${config.botToken}"
OWNER_ID = "${config.ownerId}"
SUPPORT_USERNAME = "${config.supportUsername}"
FORCE_CHANNEL = "${config.forceChannel}"
`;
}
