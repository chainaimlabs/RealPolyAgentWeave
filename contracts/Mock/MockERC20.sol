// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title The test ERC20
 * @author Polytrade.Finance
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address receiver_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(receiver_, totalSupply_ * (10 ** decimals_));
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
