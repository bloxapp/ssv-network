// File: contracts/SSVRegistry.sol
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./utils/VersionedContract.sol";
import "./ISSVRegistry.sol";
import "hardhat/console.sol";

contract SSVRegistry is Initializable, OwnableUpgradeable, ISSVRegistry, VersionedContract {
    using Counters for Counters.Counter;

    struct Operator {
        string name;
        bytes publicKey;
        address ownerAddress;
        uint16 score;
        uint16 indexInOwner;
        uint16 validatorCount;
        bool active;
    }

    struct Validator {
        uint32[] operatorIds;
        address ownerAddress;
        uint16 indexInOwner;
        bool active;
    }

    struct OperatorFee {
        uint64 blockNumber;
        uint64 fee;
    }

    struct OwnerData {
        uint32 activeValidatorCount;
        bool validatorsDisabled;
        bytes[] validators;
    }


    Counters.Counter private _lastOperatorId;

    mapping(uint32 => Operator) private _operators;
    mapping(bytes => Validator) private _validators;
    mapping(uint32 => OperatorFee[]) private _operatorFees;

    mapping(address => uint32[]) private _operatorsByOwnerAddress;
    // mapping(address => bytes[]) private _validatorsByOwnerAddress;
    mapping(address => OwnerData) private _owners;

    // mapping(uint32 => uint16) internal validatorsPerOperator;
    uint16 public validatorsPerOperatorLimit;
    uint32 private _activeValidatorCount;
    mapping(bytes => uint32) private _operatorPublicKeyToId;

    /**
     * @dev See {ISSVRegistry-initialize}.
     */
    function initialize(uint16 validatorsPerOperatorLimit_) external override initializer {
        __SSVRegistry_init(validatorsPerOperatorLimit_);
    }

    function __SSVRegistry_init(uint16 validatorsPerOperatorLimit_) internal onlyInitializing {
        __Ownable_init_unchained();
        __SSVRegistry_init_unchained(validatorsPerOperatorLimit_);
    }

    function __SSVRegistry_init_unchained(uint16 validatorsPerOperatorLimit_) internal onlyInitializing {
        validatorsPerOperatorLimit = validatorsPerOperatorLimit_;
    }

    /**
     * @dev See {ISSVRegistry-registerOperator}.
     */
    function registerOperator(
        string calldata name,
        address ownerAddress,
        bytes calldata publicKey,
        uint64 fee
    ) external onlyOwner override returns (uint32 operatorId) {
        require(
            _operatorPublicKeyToId[publicKey] == 0,
            "operator with same public key already exists"
        );

        _lastOperatorId.increment();
        operatorId = uint32(_lastOperatorId.current());
        _operators[operatorId] = Operator({name: name, ownerAddress: ownerAddress, publicKey: publicKey, score: 0, active: false, indexInOwner: uint16(_operatorsByOwnerAddress[ownerAddress].length), validatorCount: 0});
        _operatorsByOwnerAddress[ownerAddress].push(operatorId);
        _operatorPublicKeyToId[publicKey] = operatorId;
        _updateOperatorFeeUnsafe(operatorId, fee);
        _activateOperatorUnsafe(operatorId);

        emit OperatorAdded(operatorId, name, ownerAddress, publicKey);
    }

    /**
     * @dev See {ISSVRegistry-removeOperator}.
     */
    function removeOperator(
        uint32 operatorId
    ) external onlyOwner override {
        require(_operators[operatorId].validatorCount == 0, "operator has validators");

        Operator storage operator = _operators[operatorId];
        _operatorsByOwnerAddress[operator.ownerAddress][operator.indexInOwner] = _operatorsByOwnerAddress[operator.ownerAddress][_operatorsByOwnerAddress[operator.ownerAddress].length - 1];
        _operators[_operatorsByOwnerAddress[operator.ownerAddress][operator.indexInOwner]].indexInOwner = operator.indexInOwner;
        _operatorsByOwnerAddress[operator.ownerAddress].pop();

        emit OperatorRemoved(operatorId, operator.ownerAddress, operator.publicKey);

        // delete _operators[operatorId].validatorCount;
        delete _operatorPublicKeyToId[operator.publicKey];
        delete _operators[operatorId];
    }

    /**
     * @dev See {ISSVRegistry-activateOperator}.
     */
    function activateOperator(uint32 operatorId) external onlyOwner override {
        _activateOperatorUnsafe(operatorId);
    }

    /**
     * @dev See {ISSVRegistry-deactivateOperator}.
     */
    function deactivateOperator(uint32 operatorId) external onlyOwner override {
        _deactivateOperatorUnsafe(operatorId);
    }

    /**
     * @dev See {ISSVRegistry-updateOperatorFee}.
     */
    function updateOperatorFee(uint32 operatorId, uint64 fee) external onlyOwner override {
        _updateOperatorFeeUnsafe(operatorId, fee);
    }

    /**
     * @dev See {ISSVRegistry-updateOperatorScore}.
     */
    function updateOperatorScore(uint32 operatorId, uint16 score) external onlyOwner override {
        Operator storage operator = _operators[operatorId];
        operator.score = score;

        emit OperatorScoreUpdated(operatorId, operator.ownerAddress, operator.publicKey, uint64(block.number), score);
    }

    /**
     * @dev See {ISSVRegistry-registerValidator}.
     */
    function registerValidator(
        address ownerAddress,
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys
    ) external onlyOwner override {
        uint256 left = gasleft();
        _validateValidatorParams(
            publicKey,
            operatorIds,
            sharesPublicKeys,
            encryptedKeys
        );

        require(
            _validators[publicKey].ownerAddress == address(0),
            "validator with same public key already exists"
        );
        console.log("REG: validate params");
        console.log(left - gasleft());
        left = gasleft();

        _validators[publicKey] = Validator({
            operatorIds: operatorIds,
            ownerAddress: ownerAddress,
            indexInOwner: uint16(_owners[ownerAddress].validators.length),
            active: true
        });
        console.log("REG: create validator record");
        console.log(left - gasleft());
        left = gasleft();
        _owners[ownerAddress].validators.push(publicKey);
        console.log("REG: add to validatorsByOwnerAddress");
        console.log(left - gasleft());
        left = gasleft();

        for (uint32 index = 0; index < operatorIds.length; ++index) {
            require(++_operators[operatorIds[index]].validatorCount <= validatorsPerOperatorLimit, "exceed validator limit");
        }

        console.log("REG: add to validatorsPerOperator and validate limit");
        console.log(left - gasleft());
        left = gasleft();
        ++_activeValidatorCount;
        // ++_owners[_validators[publicKey].ownerAddress].activeValidatorCount;

        console.log("REG: update counters");
        console.log(left - gasleft());
        left = gasleft();
        emit ValidatorAdded(ownerAddress, publicKey, operatorIds, sharesPublicKeys, encryptedKeys);

        console.log("REG: and emit event");
        console.log(left - gasleft());
        left = gasleft();
    }

    /**
     * @dev See {ISSVRegistry-updateValidator}.
     */
    function updateValidator(
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys
    ) external onlyOwner override {
        _validateValidatorParams(
            publicKey,
            operatorIds,
            sharesPublicKeys,
            encryptedKeys
        );
        Validator storage validator = _validators[publicKey];

        for (uint32 index = 0; index < validator.operatorIds.length; ++index) {
            --_operators[validator.operatorIds[index]].validatorCount;
        }

        validator.operatorIds = operatorIds;

        for (uint32 index = 0; index < operatorIds.length; ++index) {
            require(++_operators[operatorIds[index]].validatorCount <= validatorsPerOperatorLimit, "exceed validator limit");
        }

        emit ValidatorUpdated(validator.ownerAddress, publicKey, operatorIds, sharesPublicKeys, encryptedKeys);
    }

    /**
     * @dev See {ISSVRegistry-removeValidator}.
     */
    function removeValidator(
        bytes calldata publicKey
    ) external onlyOwner override {
        Validator storage validator = _validators[publicKey];

        for (uint32 index = 0; index < validator.operatorIds.length; ++index) {
            --_operators[validator.operatorIds[index]].validatorCount;
        }

        bytes[] storage ownerValidators = _owners[validator.ownerAddress].validators;

        ownerValidators[validator.indexInOwner] = ownerValidators[ownerValidators.length - 1];
        _validators[ownerValidators[validator.indexInOwner]].indexInOwner = validator.indexInOwner;
        ownerValidators.pop();

        --_activeValidatorCount;
        // --_owners[validator.ownerAddress].activeValidatorCount;

        emit ValidatorRemoved(validator.ownerAddress, publicKey);

        delete _validators[publicKey];
    }

    function enableOwnerValidators(address ownerAddress) external onlyOwner override {
        // _activeValidatorCount += _owners[ownerAddress].activeValidatorCount;
        _owners[ownerAddress].validatorsDisabled = false;

        emit OwnerValidatorsEnabled(ownerAddress);
    }

    function disableOwnerValidators(address ownerAddress) external onlyOwner override {
        // _activeValidatorCount -= _owners[ownerAddress].activeValidatorCount;
        _owners[ownerAddress].validatorsDisabled = true;

        emit OwnerValidatorsDisabled(ownerAddress);
    }

    function isOwnerValidatorsDisabled(address ownerAddress) external view override returns (bool) {
        return _owners[ownerAddress].validatorsDisabled;
    }

    /**
     * @dev See {ISSVRegistry-operators}.
     */
    function operators(uint32 operatorId) external view override returns (string memory, address, bytes memory, uint64, bool) {
        Operator storage operator = _operators[operatorId];
        return (operator.name, operator.ownerAddress, operator.publicKey, operator.score, operator.active);
    }

    /**
     * @dev See {ISSVRegistry-getOperatorsByOwnerAddress}.
     */
    function getOperatorsByOwnerAddress(address ownerAddress) external view override returns (uint32[] memory) {
        return _operatorsByOwnerAddress[ownerAddress];
    }

    /**
     * @dev See {ISSVRegistry-getOperatorsByValidator}.
     */
    function getOperatorsByValidator(bytes calldata validatorPublicKey) external view override returns (uint32[] memory operatorIds) {
        Validator storage validator = _validators[validatorPublicKey];

        return validator.operatorIds;
    }

    /**
     * @dev See {ISSVRegistry-getOperatorOwner}.
     */
    function getOperatorOwner(uint32 operatorId) external override view returns (address) {
        return _operators[operatorId].ownerAddress;
    }

    /**
     * @dev See {ISSVRegistry-getOperatorCurrentFee}.
     */
    function getOperatorCurrentFee(uint32 operatorId) external view override returns (uint64) {
        require(_operatorFees[operatorId].length > 0, "operator not found");
        return _operatorFees[operatorId][_operatorFees[operatorId].length - 1].fee;
    }

    /**
     * @dev See {ISSVRegistry-activeValidatorCount}.
     */
    function activeValidatorCount() external view override returns (uint32) {
        return _activeValidatorCount;
    }

    /**
     * @dev See {ISSVRegistry-validators}.
     */
    function validators(bytes calldata publicKey) external view override returns (address, bytes memory, bool) {
        Validator storage validator = _validators[publicKey];

        return (validator.ownerAddress, publicKey, validator.active);
    }

    /**
     * @dev See {ISSVRegistry-getValidatorsByAddress}.
     */
    function getValidatorsByAddress(address ownerAddress) external view override returns (bytes[] memory) {
        return _owners[ownerAddress].validators;
    }

    /**
     * @dev See {ISSVRegistry-getValidatorOwner}.
     */
    function getValidatorOwner(bytes calldata publicKey) external view override returns (address) {
        return _validators[publicKey].ownerAddress;
    }

    /**
     * @dev See {ISSVRegistry-setValidatorsPerOperatorLimit}.
     */
    function setValidatorsPerOperatorLimit(uint16 _validatorsPerOperatorLimit) onlyOwner external override {
        validatorsPerOperatorLimit = _validatorsPerOperatorLimit;
    }

    /**
     * @dev See {ISSVRegistry-getValidatorsPerOperatorLimit}.
     */
    function getValidatorsPerOperatorLimit() external view override returns (uint16) {
        return validatorsPerOperatorLimit;
    }

    /**
     * @dev See {ISSVRegistry-validatorsPerOperatorCount}.
     */
    function validatorsPerOperatorCount(uint32 operatorId) external override view returns (uint16) {
        return _operators[operatorId].validatorCount;
    }

    /**
     * @dev See {ISSVRegistry-activateOperator}.
     */
    function _activateOperatorUnsafe(uint32 operatorId) private {
        require(!_operators[operatorId].active, "already active");
        _operators[operatorId].active = true;

        emit OperatorActivated(operatorId, _operators[operatorId].ownerAddress, _operators[operatorId].publicKey);
    }

    /**
     * @dev See {ISSVRegistry-deactivateOperator}.
     */
    function _deactivateOperatorUnsafe(uint32 operatorId) private {
        require(_operators[operatorId].active, "already inactive");
        _operators[operatorId].active = false;

        emit OperatorDeactivated(operatorId, _operators[operatorId].ownerAddress, _operators[operatorId].publicKey);
    }

    /**
     * @dev See {ISSVRegistry-updateOperatorFee}.
     */
    function _updateOperatorFeeUnsafe(uint32 operatorId, uint64 fee) private {
        _operatorFees[operatorId].push(
            OperatorFee(uint64(block.number), fee)
        );

        emit OperatorFeeUpdated(operatorId, _operators[operatorId].ownerAddress, _operators[operatorId].publicKey, uint64(block.number), fee);
    }

    /**
     * @dev Validates the paramss for a validator.
     * @param publicKey Validator public key.
     * @param operatorIds Operator operatorIds.
     * @param sharesPublicKeys Shares public keys.
     * @param encryptedKeys Encrypted private keys.
     */
    function _validateValidatorParams(
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys
    ) private pure {
        // require(publicKey.length == 48, "invalid public key length");
        require(
            operatorIds.length == sharesPublicKeys.length &&
            operatorIds.length == encryptedKeys.length &&
            operatorIds.length >= 4 && operatorIds.length % 3 == 1,
            "OESS data structure is not valid"
        );
    }

    function version() external pure override returns (uint32) {
        return 1;
    }

    uint64[50] ______gap;
}
