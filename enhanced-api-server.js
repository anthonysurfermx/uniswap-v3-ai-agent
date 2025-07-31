const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// 🔒 Security middleware
app.use(helmet());

// 📊 Logging
app.use(morgan('combined'));

// 🛡️ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  }
});
app.use('/api/', limiter);

// 🌐 CORS configuration
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://uni-pulse-dash-bucsvlvm-anthonysurfermxs-projects.vercel.app'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 🔑 Configuration
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNmMzE1NDdkLWViOWItNDA4OC1hMzA5LThkMDU4OGE3OTBmNiIsIm9yZ0lkIjoiNDYxNzQ4IiwidXNlcklkIjoiNDc1MDQ0IiwidHlwZUlkIjoiMzRiNTM3NmItMGMzNi00ZTUyLWFhMDctOTAzNDg5ZWJkODc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTM2MTg0NjIsImV4cCI6NDkwOTM3ODQ2Mn0.7l5ccJ_rq0tlLaDwSXOkTHlxNcoaQUcHmSqE-vQevqY';
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';
const ETHEREUM_CHAIN_ID = '0x1';

// 🏥 Health check with detailed info
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    moralis: {
      configured: !!MORALIS_API_KEY,
      endpoint: MORALIS_BASE_URL
    },
    endpoints: [
      '/api/positions',
      '/api/portfolio',
      '/api/wallet-info',
      '/api/tokens',
      '/api/pools',
      '/health'
    ]
  };
  
  res.json(healthInfo);
});

// 🛠️ Utility functions
const moralisHeaders = {
  'X-API-Key': MORALIS_API_KEY,
  'Content-Type': 'application/json'
};

const isValidEthereumAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const handleAPIError = (error, endpoint) => {
  console.error(`❌ API Error at ${endpoint}:`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data
  });
  
  return {
    error: true,
    message: error.response?.data?.message || error.message,
    status: error.response?.status || 500,
    endpoint
  };
};

// 📊 Enhanced position fetching
const fetchUniswapV3Positions = async (walletAddress) => {
  try {
    console.log(`🔍 Fetching V3 positions for: ${walletAddress}`);
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/wallets/${walletAddress}/defi/uniswap-v3/positions`,
      { 
        headers: moralisHeaders,
        timeout: 10000 // 10 second timeout
      }
    );

    const positions = response.data?.result || [];
    console.log(`📊 Found ${positions.length} positions`);

    return positions.map(position => ({
      id: position.token_id,
      tokenPair: `${position.token0_symbol || 'TOKEN0'}/${position.token1_symbol || 'TOKEN1'}`,
      token0: {
        symbol: position.token0_symbol,
        address: position.token0_address,
        decimals: position.token0_decimals,
        balance: position.token0_balance,
        balanceFormatted: position.token0_balance_formatted
      },
      token1: {
        symbol: position.token1_symbol,
        address: position.token1_address,
        decimals: position.token1_decimals,
        balance: position.token1_balance,
        balanceFormatted: position.token1_balance_formatted
      },
      prices: {
        current: parseFloat(position.current_price || 0),
        lower: parseFloat(position.price_lower || 0),
        upper: parseFloat(position.price_upper || 0)
      },
      inRange: position.in_range === true,
      liquidity: {
        usd: parseFloat(position.liquidity_usd || 0),
        raw: position.liquidity
      },
      fees: {
        unclaimed0: parseFloat(position.unclaimed_fee_token_0_human || 0),
        unclaimed1: parseFloat(position.unclaimed_fee_token_1_human || 0),
        unclaimedUSD: (
          (parseFloat(position.unclaimed_fee_token_0_human || 0) * parseFloat(position.token0_price_usd || 0)) +
          (parseFloat(position.unclaimed_fee_token_1_human || 0) * parseFloat(position.token1_price_usd || 0))
        )
      },
      metrics: {
        apr: parseFloat(position.apr || 0),
        impermanentLoss: parseFloat(position.il_percentage || 0),
        feeTier: parseFloat(position.fee_tier || 0.3)
      },
      nftManager: position.nft_manager_address,
      pool: position.pool_address,
      createdAt: position.created_at,
      lastUpdated: new Date().toISOString()
    }));

  } catch (error) {
    throw handleAPIError(error, 'fetchUniswapV3Positions');
  }
};

// 💼 Get wallet basic info
const fetchWalletInfo = async (walletAddress) => {
  try {
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${walletAddress}/balance`,
      { 
        headers: moralisHeaders,
        params: { chain: ETHEREUM_CHAIN_ID }
      }
    );

    return {
      address: walletAddress,
      ethBalance: response.data.balance,
      ethBalanceFormatted: (parseFloat(response.data.balance) / 1e18).toFixed(4)
    };
  } catch (error) {
    throw handleAPIError(error, 'fetchWalletInfo');
  }
};

// 🎯 API Routes with validation

// 📊 Get LP positions
app.get('/api/positions', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({
        error: 'Missing wallet parameter',
        message: 'Please provide a wallet address in the query parameters'
      });
    }

    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: 'Please provide a valid Ethereum address'
      });
    }

    console.log(`📡 API call: GET /api/positions?wallet=${wallet}`);
    
    const positions = await fetchUniswapV3Positions(wallet);
    
    res.json({
      success: true,
      data: positions,
      count: positions.length,
      wallet: wallet,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ /api/positions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch positions',
      details: error.message
    });
  }
});

// 💰 Get portfolio summary
app.get('/api/portfolio', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet || !isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        error: 'Invalid or missing wallet address'
      });
    }

    console.log(`📡 API call: GET /api/portfolio?wallet=${wallet}`);
    
    const [positions, walletInfo] = await Promise.all([
      fetchUniswapV3Positions(wallet),
      fetchWalletInfo(wallet)
    ]);
    
    // Calculate portfolio metrics
    const totalLiquidity = positions.reduce((sum, pos) => sum + pos.liquidity.usd, 0);
    const totalFees = positions.reduce((sum, pos) => sum + pos.fees.unclaimedUSD, 0);
    const avgAPR = positions.length > 0 ? 
      positions.reduce((sum, pos) => sum + pos.metrics.apr, 0) / positions.length : 0;
    const inRangeCount = positions.filter(pos => pos.inRange).length;
    
    const portfolio = {
      success: true,
      wallet: {
        address: wallet,
        ethBalance: walletInfo.ethBalanceFormatted
      },
      summary: {
        totalValueLocked: totalLiquidity.toFixed(2),
        totalUnclaimedFees: totalFees.toFixed(2),
        averageApr: avgAPR.toFixed(1),
        positionsCount: positions.length,
        inRangeCount: inRangeCount,
        outOfRangeCount: positions.length - inRangeCount,
        healthScore: inRangeCount / Math.max(positions.length, 1) * 100
      },
      breakdown: {
        byFeeTier: positions.reduce((acc, pos) => {
          const tier = `${pos.metrics.feeTier}%`;
          acc[tier] = (acc[tier] || 0) + pos.liquidity.usd;
          return acc;
        }, {}),
        byStatus: {
          inRange: positions.filter(pos => pos.inRange).length,
          outOfRange: positions.filter(pos => !pos.inRange).length
        }
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(portfolio);
    
  } catch (error) {
    console.error('❌ /api/portfolio error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio data',
      details: error.message
    });
  }
});

// 🪙 Get wallet token balances
app.get('/api/tokens', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet || !isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        error: 'Invalid or missing wallet address'
      });
    }

    console.log(`📡 API call: GET /api/tokens?wallet=${wallet}`);
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${wallet}/erc20`,
      { 
        headers: moralisHeaders,
        params: { chain: ETHEREUM_CHAIN_ID }
      }
    );

    const tokens = response.data.result.map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.token_address,
      balance: token.balance,
      balanceFormatted: parseFloat(token.balance_formatted || 0),
      decimals: token.decimals,
      logo: token.logo,
      usdPrice: token.usd_price,
      usdValue: token.usd_value
    }));

    res.json({
      success: true,
      data: tokens,
      count: tokens.length,
      wallet: wallet,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ /api/tokens error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token balances',
      details: error.message
    });
  }
});

// 🏊 Get Uniswap pools info
app.get('/api/pools', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log(`📡 API call: GET /api/pools`);
    
    // Mock data for now - would integrate with Uniswap subgraph
    const pools = [
      {
        id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
        token0: "USDC",
        token1: "WETH",
        feeTier: 0.05,
        tvl: "142.5M",
        volume24h: "45.2M",
        apr: 12.4
      },
      {
        id: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        token0: "USDC",
        token1: "WETH", 
        feeTier: 0.3,
        tvl: "98.1M",
        volume24h: "32.1M",
        apr: 8.7
      }
    ];

    res.json({
      success: true,
      data: pools.slice(0, parseInt(limit)),
      count: pools.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ /api/pools error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pool data',
      details: error.message
    });
  }
});

// 📈 Get wallet info
app.get('/api/wallet-info', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet || !isValidEthereumAddress(wallet)) {
      return res.status(400).json({
        error: 'Invalid or missing wallet address'
      });
    }

    console.log(`📡 API call: GET /api/wallet-info?wallet=${wallet}`);
    
    const walletInfo = await fetchWalletInfo(wallet);
    
    res.json({
      success: true,
      data: walletInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ /api/wallet-info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet info',
      details: error.message
    });
  }
});

// 🚫 Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /health',
      'GET /api/positions?wallet=0x...',
      'GET /api/portfolio?wallet=0x...',
      'GET /api/tokens?wallet=0x...',
      'GET /api/pools',
      'GET /api/wallet-info?wallet=0x...'
    ]
  });
});

// 🔥 Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, () => {
  console.log(`
🦄 Enhanced Uniswap V3 API Server
📡 Port: ${PORT}
🔑 Moralis: ${MORALIS_API_KEY ? '✅ Configured' : '❌ Missing'}
🛡️  Security: ✅ Helmet + Rate Limiting
📊 Logging: ✅ Morgan
🌐 CORS: ✅ Configured
⚡ Endpoints: 6 available

🚀 Ready to serve DeFi data!
  `);
});
