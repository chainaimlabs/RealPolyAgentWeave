const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying WrappedAsset...");
  console.log("Deploying with account:", deployer.address);

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
    console.log("Created deployments directory");
  }

  // Read previous deployment data - check all possible file locations
  const deploymentPath1 = `./deployments/${hre.network.name}-addresses.json`;
  const deploymentPath2 = `./deployed-addresses-${hre.network.name}.json`;
  const deploymentPath3 = `./${hre.network.name}-addresses.json`; // Your actual file format

  let deploymentData = {};
  let deploymentPath = deploymentPath1;

  if (fs.existsSync(deploymentPath1)) {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath1, "utf8"));
    deploymentPath = deploymentPath1;
    console.log("📁 Found deployment file at:", deploymentPath1);
  } else if (fs.existsSync(deploymentPath2)) {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath2, "utf8"));
    deploymentPath = deploymentPath2;
    console.log("📁 Found deployment file at:", deploymentPath2);
  } else if (fs.existsSync(deploymentPath3)) {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath3, "utf8"));
    deploymentPath = deploymentPath3;
    console.log("📁 Found deployment file at:", deploymentPath3);
  } else {
    console.log("❌ No deployment file found!");
    console.log("Expected files:");
    console.log("  -", deploymentPath1);
    console.log("  -", deploymentPath2);
    console.log("  -", deploymentPath3);
    throw new Error("Please run step 1 (BaseAsset deployment) first");
  }

  console.log("📋 Current deployment data:", deploymentData);

  // Check for BaseAsset address from the deployment file
  const baseAssetAddress = deploymentData.baseAsset || deploymentData.BaseAsset;

  if (!baseAssetAddress) {
    console.log("❌ BaseAsset address not found in deployment file!");
    console.log("File contents:", deploymentData);
    throw new Error(
      "BaseAsset address missing from deployment file. Please check the deployment file format."
    );
  }

  console.log("✅ Using BaseAsset address:", baseAssetAddress);

  try {
    // Deploy WrappedAsset with correct constructor (only needs baseAsset address)
    const WrappedAsset = await hre.ethers.getContractFactory("WrappedAsset");

    console.log("📦 Deploying WrappedAsset contract...");
    const wrappedAsset = await WrappedAsset.deploy(
      baseAssetAddress, // Only parameter: assetCollection_
      {
        gasPrice: hre.ethers.parseUnits("25", "gwei"),
        gasLimit: 5000000,
      }
    );

    console.log("⏳ Waiting for deployment confirmation...");
    console.log("Transaction hash:", wrappedAsset.deploymentTransaction().hash);

    // Wait for deployment (Ethers v6)
    await wrappedAsset.waitForDeployment();

    const wrappedAssetAddress = await wrappedAsset.getAddress();
    console.log("✅ WrappedAsset deployed to:", wrappedAssetAddress);

    // Update deployment data
    deploymentData.wrappedAsset = wrappedAssetAddress;
    deploymentData.timestamp = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    console.log("💾 Deployment data saved to:", deploymentPath);

    // Skip verification for XDC networks
    if (
      hre.network.name !== "hardhat" &&
      hre.network.name !== "localhost" &&
      hre.network.name !== "apothem" &&
      hre.network.name !== "xdc"
    ) {
      console.log("⏳ Waiting for block confirmations...");
      const deploymentTx = wrappedAsset.deploymentTransaction();
      if (deploymentTx) {
        await deploymentTx.wait(5);
      }

      try {
        await hre.run("verify:verify", {
          address: wrappedAssetAddress,
          constructorArguments: [
            baseAssetAddress,
            "Polytrade Wrapped Asset",
            "PWA",
          ],
        });
        console.log("✅ WrappedAsset verified on blockchain explorer");
      } catch (error) {
        console.log("❌ Verification failed:", error.message);
      }
    } else {
      console.log("⏭️ Skipping verification for", hre.network.name);
    }

    console.log("🎉 WrappedAsset deployment completed successfully!");
    return wrappedAssetAddress;
  } catch (error) {
    console.log("❌ Deployment failed:", error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      throw new Error("Deployment failed");
    });
}

module.exports = main;
