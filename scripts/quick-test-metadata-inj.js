// scripts/quick_metadata_test.js
require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🧪 QUICK METADATA TEST WITH DUMMY COMPLIANCE DATA");
  console.log("============================================================");

  // Load data from previous script
  const inputData = loadWrapResultData();
  
  if (!inputData || !inputData.erc6960) {
    console.error("❌ No ERC6960 data found. Run extract_mainid.js first.");
    process.exit(1);
  }

  console.log("📥 INPUT DATA:");
  console.log(`   Original NFT: ${inputData.nftContract} #${inputData.tokenId}`);
  console.log(`   ERC6960 Main ID: ${inputData.erc6960.mainId}`);
  console.log(`   Fractions: ${inputData.erc6960.fractions}`);
  console.log(`   Company: ${inputData.metadata.companyName}`);

  // STEP 1: Create dummy compliance data
  console.log("\n🎭 STEP 1: CREATING DUMMY COMPLIANCE DATA");
  console.log("==================================================");
  
  const dummyCompliance = createDummyComplianceData(inputData);
  
  // STEP 2: Generate enriched metadata
  console.log("\n📄 STEP 2: GENERATING ENRICHED METADATA");
  console.log("==================================================");
  
  const enrichedMetadata = await generateEnrichedMetadata(inputData, dummyCompliance);
  
  // STEP 3: Save metadata files
  console.log("\n💾 STEP 3: SAVING METADATA FILES");
  console.log("==================================================");
  
  const savedFiles = await saveMetadataFiles(enrichedMetadata, inputData.erc6960.mainId);
  
  // STEP 4: Test metadata access
  console.log("\n🔍 STEP 4: TESTING METADATA ACCESS");
  console.log("==================================================");
  
  await testMetadataAccess(savedFiles);

  console.log("\n🎉 QUICK METADATA TEST COMPLETE!");
  console.log("============================================================");
  console.log(`✅ MainId: ${inputData.erc6960.mainId}`);
  console.log(`✅ Metadata Files: ${Object.keys(savedFiles).length} created`);
  console.log(`✅ Compliance Verifications: ${dummyCompliance.verifications.length}`);
  
  console.log(`\n📂 GENERATED FILES:`);
  Object.entries(savedFiles).forEach(([type, file]) => {
    console.log(`   ${type}: ${file}`);
  });

  return {
    mainId: inputData.erc6960.mainId,
    metadataFiles: savedFiles,
    complianceData: dummyCompliance
  };
}

function loadWrapResultData() {
  try {
    const dataFile = path.join(__dirname, "../output/wrap-result.json");
    if (fs.existsSync(dataFile)) {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error("❌ Failed to load wrap result data:", error.message);
    return null;
  }
}

function createDummyComplianceData(inputData) {
  console.log("   Creating dummy GLEIF verification...");
  console.log("   Creating dummy EXIM verification...");
  console.log("   Creating dummy BL Standards verification...");
  console.log("   Creating dummy 3-Way Matching verification...");
  
  const dummyCompliance = {
    verifications: [
      {
        type: "GLEIF",
        status: true,
        verifier: "0x742d35Cc6634C0532925a3b8D44a3Fab12345678",
        verificationDate: new Date().toISOString(),
        transactionHash: "0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
        data: {
          lei: "LEI123456789012345678",
          companyName: inputData.metadata.companyName,
          status: "ACTIVE"
        }
      },
      {
        type: "EXIM",
        status: true,
        verifier: "0x9f4B3577139d50E7b7C1D2a4C5F8E6D3A7B2C8E5",
        verificationDate: new Date().toISOString(),
        transactionHash: "0xdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc",
        data: {
          licenseNumber: "EXIM2024001234",
          validUntil: "2025-12-31"
        }
      },
      {
        type: "BL_STANDARDS",
        status: true,
        verifier: "0xA8E6D4B2C9F7E5A3D1C8B6A4E2F9D7B5C3A1E8F6",
        verificationDate: new Date().toISOString(),
        transactionHash: "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
        data: {
          standard: "ISO 28000",
          certificationBody: "Bureau Veritas"
        }
      },
      {
        type: "THREE_WAY_MATCHING",
        status: true,
        verifier: "0xD2F8B4A6C1E7D5B3A9F2E8C6A4D7B5F3A1C9E7D5",
        verificationDate: new Date().toISOString(),
        transactionHash: "0x789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345",
        data: {
          matchingAccuracy: "100%",
          documentsMatched: 3
        }
      }
    ],
    summary: {
      overallStatus: true,
      totalVerifications: 4,
      verifiedAt: new Date().toISOString()
    }
  };
  
  console.log(`✅ Created ${dummyCompliance.verifications.length} dummy verifications`);
  return dummyCompliance;
}

async function generateEnrichedMetadata(inputData, complianceData) {
  const metadata = {
    name: `Compliance-Verified Asset Fraction #${inputData.tokenId}`,
    description: `Fractional ownership of compliance-verified digital asset for ${inputData.metadata.companyName}`,
    image: `https://api.canft4.com/compliance/images/${inputData.erc6960.mainId}.png`,
    external_url: `https://canft4.com/compliance/fractions/${inputData.erc6960.mainId}`,
    
    attributes: [
      {"trait_type": "Original_NFT_ID", "value": inputData.tokenId},
      {"trait_type": "ERC6960_MainId", "value": inputData.erc6960.mainId},
      {"trait_type": "Company_Name", "value": inputData.metadata.companyName},
      {"trait_type": "Total_Fractions", "value": inputData.erc6960.fractions},
      {"trait_type": "Verification_Date", "value": new Date().toISOString().split('T')[0]},
      
      // Compliance attributes
      {"trait_type": "isGLEIFCompliant", "value": true, "verifier": complianceData.verifications[0].verifier},
      {"trait_type": "isEXIMCompliant", "value": true, "verifier": complianceData.verifications[1].verifier},
      {"trait_type": "isBLStandardsCompliant", "value": true, "verifier": complianceData.verifications[2].verifier},
      {"trait_type": "isThreeWayMatched", "value": true, "verifier": complianceData.verifications[3].verifier}
    ],
    
    compliance_summary: complianceData.summary,
    
    original_nft: {
      contract: inputData.nftContract,
      token_id: inputData.tokenId,
      metadata_uri: "https://CANFT4.com"
    },
    
    erc6960_details: {
      main_id: inputData.erc6960.mainId,
      sub_id: inputData.erc6960.subId,
      wrapped_asset_contract: inputData.erc6960.wrappedAssetContract,
      base_asset_contract: inputData.erc6960.baseAssetContract
    },
    
    compliance_details: complianceData
  };
  
  console.log(`✅ Generated enriched metadata with ${metadata.attributes.length} attributes`);
  return metadata;
}

async function saveMetadataFiles(metadata, mainId) {
  const files = {};
  
  // Create directories
  const metadataDir = path.join(__dirname, "../metadata/erc6960");
  const complianceDir = path.join(__dirname, "../compliance-data", mainId);
  
  [metadataDir, complianceDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Save main metadata file
  const metadataFile = path.join(metadataDir, `${mainId}.json`);
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  files.metadata = metadataFile;
  console.log(`   💾 Metadata: ${metadataFile}`);
  
  // Save individual compliance proofs
  metadata.compliance_details.verifications.forEach((verification, index) => {
    const proofFile = path.join(complianceDir, `${verification.type.toLowerCase()}_proof.json`);
    fs.writeFileSync(proofFile, JSON.stringify(verification, null, 2));
    files[verification.type] = proofFile;
    console.log(`   💾 ${verification.type}: ${proofFile}`);
  });
  
  return files;
}

async function testMetadataAccess(savedFiles) {
  console.log("   Testing file accessibility...");
  
  Object.entries(savedFiles).forEach(([type, file]) => {
    if (fs.existsSync(file)) {
      const size = fs.statSync(file).size;
      console.log(`   ✅ ${type}: ${size} bytes`);
    } else {
      console.log(`   ❌ ${type}: File not found`);
    }
  });
  
  // Test JSON validity
  try {
    const metadata = JSON.parse(fs.readFileSync(savedFiles.metadata, 'utf8'));
    console.log(`   ✅ Metadata JSON valid: ${metadata.attributes.length} attributes`);
  } catch (error) {
    console.log(`   ❌ Metadata JSON invalid: ${error.message}`);
  }
}

main().catch(console.error);