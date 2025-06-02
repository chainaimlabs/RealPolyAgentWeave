const { ethers } = require("hardhat");

// STEP 1: Admin whitelists the NFT contract
async function adminWhitelistNFT() {
  console.log("🔑 STEP 1: ADMIN WHITELIST NFT CONTRACT");
  console.log("============================================================");

  const WRAPPED_ASSET_ADDRESS = "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075";
  const NFT_ADDRESS = "0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E";

  const [admin] = await ethers.getSigners();
  console.log(`Admin: ${admin.address}`);

  const wrappedAssetABI = [
    "function whitelist(address contractAddress, bool status) external",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  ];

  const wrappedAsset = new ethers.Contract(
    WRAPPED_ASSET_ADDRESS,
    wrappedAssetABI,
    admin
  );

  try {
    // Check admin role
    const defaultAdminRole = await wrappedAsset.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await wrappedAsset.hasRole(
      defaultAdminRole,
      admin.address
    );

    if (!hasAdminRole) {
      throw new Error("Admin doesn't have DEFAULT_ADMIN_ROLE");
    }

    console.log("✅ Admin has proper permissions");

    // Whitelist NFT contract
    console.log(`🔄 Whitelisting NFT contract: ${NFT_ADDRESS}`);
    const tx = await wrappedAsset.whitelist(NFT_ADDRESS, true);
    await tx.wait();

    console.log(`✅ NFT contract whitelisted! Tx: ${tx.hash}`);
    return true;
  } catch (error) {
    console.error(`❌ Whitelist failed: ${error.message}`);
    return false;
  }
}

// STEP 2: NFT Owner wraps their asset
async function nftOwnerWrapAsset() {
  console.log("\n🎁 STEP 2: NFT OWNER WRAPS ASSET");
  console.log("============================================================");

  const WRAPPED_ASSET_ADDRESS = "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075";
  const NFT_ADDRESS = "0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E";
  const TOKEN_ID = 2;
  const FRACTIONS = ethers.parseEther("10000000"); // 10M fractions

  // Note: This would need to be run by the actual NFT owner
  // For demo, we'll show the transaction that needs to be executed

  console.log("⚠️ This step must be executed by the NFT owner:");
  console.log(`👤 NFT Owner: 0x9281B31230C735867a2Fd62aF8ec816Cc1714521`);

  const wrappedAssetABI = [
    "function wrapERC721(address contractAddress, uint256 tokenId, uint256 fractions) external returns (uint256)",
  ];

  console.log("\n📋 Transaction Details:");
  console.log(`Contract: ${WRAPPED_ASSET_ADDRESS}`);
  console.log(`Function: wrapERC721`);
  console.log(`Parameters:`);
  console.log(`  - contractAddress: ${NFT_ADDRESS}`);
  console.log(`  - tokenId: ${TOKEN_ID}`);
  console.log(`  - fractions: ${ethers.formatEther(FRACTIONS)} (10M)`);

  // If we had the NFT owner's signer, the code would be:
  /*
    const nftOwner = await ethers.getSigner("0x9281B31230C735867a2Fd62aF8ec816Cc1714521");
    const wrappedAsset = new ethers.Contract(WRAPPED_ASSET_ADDRESS, wrappedAssetABI, nftOwner);
    
    const tx = await wrappedAsset.wrapERC721(NFT_ADDRESS, TOKEN_ID, FRACTIONS);
    await tx.wait();
    
    console.log(`✅ Asset wrapped! Tx: ${tx.hash}`);
    console.log(`✅ MainId generated: ${result}`);
    */

  return "PENDING_NFT_OWNER_ACTION";
}

// STEP 3: Owner lists on marketplace (after wrapping)
async function ownerListOnMarketplace(mainId) {
  console.log("\n🏪 STEP 3: OWNER LISTS ON MARKETPLACE");
  console.log("============================================================");

  const MARKETPLACE_ADDRESS = "YOUR_MARKETPLACE_ADDRESS"; // You'll need to provide this
  const USDT_ADDRESS = "YOUR_USDT_ADDRESS"; // Token for payment

  const marketplaceABI = [
    "function list(uint256 mainId, uint256 subId, tuple(uint256 salePrice, uint256 listedFractions, uint256 minFraction, address token) listedInfo) external",
  ];

  const listingInfo = {
    salePrice: ethers.parseEther("1"), // 1 USDT per fraction
    listedFractions: ethers.parseEther("10000000"), // List all 10M fractions
    minFraction: ethers.parseEther("1000"), // Minimum 1000 fractions per purchase
    token: USDT_ADDRESS,
  };

  console.log("📋 Listing Details:");
  console.log(`MainId: ${mainId}`);
  console.log(`SubId: 1`);
  console.log(
    `Sale Price: ${ethers.formatEther(listingInfo.salePrice)} USDT per fraction`
  );
  console.log(
    `Listed Fractions: ${ethers.formatEther(listingInfo.listedFractions)}`
  );
  console.log(
    `Min Purchase: ${ethers.formatEther(listingInfo.minFraction)} fractions`
  );

  // This would also need to be executed by the NFT owner
  /*
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, marketplaceABI, nftOwner);
    const tx = await marketplace.list(mainId, 1, listingInfo);
    await tx.wait();
    console.log(`✅ Asset listed! Tx: ${tx.hash}`);
    */

  return "PENDING_OWNER_LISTING";
}

// Main execution
async function main() {
  console.log("🚀 POLYTRADE WORKFLOW EXECUTION");
  console.log("============================================================");

  try {
    // Step 1: Admin whitelists NFT
    const whitelistSuccess = await adminWhitelistNFT();

    if (!whitelistSuccess) {
      console.log("❌ Cannot proceed - whitelist failed");
      return;
    }

    // Step 2: Show what NFT owner needs to do
    await nftOwnerWrapAsset();

    console.log("\n🎯 NEXT STEPS:");
    console.log("============================================================");
    console.log("1. ✅ Admin has whitelisted the NFT contract");
    console.log(
      "2. 📋 NFT owner needs to call wrapERC721() with their account"
    );
    console.log("3. 📋 After wrapping, owner can list on marketplace");
    console.log("4. 📋 Buyers can then purchase fractions");

    console.log("\n💡 FOR NFT OWNER:");
    console.log(
      "Connect MetaMask with address: 0x9281B31230C735867a2Fd62aF8ec816Cc1714521"
    );
    console.log(
      "Call wrapERC721() on WrappedAsset contract with the parameters shown above"
    );
  } catch (error) {
    console.error("❌ Workflow failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    // process.exit(1);
    throw new Error("Deployment failed");
  });
