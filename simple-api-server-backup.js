const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Configurar CORS
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Configuración de Moralis
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNmMzE1NDdkLWViOWItNDA4OC1hMzA5LThkMDU4OGE3OTBmNiIsIm9yZ0lkIjoiNDYxNzQ4IiwidXNlcklkIjoiNDc1MDQ0IiwidHlwZUlkIjoiMzRiNTM3NmItMGMzNi00ZTUyLWFhMDctOTAzNDg5ZWJkODc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTM2MTg0NjIsImV4cCI6NDkwOTM3ODQ2Mn0.7l5ccJ_rq0tlLaDwSXOkTHlxNcoaQUcHmSqE-vQevqY'; // Reemplazar con tu API key
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

// Wallet de ejemplo (puedes cambiar por cualquier wallet)
const DEMO_WALLET = '0x8ba1f109551bD432803012645Hac136c29F64cd'; // Wallet con posiciones V3

// Headers para Moralis
const moralisHeaders = {
  'X-API-Key': MORALIS_API_KEY,
  'Content-Type': 'application/json'
};

// Función para obtener posiciones reales de Uniswap V3
const fetchUniswapV3Positions = async (walletAddress) => {
  try {
    console.log(`🔍 Fetching Uniswap V3 positions for wallet: ${walletAddress}`);
    
    const response = await axios.get(
      `${MORALIS_BASE_URL}/wallets/${walletAddress}/defi/uniswap-v3/positions`,
      { headers: moralisHeaders }
    );

    const positions = response.data?.result || [];
    console.log(`📊 Found ${positions.length} positions`);

    // Transformar datos de Moralis al formato del dashboard
    const transformedPositions = positions.map(position => {
      const token0 = position.token0_symbol || 'Unknown';
      const token1 = position.token1_symbol || 'Unknown';
      const currentPrice = parseFloat(position.current_price || 0);
      const minPrice = parseFloat(position.price_lower || 0);
      const maxPrice = parseFloat(position.price_upper || 0);
      const inRange = position.in_range === true;
      const unclaimedFees0 = parseFloat(position.unclaimed_fee_token_0_human || 0);
      const unclaimedFees1 = parseFloat(position.unclaimed_fee_token_1_human || 0);
      const totalFeesUSD = (unclaimedFees0 * (position.token0_price_usd || 0)) + 
                          (unclaimedFees1 * (position.token1_price_usd || 0));
      
      return {
        tokenPair: `${token0}/${token1}`,
        currentPrice: currentPrice,
        minPrice: minPrice,
        maxPrice: maxPrice,
        inRange: inRange,
        unclaimedFees: totalFeesUSD.toFixed(2),
        apr: parseFloat(position.apr || 0),
        impermanentLoss: parseFloat(position.il_percentage || 0),
        liquidity: parseFloat(position.liquidity_usd || 0).toFixed(2),
        volume24h: position.volume_24h_usd || 'N/A',
        feeTier: `${position.fee_tier || 'N/A'}%`,
        positionId: position.token_id,
        nftManager: position.nft_manager_address
      };
    });

    return transformedPositions;
  } catch (error) {
    console.error('❌ Error fetching Moralis data:', error.message);
    return [];
  }
};

// API endpoint para posiciones
app.get('/api/positions', async (req, res) => {
  try {
    console.log('📡 API call received: /api/positions');
    
    // Usar wallet de query param o wallet demo
    const walletAddress = req.query.wallet || DEMO_WALLET;
    
    const positions = await fetchUniswapV3Positions(walletAddress);
    
    if (positions.length === 0) {
      // Fallback data si no hay posiciones reales
      console.log('⚠️ No positions found, using fallback data');
      return res.json([
        {
          tokenPair: "ETH/USDC",
          currentPrice: 2387.45,
          minPrice: 2200.00,
          maxPrice: 2600.00,
          inRange: false,
          unclaimedFees: "127.50",
          apr: 18.2,
          impermanentLoss: -2.3,
          liquidity: "8450.23",
          volume24h: "2.1M",
          feeTier: "0.05%"
        }
      ]);
    }

    console.log(`✅ Returning ${positions.length} real positions`);
    res.json(positions);
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// API endpoint para portfolio summary
app.get('/api/portfolio', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || DEMO_WALLET;
    const positions = await fetchUniswapV3Positions(walletAddress);
    
    // Calcular métricas del portfolio
    const totalLiquidity = positions.reduce((sum, pos) => sum + parseFloat(pos.liquidity || 0), 0);
    const totalFees = positions.reduce((sum, pos) => sum + parseFloat(pos.unclaimedFees || 0), 0);
    const avgAPR = positions.length > 0 ? 
      positions.reduce((sum, pos) => sum + parseFloat(pos.apr || 0), 0) / positions.length : 0;
    const inRangeCount = positions.filter(pos => pos.inRange).length;
    
    const portfolio = {
      totalValueLocked: totalLiquidity.toFixed(2),
      totalUnclaimedFees: totalFees.toFixed(2),
      averageApr: avgAPR.toFixed(1),
      positionsCount: positions.length,
      inRangeCount: inRangeCount,
      outOfRangeCount: positions.length - inRangeCount
    };
    
    res.json(portfolio);
    
  } catch (error) {
    console.error('❌ Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    moralis: MORALIS_API_KEY ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, () => {
  console.log(`🦄 Uniswap API Server running on http://localhost:${PORT}`);
  console.log(`📡 Moralis API: ${MORALIS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`💼 Demo wallet: ${DEMO_WALLET}`);
});
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNmMzE1NDdkLWViOWItNDA4OC1hMzA5LThkMDU4OGE3OTBmNiIsIm9yZ0lkIjoiNDYxNzQ4IiwidXNlcklkIjoiNDc1MDQ0IiwidHlwZUlkIjoiMzRiNTM3NmItMGMzNi00ZTUyLWFhMDctOTAzNDg5ZWJkODc2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTM2MTg0NjIsImV4cCI6NDkwOTM3ODQ2Mn0.7l5ccJ_rq0tlLaDwSXOkTHlxNcoaQUcHmSqE-vQevqY";
