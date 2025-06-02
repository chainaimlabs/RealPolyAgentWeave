// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { PropertyInfo, IPropertyAsset, IERC20 } from "contracts/Asset/interface/IPropertyAsset.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IBaseAsset } from "contracts/Asset/interface/IBaseAsset.sol";
import { Context } from "@openzeppelin/contracts/utils/Context.sol";
import { Counters } from "contracts/lib/Counters.sol";

/**
 * @title The property asset contract based on ERC6960
 * @author Polytrade.Finance
 */
contract PropertyAsset is
    Initializable,
    Context,
    AccessControl,
    IPropertyAsset
{
    using SafeERC20 for IERC20;
    using ERC165Checker for address;
    using Counters for Counters.Counter;

    IBaseAsset private _assetCollection;
    Counters.Counter private _nonce;

    address private _treasuryWallet;

    // solhint-disable-next-line
    uint256 private CHAIN_ID;

    mapping(uint256 => PropertyInfo) private _propertyInfo;

    // Create a new role identifier for the asset originator
    bytes32 public constant ASSET_ORIGINATOR =
        0x6515eccc42cea4c6b51e4cf769f86c1580ce4efeb1d5bee305af7f36bbb6ce6e;

    bytes4 private constant _ASSET_INTERFACE_ID = type(IBaseAsset).interfaceId;

    /**
     * @dev Initializer for the type contract
     * @param assetCollection_, Address of the asset collection used in the type contract
     * @param treasuryWallet_, Address of the treasury wallet
     */
    function initialize(
        address assetCollection_,
        address treasuryWallet_
    ) external initializer {
        if (!assetCollection_.supportsInterface(_ASSET_INTERFACE_ID)) {
            revert UnsupportedInterface();
        }

        _assetCollection = IBaseAsset(assetCollection_);
        CHAIN_ID = block.chainid;

        _setTreasuryWallet(treasuryWallet_);

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ASSET_ORIGINATOR, _msgSender());
    }

    /**
     * @dev See {IPropertyAsset-setTreasuryWallet}.
     */
    function setTreasuryWallet(
        address newTreasuryWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTreasuryWallet(newTreasuryWallet);
    }

    /**
     * @dev See {IPropertyAsset-createProperty}.
     */
    function createProperty(
        address owner,
        PropertyInfo calldata propertyInfo
    ) external onlyRole(ASSET_ORIGINATOR) returns (uint256) {
        return _createProperty(owner, propertyInfo);
    }

    /**
     * @dev See {IPropertyAsset-batchCreateProperty}.
     */
    function batchCreateProperty(
        address[] calldata owners,
        PropertyInfo[] calldata propertyInfos
    ) external onlyRole(ASSET_ORIGINATOR) returns (uint256[] memory) {
        uint256 length = owners.length;
        if (length != propertyInfos.length) {
            revert NoArrayParity();
        }

        uint256[] memory ids = new uint256[](length);
        for (uint256 i = 0; i < length; ) {
            ids[i] = _createProperty(owners[i], propertyInfos[i]);

            unchecked {
                ++i;
            }
        }
        return ids;
    }

    /**
     * @dev See {IPropertyAsset-settleProperty}.
     */
    function settleProperty(
        uint256 propertyMainId,
        uint256 settlePrice,
        address owner
    ) external onlyRole(ASSET_ORIGINATOR) {
        _settleProperty(settlePrice, propertyMainId, owner);
    }

    /**
     * @dev See {IPropertyAsset-batchSettleProperty}.
     */
    function batchSettleProperty(
        uint256[] calldata propertyMainIds,
        uint256[] calldata settlePrices,
        address[] calldata owners
    ) external onlyRole(ASSET_ORIGINATOR) {
        uint256 length = propertyMainIds.length;
        if (owners.length != length || length != settlePrices.length) {
            revert NoArrayParity();
        }
        for (uint256 i = 0; i < length; ) {
            _settleProperty(settlePrices[i], propertyMainIds[i], owners[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev See {IPropertyAsset-burnProperty}.
     */
    function burnProperty(
        address owner,
        uint256 propertyMainId,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _assetCollection.burnAsset(owner, propertyMainId, 1, amount);

        uint256 totalMainSupply = _assetCollection.totalMainSupply(
            propertyMainId
        );

        _propertyInfo[propertyMainId].fractions = totalMainSupply;

        if (totalMainSupply == 0) {
            delete _propertyInfo[propertyMainId];
        }
    }

    /**
     * @dev See {IPropertyAsset-getTreasuryWallet}.
     */
    function getTreasuryWallet() external view returns (address) {
        return address(_treasuryWallet);
    }

    function getPropertyInfo(
        uint256 propertyMainId
    ) external view returns (PropertyInfo memory) {
        return _propertyInfo[propertyMainId];
    }

    function getNonce(address account) external view returns (uint256) {
        return _nonce.current(account);
    }

    /**
     * @dev Allows to set a new treasury wallet address where funds will be allocated.
     * @dev Wallet can be EOA or multisig
     * @param newTreasuryWallet, Address of the new treasury wallet
     */
    function _setTreasuryWallet(address newTreasuryWallet) private {
        if (newTreasuryWallet == address(0)) {
            revert InvalidAddress();
        }

        emit TreasuryWalletSet(_treasuryWallet, newTreasuryWallet);
        _treasuryWallet = newTreasuryWallet;
    }

    /**
     * @dev Called in settleProperty and batchSettleProperty functions
     * @param propertyMainId, unique identifier of property
     * @param owner, address of the owner for settlement
     */
    function _settleProperty(
        uint256 settlePrice,
        uint256 propertyMainId,
        address owner
    ) private {
        PropertyInfo memory property = _propertyInfo[propertyMainId];
        uint256 subBalanceOf = _assetCollection.subBalanceOf(
            owner,
            propertyMainId,
            1
        );

        if (settlePrice == 0) {
            revert InvalidPrice();
        }
        if (property.dueDate == 0) {
            revert InvalidPropertyId();
        }
        if (subBalanceOf == 0) {
            revert NotEnoughBalance();
        }
        if (block.timestamp < property.dueDate) {
            revert DueDateNotPassed();
        }

        settlePrice = (settlePrice * subBalanceOf) / property.fractions;
        _assetCollection.burnAsset(owner, propertyMainId, 1, subBalanceOf);
        property.settlementToken.safeTransferFrom(
            _treasuryWallet,
            owner,
            settlePrice
        );
        if (_assetCollection.totalSubSupply(propertyMainId, 1) == 0) {
            delete _propertyInfo[propertyMainId];
        }

        emit PropertySettled(
            owner,
            propertyMainId,
            settlePrice,
            address(property.settlementToken)
        );
    }

    /**
     * @dev Called in createProperty and batchCreateProperty functions
     * @param owner, initial owner of property
     * @param propertyInfo, related information for the property
     */
    function _createProperty(
        address owner,
        PropertyInfo calldata propertyInfo
    ) private returns (uint256 propertyMainId) {
        if (address(propertyInfo.settlementToken) == address(0)) {
            revert InvalidAddress();
        }
        if (propertyInfo.price == 0) {
            revert InvalidPrice();
        }
        if (propertyInfo.dueDate < block.timestamp) {
            revert InvalidDueDate();
        }
        if (propertyInfo.fractions == 0) {
            revert InvalidFraction();
        }
        propertyMainId = uint256(
            keccak256(
                abi.encodePacked(
                    CHAIN_ID,
                    address(this),
                    owner,
                    _nonce.useNonce(owner)
                )
            )
        );
        if (_assetCollection.totalSubSupply(propertyMainId, 1) != 0) {
            revert PropertyAlreadyCreated();
        }

        _propertyInfo[propertyMainId] = propertyInfo;

        _assetCollection.createAsset(
            owner,
            propertyMainId,
            1,
            propertyInfo.fractions
        );
    }
}
