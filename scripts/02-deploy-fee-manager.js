const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying FeeManager with account:", deployer.address);

  // Get account balance (Ethers v6 compatible)
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "XDC");

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
    console.log("Created deployments directory");
  }

  // Read previous deployment data
  const deploymentPath = `./deployments/${hre.network.name}-addresses.json`;
  let deploymentData = {};

  if (fs.existsSync(deploymentPath)) {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }

  console.log("📋 Deployment Parameters:");
  console.log("   Default Initial Fee: 250 basis points (2.5%)");
  console.log("   Default Buying Fee: 150 basis points (1.5%)");
  console.log("   Fee Wallet:", deployer.address);

  // Use reasonable gas settings (Ethers v6 compatible)
  const gasPrice = hre.ethers.parseUnits("25", "gwei"); // 25 Gwei
  const gasLimit = 2000000; // 2M gas

  console.log("⛽ Gas Configuration:");
  console.log("   Gas Price:", gasPrice.toString(), "wei (25.0 Gwei)");
  console.log("   Gas Limit:", gasLimit.toString());

  const deployOptions = {
    gasPrice,
    gasLimit,
  };

  console.log("🔧 Deploy options:", {
    gasPrice: gasPrice.toString(),
    gasLimit: gasLimit.toString(),
  });

  try {
    // Deploy FeeManager
    const FeeManager = await hre.ethers.getContractFactory("FeeManager");

    console.log("📦 Deploying contract...");
    const feeManager = await FeeManager.deploy(
      deployer.address, // owner
      250, // platform fee (2.5%)
      deployer.address, // fee recipient
      deployOptions
    );

    console.log("⏳ Waiting for deployment confirmation...");
    console.log("Transaction hash:", feeManager.deploymentTransaction().hash);

    // Wait for the transaction to be mined (Ethers v6)
    await feeManager.waitForDeployment();

    const feeManagerAddress = await feeManager.getAddress();
    console.log("✅ FeeManager deployed to:", feeManagerAddress);

    // Update deployment data
    deploymentData.feeManager = feeManagerAddress;
    deploymentData.timestamp = new Date().toISOString();
    deploymentData.network = hre.network.name;
    deploymentData.deployer = deployer.address;

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

    console.log("🎉 FeeManager deployment completed successfully!");
    return feeManagerAddress;
  } catch (error) {
    console.log("❌ Deployment failed:", error.message);
    console.log("💥 Deployment failed!");
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
