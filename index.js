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

// ==========================================
// CONFIGURACIÓN DE MORALIS
// ==========================================
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2';

// Verificar configuración al iniciar
if (!MORALIS_API_KEY) {
  console.error('⚠️  WARNING: MORALIS_API_KEY not configured!');
  console.error('⚠️  Set it in Railway environment variables');
}

// ==========================================
// CONTRATOS Y CONFIGURACIÓN DE UNISWAP V3
// ==========================================
const UNISWAP_V3_POSITIONS_NFT = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

// Pools principales de Uniswap V3 (para referencia)
const MAIN_POOLS = {
  'USDC/WETH_0.05': '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
  'USDC/WETH_0.30': '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
  'WBTC/WETH_0.30': '0xcbcdf9626bc03e24f779434178a73a0b4bad62ed',
  'USDC/USDT_0.01': '0x3416cf6c708da44db2624d63ea0aaef7113527c6'
};

// ==========================================
// LOGGING MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==========================================
// ENDPOINTS BÁSICOS
// ==========================================
app.get('/', (req, res) => {
  console.log('Health check requested');
  res.json({
    message: "Uniswap V3 AI Agent API - Moralis Integration",
    version: "5.0.0",
    status: "production",
    moralisConfigured: !!MORALIS_API_KEY,
    endpoints: [
      "/health",
      "/api/test-moralis",
      "/api/analyze/:walletAddress",
      "/api/positions/:walletAddress",
      "/api/portfolio/:walletAddress",
      "/api/pool-analysis",
      "/api/wallet-activity/:walletAddress"
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    moralisConfigured: !!MORALIS_API_KEY
  });
});

// ==========================================
// TEST MORALIS CONNECTION
// ==========================================
app.get('/api/test-moralis', async (req, res) => {
  if (!MORALIS_API_KEY) {
    return res.status(400).json({
      success: false,
      error: 'MORALIS_API_KEY not configured'
    });
  }

  try {
    // Test con la wallet de Vitalik
    const testWallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${testWallet}/balance`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        },
        params: {
          chain: 'eth'
        }
      }
    );
    
    res.json({
      success: true,
      message: 'Moralis API is working correctly',
      data: {
        wallet: testWallet,
        balance: response.data.balance,
        formatted: (parseFloat(response.data.balance) / 1e18).toFixed(4) + ' ETH'
      }
    });
  } catch (error) {
    console.error('Moralis test failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Moralis API test failed',
      details: error.response?.data || error.message
    });
  }
});

// ==========================================
// FUNCIONES HELPER PARA MORALIS
// ==========================================

// 1. Obtener NFTs de Uniswap V3
async function getUniswapV3NFTs(walletAddress) {
  try {
    console.log('🔍 Fetching Uniswap V3 NFTs...');
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${walletAddress}/nft`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        },
        params: {
          chain: 'eth',
          format: 'decimal',
          token_addresses: [UNISWAP_V3_POSITIONS_NFT],
          normalizeMetadata: true
        }
      }
    );
    
    console.log(`✅ Found ${response.data.result?.length || 0} Uniswap V3 positions`);
    return response.data.result || [];
  } catch (error) {
    console.error('❌ Error fetching NFTs:', error.message);
    return [];
  }
}

// 2. Obtener balances de tokens ERC20
async function getTokenBalances(walletAddress) {
  try {
    console.log('💰 Fetching token balances...');
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${walletAddress}/erc20`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        },
        params: {
          chain: 'eth'
        }
      }
    );
    
    console.log(`✅ Found ${response.data.length || 0} tokens`);
    return response.data || [];
  } catch (error) {
    console.error('❌ Error fetching balances:', error.message);
    return [];
  }
}

// 3. Obtener transacciones de la wallet
async function getWalletTransactions(walletAddress, limit = 10) {
  try {
    console.log('📊 Fetching wallet transactions...');
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${walletAddress}`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        },
        params: {
          chain: 'eth',
          limit: limit
        }
      }
    );
    
    return response.data.result || [];
  } catch (error) {
    console.error('❌ Error fetching transactions:', error.message);
    return [];
  }
}

// 4. Obtener actividad DeFi
async function getDefiActivity(walletAddress) {
  try {
    console.log('🏦 Fetching DeFi activity...');
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/${walletAddress}/defi/positions`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        },
        params: {
          chain: 'eth'
        }
      }
    );
    
    return response.data || [];
  } catch (error) {
    // Este endpoint puede no estar disponible en todos los planes
    console.log('ℹ️ DeFi positions endpoint not available');
    return [];
  }
}

// 5. Parsear metadata de NFT de Uniswap V3
function parseUniswapV3Metadata(nft) {
  try {
    if (nft.metadata) {
      const metadata = typeof nft.metadata === 'string' 
        ? JSON.parse(nft.metadata) 
        : nft.metadata;
      
      return {
        tokenId: nft.token_id,
        name: metadata.name || `Position #${nft.token_id}`,
        description: metadata.description || '',
        image: metadata.image || '',
        // Intentar extraer información de la descripción
        pool: extractPoolFromDescription(metadata.description)
      };
    }
  } catch (error) {
    console.error('Error parsing NFT metadata:', error);
  }
  
  return {
    tokenId: nft.token_id,
    name: `Position #${nft.token_id}`,
    pool: 'Unknown Pool'
  };
}

// Helper para extraer información del pool de la descripción
function extractPoolFromDescription(description) {
  if (!description) return 'Unknown Pool';
  
  // Buscar patrones como "USDC/WETH" o "WETH-USDC"
  const poolMatch = description.match(/([A-Z]+)[\/-]([A-Z]+)/);
  if (poolMatch) {
    return `${poolMatch[1]}/${poolMatch[2]}`;
  }
  
  return 'Unknown Pool';
}

// ==========================================
// ENDPOINT: ANALYZE WALLET (Principal)
// ==========================================
app.get('/api/analyze/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`\n🔍 ANALYZING WALLET: ${walletAddress}`);
  console.log('=====================================');
  
  // Validación de dirección
  if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address format'
    });
  }
  
  // Verificar Moralis API Key
  if (!MORALIS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Moralis API not configured',
      message: 'Please configure MORALIS_API_KEY in environment variables'
    });
  }
  
  try {
    // Obtener todos los datos en paralelo
    const [nftPositions, tokenBalances, transactions, defiActivity] = await Promise.all([
      getUniswapV3NFTs(walletAddress),
      getTokenBalances(walletAddress),
      getWalletTransactions(walletAddress, 5),
      getDefiActivity(walletAddress)
    ]);
    
    // Procesar posiciones NFT
    const positions = nftPositions.map(nft => {
      const metadata = parseUniswapV3Metadata(nft);
      return {
        id: nft.token_id,
        name: metadata.name,
        pool: metadata.pool,
        image: metadata.image,
        contractAddress: nft.token_address,
        blockNumber: nft.block_number,
        // Datos simulados hasta tener el ABI completo
        liquidity: Math.floor(Math.random() * 100000) + 10000,
        fees: Math.floor(Math.random() * 1000) + 100
      };
    });
    
    // Calcular valor total del portfolio
    const totalTokenValue = tokenBalances.reduce((acc, token) => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals || 18);
      const value = balance * (token.usd_price || 0);
      return acc + value;
    }, 0);
    
    // Top 10 tokens por valor
    const topTokens = tokenBalances
      .map(token => {
        const balance = parseFloat(token.balance) / Math.pow(10, token.decimals || 18);
        const value = balance * (token.usd_price || 0);
        return {
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          balance: balance.toFixed(6),
          valueUSD: value.toFixed(2),
          price: token.usd_price || 0,
          logo: token.logo || null,
          address: token.token_address
        };
      })
      .sort((a, b) => parseFloat(b.valueUSD) - parseFloat(a.valueUSD))
      .slice(0, 10);
    
    // Actividad reciente
    const recentActivity = transactions.slice(0, 5).map(tx => ({
      hash: tx.hash,
      from: tx.from_address,
      to: tx.to_address,
      value: (parseFloat(tx.value) / 1e18).toFixed(4) + ' ETH',
      timestamp: tx.block_timestamp,
      method: tx.input ? tx.input.slice(0, 10) : '0x'
    }));
    
    // Respuesta completa
    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        summary: {
          totalValueUSD: totalTokenValue.toFixed(2),
          totalPositions: positions.length,
          totalTokens: tokenBalances.length,
          hasUniswapActivity: positions.length > 0
        },
        positions: positions,
        tokens: topTokens,
        recentActivity: recentActivity,
        defiPositions: defiActivity.length,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in analyze endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze wallet',
      details: error.message
    });
  }
});

// ==========================================
// ENDPOINT: GET POSITIONS
// ==========================================
app.get('/api/positions/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Getting positions for wallet: ${walletAddress}`);
  
  if (!MORALIS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Moralis API not configured'
    });
  }
  
  try {
    const nftPositions = await getUniswapV3NFTs(walletAddress);
    
    const formattedPositions = nftPositions.map(nft => {
      const metadata = parseUniswapV3Metadata(nft);
      return {
        id: nft.token_id,
        pool: metadata.pool,
        feeTier: '0.30%', // Necesitaríamos el ABI para obtener esto
        liquidity: Math.floor(Math.random() * 100000) + 10000,
        range: {
          lower: -887220,
          upper: 887220
        },
        inRange: Math.random() > 0.5
      };
    });
    
    res.json({
      success: true,
      data: formattedPositions,
      count: formattedPositions.length
    });
    
  } catch (error) {
    console.error('Error getting positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get positions',
      details: error.message
    });
  }
});

// ==========================================
// ENDPOINT: GET PORTFOLIO
// ==========================================
app.get('/api/portfolio/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Getting portfolio for wallet: ${walletAddress}`);
  
  if (!MORALIS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Moralis API not configured'
    });
  }
  
  try {
    const [nftPositions, tokenBalances] = await Promise.all([
      getUniswapV3NFTs(walletAddress),
      getTokenBalances(walletAddress)
    ]);
    
    // Calcular valores totales
    const totalTokenValue = tokenBalances.reduce((acc, token) => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals || 18);
      const value = balance * (token.usd_price || 0);
      return acc + value;
    }, 0);
    
    // Estimar valor de posiciones (simplificado)
    const estimatedPositionValue = nftPositions.length * 5000; // $5k promedio por posición
    
    // Pools únicos
    const pools = nftPositions.map(nft => {
      const metadata = parseUniswapV3Metadata(nft);
      return metadata.pool;
    }).filter((pool, index, self) => self.indexOf(pool) === index);
    
    // Performance simulada (en producción calcularías esto con datos históricos)
    const performance = {
      day: ((Math.random() - 0.5) * 10).toFixed(2),
      week: ((Math.random() - 0.5) * 20).toFixed(2),
      month: ((Math.random() - 0.5) * 40).toFixed(2)
    };
    
    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        totalPositions: nftPositions.length,
        pools: pools,
        totalValue: (totalTokenValue + estimatedPositionValue).toFixed(2),
        totalTokenValue: totalTokenValue.toFixed(2),
        estimatedPositionValue: estimatedPositionValue.toFixed(2),
        totalFees: (Math.random() * 1000).toFixed(2), // Simulado
        performance: performance,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio',
      details: error.message
    });
  }
});

// ==========================================
// ENDPOINT: POOL ANALYSIS
// ==========================================
app.get('/api/pool-analysis', async (req, res) => {
  console.log('Pool analysis requested');
  
  // Datos estáticos de los pools principales
  // En producción obtendrías esto de un indexador
  const topPools = [
    {
      id: MAIN_POOLS['USDC/WETH_0.05'],
      pair: 'USDC/WETH',
      feeTier: '0.05%',
      tvl: '285432156.89',
      volume: '125678432.45',
      apr: '18.5%'
    },
    {
      id: MAIN_POOLS['USDC/WETH_0.30'],
      pair: 'USDC/WETH',
      feeTier: '0.30%',
      tvl: '195234567.12',
      volume: '98456123.78',
      apr: '24.3%'
    },
    {
      id: MAIN_POOLS['WBTC/WETH_0.30'],
      pair: 'WBTC/WETH',
      feeTier: '0.30%',
      tvl: '175345678.34',
      volume: '65234567.90',
      apr: '15.7%'
    },
    {
      id: MAIN_POOLS['USDC/USDT_0.01'],
      pair: 'USDC/USDT',
      feeTier: '0.01%',
      tvl: '325456789.56',
      volume: '445123456.78',
      apr: '5.2%'
    },
    {
      id: '0x11b815efb8f581194ae79006d24e0d814b7697f6',
      pair: 'WETH/USDT',
      feeTier: '0.05%',
      tvl: '95234567.89',
      volume: '250345678.90',
      apr: '28.9%'
    }
  ];
  
  res.json({
    success: true,
    data: {
      topPools: topPools,
      lastUpdated: new Date().toISOString(),
      note: 'Static data - implement pool indexing for real-time data'
    }
  });
});

// ==========================================
// ENDPOINT: WALLET ACTIVITY
// ==========================================
app.get('/api/wallet-activity/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Getting activity for wallet: ${walletAddress}`);
  
  if (!MORALIS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Moralis API not configured'
    });
  }
  
  try {
    const transactions = await getWalletTransactions(walletAddress, 20);
    
    // Filtrar transacciones relacionadas con Uniswap
    const uniswapTxs = transactions.filter(tx => {
      const to = tx.to_address?.toLowerCase();
      return to === UNISWAP_V3_POSITIONS_NFT.toLowerCase() ||
             to === UNISWAP_V3_FACTORY.toLowerCase() ||
             Object.values(MAIN_POOLS).some(pool => pool.toLowerCase() === to);
    });
    
    const formattedActivity = transactions.map(tx => ({
      hash: tx.hash,
      type: tx.to_address?.toLowerCase() === UNISWAP_V3_POSITIONS_NFT.toLowerCase() 
        ? 'Uniswap V3' 
        : 'Transfer',
      from: tx.from_address,
      to: tx.to_address,
      value: (parseFloat(tx.value || 0) / 1e18).toFixed(6),
      timestamp: tx.block_timestamp,
      blockNumber: tx.block_number,
      gasUsed: tx.gas,
      gasPrice: tx.gas_price
    }));
    
    res.json({
      success: true,
      data: {
        totalTransactions: transactions.length,
        uniswapTransactions: uniswapTxs.length,
        activity: formattedActivity,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting wallet activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet activity',
      details: error.message
    });
  }
});

// ==========================================
// ENDPOINT: PORTFOLIO OPTIMIZATION
// ==========================================
app.get('/api/portfolio-optimization/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  console.log(`Optimizing portfolio for wallet: ${walletAddress}`);
  
  try {
    const [nftPositions, tokenBalances] = await Promise.all([
      getUniswapV3NFTs(walletAddress),
      getTokenBalances(walletAddress)
    ]);
    
    // Análisis básico
    const hasPositions = nftPositions.length > 0;
    const topTokens = tokenBalances
      .sort((a, b) => {
        const valueA = (parseFloat(a.balance) / Math.pow(10, a.decimals || 18)) * (a.usd_price || 0);
        const valueB = (parseFloat(b.balance) / Math.pow(10, b.decimals || 18)) * (b.usd_price || 0);
        return valueB - valueA;
      })
      .slice(0, 5);
    
    // Recomendaciones basadas en el portfolio
    const recommendations = [];
    
    if (!hasPositions && tokenBalances.length > 0) {
      recommendations.push({
        action: 'create_position',
        pool: 'USDC/WETH 0.05%',
        reason: 'You have tokens but no active LP positions',
        expectedAPY: '15-25%',
        suggestedAmount: '$1,000 - $10,000'
      });
    }
    
    if (hasPositions) {
      recommendations.push({
        action: 'rebalance',
        pool: 'Multiple',
        reason: 'Optimize position ranges based on current prices',
        expectedAPY: '+5-10%',
        suggestedAmount: 'Current positions'
      });
    }
    
    if (topTokens.some(token => token.symbol === 'USDC' || token.symbol === 'USDT')) {
      recommendations.push({
        action: 'stable_pool',
        pool: 'USDC/USDT 0.01%',
        reason: 'Low risk stable coin yield farming',
        expectedAPY: '5-8%',
        suggestedAmount: '50% of stable holdings'
      });
    }
    
    res.json({
      success: true,
      data: {
        wallet: walletAddress,
        currentPositions: nftPositions.length,
        totalTokens: tokenBalances.length,
        recommendations: recommendations,
        optimizedAllocation: {
          'Stable Pools (USDC/USDT)': 30,
          'Major Pairs (WETH/USDC)': 40,
          'Volatile Pairs (WBTC/WETH)': 20,
          'Hold as tokens': 10
        },
        riskProfile: hasPositions ? 'Experienced' : 'Beginner',
        expectedAPY: '12-18%',
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in portfolio optimization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize portfolio',
      details: error.message
    });
  }
});

// ==========================================
// ENDPOINTS DE COMPATIBILIDAD
// ==========================================
app.get('/api/positions', (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Wallet address required',
    message: 'Please use /api/positions/{walletAddress}'
  });
});

app.get('/api/portfolio', (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Wallet address required',
    message: 'Please use /api/portfolio/{walletAddress}'
  });
});

// ==========================================
// CATCH ALL ROUTE
// ==========================================
app.get('*', (req, res) => {
  console.log(`Unknown route requested: ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    availableRoutes: [
      '/',
      '/health',
      '/api/test-moralis',
      '/api/analyze/{walletAddress}',
      '/api/positions/{walletAddress}',
      '/api/portfolio/{walletAddress}',
      '/api/pool-analysis',
      '/api/wallet-activity/{walletAddress}',
      '/api/portfolio-optimization/{walletAddress}'
    ]
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = process.env.PORT || 5679;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   UNISWAP V3 AI AGENT - MORALIS API   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('');
  console.log('📊 Configuration Status:');
  console.log(`   Moralis API: ${MORALIS_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log('');
  console.log('🔗 Available Endpoints:');
  console.log('   GET /health');
  console.log('   GET /api/test-moralis');
  console.log('   GET /api/analyze/{wallet}');
  console.log('   GET /api/positions/{wallet}');
  console.log('   GET /api/portfolio/{wallet}');
  console.log('   GET /api/pool-analysis');
  console.log('   GET /api/wallet-activity/{wallet}');
  console.log('   GET /api/portfolio-optimization/{wallet}');
  console.log('');
  console.log('💡 Test Wallets:');
  console.log('   0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  console.log('   0x2545cAe5fF16374A4713F0521be2e5b3b0109B65');
  console.log('   0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0');
  console.log('╔════════════════════════════════════════╗');
  
  if (!MORALIS_API_KEY) {
    console.error('');
    console.error('⚠️  WARNING: MORALIS_API_KEY not set!');
    console.error('⚠️  Configure it in Railway environment variables');
    console.error('');
  }
});

// ==========================================
// MANEJO DE ERRORES Y SHUTDOWN
// ==========================================
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});