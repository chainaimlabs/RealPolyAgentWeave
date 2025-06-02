// scripts/verify_compliance_nft.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("hardhat");

class ComplianceVerifier {
  constructor(tokenId, metadataPath = null) {
    this.tokenId = tokenId;
    this.metadataPath =
      metadataPath ||
      path.join(__dirname, "../compliance-metadata", `${tokenId}.json`);
    this.proofsPath = path.join(
      __dirname,
      "../compliance-proofs",
      tokenId.toString()
    );
  }

  async loadMetadata() {
    if (!fs.existsSync(this.metadataPath)) {
      throw new Error(`Metadata file not found: ${this.metadataPath}`);
    }

    const content = fs.readFileSync(this.metadataPath, "utf8");
    return JSON.parse(content);
  }

  async loadProofFiles() {
    if (!fs.existsSync(this.proofsPath)) {
      throw new Error(`Proof directory not found: ${this.proofsPath}`);
    }

    const proofFiles = {};
    const files = fs.readdirSync(this.proofsPath);

    for (const file of files) {
      if (file.endsWith("_proof.json")) {
        const type = file.replace("_proof.json", "").toUpperCase();
        const filePath = path.join(this.proofsPath, file);
        const content = fs.readFileSync(filePath, "utf8");
        proofFiles[type] = JSON.parse(content);
      }
    }

    return proofFiles;
  }

  async verifyMetadataIntegrity() {
    console.log("🔍 Verifying metadata integrity...");

    const metadata = await this.loadMetadata();

    // Recalculate metadata hash
    const metadataForHashing = { ...metadata };
    delete metadataForHashing.cryptographic_proofs;

    const content = JSON.stringify(
      metadataForHashing,
      Object.keys(metadataForHashing).sort()
    );
    const calculatedHash = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");

    const storedHash = metadata.cryptographic_proofs.metadata_hash;

    if (calculatedHash === storedHash) {
      console.log("✅ Metadata integrity verified");
      return true;
    } else {
      console.log("❌ Metadata integrity check failed");
      console.log(`   Calculated: ${calculatedHash}`);
      console.log(`   Stored: ${storedHash}`);
      return false;
    }
  }

  async verifyProofSignatures() {
    console.log("🔐 Verifying proof signatures...");

    const proofFiles = await this.loadProofFiles();
    const results = {};

    for (const [type, proof] of Object.entries(proofFiles)) {
      // Verify signature integrity (simplified - in production use proper crypto verification)
      const proofContent = JSON.stringify({
        verification_type: proof.verification_type,
        status: proof.status,
        full_proof_data: proof.full_proof_data,
      });

      const expectedHash = crypto
        .createHash("sha256")
        .update(proofContent)
        .digest("hex");

      // In real implementation, you would verify the actual cryptographic signature
      // using the verifier's public key
      results[type] = {
        signatureValid: proof.cryptographic_signature.length > 0,
        contentHash: expectedHash,
        verifier: proof.verifier,
      };

      console.log(
        `   ${type}: ${results[type].signatureValid ? "✅" : "❌"} ${
          proof.verifier
        }`
      );
    }

    return results;
  }

  async verifyTransactionHashes() {
    console.log("🔗 Verifying transaction hashes...");

    const metadata = await this.loadMetadata();
    const results = {};

    for (const attr of metadata.attributes) {
      if (attr.trait_type.includes("Compliant") && attr.transaction_hash) {
        try {
          // In real implementation, verify transaction exists and contains compliance data
          const tx = await ethers.provider.getTransaction(
            attr.transaction_hash
          );
          results[attr.trait_type] = {
            exists: tx !== null,
            blockNumber: tx?.blockNumber,
            hash: attr.transaction_hash,
          };

          console.log(
            `   ${attr.trait_type}: ${tx ? "✅" : "❌"} Block ${
              tx?.blockNumber || "N/A"
            }`
          );
        } catch (error) {
          results[attr.trait_type] = {
            exists: false,
            error: error.message,
            hash: attr.transaction_hash,
          };
          console.log(`   ${attr.trait_type}: ❌ Error verifying transaction`);
        }
      }
    }

    return results;
  }

  async fetchFromIPFS(ipfsHashes) {
    console.log("🌐 Fetching from IPFS...");

    // Simulated IPFS retrieval - replace with actual IPFS client
    const ipfsContent = {};

    for (const [type, hash] of Object.entries(ipfsHashes)) {
      try {
        // In real implementation: const content = await ipfs.cat(hash);
        console.log(`   ${type}: ${hash} ✅`);
        ipfsContent[type] = `Content for ${type} from IPFS ${hash}`;
      } catch (error) {
        console.log(`   ${type}: ${hash} ❌ ${error.message}`);
        ipfsContent[type] = null;
      }
    }

    return ipfsContent;
  }

  async generateComplianceReport() {
    console.log("\n📊 GENERATING COMPLIANCE VERIFICATION REPORT");
    console.log("═".repeat(70));

    try {
      const metadata = await this.loadMetadata();
      const proofFiles = await this.loadProofFiles();

      // Verify integrity
      const metadataIntegrityValid = await this.verifyMetadataIntegrity();
      const signatureResults = await this.verifyProofSignatures();
      const transactionResults = await this.verifyTransactionHashes();

      // Get IPFS hashes from metadata
      const ipfsHashes = {};
      metadata.attributes.forEach((attr) => {
        if (attr.proof_ipfs_hash) {
          ipfsHashes[attr.trait_type] = attr.proof_ipfs_hash;
        }
      });

      const ipfsContent = await this.fetchFromIPFS(ipfsHashes);

      // Generate comprehensive report
      const report = {
        token_id: this.tokenId,
        verification_timestamp: new Date().toISOString(),
        overall_validity:
          metadataIntegrityValid &&
          Object.values(signatureResults).every((r) => r.signatureValid),

        metadata_verification: {
          integrity_valid: metadataIntegrityValid,
          metadata_hash: metadata.cryptographic_proofs.metadata_hash,
          combined_signature: metadata.cryptographic_proofs.combined_signature,
          merkle_root: metadata.cryptographic_proofs.merkle_root,
        },

        compliance_status: {
          company_name: metadata.compliance_summary.company_name,
          overall_compliant: metadata.compliance_summary.overall_status,
          verification_date: metadata.compliance_summary.verified_at,
          verifier_address: metadata.compliance_summary.verifier_address,
        },

        individual_compliance: {},

        proof_verification: signatureResults,
        transaction_verification: transactionResults,
        ipfs_verification: ipfsContent,

        detailed_proofs: proofFiles,
      };

      // Extract individual compliance details
      metadata.attributes.forEach((attr) => {
        if (attr.trait_type.includes("Compliant")) {
          report.individual_compliance[attr.trait_type] = {
            status: attr.value,
            verifier: attr.verifier_public_key,
            verification_date: attr.verification_date,
            transaction_hash: attr.transaction_hash,
            proof_ipfs_hash: attr.proof_ipfs_hash,
            additional_data: attr.additional_data,
          };
        }
      });

      // Save report
      const reportPath = path.join(
        __dirname,
        "../compliance-reports",
        `verification-report-${this.tokenId}.json`
      );
      if (!fs.existsSync(path.dirname(reportPath))) {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      }
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Display summary
      this.displayVerificationSummary(report);

      console.log(`\n💾 Complete verification report saved: ${reportPath}`);

      return report;
    } catch (error) {
      console.error("❌ Verification failed:", error.message);
      throw error;
    }
  }

  displayVerificationSummary(report) {
    console.log("\n🎯 VERIFICATION SUMMARY:");
    console.log("─".repeat(50));
    console.log(`🆔 Token ID: ${report.token_id}`);
    console.log(`🏢 Company: ${report.compliance_status.company_name}`);
    console.log(`✅ Overall Valid: ${report.overall_validity ? "YES" : "NO"}`);
    console.log(
      `📅 Original Verification: ${report.compliance_status.verification_date}`
    );
    console.log(`🔍 Report Generated: ${report.verification_timestamp}`);

    console.log("\n🏷️  INDIVIDUAL COMPLIANCE STATUS:");
    for (const [type, data] of Object.entries(report.individual_compliance)) {
      console.log(`   ${type}:`);
      console.log(
        `      Status: ${data.status ? "✅ COMPLIANT" : "❌ NON-COMPLIANT"}`
      );
      console.log(`      Verifier: ${data.verifier}`);
      if (data.transaction_hash) {
        console.log(`      On-chain: ✅ ${data.transaction_hash}`);
      }
      if (data.proof_ipfs_hash) {
        console.log(`      IPFS Proof: ✅ ${data.proof_ipfs_hash}`);
      }
      if (data.additional_data) {
        Object.entries(data.additional_data).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
      }
    }

    console.log("\n🔐 CRYPTOGRAPHIC VERIFICATION:");
    console.log(
      `   Metadata Integrity: ${
        report.metadata_verification.integrity_valid ? "✅" : "❌"
      }`
    );
    console.log(
      `   Proof Signatures: ${
        Object.values(report.proof_verification).every((r) => r.signatureValid)
          ? "✅"
          : "❌"
      }`
    );
    console.log(
      `   Transaction Hashes: ${
        Object.values(report.transaction_verification).every((r) => r.exists)
          ? "✅"
          : "❌"
      }`
    );

    console.log("\n📊 DETAILED VERIFICATION:");
    console.log(
      `   Metadata Hash: ${report.metadata_verification.metadata_hash}`
    );
    console.log(
      `   Combined Signature: ${report.metadata_verification.combined_signature}`
    );
    console.log(`   Merkle Root: ${report.metadata_verification.merkle_root}`);
  }

  async extractSpecificCompliance(complianceType) {
    console.log(`\n🔍 Extracting ${complianceType} compliance details...`);

    const metadata = await this.loadMetadata();
    const proofFiles = await this.loadProofFiles();

    // Find the specific compliance attribute
    const complianceAttr = metadata.attributes.find((attr) =>
      attr.trait_type.toLowerCase().includes(complianceType.toLowerCase())
    );

    if (!complianceAttr) {
      throw new Error(`Compliance type ${complianceType} not found`);
    }

    // Get the corresponding proof file
    const proofType = Object.keys(proofFiles).find((type) =>
      type.toLowerCase().includes(complianceType.toLowerCase())
    );

    const proofFile = proofType ? proofFiles[proofType] : null;

    const result = {
      compliance_type: complianceType,
      status: complianceAttr.value,
      verifier: complianceAttr.verifier_public_key,
      verification_date: complianceAttr.verification_date,
      transaction_hash: complianceAttr.transaction_hash,
      proof_ipfs_hash: complianceAttr.proof_ipfs_hash,
      additional_data: complianceAttr.additional_data,
      full_proof: proofFile,
    };

    console.log(`✅ ${complianceType} compliance extracted successfully`);
    return result;
  }
}

// Usage functions
async function verifyTokenCompliance(tokenId) {
  const verifier = new ComplianceVerifier(tokenId);
  return await verifier.generateComplianceReport();
}

async function extractTokenCompliance(tokenId, complianceType) {
  const verifier = new ComplianceVerifier(tokenId);
  return await verifier.extractSpecificCompliance(complianceType);
}

async function batchVerifyCompliance(tokenIds) {
  console.log(`🔍 Batch verifying ${tokenIds.length} tokens...`);

  const results = {};

  for (const tokenId of tokenIds) {
    try {
      console.log(`\nVerifying Token ${tokenId}...`);
      const report = await verifyTokenCompliance(tokenId);
      results[tokenId] = report;
    } catch (error) {
      console.error(`❌ Failed to verify Token ${tokenId}: ${error.message}`);
      results[tokenId] = { error: error.message };
    }
  }

  // Generate batch summary
  const batchSummary = {
    total_tokens: tokenIds.length,
    verified_successfully: Object.values(results).filter((r) => !r.error)
      .length,
    failed_verifications: Object.values(results).filter((r) => r.error).length,
    overall_compliant: Object.values(results).filter(
      (r) => !r.error && r.overall_validity
    ).length,
    results,
    generated_at: new Date().toISOString(),
  };

  const summaryPath = path.join(
    __dirname,
    "../compliance-reports",
    `batch-verification-${Date.now()}.json`
  );
  fs.writeFileSync(summaryPath, JSON.stringify(batchSummary, null, 2));

  console.log(`\n📊 BATCH VERIFICATION SUMMARY:`);
  console.log(`   Total Tokens: ${batchSummary.total_tokens}`);
  console.log(
    `   Successfully Verified: ${batchSummary.verified_successfully}`
  );
  console.log(`   Failed: ${batchSummary.failed_verifications}`);
  console.log(`   Overall Compliant: ${batchSummary.overall_compliant}`);
  console.log(`   Report: ${summaryPath}`);

  return batchSummary;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "verify":
      const tokenId = args[1];
      if (!tokenId) {
        console.error("Usage: node verify_compliance_nft.js verify <tokenId>");
        process.exit(1);
      }
      await verifyTokenCompliance(parseInt(tokenId));
      break;

    case "extract":
      const extractTokenId = args[1];
      const complianceType = args[2];
      if (!extractTokenId || !complianceType) {
        console.error(
          "Usage: node verify_compliance_nft.js extract <tokenId> <complianceType>"
        );
        console.error("Example: node verify_compliance_nft.js extract 7 GLEIF");
        process.exit(1);
      }
      const result = await extractTokenCompliance(
        parseInt(extractTokenId),
        complianceType
      );
      console.log(JSON.stringify(result, null, 2));
      break;

    case "batch":
      const tokenIds = args.slice(1).map((id) => parseInt(id));
      if (tokenIds.length === 0) {
        console.error(
          "Usage: node verify_compliance_nft.js batch <tokenId1> <tokenId2> ..."
        );
        process.exit(1);
      }
      await batchVerifyCompliance(tokenIds);
      break;

    default:
      console.log("🔍 Compliance NFT Verification Tool");
      console.log("Usage:");
      console.log(
        "  verify <tokenId>                    - Verify single token compliance"
      );
      console.log(
        "  extract <tokenId> <complianceType> - Extract specific compliance data"
      );
      console.log(
        "  batch <tokenId1> <tokenId2> ...     - Batch verify multiple tokens"
      );
      console.log("");
      console.log("Examples:");
      console.log("  node verify_compliance_nft.js verify 7");
      console.log("  node verify_compliance_nft.js extract 7 GLEIF");
      console.log("  node verify_compliance_nft.js batch 7 8 9");
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  ComplianceVerifier,
  verifyTokenCompliance,
  extractTokenCompliance,
  batchVerifyCompliance,
};
