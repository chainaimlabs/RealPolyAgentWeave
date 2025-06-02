// Save this as scripts/check_balances.js
const hre = require("hardhat");

async function checkBalances() {
  console.log("💰 CHECKING ACCOUNT BALANCES");
  console.log("=====================================");

  const [deployer] = await hre.ethers.getSigners();
  const nftOwner = new hre.ethers.Wallet(
    process.env.NFT_OWNER_PRIVATE_KEY,
    hre.ethers.provider
  );

  console.log("Deployer address:", deployer.address);
  console.log("NFT Owner address:", nftOwner.address);

  // Check XDC balances
  const deployerBalance = await hre.ethers.provider.getBalance(
    deployer.address
  );
  const nftOwnerBalance = await hre.ethers.provider.getBalance(
    nftOwner.address
  );

  console.log("\n💎 XDC BALANCES:");
  console.log("Deployer XDC balance:", hre.ethers.formatEther(deployerBalance));
  console.log(
    "NFT Owner XDC balance:",
    hre.ethers.formatEther(nftOwnerBalance)
  );

  // Check if balances are sufficient for transactions
  const minRequiredBalance = hre.ethers.parseEther("0.1"); // 0.1 XDC

  if (deployerBalance < minRequiredBalance) {
    console.log("⚠️ WARNING: Deployer balance may be too low for transactions");
  }

  if (nftOwnerBalance < minRequiredBalance) {
    console.log(
      "⚠️ WARNING: NFT Owner balance may be too low for transactions"
    );
  }

  // Check current gas price
  const gasPrice = await hre.ethers.provider.getGasPrice();
  console.log("\n⛽ NETWORK INFO:");
  console.log(
    "Current gas price:",
    hre.ethers.formatUnits(gasPrice, "gwei"),
    "gwei"
  );

  // Estimate cost of a typical mint transaction
  const estimatedGasForMint = 200000; // typical mint operation
  const estimatedCost = gasPrice * BigInt(estimatedGasForMint);
  console.log(
    "Estimated mint transaction cost:",
    hre.ethers.formatEther(estimatedCost),
    "XDC"
  );
}

checkBalances()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
