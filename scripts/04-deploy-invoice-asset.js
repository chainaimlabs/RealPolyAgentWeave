// scripts/04-deploy-invoice-asset.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying InvoiceAsset...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Read previously deployed addresses
  const fs = require("fs");
  const addressFile = `deployed-addresses-${hre.network.name}.json`;

  if (!fs.existsSync(addressFile)) {
    throw new Error(
      `Address file ${addressFile} not found. Deploy BaseAsset first.`
    );
  }

  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  console.log("Using BaseAsset address:", addresses.baseAsset);

  const InvoiceAsset = await hre.ethers.getContractFactory("InvoiceAsset");

  // Deploy implementation only (no constructor parameters for upgradeable contracts)
  console.log("📦 Deploying InvoiceAsset implementation...");
  const invoiceAssetImpl = await InvoiceAsset.deploy({
    gasPrice: hre.ethers.parseUnits("25", "gwei"),
    gasLimit: 5000000,
  });

  // Wait for deployment (Ethers v6 syntax)
  await invoiceAssetImpl.waitForDeployment();
  const implAddress = await invoiceAssetImpl.getAddress();

  console.log("✅ InvoiceAsset implementation deployed to:", implAddress);

  // Update addresses file
  addresses.invoiceAssetImpl = implAddress;
  addresses.timestamp = new Date().toISOString();
  fs.writeFileSync(addressFile, JSON.stringify(addresses, null, 2));

  console.log("💾 Addresses saved to:", addressFile);
  console.log("⚠️  This is just the implementation contract!");
  console.log("⚠️  To use InvoiceAsset, you need to:");
  console.log("   1. Deploy a proxy contract");
  console.log("   2. Call initialize() with required parameters:");
  console.log("      - assetCollection:", addresses.baseAsset);
  console.log("      - treasuryWallet: (your treasury address)");
  console.log("      - marketplace: (marketplace contract address)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    throw new Error("Deployment failed");
  });
