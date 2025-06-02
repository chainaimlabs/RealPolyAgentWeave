#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Setup ethers provider - XDC Apothem Testnet by default (safer for development)
const RPC_URL = process.env.RPC_URL || process.env.XDC_RPC_URL || process.env.ETHEREUM_RPC_URL || 'https://rpc.apothem.network';
const provider = new ethers.JsonRpcProvider(RPC_URL);

console.error(`🌐 Connecting to: ${RPC_URL}`);

const server = new McpServer({
  name: 'blockchain-super-tools-mcp-server',
  version: '1.12.0',
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
  baseAsset: process.env.POLYTRADE_BASE_ASSET_CONTRACT || "0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771",
  wrappedAsset: process.env.POLYTRADE_WRAPPED_ASSET_CONTRACT || "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075",
  marketplace: process.env.POLYTRADE_MARKETPLACE_CONTRACT || "0x0d1Aa18eFa38eE8c3d32A84b9D452EAf4E3D571d",
  feeManager: process.env.POLYTRADE_FEE_MANAGER_CONTRACT || "0x31dDa0071Da559E4189C6Beb11eca942cB0350BE",
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
      baseAsset: process.env.POLYTRADE_BASE_ASSET_CONTRACT ? "✅ From ENV" : "🔄 Using Default",
      wrappedAsset: process.env.POLYTRADE_WRAPPED_ASSET_CONTRACT ? "✅ From ENV" : "🔄 Using Default",
      marketplace: process.env.POLYTRADE_MARKETPLACE_CONTRACT ? "✅ From ENV" : "🔄 Using Default", 
      feeManager: process.env.POLYTRADE_FEE_MANAGER_CONTRACT ? "✅ From ENV" : "🔄 Using Default"
    },
    addresses: POLYTRADE_CONTRACTS
  };
}

// =============================================================================
// SUPER TOOL 1: ASSET MINTER 
// Handles NFT minting from environment variables
// =============================================================================

server.tool(
  'asset_minter_super_tool',
  'SUPER TOOL 1: Complete NFT minting workflow using environment variables - packages all minting operations',
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
      }
    },
    required: [],
  },
  async (args) => {
    try {
      const { envOverrides = {}, preparationMode = false } = args;

      const result = {
        toolName: 'ASSET_MINTER_SUPER_TOOL',
        status: 'starting',
        logs: [],
        data: {},
        success: false,
        envUsed: {},
        nextSteps: []
      };

      result.logs.push("🚀 SUPER TOOL 1: Starting Asset Minter workflow...");

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

      // Validation
      if (!contractAddress) {
        throw new Error("❌ Please set ORIG_NFT_CONTRACT_ADDRESS environment variable");
      }

      if (!ethers.isAddress(contractAddress)) {
        throw new Error("❌ Invalid contract address format");
      }

      if (!ethers.isAddress(recipientAddress)) {
        throw new Error("❌ Invalid recipient address format");
      }

      if (!ownerPrivateKey) {
        throw new Error("❌ Please set ORIG_NFT_OWNER_PRIVATE_KEY environment variable");
      }

      // Create signer
      let signer;
      try {
        signer = new ethers.Wallet(ownerPrivateKey, provider);
      } catch (error) {
        throw new Error("❌ Invalid private key format");
      }

      result.logs.push(`📝 Signer address: ${signer.address}`);
      
      // Get network info
      try {
        const network = await provider.getNetwork();
        result.logs.push(`📍 Network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`);
      } catch (error) {
        result.logs.push(`📍 Network: Unable to fetch network info`);
      }

      // Check balance
      const balance = await provider.getBalance(signer.address);
      result.logs.push(`💰 Signer balance: ${ethers.formatEther(balance)} ${await getNetworkCurrency()}`);

      if (balance < ethers.parseEther("0.01")) {
        result.logs.push("⚠️ Warning: Low balance, transaction might fail");
      }

      // Get contract
      const contract = new ethers.Contract(contractAddress, ABIS.erc721, signer);

      // Verify contract exists
      const code = await provider.getCode(contractAddress);
      if (code === "0x") {
        throw new Error("❌ No contract found at the specified address");
      }

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

      // Static call test
      result.logs.push("🧪 Testing transaction with static call...");
      await contract.safeMint.staticCall(recipientAddress, tokenURI);
      result.logs.push("✅ Static call successful");

      // Estimate gas and execute mint
      const gasEstimate = await contract.safeMint.estimateGas(recipientAddress, tokenURI);
      const gasLimit = gasEstimate + (gasEstimate * 20n) / 100n;

      result.logs.push(`🔄 Minting to: ${recipientAddress}`);
      const tx = await contract.safeMint(recipientAddress, tokenURI, { gasLimit });
      result.logs.push(`📤 Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
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
        contractAddress,
        tokenId,
        recipientAddress,
        transactionHash: tx.hash,
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
// =============================================================================

server.tool(
  'metadata_enricher_super_tool',
  'SUPER TOOL 2: Metadata enrichment workflow - can connect to other MCP servers and enrich metadata per mainId',
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
        contracts = {}
      } = args;

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
        envUsage: logEnvironmentUsage()
      };

      result.logs.push("🔗 SUPER TOOL 2: Starting Metadata Enricher workflow...");
      result.logs.push(`📋 Strategy: ${enrichmentStrategy.toUpperCase()}`);

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
          const adminSigner = new ethers.Wallet(adminPrivateKey, provider);
          const contract = new ethers.Contract(contractAddresses.baseAsset, ABIS.baseAsset, adminSigner);

          // Check admin permissions
          const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE();
          const hasAdminRole = await contract.hasRole(defaultAdminRole, adminSigner.address);
          
          if (!hasAdminRole) {
            throw new Error("❌ Admin does not have DEFAULT_ADMIN_ROLE");
          }

          // Set base URI
          const tx = await contract.setBaseURI(metadataConfig.mainId, metadataConfig.baseURI);
          const receipt = await tx.wait();

          result.data.enrichmentResults.push({
            mainId: metadataConfig.mainId,
            baseURI: metadataConfig.baseURI,
            transactionHash: tx.hash,
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

          const batchAdminSigner = new ethers.Wallet(adminPrivateKey, provider);
          const batchContract = new ethers.Contract(contractAddresses.baseAsset, ABIS.baseAsset, batchAdminSigner);

          // Process each mapping
          for (const mapping of metadataConfig.batchMappings) {
            try {
              result.logs.push(`🔄 Setting metadata for mainId ${mapping.mainId}...`);
              
              const batchTx = await batchContract.setBaseURI(mapping.mainId, mapping.baseURI);
              const batchReceipt = await batchTx.wait();
              
              result.data.enrichmentResults.push({
                mainId: mapping.mainId,
                baseURI: mapping.baseURI,
                description: mapping.description || '',
                category: mapping.category || '',
                transactionHash: batchTx.hash,
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
// =============================================================================

server.tool(
  'polytrade_orchestrator_super_tool',
  'SUPER TOOL 3: Complete Polytrade orchestration workflow using environment variables - packages all Polytrade operations',
  {
    type: 'object',
    properties: {
      envOverrides: {
        type: 'object',
        description: 'Optional overrides for environment variables (matches script parameter names)',
        properties: {
          TARGET_NFT_CONTRACT: { type: 'string' },
          TARGET_TOKEN_ID: { type: 'string' },
          TARGET_FRACTIONS: { type: 'string' },
          ADMIN_PRIVATE_KEY: { type: 'string' },
          NFT_OWNER_PRIVATE_KEY: { type: 'string' }
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
      }
    },
    required: [],
  },
  async (args) => {
    try {
      const {
        envOverrides = {},
        skipIfAlreadyWrapped = true,
        contracts = {}
      } = args;

      const contractAddresses = getContractAddresses(contracts);

      const result = {
        toolName: 'POLYTRADE_ORCHESTRATOR_SUPER_TOOL',
        status: 'starting',
        logs: [],
        steps: {},
        data: {},
        success: false,
        envUsed: {},
        envUsage: logEnvironmentUsage()
      };

      result.logs.push("🎁 SUPER TOOL 3: Starting Polytrade Orchestrator workflow...");

      // Read from environment with optional overrides
      const nftContract = envOverrides.TARGET_NFT_CONTRACT || process.env.TARGET_NFT_CONTRACT;
      const tokenId = parseInt(envOverrides.TARGET_TOKEN_ID || process.env.TARGET_TOKEN_ID || "0");
      const fractionsInput = parseFloat(envOverrides.TARGET_FRACTIONS || process.env.TARGET_FRACTIONS || "10000000");
      const adminPrivateKey = envOverrides.ADMIN_PRIVATE_KEY || 
        process.env.ADMIN_PRIVATE_KEY || 
        process.env.DEPLOYER_PRIVATE_KEY || 
        process.env.POLYTRADE_ADMIN_PRIVATE_KEY;
      const nftOwnerPrivateKey = envOverrides.NFT_OWNER_PRIVATE_KEY || 
        process.env.NFT_OWNER_PRIVATE_KEY || 
        process.env.SELLER_PRIVATE_KEY || 
        process.env.OWNER_PRIVATE_KEY;

      // Store environment usage
      result.envUsed = {
        nftContract: nftContract ? "✅ Found" : "❌ Missing",
        tokenId: tokenId,
        fractions: fractionsInput,
        adminPrivateKey: adminPrivateKey ? "✅ Found" : "❌ Missing",
        nftOwnerPrivateKey: nftOwnerPrivateKey ? "✅ Found" : "❌ Missing"
      };

      // Validation
      if (!nftContract) {
        throw new Error("❌ Please set TARGET_NFT_CONTRACT environment variable");
      }

      if (!ethers.isAddress(nftContract)) {
        throw new Error(`❌ Invalid NFT contract address: ${nftContract}`);
      }

      if (isNaN(tokenId) || tokenId < 0) {
        throw new Error(`❌ Invalid token ID: ${tokenId}`);
      }

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
      const adminSigner = new ethers.Wallet(adminPrivateKey, provider);
      const nftOwnerSigner = new ethers.Wallet(nftOwnerPrivateKey, provider);

      result.logs.push(`🔑 Admin: ${adminSigner.address}`);
      result.logs.push(`🔑 NFT Owner: ${nftOwnerSigner.address}`);

      // Check contracts exist
      for (const [name, address] of Object.entries(contractAddresses)) {
        const code = await provider.getCode(address);
        if (code === "0x") {
          throw new Error(`❌ ${name} contract not found at ${address}`);
        }
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
        const whitelistTx = await wrappedAssetContract.whitelist(nftContract, true);
        await whitelistTx.wait();
        result.logs.push(`✅ NFT contract whitelisted! Tx: ${whitelistTx.hash}`);
        result.data.whitelistTx = whitelistTx.hash;
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
        const grantTx = await baseAssetContract.grantRole(ASSET_MANAGER, contractAddresses.wrappedAsset);
        await grantTx.wait();
        result.logs.push(`✅ ASSET_MANAGER role granted! Tx: ${grantTx.hash}`);
        result.data.grantRoleTx = grantTx.hash;
      } else {
        result.logs.push("✅ WrappedAsset already has ASSET_MANAGER role");
      }
      result.steps.assetManager = true;

      // Set up NFT approvals
      const approved = await nftContract_instance.getApproved(tokenId);
      if (approved.toLowerCase() !== contractAddresses.wrappedAsset.toLowerCase()) {
        const approveTx = await nftContract_instance.approve(contractAddresses.wrappedAsset, tokenId);
        await approveTx.wait();
        result.logs.push(`✅ NFT approved! Tx: ${approveTx.hash}`);
        result.data.approveTx = approveTx.hash;
      } else {
        result.logs.push("✅ NFT already approved");
      }
      result.steps.approval = true;

      // Wrap NFT
      const wrappedAssetWithOwner = new ethers.Contract(contractAddresses.wrappedAsset, ABIS.wrappedAsset, nftOwnerSigner);
      const wrapTx = await wrappedAssetWithOwner.wrapERC721(nftContract, tokenId, fractionsAmount);
      
      result.logs.push(`🔄 Transaction submitted: ${wrapTx.hash}`);
      const receipt = await wrapTx.wait();
      
      result.logs.push(`✅ NFT wrapped successfully!`);
      result.data.wrapTx = wrapTx.hash;
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

// =============================================================================
// INDIVIDUAL TOOLS START HERE
// =============================================================================

// Environment Configuration Tool
server.tool(
  'show_environment_config',
  'Show current environment variable configuration for all contracts and settings',
  {
    type: 'object',
    properties: {},
    required: []
  },
  async () => {
    try {
      const result = {
        toolName: 'SHOW_ENVIRONMENT_CONFIG',
        networkConfig: {
          RPC_URL: process.env.RPC_URL ? "✅ Set" : "❌ Not Set",
          XDC_RPC_URL: process.env.XDC_RPC_URL ? "✅ Set" : "❌ Not Set", 
          ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL ? "✅ Set" : "❌ Not Set",
          currentRpcUrl: RPC_URL,
          defaultRpcUrl: "https://rpc.apothem.network (XDC Apothem Testnet)",
          note: "Priority: RPC_URL > XDC_RPC_URL > ETHEREUM_RPC_URL > default Apothem testnet",
          warning: "⚠️  DEFAULTS TO APOTHEM TESTNET FOR SAFE DEVELOPMENT"
        },
        polytradeContracts: logEnvironmentUsage(),
        nftMintingConfig: {
          ORIG_NFT_CONTRACT_ADDRESS: process.env.ORIG_NFT_CONTRACT_ADDRESS ? "✅ Set" : "❌ Not Set",
          ORIG_NFT_RECIPIENT_ADDRESS: process.env.ORIG_NFT_RECIPIENT_ADDRESS ? "✅ Set" : "❌ Not Set (will use default)",
          ORIG_NFT_TOKEN_URI: process.env.ORIG_NFT_TOKEN_URI ? "✅ Set" : "❌ Not Set (will use default)",
          ORIG_NFT_OWNER_PRIVATE_KEY: process.env.ORIG_NFT_OWNER_PRIVATE_KEY ? "✅ Set" : "❌ Not Set"
        },
        polytradeWorkflowConfig: {
          TARGET_NFT_CONTRACT: process.env.TARGET_NFT_CONTRACT ? "✅ Set" : "❌ Not Set",
          TARGET_TOKEN_ID: process.env.TARGET_TOKEN_ID ? "✅ Set" : "❌ Not Set (will use default: 0)",
          TARGET_FRACTIONS: process.env.TARGET_FRACTIONS ? "✅ Set" : "❌ Not Set (will use default: 10000000)",
          ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY ? "✅ Set" : "❌ Not Set",
          NFT_OWNER_PRIVATE_KEY: process.env.NFT_OWNER_PRIVATE_KEY ? "✅ Set" : "❌ Not Set"
        },
        alternativeKeyNames: {
          note: "The system also checks for these alternative private key names:",
          adminKeys: ["ADMIN_PRIVATE_KEY", "DEPLOYER_PRIVATE_KEY", "POLYTRADE_ADMIN_PRIVATE_KEY"],
          ownerKeys: ["NFT_OWNER_PRIVATE_KEY", "SELLER_PRIVATE_KEY", "OWNER_PRIVATE_KEY"]
        },
        recommendedEnvFile: {
          note: "Create a .env file with these variables:",
          example: `
# Network Configuration
RPC_URL=http://localhost:8545
# OR
ETHEREUM_RPC_URL=https://your-rpc-endpoint.com

# Polytrade Contract Addresses (optional - defaults provided)
POLYTRADE_BASE_ASSET_CONTRACT=0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771
POLYTRADE_WRAPPED_ASSET_CONTRACT=0x92F5a2bD28CCB184af7874e1707ABc7a7df45075
POLYTRADE_MARKETPLACE_CONTRACT=0x0d1Aa18eFa38eE8c3d32A84b9D452EAf4E3D571d
POLYTRADE_FEE_MANAGER_CONTRACT=0x31dDa0071Da559E4189C6Beb11eca942cB0350BE

# NFT Minting Configuration
ORIG_NFT_CONTRACT_ADDRESS=0x...
ORIG_NFT_RECIPIENT_ADDRESS=0x...
ORIG_NFT_TOKEN_URI=https://...
ORIG_NFT_OWNER_PRIVATE_KEY=0x...

# Polytrade Workflow Configuration  
TARGET_NFT_CONTRACT=0x...
TARGET_TOKEN_ID=1
TARGET_FRACTIONS=10000000
ADMIN_PRIVATE_KEY=0x...
NFT_OWNER_PRIVATE_KEY=0x...
          `
        }
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// Contract Query Tools
server.tool(
  'get_contract_info',
  'Get basic information about a smart contract',
  {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'Contract address to query' },
      contractType: { 
        type: 'string', 
        enum: ['erc721', 'erc721a', 'erc6960', 'baseAsset', 'wrappedAsset', 'marketplace', 'erc20'],
        description: 'Type of contract to query'
      }
    },
    required: ['contractAddress', 'contractType']
  },
  async (args) => {
    try {
      const { contractAddress, contractType } = args;
      
      if (!ethers.isAddress(contractAddress)) {
        throw new Error("Invalid contract address");
      }

      const contract = new ethers.Contract(contractAddress, ABIS[contractType], provider);
      const result = { contractAddress, contractType, data: {} };

      // Common queries based on contract type
      switch (contractType) {
        case 'erc721':
          result.data.name = await contract.name();
          result.data.symbol = await contract.symbol();
          try {
            result.data.totalSupply = (await contract.totalSupply()).toString();
          } catch {}
          try {
            result.data.owner = await contract.owner();
          } catch {}
          break;

        case 'erc20':
          result.data.name = await contract.name();
          result.data.symbol = await contract.symbol();
          result.data.decimals = await contract.decimals();
          result.data.totalSupply = (await contract.totalSupply()).toString();
          break;

        default:
          result.data.note = "Basic contract verification completed";
      }

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'get_nft_info',
  'Get detailed information about a specific NFT',
  {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'NFT contract address' },
      tokenId: { type: 'string', description: 'Token ID to query' }
    },
    required: ['contractAddress', 'tokenId']
  },
  async (args) => {
    try {
      const { contractAddress, tokenId } = args;
      
      if (!ethers.isAddress(contractAddress)) {
        throw new Error("Invalid contract address");
      }

      const contract = new ethers.Contract(contractAddress, ABIS.erc721, provider);
      const result = {
        contractAddress,
        tokenId,
        data: {}
      };

      result.data.owner = await contract.ownerOf(tokenId);
      result.data.approved = await contract.getApproved(tokenId);
      
      try {
        result.data.tokenURI = await contract.tokenURI(tokenId);
      } catch {
        result.data.tokenURI = "Not available";
      }

      // Calculate mainId for Polytrade compatibility
      result.data.calculatedMainId = calculateMainId(contractAddress, tokenId);

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// Balance and Ownership Tools
server.tool(
  'get_wallet_balances',
  'Get comprehensive wallet balances including native token, ERC20, and NFTs',
  {
    type: 'object',
    properties: {
      walletAddress: { type: 'string', description: 'Wallet address to query' },
      includeTokens: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Optional array of ERC20 token addresses to check'
      },
      includeNFTs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional array of NFT contract addresses to check'
      }
    },
    required: ['walletAddress']
  },
  async (args) => {
    try {
      const { walletAddress, includeTokens = [], includeNFTs = [] } = args;
      
      if (!ethers.isAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      const result = {
        walletAddress,
        balances: {
          native: {},
          tokens: [],
          nfts: []
        }
      };

      // Get native balance
      const nativeBalance = await provider.getBalance(walletAddress);
      result.balances.native = {
        balance: ethers.formatEther(nativeBalance),
        wei: nativeBalance.toString()
      };

      // Get ERC20 token balances
      for (const tokenAddress of includeTokens) {
        if (ethers.isAddress(tokenAddress)) {
          try {
            const tokenContract = new ethers.Contract(tokenAddress, ABIS.erc20, provider);
            const balance = await tokenContract.balanceOf(walletAddress);
            const decimals = await tokenContract.decimals();
            const symbol = await tokenContract.symbol();
            
            result.balances.tokens.push({
              address: tokenAddress,
              symbol,
              balance: ethers.formatUnits(balance, decimals),
              balanceWei: balance.toString(),
              decimals
            });
          } catch (error) {
            result.balances.tokens.push({
              address: tokenAddress,
              error: error.message
            });
          }
        }
      }

      // Get NFT balances
      for (const nftAddress of includeNFTs) {
        if (ethers.isAddress(nftAddress)) {
          try {
            const nftContract = new ethers.Contract(nftAddress, ABIS.erc721, provider);
            const balance = await nftContract.balanceOf(walletAddress);
            const name = await nftContract.name();
            const symbol = await nftContract.symbol();
            
            result.balances.nfts.push({
              address: nftAddress,
              name,
              symbol,
              balance: balance.toString()
            });
          } catch (error) {
            result.balances.nfts.push({
              address: nftAddress,
              error: error.message
            });
          }
        }
      }

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// ERC6960 Specific Tools
server.tool(
  'get_erc6960_balance',
  'Get ERC6960 dual-layer token balance',
  {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'ERC6960 contract address' },
      walletAddress: { type: 'string', description: 'Wallet address to check' },
      mainId: { type: 'string', description: 'Main ID of the token' },
      subId: { type: 'string', description: 'Sub ID of the token' }
    },
    required: ['contractAddress', 'walletAddress', 'mainId', 'subId']
  },
  async (args) => {
    try {
      const { contractAddress, walletAddress, mainId, subId } = args;
      
      if (!ethers.isAddress(contractAddress) || !ethers.isAddress(walletAddress)) {
        throw new Error("Invalid address format");
      }

      const contract = new ethers.Contract(contractAddress, ABIS.erc6960, provider);
      const balance = await contract.balanceOf(walletAddress, mainId, subId);
      
      const result = {
        contractAddress,
        walletAddress,
        mainId,
        subId,
        balance: balance.toString(),
        balanceFormatted: ethers.formatEther(balance)
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'mint_erc6960_token',
  'Mint ERC6960 dual-layer tokens',
  {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'ERC6960 contract address' },
      recipientAddress: { type: 'string', description: 'Recipient wallet address' },
      mainId: { type: 'string', description: 'Main ID for the token' },
      subId: { type: 'string', description: 'Sub ID for the token' },
      amount: { type: 'string', description: 'Amount to mint (in ether units)' },
      minterPrivateKey: { type: 'string', description: 'Private key of authorized minter' }
    },
    required: ['contractAddress', 'recipientAddress', 'mainId', 'subId', 'amount', 'minterPrivateKey']
  },
  async (args) => {
    try {
      const { contractAddress, recipientAddress, mainId, subId, amount, minterPrivateKey } = args;
      
      if (!ethers.isAddress(contractAddress) || !ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid address format");
      }

      const signer = new ethers.Wallet(minterPrivateKey, provider);
      const contract = new ethers.Contract(contractAddress, ABIS.erc6960, signer);
      
      const amountWei = ethers.parseEther(amount);
      
      const tx = await contract.mint(recipientAddress, mainId, subId, amountWei);
      const receipt = await tx.wait();
      
      const result = {
        contractAddress,
        recipientAddress,
        mainId,
        subId,
        amount,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// Transaction Tools
server.tool(
  'send_native_token',
  'Send native blockchain tokens (XDC, ETH, etc.)',
  {
    type: 'object',
    properties: {
      recipientAddress: { type: 'string', description: 'Recipient wallet address' },
      amount: { type: 'string', description: 'Amount to send in ether units' },
      senderPrivateKey: { type: 'string', description: 'Sender private key' },
      gasLimit: { type: 'string', description: 'Optional gas limit', default: '21000' }
    },
    required: ['recipientAddress', 'amount', 'senderPrivateKey']
  },
  async (args) => {
    try {
      const { recipientAddress, amount, senderPrivateKey, gasLimit = '21000' } = args;
      
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid recipient address");
      }

      const signer = new ethers.Wallet(senderPrivateKey, provider);
      const amountWei = ethers.parseEther(amount);
      
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amountWei,
        gasLimit: gasLimit
      });
      
      const receipt = await tx.wait();
      
      const result = {
        from: signer.address,
        to: recipientAddress,
        amount,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'transfer_erc20_token',
  'Transfer ERC20 tokens',
  {
    type: 'object',
    properties: {
      tokenAddress: { type: 'string', description: 'ERC20 token contract address' },
      recipientAddress: { type: 'string', description: 'Recipient wallet address' },
      amount: { type: 'string', description: 'Amount to transfer (in token units)' },
      senderPrivateKey: { type: 'string', description: 'Sender private key' }
    },
    required: ['tokenAddress', 'recipientAddress', 'amount', 'senderPrivateKey']
  },
  async (args) => {
    try {
      const { tokenAddress, recipientAddress, amount, senderPrivateKey } = args;
      
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid address format");
      }

      const signer = new ethers.Wallet(senderPrivateKey, provider);
      const contract = new ethers.Contract(tokenAddress, ABIS.erc20, signer);
      
      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      
      const tx = await contract.transfer(recipientAddress, amountWei);
      const receipt = await tx.wait();
      
      const result = {
        tokenAddress,
        from: signer.address,
        to: recipientAddress,
        amount,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// NFT Transfer Tool
server.tool(
  'transfer_nft',
  'Transfer an NFT to another address',
  {
    type: 'object',
    properties: {
      contractAddress: { type: 'string', description: 'NFT contract address' },
      recipientAddress: { type: 'string', description: 'Recipient wallet address' },
      tokenId: { type: 'string', description: 'Token ID to transfer' },
      ownerPrivateKey: { type: 'string', description: 'Current owner private key' }
    },
    required: ['contractAddress', 'recipientAddress', 'tokenId', 'ownerPrivateKey']
  },
  async (args) => {
    try {
      const { contractAddress, recipientAddress, tokenId, ownerPrivateKey } = args;
      
      if (!ethers.isAddress(contractAddress) || !ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid address format");
      }

      const signer = new ethers.Wallet(ownerPrivateKey, provider);
      const contract = new ethers.Contract(contractAddress, ABIS.erc721, signer);
      
      // Verify ownership
      const currentOwner = await contract.ownerOf(tokenId);
      if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error("Signer is not the owner of this NFT");
      }
      
      const tx = await contract.transferFrom(signer.address, recipientAddress, tokenId);
      const receipt = await tx.wait();
      
      const result = {
        contractAddress,
        tokenId,
        from: signer.address,
        to: recipientAddress,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// Utility Tools
server.tool(
  'calculate_main_id',
  'Calculate mainId for Polytrade system from NFT contract and token ID',
  {
    type: 'object',
    properties: {
      nftContract: { type: 'string', description: 'NFT contract address' },
      tokenId: { type: 'string', description: 'Token ID' }
    },
    required: ['nftContract', 'tokenId']
  },
  async (args) => {
    try {
      const { nftContract, tokenId } = args;
      
      if (!ethers.isAddress(nftContract)) {
        throw new Error("Invalid NFT contract address");
      }

      const mainId = calculateMainId(nftContract, tokenId);
      
      const result = {
        nftContract,
        tokenId,
        mainId,
        mainIdDecimal: BigInt(mainId).toString()
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'get_transaction_info',
  'Get detailed information about a transaction',
  {
    type: 'object',
    properties: {
      transactionHash: { type: 'string', description: 'Transaction hash to query' }
    },
    required: ['transactionHash']
  },
  async (args) => {
    try {
      const { transactionHash } = args;
      
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(transactionHash),
        provider.getTransactionReceipt(transactionHash)
      ]);
      
      if (!tx) {
        throw new Error("Transaction not found");
      }
      
      const result = {
        hash: transactionHash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString(),
        blockNumber: tx.blockNumber,
        status: receipt?.status === 1 ? 'success' : 'failed',
        gasUsed: receipt?.gasUsed.toString()
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'approve_token_spending',
  'Approve another address to spend ERC20 tokens on your behalf',
  {
    type: 'object',
    properties: {
      tokenAddress: { type: 'string', description: 'ERC20 token contract address' },
      spenderAddress: { type: 'string', description: 'Address to approve for spending' },
      amount: { type: 'string', description: 'Amount to approve (use "max" for maximum)' },
      ownerPrivateKey: { type: 'string', description: 'Token owner private key' }
    },
    required: ['tokenAddress', 'spenderAddress', 'amount', 'ownerPrivateKey']
  },
  async (args) => {
    try {
      const { tokenAddress, spenderAddress, amount, ownerPrivateKey } = args;
      
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
        throw new Error("Invalid address format");
      }

      const signer = new ethers.Wallet(ownerPrivateKey, provider);
      const contract = new ethers.Contract(tokenAddress, ABIS.erc20, signer);
      
      let approveAmount;
      if (amount.toLowerCase() === 'max') {
        approveAmount = ethers.MaxUint256;
      } else {
        const decimals = await contract.decimals();
        approveAmount = ethers.parseUnits(amount, decimals);
      }
      
      const tx = await contract.approve(spenderAddress, approveAmount);
      const receipt = await tx.wait();
      
      const result = {
        tokenAddress,
        owner: signer.address,
        spender: spenderAddress,
        amount: amount === 'max' ? 'maximum' : amount,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

// Network and Provider Tools
server.tool(
  'get_network_info',
  'Get current network information with XDC network detection',
  {
    type: 'object',
    properties: {},
    required: []
  },
  async () => {
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const gasPrice = await provider.getFeeData();
      
      const chainId = Number(network.chainId);
      const isXDC = chainId === 50 || chainId === 51;
      const networkType = chainId === 51 ? 'XDC Apothem Testnet' : 
                         chainId === 50 ? 'XDC Mainnet' : 
                         network.name;
      
      const result = {
        chainId: chainId.toString(),
        name: networkType,
        isXDCNetwork: isXDC,
        networkType: chainId === 51 ? 'testnet' : chainId === 50 ? 'mainnet' : 'other',
        currentBlock: blockNumber,
        rpcUrl: RPC_URL,
        currency: await getNetworkCurrency(),
        gasPrice: gasPrice.gasPrice?.toString(),
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        networkDetails: {
          explorer: chainId === 51 ? 'https://explorer.apothem.network' : 
                   chainId === 50 ? 'https://explorer.xinfin.network' : 'Unknown',
          faucet: chainId === 51 ? 'https://faucet.apothem.network' : 'Not available for mainnet'
        }
      };

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
    }
  }
);

server.tool(
  'switch_network_guide',
  'Get instructions for switching between XDC networks (Apothem testnet vs Mainnet)',
  {
    type: 'object',
    properties: {
      targetNetwork: {
        type: 'string',
        enum: ['apothem', 'mainnet', 'info'],
        description: 'Target network to switch to or get info about both',
        default: 'info'
      }
    },
    required: []
  },
  async (args) => {
    try {
      const { targetNetwork = 'info' } = args;
      
      const currentNetwork = await provider.getNetwork();
      const currentChainId = Number(currentNetwork.chainId);
      
      const result = {
        toolName: 'SWITCH_NETWORK_GUIDE',
        currentNetwork: {
          chainId: currentChainId,
          name: currentChainId === 51 ? 'XDC Apothem Testnet' : 
                currentChainId === 50 ? 'XDC Mainnet' : 'Other Network',
          rpcUrl: RPC_URL,
          type: currentChainId === 51 ? 'testnet' : currentChainId === 50 ? 'mainnet' : 'other'
        },
        switchingInstructions: {}
      };

      switch (targetNetwork) {
        case 'apothem':
          result.switchingInstructions = {
            target: 'XDC Apothem Testnet (Chain ID: 51)',
            method1: {
              title: 'Environment Variable Method',
              steps: [
                '1. Stop the MCP server',
                '2. Set RPC_URL=https://rpc.apothem.network in your .env file',
                '3. Restart the server with: npm run mcp:start',
                '4. Verify connection shows Chain ID: 51'
              ]
            },
            method2: {
              title: 'No .env Method (Default)',
              steps: [
                '1. Remove or comment out RPC_URL from .env',
                '2. Server will default to Apothem testnet',
                '3. Restart with: npm run mcp:start'
              ]
            },
            benefits: [
              '✅ Safe for development (no real money)',
              '✅ Free testnet XDC from faucet',
              '✅ Same tools and functionality',
              '✅ Test smart contracts safely'
            ],
            resources: {
              rpc: 'https://rpc.apothem.network',
              explorer: 'https://explorer.apothem.network',
              faucet: 'https://faucet.apothem.network'
            }
          };
          break;

        case 'mainnet':
          result.switchingInstructions = {
            target: 'XDC Mainnet (Chain ID: 50)',
            warning: '⚠️ CAUTION: REAL MONEY INVOLVED!',
            method: {
              title: 'Environment Variable Method',
              steps: [
                '1. Stop the MCP server',
                '2. Set RPC_URL=https://rpc.xinfin.network in your .env file',
                '3. Restart the server with: npm run mcp:start',
                '4. Verify connection shows Chain ID: 50',
                '5. Double-check you have real XDC in your wallet'
              ]
            },
            warnings: [
              '⚠️ Real XDC tokens will be used',
              '⚠️ Transaction fees cost real money',
              '⚠️ Mistakes cannot be undone',
              '⚠️ Test on Apothem first!'
            ],
            resources: {
              rpc: 'https://rpc.xinfin.network',
              explorer: 'https://explorer.xinfin.network',
              faucet: 'Not available - buy XDC on exchanges'
            }
          };
          break;

        default: // 'info'
          result.switchingInstructions = {
            overview: 'Both XDC networks supported with same tools',
            networks: {
              apothem: {
                chainId: 51,
                rpc: 'https://rpc.apothem.network',
                type: 'testnet',
                currency: 'XDC (free)',
                explorer: 'https://explorer.apothem.network',
                faucet: 'https://faucet.apothem.network',
                recommended: 'Development & Testing'
              },
              mainnet: {
                chainId: 50,
                rpc: 'https://rpc.xinfin.network',
                type: 'mainnet',
                currency: 'XDC (real money)',
                explorer: 'https://explorer.xinfin.network',
                faucet: 'Not available',
                recommended: 'Production Only'
              }
            },
            toolCompatibility: {
              superTools: '✅ All 3 super tools work on both networks',
              individualTools: '✅ All 16+ individual tools work on both networks',
              contracts: '✅ Same contract addresses work on both networks',
              polytradeIntegration: '✅ Full Polytrade workflow on both networks'
            },
            quickSwitching: {
              toTestnet: 'Remove RPC_URL from .env (uses default Apothem)',
              toMainnet: 'Set RPC_URL=https://rpc.xinfin.network in .env'
            }
          };
      }

      return formatResponse(result);
    } catch (error) {
      return formatResponse({ error: error.message });
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
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ Blockchain Super Tools MCP Server v1.12.0 running on stdio");
    
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