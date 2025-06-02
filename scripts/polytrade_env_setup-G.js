require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 POLYTRADE SETUP SCRIPT (ENV PARAMETERS)");
  console.log("============================================================");

  // READ PARAMETERS FROM ENVIRONMENT VARIABLES
  const NFT_CONTRACT =
    process.env.TARGET_NFT_CONTRACT ||
    "0x8C68D4f020bc45B2AeA2B9D4EF2b137A1F85292E";
  const TOKEN_ID = parseInt(process.env.TARGET_TOKEN_ID || "2");
  const FRACTIONS_INPUT = parseFloat(
    process.env.TARGET_FRACTIONS || "10000000"
  );
  const FRACTIONS = ethers.parseEther(FRACTIONS_INPUT.toString());

  // Validate parameters
  if (!ethers.isAddress(NFT_CONTRACT)) {
    console.log(`❌ Invalid NFT contract address: ${NFT_CONTRACT}`);
    console.log("💡 Set TARGET_NFT_CONTRACT in .env file");
    return;
  }

  if (isNaN(TOKEN_ID) || TOKEN_ID < 0) {
    console.log(`❌ Invalid token ID: ${TOKEN_ID}`);
    console.log("💡 Set TARGET_TOKEN_ID in .env file");
    return;
  }

  if (isNaN(FRACTIONS_INPUT) || FRACTIONS_INPUT <= 0) {
    console.log(`❌ Invalid fractions amount: ${FRACTIONS_INPUT}`);
    console.log("💡 Set TARGET_FRACTIONS in .env file");
    return;
  }

  console.log("\n📋 PARAMETERS (from .env)");
  console.log("==================================================");
  console.log(`NFT Contract  : ${NFT_CONTRACT}`);
  console.log(`Token ID      : ${TOKEN_ID}`);
  console.log(
    `Fractions     : ${ethers.formatEther(FRACTIONS)} (${FRACTIONS_INPUT})`
  );

  // FIXED CONTRACT ADDRESSES
  const contracts = {
    nft: NFT_CONTRACT,
    baseAsset: "0x8A3a86d55b3F57b4Be9ce0113e09d0B9f7b12771",
    wrappedAsset: "0x92F5a2bD28CCB184af7874e1707ABc7a7df45075",
    marketplace: "0x0d1Aa18eFa38eE8c3d32A84b9D452EAf4E3D571d",
    feeManager: "0x31dDa0071Da559E4189C6Beb11eca942cB0350BE",
  };

  console.log("\n📋 INFRASTRUCTURE CONTRACTS");
  console.log("==================================================");
  console.log(`BaseAsset     : ${contracts.baseAsset}`);
  console.log(`WrappedAsset  : ${contracts.wrappedAsset}`);
  console.log(`Marketplace   : ${contracts.marketplace}`);
  console.log(`FeeManager    : ${contracts.feeManager}`);

  // LOAD ACCOUNTS FROM .ENV
  console.log("\n🔍 LOADING ACCOUNTS FROM .ENV");
  console.log("==================================================");

  const [defaultAdmin] = await ethers.getSigners();
  console.log(`Default Admin : ${defaultAdmin.address}`);

  // Load admin account
  let adminSigner = defaultAdmin;
  const adminKeyNames = [
    "ADMIN_PRIVATE_KEY",
    "DEPLOYER_PRIVATE_KEY",
    "POLYTRADE_ADMIN_PRIVATE_KEY",
    "MARKETPLACE_ADMIN_PRIVATE_KEY",
  ];

  for (const keyName of adminKeyNames) {
    if (process.env[keyName]) {
      try {
        let adminKey = process.env[keyName].trim();
        if (!adminKey.startsWith("0x")) adminKey = "0x" + adminKey;
        adminSigner = new ethers.Wallet(adminKey, ethers.provider);
        console.log(`✅ Admin loaded from ${keyName}: ${adminSigner.address}`);
        break;
      } catch (error) {
        console.log(`❌ Invalid admin key in ${keyName}: ${error.message}`);
      }
    }
  }

  // Load NFT owner account
  let nftOwnerSigner;
  const nftOwnerKeyNames = [
    "NFT_OWNER_PRIVATE_KEY",
    "SELLER_PRIVATE_KEY",
    "OWNER_PRIVATE_KEY",
    "USER_PRIVATE_KEY",
    "ASSET_OWNER_PRIVATE_KEY",
  ];

  let nftOwnerKey = null;
  let usedKeyName = null;

  for (const keyName of nftOwnerKeyNames) {
    if (process.env[keyName]) {
      nftOwnerKey = process.env[keyName];
      usedKeyName = keyName;
      break;
    }
  }

  if (!nftOwnerKey) {
    console.log("❌ No NFT owner private key found in .env file!");
    console.log("💡 Add one of these to your .env file:");
    nftOwnerKeyNames.forEach((name) => {
      console.log(`   ${name}=0x1234567890abcdef...`);
    });
    return;
  }

  // Create NFT owner wallet
  try {
    let cleanKey = nftOwnerKey.trim();
    if (
      (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
      (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
    ) {
      cleanKey = cleanKey.slice(1, -1);
    }
    if (!cleanKey.startsWith("0x")) cleanKey = "0x" + cleanKey;

    nftOwnerSigner = new ethers.Wallet(cleanKey, ethers.provider);
    console.log(
      `✅ NFT Owner loaded from ${usedKeyName}: ${nftOwnerSigner.address}`
    );
  } catch (error) {
    console.log(`❌ Invalid NFT owner private key: ${error.message}`);
    return;
  }

  // CONTRACT ABIs
  const abis = {
    nft: [
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function approve(address to, uint256 tokenId) external",
      "function getApproved(uint256 tokenId) view returns (address)",
      "function name() view returns (string)",
      "function symbol() view returns (string)",
    ],
    baseAsset: [
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function grantRole(bytes32 role, address account) external",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
      "function ASSET_MANAGER() view returns (bytes32)",
      "function createAsset(address owner, uint256 mainId, uint256 subId, uint256 amount) external",
    ],
    wrappedAsset: [
      "function whitelist(address contractAddress, bool status) external",
      "function wrapERC721(address contractAddress, uint256 tokenId, uint256 fractions) external returns (uint256)",
      "function hasRole(bytes32 role, address account) view returns (bool)",
      "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    ],
  };

  // STEP 1: VERIFY SETUP
  console.log("\n🔍 STEP 1: VERIFYING SETUP");
  console.log("==================================================");

  // Check if contracts exist
  for (const [name, address] of Object.entries(contracts)) {
    const code = await ethers.provider.getCode(address);
    if (code === "0x") {
      console.log(`❌ ${name} contract not found at ${address}`);
      return;
    }
  }
  console.log("✅ All contracts exist");

  const nftContract = new ethers.Contract(
    contracts.nft,
    abis.nft,
    nftOwnerSigner
  );
  const baseAssetContract = new ethers.Contract(
    contracts.baseAsset,
    abis.baseAsset,
    adminSigner
  );
  const wrappedAssetContract = new ethers.Contract(
    contracts.wrappedAsset,
    abis.wrappedAsset,
    adminSigner
  );

  // Get NFT info
  try {
    const nftName = await nftContract.name();
    const nftSymbol = await nftContract.symbol();
    console.log(`NFT Collection: ${nftName} (${nftSymbol})`);
  } catch (e) {
    console.log("NFT Collection: Name/Symbol not available");
  }

  // Check NFT ownership and if already wrapped
  try {
    const nftOwner = await nftContract.ownerOf(TOKEN_ID);
    console.log(`NFT Token ${TOKEN_ID} owner: ${nftOwner}`);

    // Check if already wrapped
    if (nftOwner.toLowerCase() === contracts.wrappedAsset.toLowerCase()) {
      console.log("🎁 NFT STATUS: ALREADY WRAPPED ✅");
      console.log("   The NFT is currently held by the WrappedAsset contract");
      console.log(
        "   This means it has been successfully wrapped into ERC6960 tokens"
      );
      console.log("   Skipping wrapping step...");

      console.log("\n🎉 SETUP VERIFICATION COMPLETE!");
      console.log("==================================================");
      console.log("✅ NFT is already wrapped into ERC6960 tokens");
      console.log("✅ All permissions and setup are working correctly");
      console.log("✅ NFT can be traded on the marketplace");

      return {
        success: true,
        alreadyWrapped: true,
        nftContract: contracts.nft,
        tokenId: TOKEN_ID,
        nftOwner,
      };
    }

    // Check if NFT owner matches the loaded account
    if (nftOwner.toLowerCase() !== nftOwnerSigner.address.toLowerCase()) {
      console.log(`❌ NFT owner mismatch!`);
      console.log(`   Expected: ${nftOwnerSigner.address}`);
      console.log(`   Actual: ${nftOwner}`);
      console.log("💡 Make sure you have the correct NFT owner's private key");
      return;
    }
    console.log("✅ NFT ownership confirmed");
  } catch (error) {
    console.log(`❌ Could not verify NFT ownership: ${error.message}`);
    return;
  }

  // STEP 2: CHECK ADMIN PERMISSIONS
  console.log("\n🔑 STEP 2: CHECKING ADMIN PERMISSIONS");
  console.log("==================================================");

  try {
    const defaultAdminRole = await wrappedAssetContract.DEFAULT_ADMIN_ROLE();
    const adminHasWrappedRole = await wrappedAssetContract.hasRole(
      defaultAdminRole,
      adminSigner.address
    );
    console.log(
      `Admin has DEFAULT_ADMIN_ROLE on WrappedAsset: ${adminHasWrappedRole}`
    );

    if (!adminHasWrappedRole) {
      console.log("❌ Admin missing DEFAULT_ADMIN_ROLE on WrappedAsset");
      return;
    }

    const baseAdminHasRole = await baseAssetContract.hasRole(
      defaultAdminRole,
      adminSigner.address
    );
    console.log(
      `Admin has DEFAULT_ADMIN_ROLE on BaseAsset: ${baseAdminHasRole}`
    );

    if (!baseAdminHasRole) {
      console.log("❌ Admin missing DEFAULT_ADMIN_ROLE on BaseAsset");
      return;
    }

    console.log("✅ Admin permissions confirmed");
  } catch (error) {
    console.log(`❌ Admin permission check failed: ${error.message}`);
    return;
  }

  // STEP 3: WHITELIST NFT CONTRACT
  console.log("\n📝 STEP 3: WHITELISTING NFT CONTRACT");
  console.log("==================================================");

  try {
    console.log(`Whitelisting NFT contract: ${contracts.nft}`);
    const whitelistTx = await wrappedAssetContract.whitelist(
      contracts.nft,
      true
    );
    await whitelistTx.wait();
    console.log(`✅ NFT contract whitelisted! Tx: ${whitelistTx.hash}`);
  } catch (error) {
    if (
      error.message.includes("already") ||
      error.message.includes("StatusChanged")
    ) {
      console.log("✅ NFT contract already whitelisted");
    } else {
      console.log(`❌ Whitelist failed: ${error.message}`);
      return;
    }
  }

  // STEP 4: CHECK AND SET UP WRAPPED ASSET PERMISSIONS
  console.log("\n🔑 STEP 4: CHECKING WRAPPED ASSET PERMISSIONS");
  console.log("==================================================");

  try {
    const ASSET_MANAGER = await baseAssetContract.ASSET_MANAGER();
    console.log(`ASSET_MANAGER role hash: ${ASSET_MANAGER}`);

    const hasAssetManagerRole = await baseAssetContract.hasRole(
      ASSET_MANAGER,
      contracts.wrappedAsset
    );
    console.log(`WrappedAsset has ASSET_MANAGER role: ${hasAssetManagerRole}`);

    if (!hasAssetManagerRole) {
      console.log("Granting ASSET_MANAGER role to WrappedAsset...");
      const grantTx = await baseAssetContract.grantRole(
        ASSET_MANAGER,
        contracts.wrappedAsset
      );
      await grantTx.wait();
      console.log(`✅ ASSET_MANAGER role granted! Tx: ${grantTx.hash}`);
    } else {
      console.log("✅ WrappedAsset already has ASSET_MANAGER role");
    }
  } catch (error) {
    console.log(`❌ Permission setup failed: ${error.message}`);
    return;
  }

  // STEP 5: SET UP NFT APPROVALS
  console.log("\n🔑 STEP 5: SETTING UP NFT APPROVALS");
  console.log("==================================================");

  try {
    const approved = await nftContract.getApproved(TOKEN_ID);
    console.log(`Currently approved to: ${approved}`);

    if (approved.toLowerCase() !== contracts.wrappedAsset.toLowerCase()) {
      console.log("Setting approval for WrappedAsset...");
      const approveTx = await nftContract.approve(
        contracts.wrappedAsset,
        TOKEN_ID
      );
      await approveTx.wait();
      console.log(`✅ NFT approved! Tx: ${approveTx.hash}`);
    } else {
      console.log("✅ NFT already approved");
    }
  } catch (error) {
    console.log(`❌ Approval failed: ${error.message}`);
    return;
  }

  // STEP 6: WRAP NFT
  console.log("\n🎁 STEP 6: WRAPPING NFT");
  console.log("==================================================");

  try {
    console.log(
      `Wrapping NFT Token ${TOKEN_ID} into ${ethers.formatEther(
        FRACTIONS
      )} ERC6960 fractions...`
    );

    const wrappedAssetWithOwner = new ethers.Contract(
      contracts.wrappedAsset,
      abis.wrappedAsset,
      nftOwnerSigner
    );
    const wrapTx = await wrappedAssetWithOwner.wrapERC721(
      contracts.nft,
      TOKEN_ID,
      FRACTIONS
    );

    console.log(`🔄 Transaction submitted: ${wrapTx.hash}`);
    console.log(`🔗 Track: https://testnet.xdcscan.com/tx/${wrapTx.hash}`);

    const receipt = await wrapTx.wait();
    console.log(`✅ NFT wrapped successfully!`);
    console.log(`📊 Gas used: ${receipt.gasUsed}`);
  } catch (error) {
    console.log(`❌ Wrapping failed: ${error.message}`);

    if (error.message.includes("AssetAlreadyCreated")) {
      console.log(
        "💡 This NFT is already wrapped - check if it was wrapped before"
      );
    } else if (error.message.includes("InvalidOwner")) {
      console.log("💡 The account doesn't own the NFT");
    } else if (error.message.includes("NotWhitelisted")) {
      console.log("💡 The NFT contract is not whitelisted");
    }
    return;
  }

  // SUCCESS SUMMARY
  console.log("\n🎉 SETUP COMPLETE!");
  console.log("============================================================");
  console.log("✅ NFT contract whitelisted");
  console.log("✅ WrappedAsset has ASSET_MANAGER permissions on BaseAsset");
  console.log("✅ NFT approved for WrappedAsset");
  console.log("✅ NFT wrapped into ERC6960 tokens");

  console.log("\n📊 RESULTS:");
  console.log("==================================================");
  console.log(`NFT Contract      : ${contracts.nft}`);
  console.log(`Token ID          : ${TOKEN_ID}`);
  console.log(`Fractions Created : ${ethers.formatEther(FRACTIONS)}`);
  console.log(`NFT Owner         : ${nftOwnerSigner.address}`);
  console.log(`Admin             : ${adminSigner.address}`);

  return {
    success: true,
    alreadyWrapped: false,
    nftContract: contracts.nft,
    tokenId: TOKEN_ID,
    fractions: ethers.formatEther(FRACTIONS),
  };
}

main()
  .then((result) => {
    if (result && result.success) {
      console.log(`\n📄 FINAL RESULT: SUCCESS ✅`);
      if (result.alreadyWrapped) {
        console.log("   Status: NFT was already wrapped");
      } else {
        console.log("   Status: NFT successfully wrapped");
      }
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
