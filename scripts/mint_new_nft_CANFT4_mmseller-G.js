// scripts/mint_with_owner_check.js
const hre = require("hardhat");

async function main() {
  try {
    console.log("🚀 Starting NFT minting process...");

    const contractAddress = process.env.ORIG_NFT_CONTRACT_ADDRESS;
    const recipientAddress =
      process.env.ORIG_NFT_RECIPIENT_ADDRESS ||
      "0x9281B31230C735867a2Fd62aF8ec816Cc1714521";
    const tokenURI = process.env.ORIG_NFT_TOKEN_URI || "https://CANFT4.com";

    // Validation
    if (!contractAddress) {
      console.error(
        "❌ Please set ORIG_NFT_CONTRACT_ADDRESS environment variable"
      );
      process.exit(1);
    }

    if (!hre.ethers.isAddress(contractAddress)) {
      console.error("❌ Invalid contract address format");
      process.exit(1);
    }

    if (!hre.ethers.isAddress(recipientAddress)) {
      console.error("❌ Invalid recipient address format");
      process.exit(1);
    }

    // Require ORIG_NFT_OWNER_PK environment variable
    if (!process.env.ORIG_NFT_OWNER_PRIVATE_KEY) {
      console.error(
        "❌ Please set ORIG_NFT_OWNER_PK environment variable with the owner's private key"
      );
      console.error("💡 Add this to your .env file:");
      console.error("   ORIG_NFT_OWNER_PK=0x1234567890abcdef...");
      process.exit(1);
    }

    console.log(
      "🔑 Using private key from ORIG_NFT_OWNER_PRIVATE_KEY environment variable"
    );

    let signer;
    try {
      signer = new hre.ethers.Wallet(
        process.env.ORIG_NFT_OWNER_PRIVATE_KEY,
        hre.ethers.provider
      );
    } catch (error) {
      console.error("❌ Invalid private key in ORIG_NFT_OWNER_PRIVATE_KEY");
      console.error(
        "💡 Please check that your private key is in the correct format (0x...)"
      );
      process.exit(1);
    }

    console.log(`📝 Signer address: ${signer.address}`);
    console.log(`📍 Network: ${hre.network.name}`);

    // Check signer balance
    const balance = await hre.ethers.provider.getBalance(signer.address);
    console.log(`💰 Signer balance: ${hre.ethers.formatEther(balance)} XDC`);

    if (balance < hre.ethers.parseEther("0.01")) {
      console.warn("⚠️  Warning: Low balance, transaction might fail");
    }

    const CANFT4Factory = await hre.ethers.getContractFactory("CANFT4", signer);
    const contract = CANFT4Factory.attach(contractAddress).connect(signer);

    // Verify contract exists
    const code = await hre.ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      console.error("❌ No contract found at the specified address");
      process.exit(1);
    }

    const owner = await contract.owner();
    console.log(`👑 Contract owner: ${owner}`);
    console.log(`🎯 Recipient: ${recipientAddress}`);
    console.log(`📍 Contract address: ${contractAddress}`);

    // Verify signer will be used for transaction
    console.log(
      `🔐 Transaction will be sent from: ${await contract.runner.getAddress()}`
    );

    if (signer.address.toLowerCase() !== owner.toLowerCase()) {
      console.error("\n❌ OWNERSHIP MISMATCH!");
      console.error(`Current signer: ${signer.address}`);
      console.error(`Contract owner: ${owner}`);
      console.error("\n💡 To fix this, you need to:");
      console.error(
        "1. Set ORIG_NFT_OWNER_PRIVATE_KEY with the contract owner's private key"
      );
      console.error("2. Transfer ownership to your current address, OR");
      console.error(
        "3. Use publicMint() if available and you have required XDC"
      );
      process.exit(1);
    }

    console.log("✅ Ownership verified! Proceeding with mint...");

    // Try to get current token count for logging
    let totalSupply = 0;
    try {
      totalSupply = await contract.totalSupply();
      console.log(`📊 Current total supply: ${totalSupply}`);
    } catch (error) {
      console.log("ℹ️  Could not fetch total supply");
    }

    // Check if the contract has the safeMint function
    console.log("🔍 Checking contract functions...");
    try {
      const contractInterface = contract.interface;
      const hasSafeMint = contractInterface.fragments.some(
        (f) => f.name === "safeMint"
      );
      const hasMint = contractInterface.fragments.some(
        (f) => f.name === "mint"
      );
      const hasPublicMint = contractInterface.fragments.some(
        (f) => f.name === "publicMint"
      );

      console.log(`   safeMint: ${hasSafeMint ? "✅" : "❌"}`);
      console.log(`   mint: ${hasMint ? "✅" : "❌"}`);
      console.log(`   publicMint: ${hasPublicMint ? "✅" : "❌"}`);

      if (!hasSafeMint) {
        console.error("❌ safeMint function not found in contract!");
        console.log("💡 Available functions:");
        contractInterface.fragments.forEach((f) => {
          if (f.type === "function" && !f.name.startsWith("_")) {
            console.log(
              `   - ${f.name}(${f.inputs.map((i) => i.type).join(", ")})`
            );
          }
        });
        process.exit(1);
      }
    } catch (error) {
      console.warn("⚠️  Could not analyze contract interface");
    }

    // Check if contract is paused
    try {
      const isPaused = await contract.paused();
      if (isPaused) {
        console.error("❌ Contract is paused! Cannot mint.");
        process.exit(1);
      }
      console.log("✅ Contract is not paused");
    } catch (error) {
      console.log("ℹ️  Contract pause state unknown (no paused() function)");
    }

    // Try a static call first to see what would happen
    console.log("🧪 Testing transaction with static call...");
    try {
      await contract.safeMint.staticCall(recipientAddress, tokenURI);
      console.log("✅ Static call successful - transaction should work");
    } catch (error) {
      console.error("❌ Static call failed:");
      console.error(`   Error: ${error.message}`);

      // Try to decode the revert reason
      if (error.data) {
        try {
          const decodedError = contract.interface.parseError(error.data);
          console.error(
            `   Decoded error: ${decodedError.name}(${decodedError.args.join(
              ", "
            )})`
          );
        } catch {
          console.error(`   Raw error data: ${error.data}`);
        }
      }

      console.error("\n💡 Common issues:");
      console.error("   - Maximum supply reached");
      console.error("   - Invalid recipient address");
      console.error("   - Insufficient permissions");
      console.error("   - Contract specific restrictions");
      process.exit(1);
    }

    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contract.safeMint.estimateGas(
        recipientAddress,
        tokenURI
      );
      console.log(`⛽ Estimated gas: ${gasEstimate}`);
    } catch (error) {
      console.warn("⚠️  Could not estimate gas, using default limit");
      gasEstimate = 500000n;
    }

    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate + (gasEstimate * 20n) / 100n;

    console.log(`🔄 Minting to: ${recipientAddress}`);
    console.log(`🔗 Token URI: ${tokenURI || "Empty"}`);

    const tx = await contract.safeMint(recipientAddress, tokenURI, {
      gasLimit,
    });

    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();

    console.log(`✅ Minted successfully!`);
    console.log(`📦 Block number: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed}`);

    // Try to get the token ID from events
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
        console.log(`🆔 Token ID: ${parsed.args.tokenId}`);
      }
    } catch (error) {
      console.log("ℹ️  Could not extract token ID from transaction");
    }

    console.log(`\n🎉 NFT successfully minted to ${recipientAddress}!`);
  } catch (error) {
    console.error("❌ Error:", error.message);

    // Provide more specific error handling
    if (error.code === "CALL_EXCEPTION") {
      console.error(
        "💡 This might be a contract function call issue. Check if:"
      );
      console.error("   - The contract has the safeMint function");
      console.error("   - The function parameters are correct");
      console.error("   - The contract is not paused");
    } else if (error.code === "INSUFFICIENT_FUNDS") {
      console.error(
        "💡 Insufficient funds for gas. Please add more XDC to your account."
      );
    } else if (error.code === "NETWORK_ERROR") {
      console.error(
        "💡 Network connection issue. Please check your RPC endpoint."
      );
    }

    process.exit(1);
  }
}

// Handle script termination
process.on("SIGINT", () => {
  console.log("\n👋 Script interrupted by user");
  // process.exit(0);
  throw new Error("mint failed");
});

main().catch((error) => {
  console.error("💥 Unhandled error:", error);
  // process.exit(1);
  throw new Error("Mint failed");
});
