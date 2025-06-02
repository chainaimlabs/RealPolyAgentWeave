// Fixed 06-deploy-marketplace.js script
const { upgrades } = require("hardhat");
const fs = require("fs"); // <-- This was missing!

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Read existing addresses
    const addresses = JSON.parse(
      fs.readFileSync("deployed-addresses-apothem.json", "utf8")
    );
    const baseAsset = addresses.baseAsset;
    const feeManager = addresses.feeManager;

    console.log("✅ Using BaseAsset address:", baseAsset);
    console.log("✅ Using FeeManager address:", feeManager);

    // Deploy as upgradeable proxy
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");

    console.log("📦 Deploying Marketplace as upgradeable proxy...");
    const marketplace = await upgrades.deployProxy(
      MarketplaceFactory,
      [baseAsset, feeManager], // Initialize parameters
      { initializer: "initialize" }
    );

    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();

    console.log("✅ Marketplace deployed to:", marketplaceAddress);

    // Update addresses file
    addresses.marketplace = marketplaceAddress;
    addresses.timestamp = new Date().toISOString();

    fs.writeFileSync(
      "deployed-addresses-apothem.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("📝 Updated deployed-addresses-apothem.json");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
  }
}

// Proper main function call with error handling
main().catch((error) => {
  console.error("Script execution failed:", error);
  // process.exitCode = 1;
  throw new Error("Deployment failed");
});
