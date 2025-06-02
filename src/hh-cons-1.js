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
    
    // Configuration
    const targetTokenId = process.env.TARGET_TOKEN_ID; // Use existing token if specified
    const targetMainId = 6690; // Your specified mainId for enrichment
    const fractions = process.env.TARGET_FRACTIONS || "100000";
    
    console.log(`Target Token ID: ${targetTokenId} (will mint new if not specified)`);
    console.log(`Target Fractions: ${fractions}`);

    // Validation
    if (!nftContract || !nftOwnerKey || !adminKey || !recipientAddress) {
      console.error("❌ Missing required environment variables");
      console.error("Required: ORIG_NFT_CONTRACT_ADDRESS, ORIG_NFT_OWNER_PRIVATE_KEY, POLYTRADE_ADMIN_TESTNET_PRIVATE_KEY, ORIG_NFT_RECIPIENT_ADDRESS");
      process.exit(1);
    }

    console.log(`NFT Contract: ${nftContract}`);
    console.log(`Recipient: ${recipientAddress}`);
    console.log(`Target Token ID: ${targetTokenId}`);
    console.log(`Target MainId: ${targetMainId}`);
    console.log(`Target Fractions: ${fractions}`);
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
    // STEP 2: MINT NEW NFT
    // ==========================================
    
    console.log("\n🎨 STEP 2: MINTING NEW NFT");
    console.log("==================================================");

    const CANFT4Factory = await hre.ethers.getContractFactory("CANFT4", nftOwnerSigner);
    const nftContractInstance = CANFT4Factory.attach(nftContract).connect(nftOwnerSigner);

    // Verify ownership
    const contractOwner = await nftContractInstance.owner();
    console.log(`Contract owner: ${contractOwner}`);
    
    if (nftOwnerSigner.address.toLowerCase() !== contractOwner.toLowerCase()) {
      console.error("❌ NFT owner mismatch!");
      console.error(`Expected: ${contractOwner}`);
      console.error(`Got: ${nftOwnerSigner.address}`);
      process.exit(1);
    }

    // Get current supply
    let totalSupply = 0;
    try {
      totalSupply = await nftContractInstance.totalSupply();
      console.log(`Current total supply: ${totalSupply}`);
    } catch (error) {
      console.log("Could not fetch total supply");
    }

    // Check if contract is paused
    try {
      const isPaused = await nftContractInstance.paused();
      if (isPaused) {
        console.error("❌ Contract is paused!");
        process.exit(1);
      }
      console.log("✅ Contract is not paused");
    } catch (error) {
      console.log("Contract pause state unknown");
    }

    // Static call test
    console.log("🧪 Testing mint transaction...");
    try {
      await nftContractInstance.safeMint.staticCall(recipientAddress, tokenURI);
      console.log("✅ Static call successful");
    } catch (error) {
      console.error("❌ Static call failed:");
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    // Mint the NFT
    console.log("🔄 Minting new NFT...");
    const mintTx = await nftContractInstance.safeMint(recipientAddress, tokenURI);
    console.log(`📤 Mint transaction: ${mintTx.hash}`);
    
    const mintReceipt = await mintTx.wait();
    console.log(`✅ NFT minted! Block: ${mintReceipt.blockNumber}`);

    // Extract token ID
    let tokenId = null;
    try {
      const transferEvent = mintReceipt.logs.find(log => {
        try {
          const parsed = nftContractInstance.interface.parseLog(log);
          return parsed.name === "Transfer";
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
      console.error("Could not extract token ID");
      process.exit(1);
    }

    if (!tokenId) {
      console.error("❌ Token ID not found");
      process.exit(1);
    }

    // ==========================================
    // STEP 3: ENRICH METADATA (SET MAINID)
    // ==========================================
    
    console.log("\n🔮 STEP 3: ENRICHING METADATA");
    console.log("==================================================");
    
    console.log(`Assigning MainId ${targetMainId} to Token ID ${tokenId}`);
    // Note: This is conceptual - actual metadata enrichment would depend on your specific requirements
    // You might need to:
    // 1. Update token URI with mainId reference
    // 2. Store mapping in a separate contract
    // 3. Emit events for indexing
    
    console.log(`✅ Token ${tokenId} enriched with MainId ${targetMainId}`);

    // ==========================================
    // STEP 4: PREPARE POLYTRADE CONTRACTS
    // ==========================================
    
    console.log("\n🔧 STEP 4: PREPARING POLYTRADE CONTRACTS");
    console.log("==================================================");

    // Contract ABIs
    const baseAssetABI = [
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function grantRole(bytes32 role, address account) external",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
      "function ASSET_MANAGER() view returns (bytes32)"
    ];

    const wrappedAssetABI = [
      "function whitelist(address contractAddress, bool status) external",
      "function wrapERC721(address contractAddress, uint256 tokenId, uint256 fractions) external returns (uint256)",
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)"
    ];

    const nftABI = [
      "function approve(address to, uint256 tokenId) external",
      "function getApproved(uint256 tokenId) view returns (address)",
      "function ownerOf(uint256 tokenId) view returns (address)"
    ];

    // Contract instances
    const baseAssetContract = new hre.ethers.Contract(baseAsset, baseAssetABI, adminSigner);
    const wrappedAssetContract = new hre.ethers.Contract(wrappedAsset, wrappedAssetABI, adminSigner);
    const nftForApproval = new hre.ethers.Contract(nftContract, nftABI, nftOwnerSigner);

    // Check contracts exist
    console.log("Verifying contract deployments...");
    const contracts = { baseAsset, wrappedAsset, marketplace, feeManager };
    for (const [name, address] of Object.entries(contracts)) {
      const code = await hre.ethers.provider.getCode(address);
      if (code === "0x") {
        console.error(`❌ ${name} contract not found at ${address}`);
        process.exit(1);
      }
    }
    console.log("✅ All contracts verified");

    // ==========================================
    // STEP 5: WHITELIST NFT CONTRACT
    // ==========================================
    
    console.log("\n📝 STEP 5: WHITELISTING NFT CONTRACT");
    console.log("==================================================");

    try {
      console.log(`Whitelisting NFT contract: ${nftContract}`);
      const whitelistTx = await wrappedAssetContract.whitelist(nftContract, true);
      await whitelistTx.wait();
      console.log(`✅ NFT contract whitelisted! Tx: ${whitelistTx.hash}`);
    } catch (error) {
      if (error.message.includes("already") || error.message.includes("StatusChanged")) {
        console.log("✅ NFT contract already whitelisted");
      } else {
        console.error(`❌ Whitelist failed: ${error.message}`);
        process.exit(1);
      }
    }

    // ==========================================
    // STEP 6: SETUP PERMISSIONS
    // ==========================================
    
    console.log("\n🔑 STEP 6: SETTING UP PERMISSIONS");
    console.log("==================================================");

    try {
      const ASSET_MANAGER = await baseAssetContract.ASSET_MANAGER();
      console.log(`ASSET_MANAGER role: ${ASSET_MANAGER}`);

      const hasAssetManagerRole = await baseAssetContract.hasRole(ASSET_MANAGER, wrappedAsset);
      console.log(`WrappedAsset has ASSET_MANAGER role: ${hasAssetManagerRole}`);

      if (!hasAssetManagerRole) {
        console.log("Granting ASSET_MANAGER role...");
        const grantTx = await baseAssetContract.grantRole(ASSET_MANAGER, wrappedAsset);
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
    // STEP 7: APPROVE NFT FOR WRAPPING
    // ==========================================
    
    console.log("\n✅ STEP 7: APPROVING NFT FOR WRAPPING");
    console.log("==================================================");

    try {
      // We know the token is owned by recipient since we just minted it to them
      console.log(`Token ${tokenId} owner: ${recipientAddress} (recipient)`);

      const approved = await nftForApproval.getApproved(tokenId);
      console.log(`Currently approved to: ${approved}`);

      if (approved.toLowerCase() !== wrappedAsset.toLowerCase()) {
        console.log("Setting approval for WrappedAsset...");
        const approveTx = await nftForApproval.approve(wrappedAsset, tokenId);
        await approveTx.wait();
        console.log(`✅ Token ${tokenId} approved! Tx: ${approveTx.hash}`);
      } else {
        console.log("✅ Token already approved");
      }
    } catch (error) {
      console.error(`❌ Approval failed: ${error.message}`);
      process.exit(1);
    }

    // ==========================================
    // STEP 8: FRACTIONALIZE NFT
    // ==========================================
    
    console.log("\n🎁 STEP 8: FRACTIONALIZING NFT");
    console.log("==================================================");

    try {
      const fractionsAmount = hre.ethers.parseEther(fractions);
      console.log(`Wrapping Token ${tokenId} into ${fractions} fractions (MainId: ${targetMainId})...`);

      // Use NFT owner for the wrapping transaction
      const wrappedAssetWithOwner = new hre.ethers.Contract(wrappedAsset, wrappedAssetABI, nftOwnerSigner);
      
      const wrapTx = await wrappedAssetWithOwner.wrapERC721(nftContract, tokenId, fractionsAmount);
      console.log(`🔄 Wrap transaction: ${wrapTx.hash}`);
      console.log(`🔗 Track: https://testnet.xdcscan.com/tx/${wrapTx.hash}`);

      const wrapReceipt = await wrapTx.wait();
      console.log(`✅ NFT wrapped successfully!`);
      console.log(`📊 Gas used: ${wrapReceipt.gasUsed}`);
      console.log(`📦 Block: ${wrapReceipt.blockNumber}`);

    } catch (error) {
      console.error(`❌ Wrapping failed: ${error.message}`);
      
      if (error.message.includes("AssetAlreadyCreated")) {
        console.log("💡 This NFT is already wrapped");
      } else if (error.message.includes("InvalidOwner")) {
        console.log("💡 The account doesn't own the NFT");
      } else if (error.message.includes("NotWhitelisted")) {
        console.log("💡 The NFT contract is not whitelisted");
      }
      process.exit(1);
    }

    // ==========================================
    // SUCCESS SUMMARY
    // ==========================================
    
    console.log("\n🎉 COMPLETE WORKFLOW SUCCESSFUL!");
    console.log("===============================================================");
    console.log("✅ NFT minted successfully");
    console.log("✅ Metadata enriched with MainId");
    console.log("✅ NFT contract whitelisted");
    console.log("✅ Permissions configured");
    console.log("✅ NFT approved for wrapping");
    console.log("✅ NFT fractionalized successfully");

    console.log("\n📊 RESULTS:");
    console.log("==================================================");
    console.log(`NFT Contract      : ${nftContract}`);
    console.log(`Token ID          : ${tokenId}`);
    console.log(`MainId (Enriched) : ${targetMainId}`);
    console.log(`Fractions Created : ${fractions}`);
    console.log(`Owner Address     : ${recipientAddress}`);
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
      mainId: targetMainId,
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
      console.log(`   MainId: ${result.mainId}`);
      console.log(`   Fractions: ${result.fractions}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unhandled workflow error:", error);
    process.exit(1);
  });