import { Server as HttpServer } from "http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { accessPasswordHash, verifyAccessToken } from "../config.js";

// Get proxy URL from environment variable
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.WISP_PROXY || "";

// Dynamic import for proxy agents (only load if proxy is configured)
let proxyAgent: any = undefined;

async function setupProxy() {
  if (!proxyUrl) return;
  
  console.log("[Wisp] Using proxy:", proxyUrl.replace(/:([^:@]*)@/, ':***@'));
  
  try {
    let agentModule: any;
    if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://')) {
      agentModule = await import('socks-proxy-agent');
      proxyAgent = new agentModule.SocksProxyAgent(proxyUrl);
    } else {
      agentModule = await import('https-proxy-agent');
      proxyAgent = new agentModule.HttpsProxyAgent(proxyUrl);
    }
    
    // Patch https module
    const https = await import('https');
    const originalRequest: any = https.request;
    
    https.request = function(options: any, callback?: any) {
      let hostname = typeof options === 'string' 
        ? new URL(options).hostname 
        : options.hostname || options.host;
      
      // Use proxy for Apple domains
      if (hostname && (
        hostname === 'buy.itunes.apple.com' ||
        hostname === 'auth.itunes.apple.com' ||
        hostname === 'init.itunes.apple.com' ||
        /^p\d+-buy\.itunes\.apple\.com$/.test(hostname)
      )) {
        if (typeof options === 'string') {
          const url = new URL(options);
          options = {
            protocol: 'https:',
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: 'GET',
            agent: proxyAgent,
          };
        } else {
          options.agent = proxyAgent;
        }
      }
      
      return originalRequest.call(this, options, callback);
    };
    
    console.log("[Wisp] Proxy agent installed for Apple domains");
  } catch (err) {
    console.error("[Wisp] Failed to setup proxy:", err);
  }
}

// Setup proxy if configured
if (proxyUrl) {
  setupProxy();
}

// Allow only Apple hosts required by bag/auth/purchase/version flows.
wisp.options.hostname_whitelist = [
  /^auth\.itunes\.apple\.com$/,
  /^buy\.itunes\.apple\.com$/,
  /^init\.itunes\.apple\.com$/,
  /^p\d+-buy\.itunes\.apple\.com$/,
];
wisp.options.port_whitelist = [443];
wisp.options.allow_direct_ip = false;
wisp.options.allow_private_ips = true;
wisp.options.allow_loopback_ips = false;

export function setupWsProxy(server: HttpServer) {
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/wisp")) {
      if (accessPasswordHash) {
        const url = new URL(req.url, "http://localhost");
        const token = (url.searchParams.get("token") || "").replace(/\/+$/, "");
        if (!verifyAccessToken(token)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
      }

      wisp.routeRequest(req, socket, head);
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
    }
  });
}
