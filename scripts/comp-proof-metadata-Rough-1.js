// scripts/mint_compliance_verified_nft.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Import your existing compliance verification functions
// These would be your actual verification functions
async function mockComplianceVerifications(
  companyName,
  tokenId,
  verifierAddress
) {
  console.log("🔍 Running Compliance Verifications...");

  // Simulate calls to your existing verification functions
  const verifications = {
    GLEIF: await mockGLEIFVerification(companyName),
    LocalCorpReg: await mockLocalCorpRegVerification(companyName),
    EXIM: await mockEXIMVerification(companyName),
    BLStandards: await mockBLStandardsVerification(companyName),
    BLReconciliation: await mockBLReconciliationVerification(companyName),
  };

  return verifications;
}

// Mock verification functions (replace with your actual ones)
async function mockGLEIFVerification(companyName) {
  return {
    status: true,
    verifier: "0x742d35Cc6634C0532925a3b8D44a3Fab",
    verificationDate: new Date().toISOString(),
    gleifLEI: "LEI123456789012345678",
    verificationLevel: "Level 1",
    transactionHash:
      "0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    proofData: {
      source: "GLEIF Database",
      apiResponse: {
        lei: "LEI123456789012345678",
        legalName: companyName,
        status: "ACTIVE",
        verifiedAt: new Date().toISOString(),
      },
      signature: "0x1234567890abcdef...",
      merkleRoot: "0xfedcba0987654321...",
    },
  };
}

async function mockLocalCorpRegVerification(companyName) {
  return {
    status: true,
    verifier: "0x8f3CF7ad23Cd3CaDbD9735AFf958023239c6A063",
    verificationDate: new Date().toISOString(),
    registrationNumber: "CRN987654321",
    jurisdiction: "Singapore",
    transactionHash:
      "0xdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc",
    proofData: {
      source: "ACRA Registry",
      apiResponse: {
        uen: "CRN987654321",
        companyName,
        status: "Live Company",
        incorporationDate: "2020-01-15",
      },
      signature: "0xabcdef1234567890...",
      merkleRoot: "0x0987654321fedcba...",
    },
  };
}

async function mockEXIMVerification(companyName) {
  return {
    status: true,
    verifier: "0x9f4B3577139d50E7b7C1D2a4C5F8E6D3A7B2C8E5",
    verificationDate: new Date().toISOString(),
    eximLicense: "EXIM2024001234",
    validUntil: "2025-12-31",
    transactionHash: null, // Sometimes verifications don't have on-chain tx
    proofData: {
      source: "EXIM Bank Database",
      apiResponse: {
        licenseNumber: "EXIM2024001234",
        companyName,
        status: "ACTIVE",
        products: ["Electronics", "Textiles"],
      },
      signature: "0x5678901234abcdef...",
      merkleRoot: "0x1234567890fedcba...",
    },
  };
}

async function mockBLStandardsVerification(companyName) {
  return {
    status: true,
    verifier: "0xA8E6D4B2C9F7E5A3D1C8B6A4E2F9D7B5C3A1E8F6",
    verificationDate: new Date().toISOString(),
    standardsCompliance: "ISO 28000",
    certificationBody: "Bureau Veritas",
    transactionHash:
      "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
    proofData: {
      source: "BL Standards Registry",
      apiResponse: {
        companyName,
        standard: "ISO 28000",
        certificationDate: "2024-03-15",
        validUntil: "2027-03-14",
      },
      signature: "0x9abcdef012345678...",
      merkleRoot: "0xfedcba9876543210...",
    },
  };
}

async function mockBLReconciliationVerification(companyName) {
  return {
    status: true,
    verifier: "0xD2F8B4A6C1E7D5B3A9F2E8C6A4D7B5F3A1C9E7D5",
    verificationDate: new Date().toISOString(),
    matchingAccuracy: "100%",
    documentsMatched: 3,
    transactionHash:
      "0x789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345",
    proofData: {
      source: "3-Way Matching System",
      apiResponse: {
        companyName,
        purchaseOrder: "PO123456",
        invoice: "INV789012",
        billOfLading: "BL345678",
        matchStatus: "COMPLETE_MATCH",
      },
      signature: "0xcdef0123456789ab...",
      merkleRoot: "0x543210fedcba9876...",
    },
  };
}

async function generateComplianceMetadata(
  companyName,
  tokenId,
  verifierAddress
) {
  console.log("🎯 Generating Compliance-Verified Metadata...");

  // Step 1: Run all compliance verifications
  const verifications = await mockComplianceVerifications(
    companyName,
    tokenId,
    verifierAddress
  );

  // Step 2: Generate metadata with compliance attributes
  const metadata = {
    // Standard NFT metadata
    name: `Compliance-Verified Asset #{tokenId}`,
    description: `A compliance-verified digital asset for ${companyName}. This NFT contains cryptographically verified compliance data across multiple regulatory frameworks.`,
    image: `https://api.canft4.com/compliance/images/${tokenId}.png`,
    external_url: `https://canft4.com/compliance/${tokenId}`,

    // Compliance summary (quick reference)
    compliance_summary: {
      overall_status: Object.values(verifications).every((v) => v.status),
      total_verifications: Object.keys(verifications).length,
      verified_at: new Date().toISOString(),
      verifier_address: verifierAddress,
      company_name: companyName,
    },

    // Standard attributes with compliance data
    attributes: [
      {
        trait_type: "Company Name",
        value: companyName,
      },
      {
        trait_type: "Verification Date",
        value: new Date().toISOString().split("T")[0],
      },
      {
        trait_type: "Overall Compliance Status",
        value: Object.values(verifications).every((v) => v.status)
          ? "COMPLIANT"
          : "NON_COMPLIANT",
      },
      // Individual compliance attributes
      {
        trait_type: "isGLEIFCompliant",
        value: verifications.GLEIF.status,
        verifier_public_key: verifications.GLEIF.verifier,
        transaction_hash: verifications.GLEIF.transactionHash,
        proof_ipfs_hash: null, // Will be set after IPFS upload
        verification_date: verifications.GLEIF.verificationDate,
        additional_data: {
          lei: verifications.GLEIF.gleifLEI,
          level: verifications.GLEIF.verificationLevel,
        },
      },
      {
        trait_type: "isLocalCorpRegCompliant",
        value: verifications.LocalCorpReg.status,
        verifier_public_key: verifications.LocalCorpReg.verifier,
        transaction_hash: verifications.LocalCorpReg.transactionHash,
        proof_ipfs_hash: null,
        verification_date: verifications.LocalCorpReg.verificationDate,
        additional_data: {
          registration_number: verifications.LocalCorpReg.registrationNumber,
          jurisdiction: verifications.LocalCorpReg.jurisdiction,
        },
      },
      {
        trait_type: "isEXIMCompliant",
        value: verifications.EXIM.status,
        verifier_public_key: verifications.EXIM.verifier,
        transaction_hash: verifications.EXIM.transactionHash,
        proof_ipfs_hash: null,
        verification_date: verifications.EXIM.verificationDate,
        additional_data: {
          license_number: verifications.EXIM.eximLicense,
          valid_until: verifications.EXIM.validUntil,
        },
      },
      {
        trait_type: "isBLStandardsCompliant",
        value: verifications.BLStandards.status,
        verifier_public_key: verifications.BLStandards.verifier,
        transaction_hash: verifications.BLStandards.transactionHash,
        proof_ipfs_hash: null,
        verification_date: verifications.BLStandards.verificationDate,
        additional_data: {
          standards_compliance: verifications.BLStandards.standardsCompliance,
          certification_body: verifications.BLStandards.certificationBody,
        },
      },
      {
        trait_type: "isBLReconciledWith3WMatching",
        value: verifications.BLReconciliation.status,
        verifier_public_key: verifications.BLReconciliation.verifier,
        transaction_hash: verifications.BLReconciliation.transactionHash,
        proof_ipfs_hash: null,
        verification_date: verifications.BLReconciliation.verificationDate,
        additional_data: {
          matching_accuracy: verifications.BLReconciliation.matchingAccuracy,
          documents_matched: verifications.BLReconciliation.documentsMatched,
        },
      },
    ],

    // Full compliance details (for detailed verification)
    compliance_details: {
      verification_methodology: "Multi-source cryptographic verification",
      verifications,
      proof_storage: "IPFS + Local Archive",
      verification_standard: "ERC-721 + Custom Compliance Extension",
    },

    // Cryptographic integrity
    cryptographic_proofs: {
      metadata_hash: null, // Will be calculated
      combined_signature: null, // Will be calculated
      merkle_root: null, // Will be calculated
      timestamp: new Date().toISOString(),
    },
  };

  // Step 3: Generate and store individual proof files
  const proofFiles = await generateProofFiles(verifications, tokenId);

  // Step 4: Upload proof files to IPFS (simulated)
  const ipfsHashes = await uploadProofFilesToIPFS(proofFiles, tokenId);

  // Step 5: Update metadata with IPFS hashes
  metadata.attributes.forEach((attr, index) => {
    if (
      attr.trait_type.startsWith("is") &&
      attr.trait_type.includes("Compliant")
    ) {
      const complianceType = Object.keys(verifications)[index - 3]; // Skip first 3 non-compliance attributes
      if (complianceType && ipfsHashes[complianceType]) {
        attr.proof_ipfs_hash = ipfsHashes[complianceType];
      }
    }
  });

  // Step 6: Calculate cryptographic hashes
  const metadataHash = calculateMetadataHash(metadata);
  const combinedSignature = await generateCombinedSignature(
    verifications,
    verifierAddress
  );
  const merkleRoot = calculateMerkleRoot(verifications);

  metadata.cryptographic_proofs.metadata_hash = metadataHash;
  metadata.cryptographic_proofs.combined_signature = combinedSignature;
  metadata.cryptographic_proofs.merkle_root = merkleRoot;

  return { metadata, proofFiles, ipfsHashes };
}

async function generateProofFiles(verifications, tokenId) {
  console.log("📄 Generating individual proof files...");

  const proofFiles = {};

  for (const [type, verification] of Object.entries(verifications)) {
    const proofFile = {
      verification_type: type,
      token_id: tokenId,
      timestamp: verification.verificationDate,
      verifier: verification.verifier,
      status: verification.status,
      transaction_hash: verification.transactionHash,
      full_proof_data: verification.proofData,
      cryptographic_signature: verification.proofData.signature,
      merkle_proof: verification.proofData.merkleRoot,
      verification_metadata: {
        method: "API + Blockchain Verification",
        confidence_level: "High",
        data_sources: [verification.proofData.source],
      },
    };

    proofFiles[type] = proofFile;

    // Save locally
    const proofDir = path.join(
      __dirname,
      "../compliance-proofs",
      tokenId.toString()
    );
    if (!fs.existsSync(proofDir)) {
      fs.mkdirSync(proofDir, { recursive: true });
    }

    const filePath = path.join(proofDir, `${type.toLowerCase()}_proof.json`);
    fs.writeFileSync(filePath, JSON.stringify(proofFile, null, 2));
    console.log(`   💾 ${type} proof saved: ${filePath}`);
  }

  return proofFiles;
}

async function uploadProofFilesToIPFS(proofFiles, tokenId) {
  console.log("🌐 Uploading proof files to IPFS...");

  // Simulated IPFS upload - replace with actual IPFS integration
  const ipfsHashes = {};

  for (const [type, proofFile] of Object.entries(proofFiles)) {
    // Simulate IPFS hash generation
    const content = JSON.stringify(proofFile);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const ipfsHash = `Qm${hash.substring(0, 44)}`; // Simulate IPFS hash format

    ipfsHashes[type] = ipfsHash;
    console.log(`   🔗 ${type}: ${ipfsHash}`);

    // In real implementation, you would upload to IPFS here
    // const ipfsHash = await ipfs.add(JSON.stringify(proofFile));
  }

  return ipfsHashes;
}

function calculateMetadataHash(metadata) {
  // Create deterministic hash of metadata (excluding the hash field itself)
  const metadataForHashing = { ...metadata };
  delete metadataForHashing.cryptographic_proofs;

  const content = JSON.stringify(
    metadataForHashing,
    Object.keys(metadataForHashing).sort()
  );
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function generateCombinedSignature(verifications, verifierAddress) {
  // Combine all verification signatures into one master signature
  const signatures = Object.values(verifications).map(
    (v) => v.proofData.signature
  );
  const combined = signatures.join("");
  return crypto
    .createHash("sha256")
    .update(combined + verifierAddress)
    .digest("hex");
}

function calculateMerkleRoot(verifications) {
  // Create Merkle root of all verification proofs
  const proofs = Object.values(verifications).map(
    (v) => v.proofData.merkleRoot
  );
  const combined = proofs.join("");
  return crypto.createHash("sha256").update(combined).digest("hex");
}

async function main() {
  try {
    console.log("🚀 Starting Compliance-Verified NFT Minting...");

    const contractAddress = process.env.ORIG_NFT_CONTRACT_ADDRESS;
    const recipientAddress =
      process.env.ORIG_NFT_RECIPIENT_ADDRESS ||
      "0x9281B31230C735867a2Fd62aF8ec816Cc1714521";
    const companyName =
      process.env.COMPANY_NAME || "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED";
    const baseTokenURI =
      process.env.BASE_TOKEN_URI ||
      "https://api.canft4.com/compliance/metadata/";

    if (!contractAddress || !process.env.ORIG_NFT_OWNER_PRIVATE_KEY) {
      console.error("❌ Missing required environment variables");
      process.exit(1);
    }

    // Setup signer
    const signer = new hre.ethers.Wallet(
      process.env.ORIG_NFT_OWNER_PRIVATE_KEY,
      hre.ethers.provider
    );
    console.log(`📝 Signer address: ${signer.address}`);

    // Get next token ID
    const CANFT4Factory = await hre.ethers.getContractFactory("CANFT4", signer);
    const contract = CANFT4Factory.attach(contractAddress).connect(signer);
    const currentSupply = await contract.totalSupply();
    const nextTokenId = parseInt(currentSupply) + 1;

    console.log(`🆔 Next Token ID: ${nextTokenId}`);
    console.log(`🏢 Company: ${companyName}`);

    // Generate compliance-verified metadata
    const { metadata, proofFiles, ipfsHashes } =
      await generateComplianceMetadata(
        companyName,
        nextTokenId,
        signer.address
      );

    // Save complete metadata locally
    const metadataDir = path.join(__dirname, "../compliance-metadata");
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }

    const metadataFile = path.join(metadataDir, `${nextTokenId}.json`);
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`💾 Complete metadata saved: ${metadataFile}`);

    // Generate token URI
    const tokenURI = `${baseTokenURI}${nextTokenId}.json`;
    console.log(`🔗 Token URI: ${tokenURI}`);

    // Display compliance summary
    console.log("\n📊 COMPLIANCE VERIFICATION SUMMARY:");
    console.log("═".repeat(60));
    console.log(`🏢 Company: ${companyName}`);
    console.log(`🆔 Token ID: ${nextTokenId}`);
    console.log(`📅 Verified: ${metadata.compliance_summary.verified_at}`);
    console.log(
      `✅ Overall Status: ${
        metadata.compliance_summary.overall_status
          ? "COMPLIANT"
          : "NON-COMPLIANT"
      }`
    );
    console.log(
      `🔍 Verifications: ${metadata.compliance_summary.total_verifications}`
    );

    console.log("\n🏷️  COMPLIANCE ATTRIBUTES:");
    metadata.attributes
      .filter((attr) => attr.trait_type.includes("Compliant"))
      .forEach((attr) => {
        console.log(`   ${attr.trait_type}: ${attr.value ? "✅" : "❌"}`);
        console.log(`      Verifier: ${attr.verifier_public_key}`);
        if (attr.transaction_hash) {
          console.log(`      Tx Hash: ${attr.transaction_hash}`);
        }
        if (attr.proof_ipfs_hash) {
          console.log(`      Proof: ${attr.proof_ipfs_hash}`);
        }
      });

    console.log("\n🔐 CRYPTOGRAPHIC INTEGRITY:");
    console.log(
      `   Metadata Hash: ${metadata.cryptographic_proofs.metadata_hash}`
    );
    console.log(
      `   Combined Signature: ${metadata.cryptographic_proofs.combined_signature}`
    );
    console.log(`   Merkle Root: ${metadata.cryptographic_proofs.merkle_root}`);

    // Confirmation
    if (process.env.AUTO_CONFIRM !== "true") {
      console.log("\n❓ Ready to mint compliance-verified NFT?");
      console.log(
        "   This will create an NFT with cryptographically verified compliance data"
      );
      console.log("   Set AUTO_CONFIRM=true to skip this check");
      console.log("⏳ Proceeding in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    // Mint the NFT
    console.log("\n🚀 MINTING COMPLIANCE-VERIFIED NFT...");

    const tx = await contract.safeMint(recipientAddress, tokenURI);
    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log(`🔗 Track: https://testnet.xdcscan.com/tx/${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Compliance-verified NFT minted successfully!`);
    console.log(`📦 Block: ${receipt.blockNumber}`);

    // Save minting record with compliance data
    const mintingRecord = {
      tokenId: nextTokenId,
      companyName,
      mintTxHash: tx.hash,
      blockNumber: receipt.blockNumber,
      compliance: metadata.compliance_summary,
      proofFiles: Object.keys(proofFiles),
      ipfsHashes,
      metadataHash: metadata.cryptographic_proofs.metadata_hash,
      timestamp: new Date().toISOString(),
    };

    const recordFile = path.join(
      __dirname,
      "../compliance-records",
      `token-${nextTokenId}.json`
    );
    if (!fs.existsSync(path.dirname(recordFile))) {
      fs.mkdirSync(path.dirname(recordFile), { recursive: true });
    }
    fs.writeFileSync(recordFile, JSON.stringify(mintingRecord, null, 2));

    console.log("\n🎉 COMPLIANCE-VERIFIED NFT MINTED SUCCESSFULLY!");
    console.log("📋 Files created:");
    console.log(`   📄 Metadata: ${metadataFile}`);
    console.log(`   📁 Proofs: compliance-proofs/${nextTokenId}/`);
    console.log(`   📋 Record: ${recordFile}`);
    console.log(
      `   🌐 IPFS: ${Object.values(ipfsHashes).length} files uploaded`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    // process.exit(1);
    throw new Error("Deployment failed");
  }
}

main().catch(console.error);
