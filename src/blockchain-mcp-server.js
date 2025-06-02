#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// NETWORK AUTO-DETECTION - Hardcoded RPC URLs (no env dependency)
// =============================================================================

// Network configurations with hardcoded RPC URLs
const XDC_NETWORKS = {
  mainnet: {
    chainId: 50,
    rpcUrl: 'https://rpc.xinfin.network',
    explorerUrl: 'https://explorer.xinfin.network'
  },
  testnet: {
    chainId: 51,
    rpcUrl: 'https://rpc.apothem.network',
    explorerUrl: 'https://explorer.apothem.network'
  }
};

// Network detection keywords
const NETWORK_KEYWORDS = {
  mainnet: ['mainnet', 'production', 'prod', 'live', 'main'],
  testnet: ['testnet', 'apothem', 'test', 'testing', 'development', 'dev', 'staging']
};

// Detect network from user prompt
function detectNetworkFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return 'testnet'; // Safe default
  }
  
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for mainnet keywords
  for (const keyword of NETWORK_KEYWORDS.mainnet) {
    if (lowerPrompt.includes(keyword)) {
      return 'mainnet';
    }
  }
  
  // Check for testnet keywords  
  for (const keyword of NETWORK_KEYWORDS.testnet) {
    if (lowerPrompt.includes(keyword)) {
      return 'testnet';
    }
  }
  
  // Default to testnet for safety
  return 'testnet';
}

// Get RPC URL based on network or user prompt (hardcoded URLs)
function getRpcUrl(network = null, userPrompt = null) {
  // If explicit network provided, use it
  if (network && XDC_NETWORKS[network]) {
    return XDC_NETWORKS[network].rpcUrl;
  }
  
  // If user prompt provided, auto-detect
  if (userPrompt) {
    const detectedNetwork = detectNetworkFromPrompt(userPrompt);
    console.error(`🔍 Auto-detected network: ${detectedNetwork} from prompt: "${userPrompt}"`);
    return XDC_NETWORKS[detectedNetwork].rpcUrl;
  }
  
  // Fall back to environment variable or default testnet
  return process.env.RPC_URL || process.env.XDC_RPC_URL || process.env.ETHEREUM_RPC_URL || XDC_NETWORKS.testnet.rpcUrl;
}

// FIXED: Enhanced provider creation with error handling
function createProviderSafely(network = null, userPrompt = null) {
  try {
    // If explicit network provided, use it
    if (network && XDC_NETWORKS[network]) {
      const rpcUrl = XDC_NETWORKS[network].rpcUrl;
      console.error(`🔗 Creating provider for explicit network: ${network} (${rpcUrl})`);
      return new ethers.JsonRpcProvider(rpcUrl);
    }
    
    // If user prompt provided, auto-detect
    if (userPrompt) {
      const detectedNetwork = detectNetworkFromPrompt(userPrompt);
      const rpcUrl = XDC_NETWORKS[detectedNetwork].rpcUrl;
      console.error(`🔍 Auto-detected network: ${detectedNetwork} from prompt (${rpcUrl})`);
      return new ethers.JsonRpcProvider(rpcUrl);
    }
    
    // Fall back to environment variable or default testnet
    const rpcUrl = getRpcUrl();
    console.error(`🔄 Using default provider: ${rpcUrl}`);
    return new ethers.JsonRpcProvider(rpcUrl);
    
  } catch (error) {
    console.error(`❌ Provider creation failed: ${error.message}, falling back to default testnet`);
    return new ethers.JsonRpcProvider(XDC_NETWORKS.testnet.rpcUrl);
  }
}

// Enhanced provider creation (replaces original createProvider)
function createProvider(network = null, userPrompt = null) {
  return createProviderSafely(network, userPrompt);
}

// Helper function to extract token ID from user prompt - ENHANCED
function extractTokenIdFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return null;
  }
  
  console.error(`🔍 Analyzing prompt for token ID: "${prompt}"`);
  
  const tokenIdPatterns = [
    // Explicit patterns (highest priority)
    /token\s*id\s*[:\s=]\s*(\d+)/i,
    /tokenid\s*[:\s=]\s*(\d+)/i,
    /id\s*[:\s=]\s*(\d+)/i,
    
    // Natural language patterns
    /token\s*(\d+)/i,
    /nft\s*(\d+)/i,
    /asset\s*(\d+)/i,
    /item\s*(\d+)/i,
    
    // Action-specific patterns
    /wrap\s*(\d+)/i,
    /fractionalize\s*(\d+)/i,
    /polytrade\s*(\d+)/i,
    
    // Reference patterns
    /(\d+)\s*(?:token|nft|asset)/i,
    /number\s*(\d+)/i,
    /#(\d+)/i,
  ];
  
  // Try patterns in order of specificity
  for (let i = 0; i < tokenIdPatterns.length; i++) {
    const pattern = tokenIdPatterns[i];
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const tokenId = parseInt(match[1]);
      console.error(`🎯 Extracted TOKEN_ID: ${tokenId} using pattern ${i + 1} from: "${prompt}"`);
      return tokenId;
    }
  }
  
  // Smart fallback: find any reasonable number
  const numberMatches = [...prompt.matchAll(/\b(\d{1,6})\b/g)];
  if (numberMatches.length > 0) {
    const numbers = numberMatches.map(m => parseInt(m[1])).filter(n => n >= 0 && n <= 999999);
    if (numbers.length > 0) {
      const selectedTokenId = Math.min(...numbers);
      console.error(`🔍 Smart fallback TOKEN_ID: ${selectedTokenId} from numbers: [${numbers.join(', ')}] in: "${prompt}"`);
      return selectedTokenId;
    }
  }
  
  console.error(`❌ No token ID found in prompt: "${prompt}"`);
  return null;
}

// =============================================================================
// ENHANCED VALIDATION AND ERROR HANDLING
// =============================================================================

// Environment variable validation helper
function validateEnvironmentVariables(required, optional = {}) {
  const missing = [];
  const found = {};
  
  for (const [key, description] of Object.entries(required)) {
    const value = process.env[key];
    if (!value) {
      missing.push(`${key} (${description})`);
    } else {
      found[key] = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    }
  }
  
  for (const [key, defaultValue] of Object.entries(optional)) {
    found[key] = process.env[key] || defaultValue;
  }
  
  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return found;
}

// Address validation helper
function validateAddress(address, name) {
  if (!address) {
    throw new Error(`❌ ${name} address is required`);
  }
  if (!ethers.isAddress(address)) {
    throw new Error(`❌ Invalid ${name} address format: ${address}`);
  }
  return address.toLowerCase();
}

// Enhanced contract verification
async function verifyContract(provider, address, name) {
  try {
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(`❌ No contract found at ${name} address: ${address}`);
    }
    return true;
  } catch (error) {
    throw new Error(`❌ Contract verification failed for ${name}: ${error.message}`);
  }
}

// Safe transaction execution
async function executeTransaction(contract, methodName, args, options = {}) {
  try {
    // Static call first to catch errors early
    await contract[methodName].staticCall(...args);
    
    // Estimate gas
    const gasEstimate = await contract[methodName].estimateGas(...args);
    const gasLimit = gasEstimate + (gasEstimate * 20n) / 100n; // 20% buffer
    
    // Execute transaction
    const tx = await contract[methodName](...args, { gasLimit, ...options });
    
    return {
      hash: tx.hash,
      transaction: tx,
      wait: () => tx.wait()
    };
  } catch (error) {
    throw new Error(`❌ Transaction failed for ${methodName}: ${error.message}`);
  }
}

// =============================================================================
// END ENHANCED VALIDATION
// =============================================================================

// Setup ethers provider - Uses hardcoded testnet by default (safer for development)
const RPC_URL = process.env.RPC_URL || process.env.XDC_RPC_URL || process.env.ETHEREUM_RPC_URL || XDC_NETWORKS.testnet.rpcUrl;
const provider = new ethers.JsonRpcProvider(RPC_URL);

console.error(`🌐 Connecting to: ${RPC_URL}`);

const server = new McpServer({
  name: 'blockchain-super-tools-mcp-server',
  version: '1.13.0', // Updated version
}, {
  capabilities: {
    tools: {},
  },
});

// Contract ABIs
const ABIS = {
  erc721: [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId) external",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function safeMint(address to, string memory uri) external",
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
  ],
  erc721a: [
    "function totalSupply() view returns (uint256)",
    "function mint(address to, uint256 quantity) external",
    "function safeMint(address to, uint256 quantity) external",
    "function numberMinted(address owner) view returns (uint256)",
    "function exists(uint256 tokenId) view returns (bool)"
  ],
  erc6960: [
    "function balanceOf(address account, uint256 mainId, uint256 subId) view returns (uint256)",
    "function mint(address to, uint256 mainId, uint256 subId, uint256 amount) external",
    "function batchMint(address to, uint256[] calldata mainIds, uint256[] calldata subIds, uint256[] calldata amounts) external",
    "function transfer(address to, uint256 mainId, uint256 subId, uint256 amount) external",
    "function totalSupply(uint256 mainId, uint256 subId) view returns (uint256)"
  ],
  baseAsset: [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function grantRole(bytes32 role, address account) external",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function ASSET_MANAGER() view returns (bytes32)",
    "function setBaseURI(uint256 mainId, string calldata newBaseURI) external",
    "function tokenURI(uint256 mainId, uint256 subId) view returns (string)",
    "function getAssetInfo(uint256 mainId, uint256 subId) view returns (tuple(address initialOwner))",
    "function mint(address to, uint256 mainId, uint256 subId, uint256 amount) external",
    "function batchMint(address to, uint256[] calldata mainIds, uint256[] calldata subIds, uint256[] calldata amounts) external"
  ],
  wrappedAsset: [
    "function whitelist(address contractAddress, bool status) external",
    "function wrapERC721(address contractAddress, uint256 tokenId, uint256 fractions) external returns (uint256)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function unwrapERC721(address contractAddress, uint256 tokenId) external",
    "function getWrappedInfo(address contractAddress, uint256 tokenId) view returns (tuple(uint256 mainId, uint256 fractions, bool exists))"
  ],
  marketplace: [
    "function createListing(uint256 mainId, uint256 subId, uint256 amount, uint256 price) external",
    "function buyFromListing(uint256 listingId, uint256 amount) external payable",
    "function cancelListing(uint256 listingId) external",
    "function getListingInfo(uint256 listingId) view returns (tuple(address seller, uint256 mainId, uint256 subId, uint256 amount, uint256 price, bool active))"
  ],
  erc20: [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)"
  ]
};

// Load Polytrade contract addresses from environment variables with fallbacks
const POLYTRADE_CONTRACTS = {
  baseAsset: process.env.POLYTRADE_BASE_ASSET_TESTNET_CONTRACT || "0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771",
  wrappedAsset: process.env.POLYTRADE_WRAPPED_ASSET_TESTNET_CONTRACT || "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075",
  marketplace: process.env.POLYTRADE_MARKETPLACE_TESTNET_CONTRACT || "0x0d1Aa18eFa38eE8c3d32A84b9D452EAf4E3D571d",
  feeManager: process.env.POLYTRADE_FEE_MANAGER_TESTNET_CONTRACT || "0x31dDa0071Da559E4189C6Beb11eca942cB0350BE",
};

// Helper function to get network currency symbol
async function getNetworkCurrency() {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    const currencyMap = {
      1: 'ETH',           // Ethereum Mainnet
      137: 'MATIC',       // Polygon
      56: 'BNB',          // Binance Smart Chain
      50: 'XDC',          // XDC Network
      51: 'XDC',          // XDC Apothem Testnet
      31337: 'ETH',       // Local hardhat
      1337: 'ETH',        // Local ganache
    };
    
    return currencyMap[chainId] || 'ETH';
  } catch {
    return 'ETH';
  }
}

// Helper function to calculate mainId
function calculateMainId(nftContract, tokenId) {
  return ethers.keccak256(
    ethers.defaultAbiCoder.encode(
      ['address', 'uint256'], 
      [nftContract, tokenId]
    )
  );
}

// Helper function to format response
function formatResponse(data) {
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify(data, null, 2) 
    }]
  };
}

// Helper function to get contract addresses with environment variable support
function getContractAddresses(contractOverrides = {}) {
  return {
    baseAsset: contractOverrides.baseAsset || POLYTRADE_CONTRACTS.baseAsset,
    wrappedAsset: contractOverrides.wrappedAsset || POLYTRADE_CONTRACTS.wrappedAsset,
    marketplace: contractOverrides.marketplace || POLYTRADE_CONTRACTS.marketplace,
    feeManager: contractOverrides.feeManager || POLYTRADE_CONTRACTS.feeManager,
  };
}

// Helper function to log environment variables being used
function logEnvironmentUsage() {
  return {
    polytradeContracts: {
      baseAsset: process.env.POLYTRADE_BASE_ASSET_TESTNET_CONTRACT ? "✅ From ENV" : "🔄 Using Default",
      wrappedAsset: process.env.POLYTRADE_WRAPPED_ASSET_TESTNET_CONTRACT ? "✅ From ENV" : "🔄 Using Default",
      marketplace: process.env.POLYTRADE_MARKETPLACE_TESTNET_CONTRACT ? "✅ From ENV" : "🔄 Using Default", 
      feeManager: process.env.POLYTRADE_FEE_MANAGER_TESTNET_CONTRACT ? "✅ From ENV" : "🔄 Using Default"
    },
    addresses: POLYTRADE_CONTRACTS,
    rpcUrls: {
      mainnet: XDC_NETWORKS.mainnet.rpcUrl,
      testnet: XDC_NETWORKS.testnet.rpcUrl,
      currentDefault: RPC_URL,
      note: "RPC URLs are now hardcoded - no environment dependency"
    }
  };
}

// FIXED: Enhanced token ID resolution
function resolveTokenId(envOverrides, userPrompt) {
  const extractedTokenId = extractTokenIdFromPrompt(userPrompt);
  
  let tokenIdSource;
  let tokenIdSourceType;

  if (envOverrides.TARGET_TOKEN_ID !== undefined) {
    tokenIdSource = envOverrides.TARGET_TOKEN_ID;
    tokenIdSourceType = "envOverrides";
  } else if (extractedTokenId !== null) {
    tokenIdSource = extractedTokenId.toString();
    tokenIdSourceType = "prompt";
  } else if (process.env.TARGET_TOKEN_ID !== undefined) {
    tokenIdSource = process.env.TARGET_TOKEN_ID;
    tokenIdSourceType = "environment";
  } else {
    tokenIdSource = "0";
    tokenIdSourceType = "default";
  }

  const tokenId = parseInt(tokenIdSource);

  // Validation
  if (isNaN(tokenId) || tokenId < 0) {
    throw new Error(`❌ Invalid token ID: ${tokenIdSource} (from ${tokenIdSourceType})`);
  }

  return {
    tokenId,
    sourceType: tokenIdSourceType,
    extractedFromPrompt: extractedTokenId !== null
  };
}

// =============================================================================
// SUPER TOOL 1: ASSET MINTER 
// Handles NFT minting from environment variables
// Enhanced with network auto-detection
// =============================================================================

server.tool(
  'asset_minter_super_tool',
  'SUPER TOOL 1: Complete NFT minting workflow using environment variables - packages all minting operations with network auto-detection',
  {
    type: 'object',
    properties: {
      envOverrides: {
        type: 'object',
        description: 'Optional overrides for environment variables (matches script parameter names)',
        properties: {
          ORIG_NFT_CONTRACT_ADDRESS: { type: 'string' },
          ORIG_NFT_RECIPIENT_ADDRESS: { type: 'string' },
          ORIG_NFT_TOKEN_URI: { type: 'string' },
          ORIG_NFT_OWNER_PRIVATE_KEY: { type: 'string' }
        }
      },
      preparationMode: {
        type: 'boolean',
        description: 'If true, stops after minting for metadata enrichment (default: false)',
        default: false
      },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet'],
        description: 'Explicit network selection (optional - can be auto-detected from userPrompt)'
      },
      userPrompt: {
        type: 'string',
        description: 'User message for network auto-detection (alternative to explicit network)'
      }
    },
    required: [],
  },
  async (args) => {
    try {
      const { envOverrides = {}, preparationMode = false, network, userPrompt } = args;

      // Create provider with network detection - FIXED
      const currentProvider = (network || userPrompt) ? createProviderSafely(network, userPrompt) : provider;

      const result = {
        toolName: 'ASSET_MINTER_SUPER_TOOL',
        status: 'starting',
        logs: [],
        data: {},
        success: false,
        envUsed: {},
        nextSteps: [],
        networkUsed: network || (userPrompt ? detectNetworkFromPrompt(userPrompt) : 'default')
      };

      result.logs.push("🚀 SUPER TOOL 1: Starting Asset Minter workflow...");

      // Log network detection if used
      if (userPrompt && !network) {
        const detectedNetwork = detectNetworkFromPrompt(userPrompt);
        result.logs.push(`🔍 Auto-detected network: ${detectedNetwork} from prompt: "${userPrompt}"`);
      } else if (network) {
        result.logs.push(`🎯 Using explicit network: ${network}`);
      }

      // Read from environment with optional overrides
      const contractAddress = envOverrides.ORIG_NFT_CONTRACT_ADDRESS || process.env.ORIG_NFT_CONTRACT_ADDRESS;
      const recipientAddress = envOverrides.ORIG_NFT_RECIPIENT_ADDRESS || 
        process.env.ORIG_NFT_RECIPIENT_ADDRESS || 
        "0x9281B31230C735867a2Fd62aF8ec816Cc1714521";
      const tokenURI = envOverrides.ORIG_NFT_TOKEN_URI || 
        process.env.ORIG_NFT_TOKEN_URI || 
        "https://CANFT4.com";
      const ownerPrivateKey = envOverrides.ORIG_NFT_OWNER_PRIVATE_KEY || 
        process.env.ORIG_NFT_OWNER_PRIVATE_KEY;

      // Store environment usage
      result.envUsed = {
        contractAddress: contractAddress ? "✅ Found" : "❌ Missing",
        recipientAddress: recipientAddress,
        tokenURI: tokenURI,
        ownerPrivateKey: ownerPrivateKey ? "✅ Found" : "❌ Missing"
      };

      // Enhanced validation
      if (!contractAddress) {
        throw new Error("❌ Please set ORIG_NFT_CONTRACT_ADDRESS environment variable");
      }

      validateAddress(contractAddress, "contract");
      validateAddress(recipientAddress, "recipient");

      if (!ownerPrivateKey) {
        throw new Error("❌ Please set ORIG_NFT_OWNER_PRIVATE_KEY environment variable");
      }

      // Create signer
      let signer;
      try {
        signer = new ethers.Wallet(ownerPrivateKey, currentProvider);
      } catch (error) {
        throw new Error("❌ Invalid private key format");
      }

      result.logs.push(`📝 Signer address: ${signer.address}`);
      
      // Get network info
      try {
        const network = await currentProvider.getNetwork();
        result.logs.push(`📍 Network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`);
        result.data.networkInfo = {
          chainId: Number(network.chainId),
          name: network.name
        };
      } catch (error) {
        result.logs.push(`📍 Network: Unable to fetch network info`);
      }

      // Check balance
      const balance = await currentProvider.getBalance(signer.address);
      result.logs.push(`💰 Signer balance: ${ethers.formatEther(balance)} ${await getNetworkCurrency()}`);

      if (balance < ethers.parseEther("0.01")) {
        result.logs.push("⚠️ Warning: Low balance, transaction might fail");
      }

      // Verify contract exists
      await verifyContract(currentProvider, contractAddress, "NFT contract");

      // Get contract
      const contract = new ethers.Contract(contractAddress, ABIS.erc721, signer);

      // Check ownership
      const owner = await contract.owner();
      result.logs.push(`👑 Contract owner: ${owner}`);
      result.logs.push(`🎯 Recipient: ${recipientAddress}`);

      if (signer.address.toLowerCase() !== owner.toLowerCase()) {
        throw new Error(`❌ Ownership mismatch! Signer: ${signer.address}, Owner: ${owner}`);
      }

      result.logs.push("✅ Ownership verified! Proceeding with mint...");

      // Get total supply
      try {
        const totalSupply = await contract.totalSupply();
        result.logs.push(`📊 Current total supply: ${totalSupply}`);
        result.data.totalSupply = totalSupply.toString();
      } catch (error) {
        result.logs.push("ℹ️ Could not fetch total supply");
      }

      // Check functions
      result.logs.push("🔍 Checking contract functions...");
      const contractInterface = contract.interface;
      const hasSafeMint = contractInterface.fragments.some((f) => f.name === "safeMint");

      if (!hasSafeMint) {
        throw new Error("❌ safeMint function not found in contract!");
      }

      // Check if paused
      try {
        const isPaused = await contract.paused();
        if (isPaused) {
          throw new Error("❌ Contract is paused! Cannot mint.");
        }
        result.logs.push("✅ Contract is not paused");
      } catch (error) {
        result.logs.push("ℹ️ Contract pause state unknown");
      }

      // Execute mint using enhanced transaction handler
      result.logs.push(`🔄 Minting to: ${recipientAddress}`);
      const txResult = await executeTransaction(contract, 'safeMint', [recipientAddress, tokenURI]);
      result.logs.push(`📤 Transaction sent: ${txResult.hash}`);

      const receipt = await txResult.wait();
      result.logs.push(`✅ Minted successfully!`);

      // Extract token ID
      let tokenId = null;
      try {
        const transferEvent = receipt.logs.find((log) => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed.name === "Transfer";
          } catch {
            return false;
          }
        });
        if (transferEvent) {
          const parsed = contract.interface.parseLog(transferEvent);
          tokenId = parsed.args.tokenId.toString();
          result.logs.push(`🆔 Token ID: ${tokenId}`);
        }
      } catch (error) {
        result.logs.push("ℹ️ Could not extract token ID");
      }

      result.data = {
        ...result.data,
        contractAddress,
        tokenId,
        recipientAddress,
        transactionHash: txResult.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      result.status = 'completed';
      result.success = true;

      if (preparationMode) {
        result.logs.push("🎯 PREPARATION MODE: Stopping for metadata enrichment");
        result.nextSteps = [
          "Use metadata_enricher_super_tool to set metadata",
          "Then use polytrade_orchestrator_super_tool for fractionalization"
        ];
      } else {
        result.logs.push("🎉 Asset minting completed!");
        result.nextSteps = [
          "Ready for metadata enrichment or Polytrade operations"
        ];
      }

      return formatResponse(result);

    } catch (error) {
      return formatResponse({
        toolName: 'ASSET_MINTER_SUPER_TOOL',
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }
);

// =============================================================================
// SUPER TOOL 2: METADATA ENRICHER
// Handles metadata setting and can connect to other MCP servers
// Enhanced with network auto-detection
// =============================================================================

server.tool(
  'metadata_enricher_super_tool',
  'SUPER TOOL 2: Metadata enrichment workflow - can connect to other MCP servers and enrich metadata per mainId with network auto-detection',
  {
    type: 'object',
    properties: {
      enrichmentStrategy: {
        type: 'string',
        enum: ['single', 'batch', 'external_mcp', 'ai_generated'],
        description: 'Strategy for metadata enrichment',
        default: 'single'
      },
      metadataConfig: {
        type: 'object',
        description: 'Metadata configuration',
        properties: {
          mainId: { type: 'number' },
          baseURI: { type: 'string' },
          batchMappings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mainId: { type: 'number' },
                baseURI: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' }
              }
            }
          },
          aiPrompt: { type: 'string' },
          externalMcpServer: { type: 'string' }
        }
      },
      adminPrivateKey: {
        type: 'string',
        description: 'Admin private key for setting metadata'
      },
      contracts: {
        type: 'object',
        description: 'Contract addresses (optional, will use environment variables)',
        properties: {
          baseAsset: { type: 'string' }
        }
      },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet'],
        description: 'Explicit network selection (optional - can be auto-detected from userPrompt)'
      },
      userPrompt: {
        type: 'string',
        description: 'User message for network auto-detection (alternative to explicit network)'
      }
    },
    required: ['enrichmentStrategy', 'metadataConfig'],
  },
  async (args) => {
    try {
      const {
        enrichmentStrategy,
        metadataConfig,
        adminPrivateKey,
        contracts = {},
        network,
        userPrompt
      } = args;

      // Create provider with network detection - FIXED
      const currentProvider = (network || userPrompt) ? createProviderSafely(network, userPrompt) : provider;

      const contractAddresses = getContractAddresses(contracts);

      const result = {
        toolName: 'METADATA_ENRICHER_SUPER_TOOL',
        status: 'starting',
        logs: [],
        data: {
          enrichmentResults: [],
          strategy: enrichmentStrategy
        },
        success: false,
        nextSteps: [],
        envUsage: logEnvironmentUsage(),
        networkUsed: network || (userPrompt ? detectNetworkFromPrompt(userPrompt) : 'default')
      };

      result.logs.push("🔗 SUPER TOOL 2: Starting Metadata Enricher workflow...");
      result.logs.push(`📋 Strategy: ${enrichmentStrategy.toUpperCase()}`);

      // Log network detection if used
      if (userPrompt && !network) {
        const detectedNetwork = detectNetworkFromPrompt(userPrompt);
        result.logs.push(`🔍 Auto-detected network: ${detectedNetwork} from prompt: "${userPrompt}"`);
      } else if (network) {
        result.logs.push(`🎯 Using explicit network: ${network}`);
      }

      // Handle different enrichment strategies
      switch (enrichmentStrategy) {
        case 'single':
          result.logs.push("🎯 Single metadata enrichment mode");
          
          if (!metadataConfig.mainId || !metadataConfig.baseURI) {
            throw new Error("❌ Single mode requires mainId and baseURI");
          }

          if (!adminPrivateKey) {
            throw new Error("❌ Admin private key required for metadata setting");
          }

          // Set single metadata
          const adminSigner = new ethers.Wallet(adminPrivateKey, currentProvider);
          await verifyContract(currentProvider, contractAddresses.baseAsset, "BaseAsset contract");
          const contract = new ethers.Contract(contractAddresses.baseAsset, ABIS.baseAsset, adminSigner);

          // Check admin permissions
          const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE();
          const hasAdminRole = await contract.hasRole(defaultAdminRole, adminSigner.address);
          
          if (!hasAdminRole) {
            throw new Error("❌ Admin does not have DEFAULT_ADMIN_ROLE");
          }

          // Set base URI using enhanced transaction handler
          const txResult = await executeTransaction(contract, 'setBaseURI', [metadataConfig.mainId, metadataConfig.baseURI]);
          const receipt = await txResult.wait();

          result.data.enrichmentResults.push({
            mainId: metadataConfig.mainId,
            baseURI: metadataConfig.baseURI,
            transactionHash: txResult.hash,
            gasUsed: receipt.gasUsed.toString(),
            success: true
          });

          result.logs.push(`✅ Metadata set for mainId ${metadataConfig.mainId}`);
          break;

        case 'batch':
          result.logs.push("📦 Batch metadata enrichment mode");
          
          if (!metadataConfig.batchMappings || metadataConfig.batchMappings.length === 0) {
            throw new Error("❌ Batch mode requires batchMappings array");
          }

          if (!adminPrivateKey) {
            throw new Error("❌ Admin private key required for metadata setting");
          }

          const batchAdminSigner = new ethers.Wallet(adminPrivateKey, currentProvider);
          await verifyContract(currentProvider, contractAddresses.baseAsset, "BaseAsset contract");
          const batchContract = new ethers.Contract(contractAddresses.baseAsset, ABIS.baseAsset, batchAdminSigner);

          // Process each mapping
          for (const mapping of metadataConfig.batchMappings) {
            try {
              result.logs.push(`🔄 Setting metadata for mainId ${mapping.mainId}...`);
              
              const batchTxResult = await executeTransaction(batchContract, 'setBaseURI', [mapping.mainId, mapping.baseURI]);
              const batchReceipt = await batchTxResult.wait();
              
              result.data.enrichmentResults.push({
                mainId: mapping.mainId,
                baseURI: mapping.baseURI,
                description: mapping.description || '',
                category: mapping.category || '',
                transactionHash: batchTxResult.hash,
                gasUsed: batchReceipt.gasUsed.toString(),
                success: true
              });
              
              result.logs.push(`✅ MainId ${mapping.mainId} completed`);
              
            } catch (error) {
              result.data.enrichmentResults.push({
                mainId: mapping.mainId,
                baseURI: mapping.baseURI,
                error: error.message,
                success: false
              });
              
              result.logs.push(`❌ MainId ${mapping.mainId} failed: ${error.message}`);
            }
          }
          break;

        case 'external_mcp':
          result.logs.push("🌐 External MCP server enrichment mode");
          result.logs.push("💡 This mode would connect to external MCP servers for metadata generation");
          
          // Placeholder for external MCP server connection
          result.data.enrichmentResults.push({
            strategy: 'external_mcp',
            server: metadataConfig.externalMcpServer || 'not_specified',
            status: 'placeholder_implementation',
            note: 'Would connect to external MCP servers for metadata generation'
          });
          
          result.logs.push("🔄 External MCP connection logic would go here");
          break;

        case 'ai_generated':
          result.logs.push("🤖 AI-generated metadata enrichment mode");
          result.logs.push("💡 This mode would use AI to generate rich metadata");
          
          // Placeholder for AI metadata generation
          result.data.enrichmentResults.push({
            strategy: 'ai_generated',
            prompt: metadataConfig.aiPrompt || 'default_prompt',
            status: 'placeholder_implementation',
            note: 'Would use AI to generate metadata based on NFT characteristics'
          });
          
          result.logs.push("🔄 AI metadata generation logic would go here");
          break;

        default:
          throw new Error(`❌ Unknown enrichment strategy: ${enrichmentStrategy}`);
      }

      result.status = 'completed';
      result.success = result.data.enrichmentResults.some(r => r.success !== false);
      result.logs.push("🎉 Metadata enrichment completed!");
      
      result.nextSteps = [
        "Use polytrade_orchestrator_super_tool for NFT fractionalization",
        "Or use asset_minter_super_tool for additional NFT minting"
      ];

      return formatResponse(result);

    } catch (error) {
      return formatResponse({
        toolName: 'METADATA_ENRICHER_SUPER_TOOL',
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }
);

// =============================================================================
// SUPER TOOL 3: POLYTRADE ORCHESTRATOR
// Handles complete Polytrade workflow from environment variables
// Enhanced with network auto-detection and FIXED token ID logic
// =============================================================================

server.tool(
  'polytrade_orchestrator_super_tool',
  'SUPER TOOL 3: Complete Polytrade orchestration workflow using environment variables - packages all Polytrade operations with network auto-detection',
  {
    type: 'object',
    properties: {
      envOverrides: {
        type: 'object',
        description: 'Optional overrides for environment variables (matches script parameter names)',
        properties: {
          ORIG_NFT_CONTRACT_ADDRESS: {type: 'string'},
          TARGET_TOKEN_ID: { type: 'string' },
          TARGET_FRACTIONS: { type: 'string' },
          POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY: { type: 'string' },
          ORIG_NFT_OWNER_PRIVATE_KEY: { type: 'string' }
        }
      },
      skipIfAlreadyWrapped: {
        type: 'boolean',
        description: 'Skip wrapping if NFT is already wrapped (default: true)',
        default: true
      },
      contracts: {
        type: 'object',
        description: 'Contract addresses (optional, will use environment variables)',
        properties: {
          baseAsset: { type: 'string' },
          wrappedAsset: { type: 'string' },
          marketplace: { type: 'string' },
          feeManager: { type: 'string' }
        }
      },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet'],
        description: 'Explicit network selection (optional - can be auto-detected from userPrompt)'
      },
      userPrompt: {
        type: 'string',
        description: 'User message for network auto-detection (alternative to explicit network)'
      }
    },
    required: [],
  },
  async (args) => {
    try {
      const {
        envOverrides = {},
        skipIfAlreadyWrapped = true,
        contracts = {},
        network,
        userPrompt
      } = args;

      // Create provider with network detection - FIXED
      const currentProvider = (network || userPrompt) ? createProviderSafely(network, userPrompt) : provider;

      const contractAddresses = getContractAddresses(contracts);

      const result = {
        toolName: 'POLYTRADE_ORCHESTRATOR_SUPER_TOOL',
        status: 'starting',
        logs: [],
        steps: {},
        data: {},
        success: false,
        envUsed: {},
        envUsage: logEnvironmentUsage(),
        networkUsed: network || (userPrompt ? detectNetworkFromPrompt(userPrompt) : 'default')
      };

      result.logs.push("🎁 SUPER TOOL 3: Starting Polytrade Orchestrator workflow...");

      // Log network detection if used
      if (userPrompt && !network) {
        const detectedNetwork = detectNetworkFromPrompt(userPrompt);
        result.logs.push(`🔍 Auto-detected network: ${detectedNetwork} from prompt: "${userPrompt}"`);
      } else if (network) {
        result.logs.push(`🎯 Using explicit network: ${network}`);
      }

      // Read from environment with optional overrides
      const nftContract = envOverrides.ORIG_NFT_CONTRACT_ADDRESS || process.env.ORIG_NFT_CONTRACT_ADDRESS;

      // FIXED: Enhanced token ID extraction with proper handling
      const tokenIdInfo = resolveTokenId(envOverrides, userPrompt);
      const tokenId = tokenIdInfo.tokenId;

      const fractionsInput = parseFloat(envOverrides.TARGET_FRACTIONS || process.env.TARGET_FRACTIONS || "10000000");
      const adminPrivateKey = envOverrides.POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY || process.env.POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY;
      const nftOwnerPrivateKey = envOverrides.ORIG_NFT_OWNER_PRIVATE_KEY || process.env.ORIG_NFT_OWNER_PRIVATE_KEY;

      // Enhanced logging for token ID resolution
      result.logs.push(`🎯 Using TOKEN_ID: ${tokenId} (source: ${tokenIdInfo.sourceType})`);
      if (tokenIdInfo.extractedFromPrompt) {
        result.logs.push(`🔍 Extracted from prompt: "${userPrompt}"`);
      }

      // Store environment usage
      result.envUsed = {
        nftContract: nftContract ? "✅ Found" : "❌ Missing",
        tokenId: tokenId,
        fractions: fractionsInput,
        adminPrivateKey: adminPrivateKey ? "✅ Found" : "❌ Missing",
        nftOwnerPrivateKey: nftOwnerPrivateKey ? "✅ Found" : "❌ Missing",
        tokenIdResolution: tokenIdInfo
      };

      // Enhanced validation
      if (!nftContract) {
        throw new Error("❌ Please set ORIG_NFT_CONTRACT_ADDRESS environment variable");
      }

      validateAddress(nftContract, "NFT contract");

      if (isNaN(fractionsInput) || fractionsInput <= 0) {
        throw new Error(`❌ Invalid fractions amount: ${fractionsInput}`);
      }

      if (!adminPrivateKey) {
        throw new Error("❌ Admin private key not found in environment variables");
      }

      if (!nftOwnerPrivateKey) {
        throw new Error("❌ NFT owner private key not found in environment variables");
      }

      const fractionsAmount = ethers.parseEther(fractionsInput.toString());
      result.logs.push(`📋 Parameters: NFT=${nftContract}, TokenID=${tokenId}, Fractions=${fractionsInput}`);

      // Create signers
      const adminSigner = new ethers.Wallet(adminPrivateKey, currentProvider);
      const nftOwnerSigner = new ethers.Wallet(nftOwnerPrivateKey, currentProvider);

      result.logs.push(`🔑 Admin: ${adminSigner.address}`);
      result.logs.push(`🔑 NFT Owner: ${nftOwnerSigner.address}`);

      // Check contracts exist - Enhanced
      for (const [name, address] of Object.entries(contractAddresses)) {
        await verifyContract(currentProvider, address, `${name} contract`);
      }
      result.logs.push("✅ All Polytrade contracts exist");

      // Get contract instances
      const nftContract_instance = new ethers.Contract(nftContract, ABIS.erc721, nftOwnerSigner);
      const baseAssetContract = new ethers.Contract(contractAddresses.baseAsset, ABIS.baseAsset, adminSigner);
      const wrappedAssetContract = new ethers.Contract(contractAddresses.wrappedAsset, ABIS.wrappedAsset, adminSigner);

      // Check NFT ownership
      const nftOwner = await nftContract_instance.ownerOf(tokenId);
      result.data.nftOwner = nftOwner;

      // Check if already wrapped
      if (nftOwner.toLowerCase() === contractAddresses.wrappedAsset.toLowerCase()) {
        result.logs.push("🎁 NFT is already wrapped! ✅");
        
        if (skipIfAlreadyWrapped) {
          result.status = 'completed';
          result.success = true;
          result.data.alreadyWrapped = true;
          result.logs.push("⏭️ Skipping wrapping process as requested");
          return formatResponse(result);
        }
      }

      if (nftOwner.toLowerCase() !== nftOwnerSigner.address.toLowerCase()) {
        throw new Error(`❌ NFT owner mismatch! Expected: ${nftOwnerSigner.address}, Actual: ${nftOwner}`);
      }
      result.logs.push("✅ NFT ownership confirmed");
      result.steps.verification = true;

      // Check admin permissions
      const defaultAdminRole = await wrappedAssetContract.DEFAULT_ADMIN_ROLE();
      const [adminHasWrappedRole, baseAdminHasRole] = await Promise.all([
        wrappedAssetContract.hasRole(defaultAdminRole, adminSigner.address),
        baseAssetContract.hasRole(defaultAdminRole, adminSigner.address)
      ]);

      if (!adminHasWrappedRole || !baseAdminHasRole) {
        throw new Error("❌ Admin missing required permissions");
      }
      result.logs.push("✅ Admin permissions confirmed");
      result.steps.permissions = true;

      // Whitelist NFT contract
      try {
        const whitelistTxResult = await executeTransaction(wrappedAssetContract, 'whitelist', [nftContract, true]);
        const whitelistReceipt = await whitelistTxResult.wait();
        result.logs.push(`✅ NFT contract whitelisted! Tx: ${whitelistTxResult.hash}`);
        result.data.whitelistTx = whitelistTxResult.hash;
      } catch (error) {
        if (error.message.includes("already") || error.message.includes("StatusChanged")) {
          result.logs.push("✅ NFT contract already whitelisted");
        } else {
          throw error;
        }
      }
      result.steps.whitelist = true;

      // Set up ASSET_MANAGER permissions
      const ASSET_MANAGER = await baseAssetContract.ASSET_MANAGER();
      const hasAssetManagerRole = await baseAssetContract.hasRole(ASSET_MANAGER, contractAddresses.wrappedAsset);

      if (!hasAssetManagerRole) {
        const grantTxResult = await executeTransaction(baseAssetContract, 'grantRole', [ASSET_MANAGER, contractAddresses.wrappedAsset]);
        const grantReceipt = await grantTxResult.wait();
        result.logs.push(`✅ ASSET_MANAGER role granted! Tx: ${grantTxResult.hash}`);
        result.data.grantRoleTx = grantTxResult.hash;
      } else {
        result.logs.push("✅ WrappedAsset already has ASSET_MANAGER role");
      }
      result.steps.assetManager = true;

      // Set up NFT approvals
      const approved = await nftContract_instance.getApproved(tokenId);
      if (approved.toLowerCase() !== contractAddresses.wrappedAsset.toLowerCase()) {
        const approveTxResult = await executeTransaction(nftContract_instance, 'approve', [contractAddresses.wrappedAsset, tokenId]);
        const approveReceipt = await approveTxResult.wait();
        result.logs.push(`✅ NFT approved! Tx: ${approveTxResult.hash}`);
        result.data.approveTx = approveTxResult.hash;
      } else {
        result.logs.push("✅ NFT already approved");
      }
      result.steps.approval = true;

      // Wrap NFT
      const wrappedAssetWithOwner = new ethers.Contract(contractAddresses.wrappedAsset, ABIS.wrappedAsset, nftOwnerSigner);
      const wrapTxResult = await executeTransaction(wrappedAssetWithOwner, 'wrapERC721', [nftContract, tokenId, fractionsAmount]);
      
      result.logs.push(`🔄 Transaction submitted: ${wrapTxResult.hash}`);
      const receipt = await wrapTxResult.wait();
      
      result.logs.push(`✅ NFT wrapped successfully!`);
      result.data.wrapTx = wrapTxResult.hash;
      result.data.gasUsed = receipt.gasUsed.toString();
      result.steps.wrap = true;

      result.status = 'completed';
      result.success = true;
      result.logs.push("🎉 Polytrade orchestration completed successfully!");

      result.nextSteps = [
        "NFT successfully fractionalized into ERC6960 tokens",
        "Ready for marketplace operations or additional metadata management"
      ];

      return formatResponse(result);

    } catch (error) {
      return formatResponse({
        toolName: 'POLYTRADE_ORCHESTRATOR_SUPER_TOOL',
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }
);

// Start the server
async function main() {
  try {
    // Test network connection
    console.error("🔍 Testing network connection...");
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    console.error(`✅ Connected to ${network.name || 'Unknown Network'}`);
    console.error(`📊 Chain ID: ${network.chainId}`);
    console.error(`🔢 Current Block: ${blockNumber}`);
    console.error(`🌐 RPC URL: ${RPC_URL}`);
    console.error(`🚀 Network Auto-Detection: ENABLED (Hardcoded URLs)`);
    console.error(`📍 Mainnet RPC: ${XDC_NETWORKS.mainnet.rpcUrl}`);
    console.error(`🧪 Testnet RPC: ${XDC_NETWORKS.testnet.rpcUrl}`);
    console.error(`🔧 Enhanced Error Handling: ENABLED`);
    console.error(`🎯 Fixed Token ID Logic: ENABLED`);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ Blockchain Super Tools MCP Server v1.13.0 with Enhanced Features running on stdio");
    
  } catch (error) {
    console.error("❌ Failed to connect to network:", error.message);
    console.error("💡 Please check your RPC_URL in .env file");
    console.error(`🔧 Current RPC URL: ${RPC_URL}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});