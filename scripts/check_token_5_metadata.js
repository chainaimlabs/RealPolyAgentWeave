// scripts/check_token_5_metadata.js
require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 CHECKING TOKEN 5 CURRENT METADATA STATE");
  console.log("============================================================");

  const contracts = {
    nft: "0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E",
    baseAsset: "0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771",
    wrappedAsset: "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075"
  };

  const TOKEN_ID = 5;
  const [admin] = await ethers.getSigners();

  // Calculate mainId for Token 5
  const mainId = ethers.keccak256(
    ethers.defaultAbiCoder.encode(
      ['address', 'uint256'], 
      [contracts.nft, TOKEN_ID]
    )
  );

  console.log(`Original NFT: ${contracts.nft} #${TOKEN_ID}`);
  console.log(`Calculated MainId: ${mainId}`);

  // Check BaseAsset metadata
  console.log("\n📋 CHECKING BASEASSET METADATA:");
  console.log("==================================================");
  
  try {
    const baseAsset = await ethers.getContractAt("BaseAsset", contracts.baseAsset, admin);
    
    // Method 1: Try uri() function (ERC1155 standard)
    try {
      const uri = await baseAsset.uri(mainId);
      console.log(`✅ uri(${mainId}): "${uri}"`);
      
      if (uri && uri !== "") {
        console.log("🎯 METADATA EXISTS via uri() function");
      } else {
        console.log("🔍 uri() exists but returns empty");
      }
    } catch (e) {
      console.log(`❌ uri() function: ${e.message}`);
    }

    // Method 2: Try tokenURI() function (ERC721 style)
    try {
      const tokenURI = await baseAsset.tokenURI(mainId, 0);
      console.log(`✅ tokenURI(${mainId}, 0): "${tokenURI}"`);
      
      if (tokenURI && tokenURI !== "") {
        console.log("🎯 METADATA EXISTS via tokenURI() function");
      } else {
        console.log("🔍 tokenURI() exists but returns empty");
      }
    } catch (e) {
      console.log(`❌ tokenURI() function: ${e.message}`);
    }

    // Method 3: Check if token exists by checking balance
    const nftOwner = "0x9281B31230C735867a2Fd62aF8ec816Cc1714521";
    const balance = await baseAsset.balanceOf(nftOwner, mainId, 0);
    console.log(`✅ Token balance: ${ethers.formatEther(balance)} (confirms token exists)`);

  } catch (error) {
    console.log(`❌ BaseAsset contract error: ${error.message}`);
  }

  // Check WrappedAsset metadata
  console.log("\n📋 CHECKING WRAPPED ASSET METADATA:");
  console.log("==================================================");
  
  try {
    const wrappedAsset = await ethers.getContractAt("WrappedAsset", contracts.wrappedAsset, admin);
    
    // Try different metadata access methods
    try {
      const uri = await wrappedAsset.uri(mainId);
      console.log(`✅ WrappedAsset uri(${mainId}): "${uri}"`);
    } catch (e) {
      console.log(`❌ WrappedAsset uri(): ${e.message}`);
    }

    try {
      const tokenURI = await wrappedAsset.tokenURI(mainId);
      console.log(`✅ WrappedAsset tokenURI(${mainId}): "${tokenURI}"`);
    } catch (e) {
      console.log(`❌ WrappedAsset tokenURI(): ${e.message}`);
    }

  } catch (error) {
    console.log(`❌ WrappedAsset contract error: ${error.message}`);
  }

  // Check original NFT metadata for comparison
  console.log("\n📋 CHECKING ORIGINAL NFT METADATA:");
  console.log("==================================================");
  
  try {
    const nftContract = await ethers.getContractAt("IERC721Metadata", contracts.nft, admin);
    
    const tokenURI = await nftContract.tokenURI(TOKEN_ID);
    console.log(`✅ Original NFT tokenURI(${TOKEN_ID}): "${tokenURI}"`);
    
  } catch (error) {
    console.log(`❌ Original NFT metadata error: ${error.message}`);
  }

  console.log("\n🎯 SUMMARY:");
  console.log("============================================================");
  console.log("Based on the results above:");
  console.log("• If any URI returns a valid URL → Metadata EXISTS");
  console.log("• If all URIs are empty/error → NO metadata set");
  console.log("• Original NFT metadata is separate from ERC6960 metadata");
}

main().catch(console.error);