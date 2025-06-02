// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CANFT4 is ERC721, Ownable {
    uint256 private _nextTokenId = 1;
    uint256 public constant PRICE = 9 * 10 ** 18;
    string private _baseTokenURI;
    mapping(uint256 => string) private _tokenURIs;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI
    ) ERC721(name, symbol) Ownable() {
        _baseTokenURI = baseURI;
    }

    function safeMint(
        address to,
        string calldata uri
    ) external onlyOwner returns (uint256) {
        require(to != address(0), "Invalid address");
        require(bytes(uri).length > 0, "Empty URI");

        uint256 tokenId = _nextTokenId++;
        _tokenURIs[tokenId] = uri;
        _safeMint(to, tokenId);

        return tokenId;
    }

    function publicMint() external payable returns (uint256) {
        require(msg.value >= PRICE, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        if (msg.value > PRICE) {
            payable(msg.sender).transfer(msg.value - PRICE);
        }

        return tokenId;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(tokenId < _nextTokenId && tokenId > 0, "Token does not exist");

        // Return custom URI if set, otherwise base URI + tokenId
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) {
            return customURI;
        }

        return string(abi.encodePacked(_baseURI(), tokenId));
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
