// scripts/01-deploy-base-asset.js - With much higher gas price
async function main() {
  console.log("Deploying BaseAsset...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check current network gas price
  const provider = ethers.provider;
  try {
    const gasPrice = await provider.getFeeData();
    console.log(
      "Network suggested gas price:",
      gasPrice.gasPrice?.toString(),
      "wei"
    );
  } catch (e) {
    console.log("Could not fetch gas price from network");
  }

  const BaseAsset = await ethers.getContractFactory("BaseAsset");

  // Try with much higher gas price
  console.log("Attempting deployment with 10 gwei gas price...");

  const deployOptions = {
    gasPrice: "13000000000", // 10 gwei in wei
    gasLimit: 8000000,
  };

  console.log("Deploy options:", deployOptions);

  const baseAsset = await BaseAsset.deploy(
    "Polytrade Asset Collection", // name
    "PTAC", // symbol
    "1.0.0", // version
    "https://api.polytrade.finance/nft/", // baseURI
    deployOptions
  );

  console.log("Deployment transaction sent, waiting for confirmation...");

  // Wait for deployment
  if (baseAsset.deployed) {
    await baseAsset.deployed();
    console.log("BaseAsset deployed to:", baseAsset.address);
    console.log("Transaction hash:", baseAsset.deployTransaction.hash);
  } else {
    await baseAsset.waitForDeployment();
    const address = await baseAsset.getAddress();
    console.log("BaseAsset deployed to:", address);
  }

  // Save address
  const fs = require("fs");
  const contractAddress = baseAsset.address || (await baseAsset.getAddress());

  const addresses = {
    baseAsset: contractAddress,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    `deployed-addresses-${hre.network.name}.json`,
    JSON.stringify(addresses, null, 2)
  );

  console.log("✅ BaseAsset deployed successfully!");
  console.log(
    `📁 Addresses saved to: deployed-addresses-${hre.network.name}.json`
  );
  console.log(`🔗 Contract address: ${contractAddress}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  throw new Error("Deployment failed");
});
