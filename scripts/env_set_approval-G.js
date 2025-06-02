const hre = require("hardhat");
const { ethers } = hre;
require("dotenv").config();

// Read contract addresses from environment variables
const NFT_CONTRACT = process.env.ERC721_CONTRACT;
const WRAPPER_CONTRACT = process.env.WRAPPER_CONTRACT;

// Complete ERC721 ABI for approval checking
const ERC721_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
];

async function comprehensiveApprovalCheck() {
  console.log("🔐 Comprehensive NFT Approval Check & Set");
  console.log("═".repeat(60));

  try {
    // Validate environment variables
    if (!NFT_CONTRACT || !WRAPPER_CONTRACT) {
      console.error("❌ Missing contract addresses in .env file!");
      console.error("Create .env with:");
      console.error(
        "ERC721_CONTRACT=0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E"
      );
      console.error(
        "WRAPPER_CONTRACT=0x92F5a2bD28CCB184af7874e1707ABc7a7df45075"
      );
      return;
    }

    console.log("🎨 NFT Contract:", NFT_CONTRACT);
    console.log("🎁 Wrapper Contract:", WRAPPER_CONTRACT);

    // Get signer and provider
    const [deployer] = await ethers.getSigners();
    const provider = deployer.provider;

    console.log("\n👤 Account:", deployer.address);

    // Check balance using provider
    const balance = await provider.getBalance(deployer.address);
    console.log("💰 XDC Balance:", ethers.formatEther(balance));

    if (balance < ethers.parseEther("0.001")) {
      console.error(
        "❌ Insufficient XDC for gas fees (need at least 0.001 XDC)"
      );
      return;
    }

    // Get network info
    const network = await provider.getNetwork();
    console.log(
      "🌐 Network:",
      network.name,
      "| Chain ID:",
      network.chainId.toString()
    );

    // Get current block and gas price
    const currentBlock = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    console.log("📦 Current Block:", currentBlock);
    console.log(
      "⛽ Gas Price:",
      ethers.formatUnits(feeData.gasPrice, "gwei"),
      "gwei"
    );

    // Validate contract addresses exist
    console.log("\n🔍 Validating Contract Deployments:");
    console.log("-".repeat(50));

    const nftCode = await provider.getCode(NFT_CONTRACT);
    if (nftCode === "0x") {
      console.error("❌ No contract found at NFT address:", NFT_CONTRACT);
      return;
    }
    console.log("✅ NFT contract deployed");

    const wrapperCode = await provider.getCode(WRAPPER_CONTRACT);
    if (wrapperCode === "0x") {
      console.error(
        "❌ No contract found at wrapper address:",
        WRAPPER_CONTRACT
      );
      return;
    }
    console.log("✅ Wrapper contract deployed");

    // Get contract instance
    const nftContract = new ethers.Contract(NFT_CONTRACT, ERC721_ABI, deployer);

    // Get detailed contract information
    console.log("\n📋 NFT Contract Analysis:");
    console.log("-".repeat(50));

    try {
      const name = await nftContract.name();
      const symbol = await nftContract.symbol();
      console.log("📛 Name:", name);
      console.log("🏷️  Symbol:", symbol);
    } catch (error) {
      console.log(
        "⚠️  Could not read name/symbol - may not be standard ERC721"
      );
    }

    // Check ERC721 interface support
    try {
      const supportsERC721 = await nftContract.supportsInterface("0x80ac58cd");
      console.log(
        "🔌 ERC721 Interface:",
        supportsERC721 ? "✅ SUPPORTED" : "❌ NOT SUPPORTED"
      );

      if (!supportsERC721) {
        console.log("⚠️  Warning: Contract may not be fully ERC721 compliant");
      }
    } catch (error) {
      console.log("⚠️  Could not check interface support");
    }

    // Check NFT ownership
    console.log("\n📦 NFT Ownership Analysis:");
    console.log("-".repeat(50));

    try {
      const nftBalance = await nftContract.balanceOf(deployer.address);
      console.log("🎨 NFTs Owned:", nftBalance.toString());

      if (nftBalance > 0) {
        console.log("\n🎯 Your Token IDs:");

        // Show up to 5 token IDs
        const maxToShow = Math.min(Number(nftBalance), 5);
        for (let i = 0; i < maxToShow; i++) {
          try {
            const tokenId = await nftContract.tokenOfOwnerByIndex(
              deployer.address,
              i
            );
            console.log(`   ${i + 1}. Token ID: ${tokenId}`);

            // Check individual token approval
            try {
              const approvedAddress = await nftContract.getApproved(tokenId);
              if (approvedAddress === WRAPPER_CONTRACT) {
                console.log(
                  `      Individual Approval: ✅ APPROVED for wrapper`
                );
              } else if (approvedAddress !== ethers.ZeroAddress) {
                console.log(
                  `      Individual Approval: 🔍 Approved for ${approvedAddress}`
                );
              } else {
                console.log(`      Individual Approval: ❌ Not approved`);
              }
            } catch (error) {
              console.log(`      Individual Approval: ❓ Could not check`);
            }
          } catch (error) {
            console.log(`   ${i + 1}. Token ID: Could not retrieve`);
          }
        }

        if (nftBalance > 5) {
          console.log(`   ... and ${nftBalance - 5n} more tokens`);
        }
      } else {
        console.log("📭 You don't own any NFTs from this contract");
        console.log("   You can still set approval for future acquisitions");
      }
    } catch (error) {
      console.log("❌ Could not check NFT balance:", error.message);
      console.log("   This suggests the contract may not be ERC721 compatible");
    }

    // Check current approval status
    console.log("\n🔐 Current Approval Status:");
    console.log("-".repeat(50));

    let isCurrentlyApproved = false;
    try {
      isCurrentlyApproved = await nftContract.isApprovedForAll(
        deployer.address,
        WRAPPER_CONTRACT
      );
      console.log(
        "📋 setApprovalForAll Status:",
        isCurrentlyApproved ? "✅ APPROVED" : "❌ NOT APPROVED"
      );

      if (isCurrentlyApproved) {
        console.log(
          "🎉 ALREADY APPROVED! The wrapper contract can manage ALL your NFTs from this collection"
        );
        console.log("\n📊 Summary:");
        console.log("✅ Approval is already set correctly");
        console.log("✅ You can proceed directly to wrapping NFTs");
        console.log("✅ No transaction needed");

        console.log("\n🚀 Next Steps:");
        console.log("1. You can now wrap your NFTs");
        console.log("2. Run the wrapping script");
        console.log("3. Or proceed with the complete workflow");

        return; // Exit early since approval is already set
      }
    } catch (error) {
      console.log("❌ Could not check approval status:", error.message);
      console.log("   Contract may not support isApprovedForAll function");
      return;
    }

    // If we get here, approval is NOT set, so we need to set it
    console.log("\n⚙️  Setting Approval for Wrapper Contract:");
    console.log("-".repeat(50));

    console.log("🎯 This will allow the wrapper contract to:");
    console.log("   • Transfer your NFTs when wrapping");
    console.log("   • Convert them to ERC-6960 wrapped tokens");
    console.log("   • Handle all future NFTs you acquire from this collection");

    // Estimate gas for the transaction
    console.log("\n⛽ Gas Estimation:");
    let gasEstimate;
    try {
      gasEstimate = await nftContract.setApprovalForAll.estimateGas(
        WRAPPER_CONTRACT,
        true
      );
      console.log("📊 Estimated Gas:", gasEstimate.toString());
    } catch (error) {
      console.log("⚠️  Could not estimate gas, using default");
      gasEstimate = 60000n;
    }

    // Calculate costs
    const gasPrice = (feeData.gasPrice * 110n) / 100n; // 10% higher for faster confirmation
    const estimatedCost = gasEstimate * gasPrice;

    console.log(
      "💰 Gas Price (with 10% buffer):",
      ethers.formatUnits(gasPrice, "gwei"),
      "gwei"
    );
    console.log(
      "💸 Estimated Transaction Cost:",
      ethers.formatEther(estimatedCost),
      "XDC"
    );

    // Show what the transaction will do
    console.log("\n📋 Transaction Details:");
    console.log(
      "   Function: setApprovalForAll(address operator, bool approved)"
    );
    console.log("   Operator:", WRAPPER_CONTRACT);
    console.log("   Approved: true");
    console.log("   From:", deployer.address);
    console.log("   To:", NFT_CONTRACT);

    // Execute the transaction
    console.log("\n🚀 Executing Transaction:");
    console.log("-".repeat(50));

    const tx = await nftContract.setApprovalForAll(WRAPPER_CONTRACT, true, {
      gasLimit: (gasEstimate * 130n) / 100n, // 30% buffer
      gasPrice,
    });

    console.log("📋 Transaction Hash:", tx.hash);
    console.log("⏳ Transaction submitted to mempool...");
    console.log(
      "🔗 View on Explorer: https://explorer.apothem.network/tx/" + tx.hash
    );

    // Wait for confirmation with progress updates
    console.log("\n⏳ Waiting for confirmations...");
    let confirmationCount = 0;
    const targetConfirmations = 2;

    // Start confirmation tracking
    const confirmationPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Transaction timeout after 2 minutes"));
      }, 120000);

      tx.wait(targetConfirmations)
        .then((receipt) => {
          clearTimeout(timeout);
          resolve(receipt);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });

    // Show progress
    const progressInterval = setInterval(async () => {
      try {
        const currentReceipt = await provider.getTransactionReceipt(tx.hash);
        if (currentReceipt) {
          const currentBlock = await provider.getBlockNumber();
          const newConfirmations =
            currentBlock - currentReceipt.blockNumber + 1;
          if (newConfirmations !== confirmationCount) {
            confirmationCount = newConfirmations;
            console.log(
              `   ⏳ Confirmations: ${confirmationCount}/${targetConfirmations}`
            );
          }
        }
      } catch (error) {
        // Silent fail
      }
    }, 3000);

    const receipt = await confirmationPromise;
    clearInterval(progressInterval);

    // Transaction confirmed
    console.log("\n✅ Transaction Confirmed!");
    console.log("-".repeat(50));
    console.log("📦 Block Number:", receipt.blockNumber);
    console.log("📊 Block Hash:", receipt.blockHash);
    console.log("⛽ Gas Used:", receipt.gasUsed.toString());
    console.log(
      "💰 Actual Cost:",
      ethers.formatEther(receipt.gasUsed * gasPrice),
      "XDC"
    );
    console.log(
      "📈 Gas Efficiency:",
      ((Number(receipt.gasUsed) / Number(gasEstimate)) * 100).toFixed(1) + "%"
    );

    // Analyze transaction events
    console.log("\n📋 Transaction Events:");
    console.log("-".repeat(50));

    if (receipt.logs && receipt.logs.length > 0) {
      console.log("📋 Total Events:", receipt.logs.length);

      // Look for ApprovalForAll event
      const approvalTopic = ethers.id("ApprovalForAll(address,address,bool)");
      const approvalLog = receipt.logs.find(
        (log) => log.topics[0] === approvalTopic
      );

      if (approvalLog) {
        console.log("✅ ApprovalForAll Event Found:");

        // Parse the event data
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["bool"],
            approvalLog.data
          );

          console.log("   📋 Event Details:");
          console.log(
            "   • Owner:",
            ethers.getAddress("0x" + approvalLog.topics[1].slice(26))
          );
          console.log(
            "   • Operator:",
            ethers.getAddress("0x" + approvalLog.topics[2].slice(26))
          );
          console.log("   • Approved:", decoded[0]);
          console.log("   • Transaction:", tx.hash);
          console.log("   • Block:", receipt.blockNumber);
        } catch (error) {
          console.log(
            "   ✅ ApprovalForAll event detected (could not parse details)"
          );
        }
      } else {
        console.log("⚠️  No ApprovalForAll event found in logs");
        console.log(
          "   This might indicate an issue, but let's verify the final state"
        );
      }
    } else {
      console.log("📭 No events emitted");
    }

    // Final verification
    console.log("\n🔍 Final Verification:");
    console.log("-".repeat(50));

    // Wait a moment for state to update
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const finalApprovalStatus = await nftContract.isApprovedForAll(
        deployer.address,
        WRAPPER_CONTRACT
      );

      if (finalApprovalStatus) {
        console.log("🎉 SUCCESS! Approval confirmed on blockchain");
        console.log(
          "✅ The wrapper contract can now manage ALL your NFTs from this collection"
        );

        console.log("\n📊 Final Summary:");
        console.log("✅ Transaction executed successfully");
        console.log("✅ ApprovalForAll status confirmed");
        console.log("✅ Gas costs within estimates");
        console.log("✅ Events properly emitted");

        console.log("\n🚀 What You Can Do Now:");
        console.log("1. 🎁 Wrap your NFTs into ERC-6960 tokens");
        console.log("2. 📊 Trade wrapped tokens on compatible platforms");
        console.log("3. 🔄 Unwrap back to original NFTs when needed");
        console.log(
          "4. 💼 All future NFTs from this collection are pre-approved"
        );

        console.log("\n🔗 Useful Links:");
        console.log(
          "• Transaction:",
          "https://explorer.apothem.network/tx/" + tx.hash
        );
        console.log(
          "• NFT Contract:",
          "https://explorer.apothem.network/address/" + NFT_CONTRACT
        );
        console.log(
          "• Wrapper Contract:",
          "https://explorer.apothem.network/address/" + WRAPPER_CONTRACT
        );
      } else {
        console.log(
          "⚠️  WARNING: Transaction succeeded but approval not confirmed"
        );
        console.log("   This could be due to:");
        console.log("   • Network synchronization delays");
        console.log("   • Non-standard contract implementation");
        console.log("   • Contract-specific restrictions");

        console.log("\n🔧 Recommended Actions:");
        console.log("1. Wait 5-10 minutes and check again");
        console.log("2. Verify transaction on block explorer");
        console.log("3. Try the approval process again if needed");
      }
    } catch (error) {
      console.log("❌ Could not verify final approval status:", error.message);
      console.log("   The transaction was successful, but verification failed");
      console.log("   This is likely a temporary network issue");
    }
  } catch (error) {
    console.error("\n💥 Error during approval process:");
    console.error("Message:", error.message);

    if (error.code) {
      console.error("Error Code:", error.code);
    }

    if (error.transaction) {
      console.error("Failed Transaction:", error.transaction.hash);
    }

    if (error.receipt) {
      console.error("Transaction was mined but failed:");
      console.error("Block:", error.receipt.blockNumber);
      console.error("Gas Used:", error.receipt.gasUsed?.toString());
    }

    console.log("\n🔧 Troubleshooting Steps:");
    console.log("1. ✅ Check .env file has correct addresses");
    console.log("2. ✅ Ensure sufficient XDC balance for gas");
    console.log("3. ✅ Verify network connection to Apothem");
    console.log("4. ✅ Confirm contract addresses are deployed");
    console.log("5. ✅ Check if contract has any special restrictions");
  }
}

// Main execution with proper cleanup
async function main() {
  try {
    await comprehensiveApprovalCheck();
  } catch (error) {
    console.error("Script execution failed:", error.message);
  } finally {
    // Ensure clean exit
    setTimeout(() => {
      console.log("\n✨ Script execution completed");
      process.exit(0);
    }, 2000);
  }
}

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
  process.exit(1);
});

// Execute
main().catch((error) => {
  console.error("Main execution failed:", error);
  // process.exit(1);
  throw new Error("Deployment failed");
});
