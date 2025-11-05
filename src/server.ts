/**
 * Fullscript Scraper Service - Express API
 *
 * Standalone service for Railway deployment that scrapes Fullscript
 * and stores results in Supabase.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { FullscriptScraper, ScraperConfig } from './scraper';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Request body for scrape endpoint
 */
interface ScrapeRequest {
  credentials: {
    email: string;
    password: string;
  };
  mode: 'full_catalog' | 'category' | 'brand' | 'search';
  filter?: string;
  limit: number;
}

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'fullscript-scraper',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Main scrape endpoint
 *
 * POST /scrape
 * Body: {
 *   credentials: { email, password },
 *   mode: 'full_catalog' | 'category' | 'brand' | 'search',
 *   filter?: string,
 *   limit: number
 * }
 */
app.post('/scrape', async (req: Request, res: Response) => {
  console.log('[API] Received scrape request');

  try {
    // Validate request body
    const { credentials, mode, filter, limit }: ScrapeRequest = req.body;

    if (!credentials || !credentials.email || !credentials.password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    if (!mode) {
      return res.status(400).json({
        error: 'Missing mode',
        message: 'Scraper mode is required (full_catalog, category, brand, search)',
      });
    }

    if (!limit || limit < 1 || limit > 500) {
      return res.status(400).json({
        error: 'Invalid limit',
        message: 'Limit must be between 1 and 500',
      });
    }

    if (mode !== 'full_catalog' && !filter) {
      return res.status(400).json({
        error: 'Missing filter',
        message: `Filter is required for mode: ${mode}`,
      });
    }

    // Build scraper config
    const config: ScraperConfig = {
      email: credentials.email,
      password: credentials.password,
      mode,
      filter: filter || null,
      limit,
    };

    console.log('[API] Starting scraper with config:', {
      mode: config.mode,
      filter: config.filter,
      limit: config.limit,
    });

    // Create scraper instance
    const scraper = new FullscriptScraper();

    // Start scraping (this will take a while)
    const result = await scraper.scrape(config);

    console.log('[API] Scraper finished:', {
      success: result.success,
      totalScraped: result.totalScraped,
      importId: result.importId,
    });

    // Return result
    if (result.success) {
      return res.json({
        success: true,
        import_id: result.importId,
        total_products: result.totalScraped,
        message: 'Scraping completed successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        import_id: result.importId,
        total_products: result.totalScraped,
        errors: result.errors,
        message: 'Scraping failed',
      });
    }

  } catch (error: any) {
    console.error('[API] Scrape endpoint error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred',
    });
  }
});

/**
 * Test endpoint (returns mock data for testing)
 */
app.get('/test', (_req: Request, res: Response) => {
  res.json({
    message: 'Fullscript Scraper Service is running',
    endpoints: {
      health: 'GET /health',
      scrape: 'POST /scrape',
      test: 'GET /test',
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`[Server] Fullscript Scraper Service listening on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Scrape endpoint: POST http://localhost:${PORT}/scrape`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
