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

app.listen(5679, () => {
  console.log('🦄 Improved API Server on port 5679');
});
