/**
 * Proxy Configuration API Routes
 */

import { Router, Request, Response } from '../../http/router';
import { createProxyEnvironment, validateProxyConfig, detectSystemProxy, testProxyConnectivity, ProxyConfig } from '../../../shared/ProxyConfig';

export function createProxyRoutes(router: Router): void {
  // Get current proxy configuration
  router.get('/api/proxy/config', (_req: Request, res: Response) => {
    try {
      const systemProxy = detectSystemProxy();
      
      res.json({
        success: true,
        systemProxy,
        currentEnvironment: {
          HTTP_PROXY: process.env.HTTP_PROXY,
          HTTPS_PROXY: process.env.HTTPS_PROXY,
          SOCKS_PROXY: process.env.SOCKS_PROXY,
          ALL_PROXY: process.env.ALL_PROXY,
          NO_PROXY: process.env.NO_PROXY,
          http_proxy: process.env.http_proxy,
          https_proxy: process.env.https_proxy,
          socks_proxy: process.env.socks_proxy,
          all_proxy: process.env.all_proxy,
          no_proxy: process.env.no_proxy,
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Validate proxy configuration
  router.post('/api/proxy/validate', (req: Request, res: Response) => {
    try {
      const proxyConfig = req.body as Partial<ProxyConfig>;
      const validation = validateProxyConfig(proxyConfig);
      
      res.json({
        success: true,
        valid: validation.valid,
        errors: validation.errors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Test proxy connectivity
  router.post('/api/proxy/test', async (req: Request, res: Response) => {
    try {
      const proxyConfig = req.body as ProxyConfig;
      
      if (!proxyConfig.enabled) {
        res.json({
          success: false,
          error: 'Proxy is not enabled',
        });
        return;
      }
      
      const validation = validateProxyConfig(proxyConfig);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid proxy configuration',
          errors: validation.errors,
        });
        return;
      }
      
      const testResult = await testProxyConnectivity(proxyConfig);
      
      res.json({
        success: true,
        testResult,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Apply proxy configuration (returns environment variables)
  router.post('/api/proxy/apply', (req: Request, res: Response) => {
    try {
      const proxyConfig = req.body as ProxyConfig;
      
      if (!proxyConfig.enabled) {
        res.json({
          success: true,
          environment: {},
          message: 'Proxy disabled',
        });
        return;
      }
      
      const validation = validateProxyConfig(proxyConfig);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid proxy configuration',
          errors: validation.errors,
        });
        return;
      }
      
      const environment = createProxyEnvironment(proxyConfig);
      
      res.json({
        success: true,
        environment,
        message: 'Proxy configuration applied',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
