// File: contracts/ISSVNetwork.sol
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "./ISSVRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISSVNetwork {
    /**
     * @dev Emitted when the account has been enabled.
     * @param ownerAddress Operator's owner.
     */
    event AccountEnabled(address indexed ownerAddress);

    /**
     * @dev Emitted when the account has been liquidated.
     * @param ownerAddress Operator's owner.
     */
    event AccountLiquidated(address indexed ownerAddress);

    event OperatorFeeSet(
        address indexed ownerAddress,
        uint32 operatorId,
        uint64 blockNumber,
        uint64 fee
    );

    event OperatorFeeSetCanceled(address indexed ownerAddress, uint32 operatorId);

    /**
     * @dev Emitted when an operator's fee is updated.
     * @param ownerAddress Operator's owner.
     * @param blockNumber from which block number.
     * @param fee updated fee value.
     */
    event OperatorFeeApproved(
        address indexed ownerAddress,
        uint32 operatorId,
        uint64 blockNumber,
        uint64 fee
    );

    /**
     * @dev Emitted when an owner deposits funds.
     * @param value Amount of tokens.
     * @param ownerAddress Owner's address.
     */
    event FundsDeposited(uint64 value, address ownerAddress);

    /**
     * @dev Emitted when an owner withdraws funds.
     * @param value Amount of tokens.
     * @param ownerAddress Owner's address.
     */
    event FundsWithdrawn(uint64 value, address ownerAddress);

    /**
     * @dev Emitted when the network fee is updated.
     * @param oldFee The old fee
     * @param newFee The new fee
     */
    event NetworkFeeUpdated(uint64 oldFee, uint64 newFee);

    /**
     * @dev Emitted when transfer fees are withdrawn.
     * @param value The amount of tokens withdrawn.
     * @param recipient The recipient address.
     */
    event NetworkFeesWithdrawn(uint64 value, address recipient);

    event SetOperatorFeePeriodUpdated(uint64 value);

    event ApproveOperatorFeePeriodUpdated(uint64 value);

    /**
     * @dev Initializes the contract.
     * @param registryAddress_ The registry address.
     * @param token_ The network token.
     * @param minimumBlocksBeforeLiquidation_ The minimum blocks before liquidation.
     * @param setOperatorFeePeriod_ The period an operator needs to wait before they can approve their fee.
     * @param approveOperatorFeePeriod_ The length of the period in which an operator can approve their fee.
     * @param validatorsPerOperatorLimit_ the limit for validators per operator.
     */
    function initialize(
        ISSVRegistry registryAddress_,
        IERC20 token_,
        uint64 minimumBlocksBeforeLiquidation_,
        uint64 operatorMaxFeeIncrease_,
        uint64 setOperatorFeePeriod_,
        uint64 approveOperatorFeePeriod_,
        uint16 validatorsPerOperatorLimit_
    ) external;

    /**
     * @dev Registers a new operator.
     * @param name Operator's display name.
     * @param publicKey Operator's public key. Used to encrypt secret shares of validators keys.
     */
    function registerOperator(
        string calldata name,
        bytes calldata publicKey,
        uint64 fee
    ) external returns (uint32);

    /**
     * @dev Removes an operator.
     * @param operatorId Operator's id.
     */
    function removeOperator(uint32 operatorId) external;

    /**
     * @dev Activates an operator.
     * @param operatorId Operator's id.
     */
    function activateOperator(uint32 operatorId) external;

    /**
     * @dev Deactivates an operator.
     * @param operatorId Operator's id.
     */
    function deactivateOperator(uint32 operatorId) external;

    /**
     * @dev Set operator's fee change request by public key.
     * @param operatorId Operator's id.
     * @param fee The operator's updated fee.
     */
    function setOperatorFee(uint32 operatorId, uint64 fee) external;

    function cancelSetOperatorFee(uint32 operatorId) external;

    function approveOperatorFee(uint32 operatorId) external;

    /**
     * @dev Updates operator's score by public key.
     * @param operatorId Operator's id.
     * @param score The operators's updated score.
     */
    function updateOperatorScore(uint32 operatorId, uint16 score) external;

    /**
     * @dev Registers a new validator.
     * @param publicKey Validator public key.
     * @param operatorIndices Operator public keys.
     * @param sharesPublicKeys Shares public keys.
     * @param encryptedKeys Encrypted private keys.
     */
    function registerValidator(
        bytes calldata publicKey,
        uint32[] calldata operatorIndices,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount
    ) external;

    /**
     * @dev Updates a validator.
     * @param publicKey Validator public key.
     * @param operatorIndices Operator public keys.
     * @param sharesPublicKeys Shares public keys.
     * @param encryptedKeys Encrypted private keys.
     */
    function updateValidator(
        bytes calldata publicKey,
        uint32[] calldata operatorIndices,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount
    ) external;

    /**
     * @dev Removes a validator.
     * @param publicKey Validator's public key.
     */
    function removeValidator(bytes calldata publicKey) external;

    /**
     * @dev Deposits tokens for the sender.
     * @param tokenAmount Tokens amount.
     */
    function deposit(uint64 tokenAmount) external;

    /**
     * @dev Withdraw tokens for the sender.
     * @param tokenAmount Tokens amount.
     */
    function withdraw(uint64 tokenAmount) external;

    /**
     * @dev Withdraw total balance to the sender, deactivating their validators if necessary.
     */
    function withdrawAll() external;

    /**
     * @dev Liquidates multiple owners.
     * @param ownerAddresses Owners' addresses.
     */
    function liquidate(address[] calldata ownerAddresses) external;

    /**
     * @dev Enables msg.sender account.
     * @param tokenAmount Tokens amount.
     */
    function enableAccount(uint64 tokenAmount) external;

    /**
     * @dev Updates the number of blocks left for an owner before they can be liquidated.
     * @param newMinimumBlocksBeforeLiquidation The new value.
     */
    function updateMinimumBlocksBeforeLiquidation(uint64 newMinimumBlocksBeforeLiquidation) external;

    /**
     * @dev Updates the maximum fee increase in pecentage.
     * @param newOperatorMaxFeeIncrease The new value.
     */
    function updateOperatorMaxFeeIncrease(uint64 newOperatorMaxFeeIncrease) external;

    function updateSetOperatorFeePeriod(uint64 newSetOperatorFeePeriod) external;

    function updateApproveOperatorFeePeriod(uint64 newApproveOperatorFeePeriod) external;

    /**
     * @dev Updates the network fee.
     * @param fee the new fee
     */
    function updateNetworkFee(uint64 fee) external;

    /**
     * @dev Withdraws network fees.
     * @param amount Amount to withdraw
     */
    function withdrawNetworkFees(uint64 amount) external;

    /**
     * @dev Gets total earnings for an owner
     * @param ownerAddress Owner's address.
     */
    function totalEarningsOf(address ownerAddress) external view returns (uint64);

    /**
     * @dev Gets total balance for an owner.
     * @param ownerAddress Owner's address.
     */
    function totalBalanceOf(address ownerAddress) external view returns (uint64);

    function isOwnerValidatorsDisabled(address ownerAddress) external view returns (bool);

    /**
     * @dev Gets an operator by public key.
     * @param operatorId Operator's id.
     */
    function operators(uint32 operatorId)
        external view
        returns (
            string memory,
            address,
            bytes memory,
            uint64,
            bool
        );

    /**
     * @dev Gets a validator public keys by owner's address.
     * @param ownerAddress Owner's Address.
     */
    function getValidatorsByOwnerAddress(address ownerAddress)
        external view
        returns (bytes[] memory);

    /**
     * @dev Returns operators for owner.
     * @param ownerAddress Owner's address.
     */
    function getOperatorsByOwnerAddress(address ownerAddress)
        external view
        returns (uint32[] memory);

    /**
     * @dev Gets operators list which are in use by validator.
     * @param validatorPublicKey Validator's public key.
     */
    function getOperatorsByValidator(bytes calldata validatorPublicKey)
        external view
        returns (uint32[] memory);

    function getOperatorFeeChangeRequest(uint32 operatorId) external view returns (uint64, uint64, uint64);

    /**
     * @dev Gets operator current fee.
     * @param operatorId Operator's id.
     */
    function getOperatorCurrentFee(uint32 operatorId) external view returns (uint64);

    /**
     * @dev Gets operator earnings.
     * @param operatorId Operator's id.
     */
    function operatorEarningsOf(uint32 operatorId) external view returns (uint64);

    /**
     * @dev Gets the network fee for an address.
     * @param ownerAddress Owner's address.
     */
    function addressNetworkFee(address ownerAddress) external view returns (uint64);

    /**
     * @dev Returns the burn rate of an owner, returns 0 if negative.
     * @param ownerAddress Owner's address.
     */
    function burnRate(address ownerAddress) external view returns (uint64);

    /**
     * @dev Check if an owner is liquidatable.
     * @param ownerAddress Owner's address.
     */
    function liquidatable(address ownerAddress) external view returns (bool);

    /**
     * @dev Returns the network fee.
     */
    function networkFee() external view returns (uint64);

    /**
     * @dev Gets the network treasury
     */
    function getNetworkTreasury() external view returns (uint64);

    /**
     * @dev Returns the number of blocks left for an owner before they can be liquidated.
     */
    function minimumBlocksBeforeLiquidation() external view returns (uint64);

    /**
     * @dev Returns the maximum fee increase in pecentage
     */
     function operatorMaxFeeIncrease() external view returns (uint64);

     function getSetOperatorFeePeriod() external view returns (uint64);

     function getApproveOperatorFeePeriod() external view returns (uint64);
}
