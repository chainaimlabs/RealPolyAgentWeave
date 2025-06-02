// scripts/complete_nft_workflow.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 COMPLETE NFT WORKFLOW: MINT → ENRICH → FRACTIONALIZE");
  console.log("===============================================================");

  try {
    // ==========================================
    // STEP 0: ENVIRONMENT SETUP
    // ==========================================
    
    console.log("\n📋 STEP 0: LOADING ENVIRONMENT");
    console.log("==================================================");

    // Use existing environment variables
    const nftContract = process.env.ORIG_NFT_CONTRACT_ADDRESS;
    const recipientAddress = process.env.ORIG_NFT_RECIPIENT_ADDRESS;
    const nftOwnerKey = process.env.ORIG_NFT_OWNER_PRIVATE_KEY;
    const adminKey = process.env.POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY;
    const tokenURI = process.env.ORIG_NFT_TOKEN_URI || "https://CANFT4.com";
    
    // Polytrade contracts
    const baseAsset = process.env.POLYTRADE_BASE_ASSET_TESTNET_CONTRACT;
    const wrappedAsset = process.env.POLYTRADE_WRAPPED_ASSET_TESTNET_CONTRACT;
    const marketplace = process.env.POLYTRADE_MARKETPLACE_TESTNET_CONTRACT;
    const feeManager = process.env.POLYTRADE_FEE_MANAGER_TESTNET_CONTRACT;
    
    // Configuration - only use TARGET_TOKEN_ID if explicitly set
    const targetTokenId = process.env.TARGET_TOKEN_ID && process.env.TARGET_TOKEN_ID.trim() !== "" ? process.env.TARGET_TOKEN_ID : null;
    const fractions = process.env.TARGET_FRACTIONS || "100000";
    
    // Gas configuration
    const gasLimit = parseInt(process.env.GAS_LIMIT) || 8000000;
    const gasPrice = parseInt(process.env.GAS_PRICE) || 25000000000;

    console.log(`Target Token ID: ${targetTokenId || 'NONE - will mint new token'} `);
    console.log(`Target Fractions: ${fractions}`);
    console.log(`Gas Limit: ${gasLimit}`);
    console.log(`Gas Price: ${gasPrice}`);

    // Validation
    if (!nftContract || !nftOwnerKey || !adminKey || !recipientAddress) {
      console.error("❌ Missing required environment variables");
      console.error("Required: ORIG_NFT_CONTRACT_ADDRESS, ORIG_NFT_OWNER_PRIVATE_KEY, POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY, ORIG_NFT_RECIPIENT_ADDRESS");
      process.exit(1);
    }

    console.log(`NFT Contract: ${nftContract}`);
    console.log(`Recipient: ${recipientAddress}`);
    console.log(`Token URI: ${tokenURI}`);

    // ==========================================
    // STEP 1: SETUP SIGNERS
    // ==========================================
    
    console.log("\n🔑 STEP 1: SETTING UP SIGNERS");
    console.log("==================================================");

    const nftOwnerSigner = new hre.ethers.Wallet(nftOwnerKey, hre.ethers.provider);
    const adminSigner = new hre.ethers.Wallet(adminKey, hre.ethers.provider);

    console.log(`NFT Owner: ${nftOwnerSigner.address}`);
    console.log(`Admin: ${adminSigner.address}`);

    // Check balances
    const nftOwnerBalance = await hre.ethers.provider.getBalance(nftOwnerSigner.address);
    const adminBalance = await hre.ethers.provider.getBalance(adminSigner.address);
    
    console.log(`NFT Owner Balance: ${hre.ethers.formatEther(nftOwnerBalance)} XDC`);
    console.log(`Admin Balance: ${hre.ethers.formatEther(adminBalance)} XDC`);

    // ==========================================
    // STEP 2: PREPARE CONTRACT INTERFACES
    // ==========================================
    
    console.log("\n🔧 STEP 2: PREPARING CONTRACT INTERFACES");
    console.log("==================================================");

    // Contract ABIs based on actual contract code
    const erc721ABI = [
      "function owner() view returns (address)",
      "function totalSupply() view returns (uint256)",
      "function paused() view returns (bool)",
      "function safeMint(address to, string uri) external",
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function approve(address to, uint256 tokenId) external",
      "function getApproved(uint256 tokenId) view returns (address)",
      "function transferFrom(address from, address to, uint256 tokenId) external",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    ];

    // BaseAsset ABI (from actual contract)
    const baseAssetABI = [
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function grantRole(bytes32 role, address account) external",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
      "function ASSET_MANAGER() view returns (bytes32)",
      "function createAsset(address owner, uint256 mainId, uint256 subId, uint256 amount) external",
      "function totalMainSupply(uint256 mainId) view returns (uint256)"
    ];

    // WrappedAsset ABI (from actual contract)
    const wrappedAssetABI = [
      "function whitelist(address contractAddress, bool status) external",
      "function wrapERC721(address contractAddress, uint256 tokenId, uint256 fractions) external returns (uint256)",
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
      "function getNonce(address account) external view returns (uint256)",
      "function getWrappedInfo(uint256 wrappedMainId) external view returns (tuple(uint256 tokenId, uint256 fractions, uint256 balance, address contractAddress))",
      "event ERC721Wrapped(address indexed owner, address indexed contractAddress, uint256 indexed tokenId, uint256 mainId, uint256 nonce)",
      "event StatusChanged(address indexed contractAddress, bool status)"
    ];

    // Contract instances
    const nftContractInstance = new hre.ethers.Contract(nftContract, erc721ABI, nftOwnerSigner);
    const baseAssetContract = new hre.ethers.Contract(baseAsset, baseAssetABI, adminSigner);
    const wrappedAssetContract = new hre.ethers.Contract(wrappedAsset, wrappedAssetABI, adminSigner);

    // Verify contracts exist
    console.log("Verifying contract deployments...");
    const contracts = { nftContract, baseAsset, wrappedAsset, marketplace, feeManager };
    for (const [name, address] of Object.entries(contracts)) {
      const code = await hre.ethers.provider.getCode(address);
      if (code === "0x") {
        console.error(`❌ ${name} contract not found at ${address}`);
        process.exit(1);
      }
    }
    console.log("✅ All contracts verified");

    // ==========================================
    // STEP 3: HANDLE NFT TOKEN
    // ==========================================
    
    let tokenId = targetTokenId;
    
    if (!targetTokenId) {
      console.log("\n🎨 STEP 3A: MINTING NEW NFT");
      console.log("==================================================");

      // Verify ownership of NFT contract
      const contractOwner = await nftContractInstance.owner();
      console.log(`Contract owner: ${contractOwner}`);
      
      if (nftOwnerSigner.address.toLowerCase() !== contractOwner.toLowerCase()) {
        console.error("❌ NFT owner mismatch!");
        console.error(`Expected: ${contractOwner}`);
        console.error(`Got: ${nftOwnerSigner.address}`);
        process.exit(1);
      }

      // Mint the NFT
      console.log("🔄 Minting new NFT...");
      const mintTx = await nftContractInstance.safeMint(recipientAddress, tokenURI, {
        gasLimit: gasLimit,
        gasPrice: gasPrice
      });
      console.log(`📤 Mint transaction: ${mintTx.hash}`);
      
      const mintReceipt = await mintTx.wait();
      console.log(`✅ NFT minted! Block: ${mintReceipt.blockNumber}`);

      // Extract token ID from events
      try {
        const transferEvent = mintReceipt.logs.find(log => {
          try {
            const parsed = nftContractInstance.interface.parseLog(log);
            return parsed.name === "Transfer" && parsed.args.from === hre.ethers.ZeroAddress;
          } catch {
            return false;
          }
        });

        if (transferEvent) {
          const parsed = nftContractInstance.interface.parseLog(transferEvent);
          tokenId = parsed.args.tokenId.toString();
          console.log(`🆔 New Token ID: ${tokenId}`);
        }
      } catch (error) {
        console.error("Could not extract token ID from events");
        process.exit(1);
      }

      if (!tokenId) {
        console.error("❌ Token ID not found in mint transaction");
        process.exit(1);
      }
    } else {
      console.log("\n🎯 STEP 3B: USING EXISTING TOKEN");
      console.log("==================================================");
      console.log(`Using existing Token ID: ${tokenId}`);
      
      // Verify token exists and get owner
      try {
        const tokenOwner = await nftContractInstance.ownerOf(tokenId);
        console.log(`Token ${tokenId} owner: ${tokenOwner}`);
        console.log(`NFT Owner Signer: ${nftOwnerSigner.address}`);
        console.log(`Recipient: ${recipientAddress}`);
        
        // CRITICAL: Check who owns the token
        if (tokenOwner.toLowerCase() !== nftOwnerSigner.address.toLowerCase()) {
          console.error(`❌ CRITICAL ISSUE: Token ${tokenId} is owned by ${tokenOwner}`);
          console.error(`❌ But NFT Owner Signer is ${nftOwnerSigner.address}`);
          console.error(`❌ WrappedAsset.wrapERC721() requires the token owner to call it!`);
          
          if (tokenOwner.toLowerCase() === recipientAddress.toLowerCase()) {
            console.error(`💡 Token is owned by recipient. You need recipient's private key to wrap it.`);
          } else {
            console.error(`💡 Token is owned by a different address. Transfer it to NFT Owner first.`);
          }
          
          console.log(`\n🔄 ATTEMPTING TO TRANSFER TOKEN TO NFT OWNER...`);
          console.log(`This will only work if current NFT Owner has permission to transfer.`);
          
          try {
            // Try to transfer the token to NFT owner so they can wrap it
            const transferTx = await nftContractInstance.transferFrom(
              tokenOwner,
              nftOwnerSigner.address,
              tokenId,
              { gasLimit: gasLimit, gasPrice: gasPrice }
            );
            await transferTx.wait();
            console.log(`✅ Token ${tokenId} transferred to NFT Owner`);
          } catch (transferError) {
            console.error(`❌ Transfer failed: ${transferError.message}`);
            console.error(`❌ Cannot proceed with wrapping. Token owner must call wrapERC721.`);
            process.exit(1);
          }
        } else {
          console.log(`✅ NFT Owner signer owns token ${tokenId} - can proceed with wrapping`);
        }
      } catch (error) {
        console.error(`❌ Token ${tokenId} does not exist or error checking ownership: ${error.message}`);
        process.exit(1);
      }
    }

    // ==========================================
    // STEP 4: METADATA ENRICHMENT
    // ==========================================
    
    console.log("\n🔮 STEP 4: METADATA ENRICHMENT");
    console.log("==================================================");
    
    console.log(`Token ${tokenId} will be enriched during wrapping process`);
    console.log(`MainId will be auto-generated by WrappedAsset contract`);

    // ==========================================
    // STEP 5: ADMIN OPERATIONS - WHITELIST
    // ==========================================
    
    console.log("\n📝 STEP 5: WHITELISTING NFT CONTRACT");
    console.log("==================================================");

    try {
      console.log(`Whitelisting NFT contract: ${nftContract}`);
      const whitelistTx = await wrappedAssetContract.whitelist(nftContract, true, {
        gasLimit: gasLimit,
        gasPrice: gasPrice
      });
      await whitelistTx.wait();
      console.log(`✅ NFT contract whitelisted! Tx: ${whitelistTx.hash}`);
    } catch (error) {
      if (error.message.includes("StatusChanged") || error.message.includes("already")) {
        console.log("✅ NFT contract already whitelisted");
      } else {
        console.error(`❌ Whitelist failed: ${error.message}`);
        process.exit(1);
      }
    }

    // ==========================================
    // STEP 6: ADMIN OPERATIONS - PERMISSIONS
    // ==========================================
    
    console.log("\n🔑 STEP 6: SETTING UP PERMISSIONS");
    console.log("==================================================");

    try {
      const ASSET_MANAGER = await baseAssetContract.ASSET_MANAGER();
      console.log(`ASSET_MANAGER role: ${ASSET_MANAGER}`);

      const hasAssetManagerRole = await baseAssetContract.hasRole(ASSET_MANAGER, wrappedAsset);
      console.log(`WrappedAsset has ASSET_MANAGER role: ${hasAssetManagerRole}`);

      if (!hasAssetManagerRole) {
        console.log("Granting ASSET_MANAGER role to WrappedAsset...");
        const grantTx = await baseAssetContract.grantRole(ASSET_MANAGER, wrappedAsset, {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        });
        await grantTx.wait();
        console.log(`✅ ASSET_MANAGER role granted! Tx: ${grantTx.hash}`);
      } else {
        console.log("✅ WrappedAsset already has ASSET_MANAGER role");
      }
    } catch (error) {
      console.error(`❌ Permission setup failed: ${error.message}`);
      process.exit(1);
    }

    // ==========================================
    // STEP 7: FRACTIONALIZE NFT
    // ==========================================
    
    console.log("\n🎁 STEP 7: FRACTIONALIZING NFT");
    console.log("==================================================");

    try {
      const fractionsAmount = hre.ethers.parseEther(fractions);
      console.log(`Wrapping Token ${tokenId} into ${fractions} fractions...`);

      // CRITICAL: Use NFT owner signer since they must own the token
      const wrappedAssetWithOwner = new hre.ethers.Contract(wrappedAsset, wrappedAssetABI, nftOwnerSigner);
      
      // Get current nonce to predict mainId
      const currentNonce = await wrappedAssetWithOwner.getNonce(nftOwnerSigner.address);
      console.log(`Current nonce for ${nftOwnerSigner.address}: ${currentNonce}`);
      
      const wrapTx = await wrappedAssetWithOwner.wrapERC721(nftContract, tokenId, fractionsAmount, {
        gasLimit: gasLimit,
        gasPrice: gasPrice
      });
      console.log(`🔄 Wrap transaction: ${wrapTx.hash}`);
      console.log(`🔗 Track: https://explorer.apothem.network/tx/${wrapTx.hash}`);

      const wrapReceipt = await wrapTx.wait();
      console.log(`✅ NFT wrapped successfully!`);
      console.log(`📊 Gas used: ${wrapReceipt.gasUsed}`);
      console.log(`📦 Block: ${wrapReceipt.blockNumber}`);

      // Extract mainId from events
      let mainId = null;
      try {
        const wrappedEvent = wrapReceipt.logs.find(log => {
          try {
            const parsed = wrappedAssetWithOwner.interface.parseLog(log);
            return parsed.name === "ERC721Wrapped";
          } catch {
            return false;
          }
        });

        if (wrappedEvent) {
          const parsed = wrappedAssetWithOwner.interface.parseLog(wrappedEvent);
          mainId = parsed.args.mainId.toString();
          console.log(`🆔 Generated MainId: ${mainId}`);
        }
      } catch (error) {
        console.log("Could not extract mainId from events");
      }

    } catch (error) {
      console.error(`❌ Wrapping failed: ${error.message}`);
      
      if (error.message.includes("AssetAlreadyCreated")) {
        console.log("💡 This NFT is already wrapped");
      } else if (error.message.includes("InvalidOwner")) {
        console.log("💡 The caller doesn't own the NFT - token owner must call wrapERC721");
      } else if (error.message.includes("NotWhitelisted")) {
        console.log("💡 The NFT contract is not whitelisted");
      } else if (error.message.includes("UnsupportedInterface")) {
        console.log("💡 The contract doesn't support ERC721 interface");
      }
      process.exit(1);
    }

    // ==========================================
    // SUCCESS SUMMARY
    // ==========================================
    
    console.log("\n🎉 COMPLETE WORKFLOW SUCCESSFUL!");
    console.log("===============================================================");
    console.log("✅ NFT processed successfully");
    console.log("✅ Metadata enriched (mainId auto-generated)");
    console.log("✅ NFT contract whitelisted");
    console.log("✅ Permissions configured");
    console.log("✅ NFT fractionalized successfully");

    console.log("\n📊 RESULTS:");
    console.log("==================================================");
    console.log(`NFT Contract      : ${nftContract}`);
    console.log(`Token ID          : ${tokenId}`);
    console.log(`MainId (Generated): ${mainId || 'Check transaction logs'}`);
    console.log(`Fractions Created : ${fractions}`);
    console.log(`NFT Owner         : ${nftOwnerSigner.address}`);
    console.log(`Admin Address     : ${adminSigner.address}`);

    console.log("\n🔗 POLYTRADE CONTRACTS:");
    console.log("==================================================");
    console.log(`BaseAsset     : ${baseAsset}`);
    console.log(`WrappedAsset  : ${wrappedAsset}`);
    console.log(`Marketplace   : ${marketplace}`);
    console.log(`FeeManager    : ${feeManager}`);

    return {
      success: true,
      tokenId: tokenId,
      mainId: mainId,
      fractions: fractions,
      contracts: { baseAsset, wrappedAsset, marketplace, feeManager }
    };

  } catch (error) {
    console.error("❌ Workflow failed:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Handle script termination
process.on("SIGINT", () => {
  console.log("\n👋 Workflow interrupted by user");
  process.exit(0);
});

main()
  .then((result) => {
    if (result && result.success) {
      console.log(`\n📄 FINAL RESULT: COMPLETE SUCCESS ✅`);
      console.log(`   Token ID: ${result.tokenId}`);
      console.log(`   MainId: ${result.mainId || 'Auto-generated'}`);
      console.log(`   Fractions: ${result.fractions}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unhandled workflow error:", error);
    process.exit(1);
  });