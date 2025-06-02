const hre = require("hardhat");
const { ethers } = hre;
require("dotenv").config();

const NFT_CONTRACT = process.env.ERC721_CONTRACT;
const WRAPPER_CONTRACT = process.env.WRAPPER_CONTRACT;

const ERC721_ABI = [
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

async function verifyApprovalStatus() {
  console.log("🔍 Verifying Approval Status");
  console.log("═".repeat(50));

  try {
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;

    console.log("📋 Verification Details:");
    console.log("🎨 NFT Contract:", NFT_CONTRACT);
    console.log("🎁 Wrapper Contract:", WRAPPER_CONTRACT);
    console.log("👤 Your Account:", deployer.address);

    // Get contract instance
    const nftContract = new ethers.Contract(NFT_CONTRACT, ERC721_ABI, deployer);

    // Get contract name for confirmation
    const contractName = await nftContract.name();
    const contractSymbol = await nftContract.symbol();
    console.log("📛 Contract:", contractName, "(" + contractSymbol + ")");

    // Check approval status multiple times for certainty
    console.log("\n🔍 Multiple Approval Checks:");
    console.log("-".repeat(40));

    for (let i = 1; i <= 3; i++) {
      try {
        const isApproved = await nftContract.isApprovedForAll(
          deployer.address,
          WRAPPER_CONTRACT
        );
        console.log(
          `Check ${i}: ${isApproved ? "✅ APPROVED" : "❌ NOT APPROVED"}`
        );

        if (i < 3) {
          // Small delay between checks
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.log(`Check ${i}: ❌ ERROR - ${error.message}`);
      }
    }

    // Final definitive check
    console.log("\n📊 Final Verification:");
    console.log("-".repeat(40));

    const finalApprovalStatus = await nftContract.isApprovedForAll(
      deployer.address,
      WRAPPER_CONTRACT
    );

    if (finalApprovalStatus) {
      console.log("🎉 CONFIRMED: setApprovalForAll is TRUE");
      console.log("✅ The wrapper contract CAN manage your NFTs");

      console.log("\n🔐 What This Means:");
      console.log("• Wrapper contract can transfer your NFTs when wrapping");
      console.log("• You can wrap any NFTs you acquire from this collection");
      console.log("• No additional approvals needed for future wrapping");

      console.log("\n🚀 You Can Now:");
      console.log("1. ✅ Mint/acquire NFTs from this contract");
      console.log("2. ✅ Wrap them into ERC-6960 tokens immediately");
      console.log("3. ✅ Trade wrapped tokens on compatible platforms");

      console.log("\n📋 Smart Contract Call Proof:");
      console.log(`Contract: ${NFT_CONTRACT}`);
      console.log(
        `Function: isApprovedForAll(${deployer.address}, ${WRAPPER_CONTRACT})`
      );
      console.log(`Result: ${finalApprovalStatus}`);
      console.log(`Block: ${await provider.getBlockNumber()}`);

      return true;
    } else {
      console.log("❌ VERIFICATION FAILED: setApprovalForAll is FALSE");
      console.log("⚠️  Previous approval check may have been incorrect");

      console.log("\n🔧 Recommended Actions:");
      console.log("1. Run the approval setting script again");
      console.log("2. Check for any contract restrictions");
      console.log("3. Verify you're on the correct network");

      return false;
    }
  } catch (error) {
    console.error("💥 Verification failed:", error.message);
    return false;
  } finally {
    setTimeout(() => {
      console.log("\n✨ Verification completed");
      process.exit(0);
    }, 1000);
  }
}

verifyApprovalStatus();
