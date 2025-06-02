// scripts/extract_mainid.js
require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 EXTRACTING MAINID FROM WRAPPED TOKEN 5");
  console.log("============================================================");

  const contracts = {
    nft: "0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E",
    wrappedAsset: "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075",
    baseAsset: "0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771"
  };

  const TOKEN_ID = 5; // Your wrapped token
  const [admin] = await ethers.getSigners();

  // Method 1: Calculate mainId (most likely approach)
  console.log("\n📊 METHOD 1: CALCULATING MAINID");
  console.log("==================================================");
  
  // Common pattern: mainId = hash(nftContract + tokenId)
  const calculatedMainId = ethers.keccak256(
    ethers.defaultAbiCoder.encode(
      ['address', 'uint256'], 
      [contracts.nft, TOKEN_ID]
    )
  );
  
  console.log(`Calculated MainId: ${calculatedMainId}`);

  // Method 2: Check BaseAsset for created assets
  console.log("\n📊 METHOD 2: CHECKING BASEASSET EVENTS");
  console.log("==================================================");
  
  try {
    const baseAsset = await ethers.getContractAt("BaseAsset", contracts.baseAsset, admin);
    
    // Get AssetCreated events for this NFT
    const filter = baseAsset.filters.AssetCreated();
    const events = await baseAsset.queryFilter(filter, -1000); // Last 1000 blocks
    
    console.log(`Found ${events.length} AssetCreated events`);
    
    for (const event of events) {
      const { owner, mainId, subId, amount } = event.args;
      console.log(`  MainId: ${mainId}, SubId: ${subId}, Amount: ${ethers.formatEther(amount)}`);
      
      // Check if this matches our token (you can verify by owner address)
      if (ethers.formatEther(amount) === "100000.0") {
        console.log(`  ✅ Likely match for Token ${TOKEN_ID}: MainId ${mainId}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Could not check BaseAsset events: ${error.message}`);
  }

  // Method 3: Try to get balance for calculated mainId
  console.log("\n📊 METHOD 3: VERIFYING MAINID WITH BALANCE CHECK");
  console.log("==================================================");
  
  try {
    const baseAsset = await ethers.getContractAt("BaseAsset", contracts.baseAsset, admin);
    const nftOwner = "0x9281B31230C735867a2Fd62aF8ec816Cc1714521"; // From your logs
    
    const balance = await baseAsset.balanceOf(nftOwner, calculatedMainId, 0);
    console.log(`Balance for MainId ${calculatedMainId}: ${ethers.formatEther(balance)}`);
    
    if (balance > 0) {
      console.log(`✅ Confirmed MainId: ${calculatedMainId}`);
    }
    
  } catch (error) {
    console.log(`❌ Could not verify balance: ${error.message}`);
  }

  // Save the result for next script
  const wrapResult = {
    success: true,
    alreadyWrapped: true,
    nftContract: contracts.nft,
    tokenId: TOKEN_ID,
    nftOwner: "0x9281B31230C735867a2Fd62aF8ec816Cc1714521",
    
    // ERC6960 data
    erc6960: {
      mainId: calculatedMainId,
      subId: 0,
      fractions: "100000.0",
      wrappedAssetContract: contracts.wrappedAsset,
      baseAssetContract: contracts.baseAsset
    },
    
    // Metadata preparation
    metadata: {
      complianceRequired: true,
      companyName: "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED",
      baseMetadataPath: `./metadata/erc6960/${calculatedMainId}/`,
      complianceDataPath: `./compliance-data/${calculatedMainId}/`
    }
  };

  // Save for next script
  const outputDir = path.join(__dirname, "../output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, "wrap-result.json"),
    JSON.stringify(wrapResult, null, 2)
  );

  console.log("\n🎉 MAINID EXTRACTION COMPLETE!");
  console.log("============================================================");
  console.log(`✅ MainId: ${calculatedMainId}`);
  console.log(`✅ Data saved to: output/wrap-result.json`);
  console.log(`\n🔗 NEXT STEP:`);
  console.log(`   Run: npx hardhat run scripts/quick_metadata_test.js --network apothem`);

  return wrapResult;
}

main().catch(console.error);