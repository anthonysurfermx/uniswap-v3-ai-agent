const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Configuración mejorada de CORS
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://uni-pulse-dash-rnrsge3ar-anthonysurfermxs-projects.vercel.app',
    'https://uni-pulse-dash.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// Logging mejorado
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  console.log('Health check requested');
  res.json({
    message: "Uniswap V3 AI Agent API",
    version: "2.0.0",
    endpoints: [
      "/health",
      "/api/positions",
      "/api/portfolio",
      "/api/portfolio-optimization",
      "/api/pool-analysis"
    ]
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Pool analysis endpoint
app.get('/api/pool-analysis', async (req, res) => {
  console.log('Pool analysis requested');
  try {
    const mockData = {
      success: true,
      data: {
        poolId: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        token0: "USDC",
        token1: "WETH",
        tvl: 285000000,
        volume24h: 45000000,
        apy: 12.5,
        historicalData: [
          { date: "2024-01-01", tvl: 250000000, volume: 40000000 },
          { date: "2024-01-02", tvl: 255000000, volume: 42000000 },
          { date: "2024-01-03", tvl: 260000000, volume: 44000000 },
          { date: "2024-01-04", tvl: 265000000, volume: 43000000 },
          { date: "2024-01-05", tvl: 270000000, volume: 45000000 }
        ]
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending pool analysis data');
    res.json(mockData);
  } catch (error) {
    console.error('Error in pool analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Positions endpoint
app.get('/api/positions', async (req, res) => {
  console.log('Positions requested');
  try {
    const mockPositions = {
      success: true,
      data: [
        {
          id: "1",
          pool: "USDC/WETH",
          liquidity: "1000000",
          range: "0.0005 - 0.0008",
          fees: "250.50",
          value: "50000"
        },
        {
          id: "2",
          pool: "DAI/USDC",
          liquidity: "500000",
          range: "0.99 - 1.01",
          fees: "125.25",
          value: "25000"
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending positions data');
    res.json(mockPositions);
  } catch (error) {
    console.error('Error in positions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Portfolio endpoint
app.get('/api/portfolio', async (req, res) => {
  console.log('Portfolio requested');
  try {
    const mockPortfolio = {
      success: true,
      data: {
        totalValue: 75000,
        totalFees: 375.75,
        positions: 2,
        performance: {
          day: 2.5,
          week: 5.8,
          month: 12.3
        }
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending portfolio data');
    res.json(mockPortfolio);
  } catch (error) {
    console.error('Error in portfolio:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Portfolio optimization endpoint (el que faltaba)
app.get('/api/portfolio-optimization', async (req, res) => {
  console.log('Portfolio optimization requested');
  try {
    const mockData = {
      success: true,
      data: {
        optimizedAllocation: {
          'USDC/WETH': 40,
          'DAI/USDC': 30,
          'WETH/USDT': 30
        },
        expectedAPY: 15.5,
        riskScore: 'Medium',
        recommendations: [
          {
            action: 'increase',
            pool: 'USDC/WETH',
            reason: 'Higher APY with stable volume'
          },
          {
            action: 'decrease',
            pool: 'DAI/USDC',
            reason: 'Lower returns in stable pairs'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending portfolio optimization data');
    res.json(mockData);
  } catch (error) {
    console.error('Error in portfolio optimization:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Catch all route
app.get('*', (req, res) => {
  console.log(`Unknown route requested: ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    availableRoutes: [
      '/',
      '/health',
      '/api/test',
      '/api/pool-analysis',
      '/api/positions',
      '/api/portfolio',
      '/api/portfolio-optimization'
    ]
  });
});

// Puerto dinámico para Railway
const PORT = process.env.PORT || 5679;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('=================================');
  console.log('Available endpoints:');
  console.log('  GET /');
  console.log('  GET /health');
  console.log('  GET /api/test');
  console.log('  GET /api/pool-analysis');
  console.log('  GET /api/positions');
  console.log('  GET /api/portfolio');
  console.log('  GET /api/portfolio-optimization');
  console.log('=================================');
});

// Manejo de errores
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});