const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
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
    endpoints: ['/api/positions', '/api/portfolio', '/health']
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
});

app.listen(5680, () => {
  console.log('🦄 Improved API Server on port 5680');
});

// Cache stats endpoint
app.get('/api/cache/stats', (req, res) => {
  res.json({
    entries: 0,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Price history endpoint  
app.get('/api/price-history', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const data = [];
  
  for(let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const basePrice = 2300;
    const price = basePrice + (Math.random() - 0.5) * 200;
    
    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(price * 100) / 100,
      volume: Math.round(Math.random() * 50000000)
    });
  }
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    period: `${days} days`
  });
});

// Market data endpoint
app.get('/api/market-data', (req, res) => {
  res.json({
    success: true,
    data: {
      ethereum: { price: 2387.45, change24h: 3.24 },
      defi: { totalValueLocked: 45600000000 },
      uniswapV3: { 
        tvl: 4200000000,
        volume24h: 1240000000,
        topPools: [
          { pair: 'ETH/USDC', tvl: '850M', apr: 12.4 },
          { pair: 'ETH/USDT', tvl: '420M', apr: 8.7 }
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});
