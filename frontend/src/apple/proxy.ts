// Simple proxy configuration for Apple requests
// Use a residential proxy to avoid Apple's datacenter IP blocking

let proxyUrl: string | null = null;

export function setProxy(url: string | null) {
  proxyUrl = url;
}

export function getProxy(): string | null {
  // Check environment variable first
  if (typeof process !== 'undefined' && process.env?.APPLE_PROXY) {
    return process.env.APPLE_PROXY;
  }
  // Check localStorage
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('apple-proxy') || proxyUrl;
  }
  return proxyUrl;
}

export function saveProxy(url: string | null) {
  if (typeof localStorage !== 'undefined') {
    if (url) {
      localStorage.setItem('apple-proxy', url);
    } else {
      localStorage.removeItem('apple-proxy');
    }
  }
  proxyUrl = url;
}
