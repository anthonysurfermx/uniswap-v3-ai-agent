const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors({
  origin: ['http://localhost:8080', 'https://uni-pulse-dash-rnrsge3ar-anthonysurfermxs-projects.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNmMzE1NDdkLWViOWItNDA4OC1hMzA5LThkMDU4OGE3OTBmNiIsIm9yZ0lkIjoiNDYxNzQ4IiwidXNlcklkIjoiNDc1MDQ0IiwidHlwZUlkIjoiMzRiNTM3NmItMGMzNi00ZTUyLWFhMDctOTAzNDg5ZWJkODc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTM2MTg0NjIsImV4cCI6NDkwOTM3ODQ2Mn0.7l5ccJ_rq0tlLaDwSXOkTHlxNcoaQUcHmSqE-vQevqY';
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

// Validation function
const isValidEthereumAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Enhanced health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/positions', '/api/portfolio', '/api/pool-analysis', '/health']
  });
});

// Enhanced API endpoint
app.get('/api/positions', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet parameter'
      });
    }

    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    console.log(`📡 Enhanced API: /api/positions?wallet=${wallet}`);
    
    res.json({
      success: true,
      message: 'Enhanced API with validation working!',
      wallet: wallet,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
}); // IMPORTANTE: Este cierre faltaba

// Add portfolio endpoint
app.get('/api/portfolio', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet parameter'
      });
    }

    console.log('📊 Portfolio request for:', wallet);
    
    // Mock portfolio data for now
    const portfolioData = {
      success: true,
      summary: {
        totalValueLocked: "8450.23",
        totalUnclaimedFees: "127.50", 
        weightedApr: "15.4",
        positionsCount: 2,
        inRangeCount: 1,
        outOfRangeCount: 1,
        healthScore: "75.0"
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(portfolioData);
    
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Add pool analysis endpoint
app.get('/api/pool-analysis', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        topPools: [
          {
            id: "1",
            pair: "WETH/USDC",
            tvl: "$1.2B",
            volume24h: "$45.3M",
            apy: "12.5%"
          },
          {
            id: "2",
            pair: "USDC/USDT",
            tvl: "$890M",
            volume24h: "$23.1M",
            apy: "8.3%"
          },
          {
            id: "3",
            pair: "WBTC/WETH",
            tvl: "$756M",
            volume24h: "$34.2M",
            apy: "10.2%"
          }
        ],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: "Uniswap V3 AI Agent API",
    version: "2.0.0",
    endpoints: ['/health', '/api/positions', '/api/portfolio', '/api/pool-analysis']
  });
});

// Start server - IMPORTANTE: Solo un app.listen al final
const PORT = process.env.PORT || 5679;
app.listen(PORT, () => {
  console.log(`🚀 CORRECT SERVER RUNNING - improved-server.js on port ${PORT}`);
});