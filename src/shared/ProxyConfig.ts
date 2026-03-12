/**
 * Proxy Configuration Utility
 * Handles HTTP, HTTPS, and SOCKS proxy configuration
 */

export interface ProxyConfig {
  enabled: boolean;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  bypassHosts?: string[]; // Hosts to bypass proxy
}

export interface ProxyEnvironment {
  [key: string]: string | undefined;
}

/**
 * Create proxy environment variables based on configuration
 */
export function createProxyEnvironment(proxyConfig?: ProxyConfig): ProxyEnvironment {
  const env: ProxyEnvironment = {};
  
  if (!proxyConfig || !proxyConfig.enabled) {
    return env;
  }
  
  const { type, host, port, username, password, bypassHosts } = proxyConfig;
  
  // Build proxy URL
  let proxyUrl = '';
  if (username && password) {
    proxyUrl = `${type}://${username}:${password}@${host}:${port}`;
  } else {
    proxyUrl = `${type}://${host}:${port}`;
  }
  
  // Set proxy environment variables
  switch (type) {
    case 'http':
    case 'https':
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
      env.http_proxy = proxyUrl;
      env.https_proxy = proxyUrl;
      break;
      
    case 'socks4':
    case 'socks5':
      env.SOCKS_PROXY = proxyUrl;
      env.socks_proxy = proxyUrl;
      env.ALL_PROXY = proxyUrl;
      env.all_proxy = proxyUrl;
      
      // Also set HTTP/HTTPS to use SOCKS proxy
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
      env.http_proxy = proxyUrl;
      env.https_proxy = proxyUrl;
      break;
  }
  
  // Set no_proxy for bypass hosts
  if (bypassHosts && bypassHosts.length > 0) {
    const noProxy = bypassHosts.join(',');
    env.NO_PROXY = noProxy;
    env.no_proxy = noProxy;
  }
  
  // Common localhost bypasses
  const defaultBypass = ['localhost', '127.0.0.1', '::1'];
  if (bypassHosts) {
    defaultBypass.push(...bypassHosts);
  }
  const noProxy = defaultBypass.join(',');
  env.NO_PROXY = env.NO_PROXY || noProxy;
  env.no_proxy = env.no_proxy || noProxy;
  
  return env;
}

/**
 * Validate proxy configuration
 */
export function validateProxyConfig(config: Partial<ProxyConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.type) {
    errors.push('Proxy type is required');
  } else if (!['http', 'https', 'socks4', 'socks5'].includes(config.type)) {
    errors.push('Invalid proxy type. Must be http, https, socks4, or socks5');
  }
  
  if (!config.host) {
    errors.push('Proxy host is required');
  } else if (!isValidHost(config.host)) {
    errors.push('Invalid proxy host format');
  }
  
  if (!config.port) {
    errors.push('Proxy port is required');
  } else if (!isValidPort(config.port)) {
    errors.push('Invalid proxy port. Must be between 1 and 65535');
  }
  
  if (config.username && !config.password) {
    errors.push('Proxy password is required when username is provided');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if host is valid
 */
function isValidHost(host: string): boolean {
  // IPv4 address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(host)) {
    const parts = host.split('.');
    return parts.every(part => parseInt(part, 10) >= 0 && parseInt(part, 10) <= 255);
  }
  
  // IPv6 address
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  const ipv6ShortRegex = /^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?$/;
  if (ipv6Regex.test(host) || ipv6ShortRegex.test(host)) {
    return true;
  }
  
  // Domain name
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(host);
}

/**
 * Check if port is valid
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Detect system proxy settings
 */
export function detectSystemProxy(): ProxyConfig | null {
  // Check common proxy environment variables
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const socksProxy = process.env.SOCKS_PROXY || process.env.socks_proxy;
  const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
  
  if (httpProxy || httpsProxy || socksProxy || allProxy) {
    try {
      const proxyUrl = httpProxy || httpsProxy || socksProxy || allProxy;
      if (proxyUrl) {
        const url = new URL(proxyUrl);
        
        let type: 'http' | 'https' | 'socks4' | 'socks5' = 'http';
        if (url.protocol === 'socks4:') type = 'socks4';
        else if (url.protocol === 'socks5:') type = 'socks5';
        else if (url.protocol === 'https:') type = 'https';
        
        return {
          enabled: true,
          type,
          host: url.hostname,
          port: parseInt(url.port, 10),
          username: url.username || undefined,
          password: url.password || undefined
        };
      }
    } catch (error) {
      console.warn('Failed to parse system proxy configuration:', error);
    }
  }
  
  return null;
}

/**
 * Test proxy connectivity
 */
export async function testProxyConnectivity(proxyConfig: ProxyConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const env = createProxyEnvironment(proxyConfig);
    
    // Test with a simple HTTP request
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('curl -I --connect-timeout 10 http://httpbin.org/ip', {
      env: { ...process.env, ...env },
      timeout: 15000
    });
    
    if (stdout.includes('HTTP/')) {
      return { success: true };
    } else {
      return { success: false, error: 'Invalid response from proxy test' };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Proxy test failed' 
    };
  }
}
