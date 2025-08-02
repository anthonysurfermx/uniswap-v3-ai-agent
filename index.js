const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Configuración mejorada de CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permite localhost y cualquier subdominio de vercel.app
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// The Graph endpoint for Uniswap V3
const UNISWAP_V3_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

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
    version: "3.1.0",
    endpoints: [
      "/health",
      "/api/positions/:walletAddress",
      "/api/portfolio/:walletAddress",
      "/api/pool-analysis",
      "/api/analyze/:walletAddress"
    ]
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Helper function to analyze wallet
async function analyzeWalletData(walletAddress) {
  console.log(`🔍 Querying The Graph for wallet: ${walletAddress}`);
  
  const query = `
    query getPositions($owner: String!) {
      positions(where: { owner: $owner }) {
        id
        owner
        pool {
          id
          token0 {
            id
            symbol
            decimals
          }
          token1 {
            id
            symbol
            decimals
          }
          feeTier
          liquidity
          sqrtPrice
          tick
        }
        liquidity
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        tickLower {
          tickIdx
        }
        tickUpper {
          tickIdx
        }
      }
    }
  `;

  try {
    console.log('📡 Sending query to The Graph...');
    const response = await axios.post(
      UNISWAP_V3_SUBGRAPH,
      {
        query,
        variables: { owner: walletAddress.toLowerCase() }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('✅ Response from The Graph received');
    
    // Check for errors in the GraphQL response
    if (response.data.errors) {
      console.error('❌ GraphQL errors:', response.data.errors);
      throw new Error('GraphQL query failed: ' + JSON.stringify(response.data.errors));
    }

    return response.data.data.positions || [];
  } catch (error) {
    console.error('❌ Error querying The Graph:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

// Analyze wallet - Main endpoint
app.get('/api/analyze/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`🔍 Analyzing wallet: ${walletAddress}`);
  
  // Basic address validation
  if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address format'
    });
  }
  
  try {
    const positions = await analyzeWalletData(walletAddress);
    console.log(`📊 Found ${positions.length} positions`);

    if (!positions || positions.length === 0) {
      return res.json({
        success: true,
        data: {
          wallet: walletAddress,
          hasPositions: false,
          positionsCount: 0,
          positions: [],
          message: "No Uniswap V3 positions found for this wallet"
        }
      });
    }

    // Calculate totals and format data
    const formattedPositions = positions.map(pos => {
      const fees0 = parseFloat(pos.collectedFeesToken0) || 0;
      const fees1 = parseFloat(pos.collectedFeesToken1) || 0;
      const totalFees = fees0 + fees1;
      
      return {
        id: pos.id,
        pool: `${pos.pool.token0.symbol || 'Unknown'}/${pos.pool.token1.symbol || 'Unknown'}`,
        poolAddress: pos.pool.id,
        feeTier: (pos.pool.feeTier / 10000).toFixed(2) + '%',
        liquidity: pos.liquidity,
        range: {
          lower: pos.tickLower.tickIdx,
          upper: pos.tickUpper.tickIdx
        },
        fees: {
          token0: fees0.toFixed(4),
          token1: fees1.toFixed(4),
          total: totalFees.toFixed(2)
        }
      };
    });

    const uniquePools = [...new Set(positions.map(p => 
      `${p.pool.token0.symbol || 'Unknown'}/${p.pool.token1.symbol || 'Unknown'}`
    ))];

    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        hasPositions: true,
        positionsCount: positions.length,
        positions: formattedPositions,
        summary: {
          totalPositions: positions.length,
          pools: uniquePools,
          lastUpdated: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Error analyzing wallet:', error);
    
    // Check if it's a Graph error
    if (error.message.includes('GraphQL')) {
      res.status(503).json({
        success: false,
        error: 'The Graph service is temporarily unavailable',
        details: 'Please try again in a few moments'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to analyze wallet',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

// Get positions for a specific wallet
app.get('/api/positions/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Getting positions for wallet: ${walletAddress}`);
  
  try {
    const positions = await analyzeWalletData(walletAddress);
    
    if (!positions || positions.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const formattedPositions = positions.map(pos => ({
      id: pos.id,
      pool: `${pos.pool.token0.symbol || 'Unknown'}/${pos.pool.token1.symbol || 'Unknown'}`,
      feeTier: (pos.pool.feeTier / 10000).toFixed(2) + '%',
      liquidity: pos.liquidity,
      range: {
        lower: pos.tickLower.tickIdx,
        upper: pos.tickUpper.tickIdx
      }
    }));

    res.json({
      success: true,
      data: formattedPositions
    });
  } catch (error) {
    console.error('Error getting positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get positions',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Pool analysis endpoint (general, not wallet-specific)
app.get('/api/pool-analysis', async (req, res) => {
  console.log('Pool analysis requested');
  try {
    const query = `
      query getTopPools {
        pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id
          token0 {
            symbol
          }
          token1 {
            symbol
          }
          feeTier
          liquidity
          totalValueLockedUSD
          volumeUSD
        }
      }
    `;

    const response = await axios.post(UNISWAP_V3_SUBGRAPH, {
      query
    });

    if (response.data.errors) {
      throw new Error('GraphQL query failed');
    }

    const pools = response.data.data.pools || [];

    res.json({
      success: true,
      data: {
        topPools: pools.map(pool => ({
          id: pool.id,
          pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
          feeTier: (pool.feeTier / 10000).toFixed(2) + '%',
          tvl: parseFloat(pool.totalValueLockedUSD).toFixed(2),
          volume: parseFloat(pool.volumeUSD).toFixed(2),
          liquidity: pool.liquidity
        })),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in pool analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze pools'
    });
  }
});

// Portfolio endpoint for wallet
app.get('/api/portfolio/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Getting portfolio for wallet: ${walletAddress}`);
  
  try {
    const positions = await analyzeWalletData(walletAddress);
    
    const pools = positions.length > 0 
      ? [...new Set(positions.map(p => 
          `${p.pool.token0.symbol || 'Unknown'}/${p.pool.token1.symbol || 'Unknown'}`
        ))]
      : [];
    
    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        totalPositions: positions.length,
        pools: pools,
        totalValue: 0, // Would need price data
        totalFees: 0, // Would need to calculate
        performance: {
          day: 0, // Would need historical data
          week: 0,
          month: 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Portfolio optimization endpoint
app.get('/api/portfolio-optimization/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Optimizing portfolio for wallet: ${walletAddress}`);
  
  try {
    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        recommendations: [
          {
            action: 'analyze',
            message: 'Portfolio optimization coming soon...'
          }
        ],
        optimizedAllocation: {},
        expectedAPY: 0,
        riskScore: 'N/A',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in portfolio optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize portfolio'
    });
  }
});

// Test endpoint for The Graph
app.get('/api/test-graph', async (req, res) => {
  try {
    const query = `
      query {
        factories(first: 1) {
          id
          poolCount
        }
      }
    `;
    
    const response = await axios.post(UNISWAP_V3_SUBGRAPH, { query });
    
    res.json({
      success: true,
      message: 'The Graph is accessible',
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cannot connect to The Graph',
      details: error.message
    });
  }
});

// Backward compatibility endpoints
app.get('/api/positions', (req, res) => {
  res.json({
    success: false,
    error: 'Wallet address required',
    message: 'Please use /api/positions/{walletAddress}'
  });
});

app.get('/api/portfolio', (req, res) => {
  res.json({
    success: false,
    error: 'Wallet address required',
    message: 'Please use /api/portfolio/{walletAddress}'
  });
});

app.get('/api/portfolio-optimization', (req, res) => {
  res.json({
    success: false,
    error: 'Wallet address required',
    message: 'Please use /api/portfolio-optimization/{walletAddress}'
  });
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
      '/api/analyze/{walletAddress}',
      '/api/positions/{walletAddress}',
      '/api/portfolio/{walletAddress}',
      '/api/pool-analysis',
      '/api/test-graph'
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
  console.log('  GET /api/analyze/{walletAddress}');
  console.log('  GET /api/positions/{walletAddress}');
  console.log('  GET /api/portfolio/{walletAddress}');
  console.log('  GET /api/pool-analysis');
  console.log('  GET /api/test-graph');
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