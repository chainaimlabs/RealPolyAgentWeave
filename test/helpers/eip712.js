const ethSigUtil = require("@metamask/eth-sig-util");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const hexRegex = /[A-Fa-fx]/g;

const toBN = (n) => BigInt(toHex(n, 0));

const toHex = (n, numBytes) => {
  const asHexString =
    typeof n === "bigint"
      ? ethers.toBeHex(n).slice(2)
      : typeof n === "string"
      ? hexRegex.test(n)
        ? n.replace(/0x/, "")
        : Number(n).toString(16)
      : Number(n).toString(16);
  return `0x${asHexString.padStart(numBytes * 2, "0")}`;
};

const calculateOfferHash = (params) => {
  const OfferTypeString =
    "offer(address owner,address offeror,address token,uint256 offerPrice,uint256 mainId,uint256 subId,uint256 fractionsToBuy,uint256 nonce,uint256 deadline)";

  const offerTypeHash = ethers.keccak256(ethers.toUtf8Bytes(OfferTypeString));

  const derivedOfferHash = ethers.keccak256(
    "0x" +
      [
        offerTypeHash.slice(2),
        params.owner.slice(2).padStart(64, "0"),
        params.offeror.slice(2).padStart(64, "0"),
        params.token.slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.offerPrice)).slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.mainId)).slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.subId)).slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.fractionsToBuy)).slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.nonce)).slice(2).padStart(64, "0"),
        ethers.toBeHex(toBN(params.deadline)).slice(2).padStart(64, "0"),
      ].join("")
  );

  return derivedOfferHash;
};

const validateRecoveredAddress = (
  expectAddress,
  domainSeparator,
  hash,
  signature
) => {
  const digest = ethers.keccak256(
    `0x1901${domainSeparator.slice(2)}${hash.slice(2)}`
  );
  const recoveredAddress = ethers.recoverAddress(digest, signature);
  expect(recoveredAddress).to.be.equal(expectAddress);
};

async function domainSeparatorCal(name, version, chainId, verifyingContract) {
  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  return (
    "0x" +
    ethSigUtil.TypedDataUtils.hashStruct(
      "EIP712Domain",
      { name, version, chainId, verifyingContract },
      { EIP712Domain },
      "V4"
    ).toString("hex")
  );
}

module.exports = {
  toBN,
  toHex,
  calculateOfferHash,
  validateRecoveredAddress,
  domainSeparatorCal,
};
