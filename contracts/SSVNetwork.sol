// File: contracts/SSVNetwork.sol
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./utils/VersionedContract.sol";
import "./ISSVNetwork.sol";
import "hardhat/console.sol";

contract SSVNetwork is Initializable, OwnableUpgradeable, ISSVNetwork, VersionedContract {
    struct OperatorData {
        uint64 blockNumber;
        uint64 activeValidatorCount;
        uint64 earnings;
        uint64 index;
        uint64 indexBlockNumber;
        uint64 previousFee;
    }

    struct OwnerData {
        uint64 balance;
//        uint64 deposited;
//        uint64 withdrawn;
//        uint64 earned;
//        uint64 used;
        uint64 networkFee;
        uint64 networkFeeIndex;
        uint64 activeValidatorCount;
        bool validatorsDisabled;
    }

    struct OperatorInUse {
        uint64 index;
        uint64 used;
        bool exists;
        uint32 validatorCount;
        uint32 indexInArray;
    }

    struct FeeChangeRequest {
        uint64 fee;
        uint64 approvalBeginTime;
        uint64 approvalEndTime;
    }

    ISSVRegistry private _ssvRegistryContract;
    IERC20 private _token;
    uint64 private _minimumBlocksBeforeLiquidation;
    uint64 private _operatorMaxFeeIncrease;

    uint64 private _networkFee;
    uint64 private _networkFeeIndex;
    uint64 private _networkFeeIndexBlockNumber;
    uint64 private _networkEarnings;
    uint64 private _networkEarningsBlockNumber;
    uint64 private _withdrawnFromTreasury;

    mapping(uint64 => OperatorData) private _operatorDatas;
    mapping(address => OwnerData) private _owners;
    mapping(address => mapping(uint64 => OperatorInUse)) private _operatorsInUseByAddress;
    mapping(address => uint32[]) private _operatorsInUseList;

    uint64 private _setOperatorFeePeriod;
    uint64 private _approveOperatorFeePeriod;
    mapping(uint64 => FeeChangeRequest) private _feeChangeRequests;

    uint64 constant MINIMAL_OPERATOR_FEE = 10000;

    function initialize(
        ISSVRegistry registryAddress_,
        IERC20 token_,
        uint64 minimumBlocksBeforeLiquidation_,
        uint64 operatorMaxFeeIncrease_,
        uint64 setOperatorFeePeriod_,
        uint64 approveOperatorFeePeriod_,
        uint16 validatorsPerOperatorLimit_
    ) external initializer override {
        __SSVNetwork_init(registryAddress_, token_, minimumBlocksBeforeLiquidation_, operatorMaxFeeIncrease_, setOperatorFeePeriod_, approveOperatorFeePeriod_, validatorsPerOperatorLimit_);
    }

    function __SSVNetwork_init(
        ISSVRegistry registryAddress_,
        IERC20 token_,
        uint64 minimumBlocksBeforeLiquidation_,
        uint64 operatorMaxFeeIncrease_,
        uint64 setOperatorFeePeriod_,
        uint64 approveOperatorFeePeriod_,
        uint16 validatorsPerOperatorLimit_
    ) internal onlyInitializing {
        __Ownable_init_unchained();
        __SSVNetwork_init_unchained(registryAddress_, token_, minimumBlocksBeforeLiquidation_, operatorMaxFeeIncrease_, setOperatorFeePeriod_, approveOperatorFeePeriod_, validatorsPerOperatorLimit_);
    }

    function __SSVNetwork_init_unchained(
        ISSVRegistry registryAddress_,
        IERC20 token_,
        uint64 minimumBlocksBeforeLiquidation_,
        uint64 operatorMaxFeeIncrease_,
        uint64 setOperatorFeePeriod_,
        uint64 approveOperatorFeePeriod_,
        uint16 validatorsPerOperatorLimit_
    ) internal onlyInitializing {
        _ssvRegistryContract = registryAddress_;
        _token = token_;
        _minimumBlocksBeforeLiquidation = minimumBlocksBeforeLiquidation_;
        _operatorMaxFeeIncrease = operatorMaxFeeIncrease_;
        _setOperatorFeePeriod = setOperatorFeePeriod_;
        _approveOperatorFeePeriod = approveOperatorFeePeriod_;
        _ssvRegistryContract.initialize(validatorsPerOperatorLimit_);
    }

    modifier onlyValidatorOwner(bytes calldata publicKey) {
        address owner = _ssvRegistryContract.getValidatorOwner(publicKey);
        require(
            owner != address(0),
            "validator with public key does not exist"
        );
        require(msg.sender == owner, "caller is not validator owner");
        _;
    }

    modifier onlyOperatorOwner(uint32 operatorId) {
        address owner = _ssvRegistryContract.getOperatorOwner(operatorId);
        require(
            owner != address(0),
            "operator with public key does not exist"
        );
        require(msg.sender == owner, "caller is not operator owner");
        _;
    }

    modifier ensureMinimalOperatorFee(uint64 fee) {
        require(fee >= MINIMAL_OPERATOR_FEE, "fee is too low");
        _;
    }

    /**
     * @dev See {ISSVNetwork-registerOperator}.
     */
    function registerOperator(
        string calldata name,
        bytes calldata publicKey,
        uint64 fee
    ) ensureMinimalOperatorFee(fee) external override returns (uint32 operatorId) {
        operatorId = _ssvRegistryContract.registerOperator(
            name,
            msg.sender,
            publicKey,
            fee
        );
        uint64 blocknumber = uint64(block.number);
        _operatorDatas[operatorId] = OperatorData(blocknumber, 0, 0, 0, blocknumber, uint64(block.timestamp));
    }

    function migrateRegisterOperator(
        string calldata name,
        address ownerAddress,
        bytes calldata publicKey,
        uint64 fee
    ) external returns (uint32 operatorId) {
        operatorId = _ssvRegistryContract.registerOperator(
            name,
            ownerAddress,
            publicKey,
            fee
        );
        uint64 blocknumber = uint64(block.number);
        _operatorDatas[operatorId] = OperatorData(blocknumber, 0, 0, 0, blocknumber, uint64(block.timestamp));
    }

    /**
     * @dev See {ISSVNetwork-removeOperator}.
     */
    function removeOperator(uint32 operatorId) onlyOperatorOwner(operatorId) external override {
        address owner = _ssvRegistryContract.getOperatorOwner(operatorId);
        _owners[owner].balance += _operatorDatas[operatorId].earnings;
        delete _operatorDatas[operatorId];
        _ssvRegistryContract.removeOperator(operatorId);
    }

    function activateOperator(uint32 operatorId) onlyOperatorOwner(operatorId) external override {
        _ssvRegistryContract.activateOperator(operatorId);
        _updateAddressNetworkFee(msg.sender);
    }

    function deactivateOperator(uint32 operatorId) onlyOperatorOwner(operatorId) external override {
        require(_operatorDatas[operatorId].activeValidatorCount == 0, "operator has validators");

        _ssvRegistryContract.deactivateOperator(operatorId);
    }

    function setOperatorFee(uint32 operatorId, uint64 fee) onlyOperatorOwner(operatorId) ensureMinimalOperatorFee(fee) external override {
        require(fee == _operatorDatas[operatorId].previousFee || fee <= uint64(_ssvRegistryContract.getOperatorCurrentFee(operatorId)) * (100 + _operatorMaxFeeIncrease) / 100, "fee exceeds increase limit");
        _feeChangeRequests[operatorId] = FeeChangeRequest(fee, uint64(block.timestamp) + _setOperatorFeePeriod, uint64(block.timestamp) + _setOperatorFeePeriod + _approveOperatorFeePeriod);

        emit OperatorFeeSet(msg.sender, operatorId, uint64(block.number), fee);
    }

    function cancelSetOperatorFee(uint32 operatorId) onlyOperatorOwner(operatorId) external override {
        delete _feeChangeRequests[operatorId];

        emit OperatorFeeSetCanceled(msg.sender, operatorId);
    }

    function approveOperatorFee(uint32 operatorId) onlyOperatorOwner(operatorId) external override {
        FeeChangeRequest storage feeChangeRequest = _feeChangeRequests[operatorId];

        require(feeChangeRequest.fee > 0, "no pending fee change request");
        require(uint64(block.timestamp) >= feeChangeRequest.approvalBeginTime && uint64(block.timestamp) <= feeChangeRequest.approvalEndTime, "approval not within timeframe");

        _updateOperatorIndex(operatorId);
        _operatorDatas[operatorId].indexBlockNumber = uint64(block.number);
        _updateOperatorBalance(operatorId);
        _operatorDatas[operatorId].previousFee = uint64(_ssvRegistryContract.getOperatorCurrentFee(operatorId));
        _ssvRegistryContract.updateOperatorFee(operatorId, feeChangeRequest.fee);

        emit OperatorFeeApproved(msg.sender, operatorId, uint64(block.number), feeChangeRequest.fee);

        delete _feeChangeRequests[operatorId];
    }

    function updateOperatorScore(uint32 operatorId, uint16 score) onlyOwner external override {
        _ssvRegistryContract.updateOperatorScore(operatorId, score);
    }

    /**
     * @dev See {ISSVNetwork-registerValidator}.
     */
    function registerValidator(
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount
    ) external override {
        uint256 left2 = gasleft();
        uint256 left = gasleft();
//        _updateNetworkEarnings();
//        console.log("NET: _updateNetworkEarnings()");
//        console.log(left - gasleft());
//        left = gasleft();
        _updateAddressNetworkFee(msg.sender);
        console.log("NET: _updateAddressNetworkFee(msg.sender)");
        console.log(left - gasleft());
        left = gasleft();
        _registerValidatorUnsafe(msg.sender, publicKey, operatorIds, sharesPublicKeys, encryptedKeys, tokenAmount);
        console.log("NET: _registerValidatorUnsafe(msg.sender, publicKey, operatorIds, sharesPublicKeys, encryptedKeys, tokenAmount)");
        console.log(left - gasleft());

        console.log("NET: registerValidator");
        console.log(left2 - gasleft());
    }

    function migrateRegisterValidator(
        address ownerAddress,
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount
    ) external {
        _updateNetworkEarnings();
        _updateAddressNetworkFee(ownerAddress);
        _registerValidatorUnsafe(ownerAddress, publicKey, operatorIds, sharesPublicKeys, encryptedKeys, tokenAmount);
    }

    /**
     * @dev See {ISSVNetwork-updateValidator}.
     */
    function updateValidator(
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount
    ) onlyValidatorOwner(publicKey) external override {
        _removeValidatorUnsafe(msg.sender, publicKey);
        _registerValidatorUnsafe(msg.sender, publicKey, operatorIds, sharesPublicKeys, encryptedKeys, tokenAmount);
    }

    /**
     * @dev See {ISSVNetwork-removeValidator}.
     */
    function removeValidator(bytes calldata publicKey) onlyValidatorOwner(publicKey) external override {
        _updateNetworkEarnings();
        _updateAddressNetworkFee(msg.sender);
        _removeValidatorUnsafe(msg.sender, publicKey);
        _totalBalanceOf(msg.sender); // For assertion
    }

    function deposit(uint64 tokenAmount) external override {
        _deposit(tokenAmount);
    }

    function withdraw(uint64 tokenAmount) external override {
        require(_totalBalanceOf(msg.sender) >= tokenAmount, "not enough balance");

        _withdrawUnsafe(tokenAmount);

        require(!_liquidatable(msg.sender), "not enough balance");
    }

    function withdrawAll() external override {
        require(_burnRate(msg.sender) == 0, "burn rate positive");

        _withdrawUnsafe(_totalBalanceOf(msg.sender));
    }

    function liquidate(address[] calldata ownerAddresses) external override {
        uint balanceToTransfer = 0;

        for (uint64 index = 0; index < ownerAddresses.length; ++index) {
            if (_canLiquidate(ownerAddresses[index])) {
                balanceToTransfer += _liquidateUnsafe(ownerAddresses[index]);
            }
        }

        _token.transfer(msg.sender, balanceToTransfer);
    }

    function enableAccount(uint64 tokenAmount) external override {
        require(_owners[msg.sender].validatorsDisabled, "account already enabled");

        _deposit(tokenAmount);

        _enableOwnerValidatorsUnsafe(msg.sender);

        require(!_liquidatable(msg.sender), "not enough balance");

        emit AccountEnabled(msg.sender);
    }

    function updateMinimumBlocksBeforeLiquidation(uint64 newMinimumBlocksBeforeLiquidation) external onlyOwner override {
        _minimumBlocksBeforeLiquidation = newMinimumBlocksBeforeLiquidation;
    }

    function updateOperatorMaxFeeIncrease(uint64 newOperatorMaxFeeIncrease) external onlyOwner override {
        _operatorMaxFeeIncrease = newOperatorMaxFeeIncrease;
    }

    function updateSetOperatorFeePeriod(uint64 newSetOperatorFeePeriod) external onlyOwner override {
        _setOperatorFeePeriod = newSetOperatorFeePeriod;

        emit SetOperatorFeePeriodUpdated(newSetOperatorFeePeriod);
    }

    function updateApproveOperatorFeePeriod(uint64 newApproveOperatorFeePeriod) external onlyOwner override {
        _approveOperatorFeePeriod = newApproveOperatorFeePeriod;

        emit ApproveOperatorFeePeriodUpdated(newApproveOperatorFeePeriod);
    }

    /**
     * @dev See {ISSVNetwork-updateNetworkFee}.
     */
    function updateNetworkFee(uint64 fee) external onlyOwner override {
        emit NetworkFeeUpdated(_networkFee, fee);
        _updateNetworkEarnings();
        _updateNetworkFeeIndex();
        _networkFee = fee;
    }

    function withdrawNetworkFees(uint64 amount) external onlyOwner override {
        require(amount <= _getNetworkTreasury(), "not enough balance");
        _withdrawnFromTreasury += amount;
        _token.transfer(msg.sender, amount);

        emit NetworkFeesWithdrawn(amount, msg.sender);
    }

    function totalEarningsOf(address ownerAddress) external override view returns (uint64) {
        return _totalEarningsOf(ownerAddress);
    }

    function totalBalanceOf(address ownerAddress) external override view returns (uint64) {
        return _totalBalanceOf(ownerAddress);
    }

    function isOwnerValidatorsDisabled(address ownerAddress) external view override returns (bool) {
        return _owners[ownerAddress].validatorsDisabled;
    }

    /**
     * @dev See {ISSVNetwork-operators}.
     */
    function operators(uint32 operatorId) external view override returns (string memory, address, bytes memory, uint64, bool) {
        return _ssvRegistryContract.operators(operatorId);
    }

    function getOperatorFeeChangeRequest(uint32 operatorId) external view override returns (uint64, uint64, uint64) {
        FeeChangeRequest storage feeChangeRequest = _feeChangeRequests[operatorId];

        return (feeChangeRequest.fee, feeChangeRequest.approvalBeginTime, feeChangeRequest.approvalEndTime);
    }

    /**
     * @dev See {ISSVNetwork-getOperatorCurrentFee}.
     */
    function getOperatorCurrentFee(uint32 operatorId) external view override returns (uint64) {
        return uint64(_ssvRegistryContract.getOperatorCurrentFee(operatorId));
    }

    /**
     * @dev See {ISSVNetwork-operatorEarningsOf}.
     */
    function operatorEarningsOf(uint32 operatorId) external view override returns (uint64) {
        return _operatorEarningsOf(operatorId);
    }

    /**
     * @dev See {ISSVNetwork-getOperatorsByOwnerAddress}.
     */
    function getOperatorsByOwnerAddress(address ownerAddress) external view override returns (uint32[] memory) {
        return _ssvRegistryContract.getOperatorsByOwnerAddress(ownerAddress);
    }

    /**
     * @dev See {ISSVNetwork-getOperatorsByValidator}.
     */
    function getOperatorsByValidator(bytes memory publicKey) external view override returns (uint32[] memory) {
        return _ssvRegistryContract.getOperatorsByValidator(publicKey);
    }

    /**
     * @dev See {ISSVNetwork-getValidatorsByAddress}.
     */
    function getValidatorsByOwnerAddress(address ownerAddress) external view override returns (bytes[] memory) {
        return _ssvRegistryContract.getValidatorsByAddress(ownerAddress);
    }

    /**
     * @dev See {ISSVNetwork-addressNetworkFee}.
     */
    function addressNetworkFee(address ownerAddress) external view override returns (uint64) {
        return _addressNetworkFee(ownerAddress);
    }


    function burnRate(address ownerAddress) external view override returns (uint64) {
        return _burnRate(ownerAddress);
    }

    function liquidatable(address ownerAddress) external view override returns (bool) {
        return _liquidatable(ownerAddress);
    }

    function networkFee() external view override returns (uint64) {
        return _networkFee;
    }

    function getNetworkTreasury() external view override returns (uint64) {
        return _getNetworkTreasury();
    }

    function minimumBlocksBeforeLiquidation() external view override returns (uint64) {
        return _minimumBlocksBeforeLiquidation;
    }

    function operatorMaxFeeIncrease() external view override returns (uint64) {
        return _operatorMaxFeeIncrease;
    }

    function getSetOperatorFeePeriod() external view override returns (uint64) {
        return _setOperatorFeePeriod;
    }

    function getApproveOperatorFeePeriod() external view override returns (uint64) {
        return _approveOperatorFeePeriod;
    }

    function setValidatorsPerOperatorLimit(uint16 validatorsPerOperatorLimit_) external onlyOwner {
        _ssvRegistryContract.setValidatorsPerOperatorLimit(validatorsPerOperatorLimit_);
    }

    function validatorsPerOperatorCount(uint32 operatorId_) external view returns (uint16) {
        return _ssvRegistryContract.validatorsPerOperatorCount(operatorId_);
    }

    function getValidatorsPerOperatorLimit() external view returns (uint16) {
        return _ssvRegistryContract.getValidatorsPerOperatorLimit();
    }

    function _deposit(uint64 tokenAmount) private {
        _token.transferFrom(msg.sender, address(this), tokenAmount);
        _owners[msg.sender].balance += tokenAmount;

        emit FundsDeposited(tokenAmount, msg.sender);
    }

    function _withdrawUnsafe(uint64 tokenAmount) private {
        _owners[msg.sender].balance -= tokenAmount;
        _token.transfer(msg.sender, tokenAmount);

        emit FundsWithdrawn(tokenAmount, msg.sender);
    }

    /**
     * @dev Update network fee for the address.
     * @param ownerAddress Owner address.
     */
    function _updateAddressNetworkFee(address ownerAddress) private {
        _owners[ownerAddress].networkFee = _addressNetworkFee(ownerAddress);
        _owners[ownerAddress].networkFeeIndex = _currentNetworkFeeIndex();
    }

    function _updateOperatorIndex(uint32 operatorId) private {
        _operatorDatas[operatorId].index = _operatorIndexOf(operatorId);
    }

    /**
     * @dev Updates operators's balance.
     */
    function _updateOperatorBalance(uint32 operatorId) private {
        OperatorData storage operatorData = _operatorDatas[operatorId];
        operatorData.earnings = _operatorEarningsOf(operatorId);
        operatorData.blockNumber = uint64(block.number);
    }

    function _liquidateUnsafe(address ownerAddress) private returns (uint64) {
        _disableOwnerValidatorsUnsafe(ownerAddress);

        uint64 balanceToTransfer = _totalBalanceOf(ownerAddress);

        _owners[ownerAddress].balance = 0;

        emit AccountLiquidated(ownerAddress);

        return balanceToTransfer;
    }

    function _updateNetworkEarnings() private {
        _networkEarnings = _getNetworkEarnings();
        _networkEarningsBlockNumber = uint64(block.number);
    }

    function _updateNetworkFeeIndex() private {
        _networkFeeIndex = _currentNetworkFeeIndex();
        _networkFeeIndexBlockNumber = uint64(block.number);
    }

    function _registerValidatorUnsafe(
        address ownerAddress,
        bytes calldata publicKey,
        uint32[] calldata operatorIds,
        bytes[] calldata sharesPublicKeys,
        bytes[] calldata encryptedKeys,
        uint64 tokenAmount) private {

        uint256 left = gasleft();

        _ssvRegistryContract.registerValidator(
            ownerAddress,
            publicKey,
            operatorIds,
            sharesPublicKeys,
            encryptedKeys
        );
        console.log("NET: _ssvRegistryContract.registerValidator(");
        console.log(left - gasleft());
        left = gasleft();

        OwnerData memory owner = _owners[ownerAddress];

        if (!owner.validatorsDisabled) {
            ++owner.activeValidatorCount;
        }

        console.log("NET: active validator count");
        console.log(left - gasleft());
        left = gasleft();
        uint256 left2 = gasleft();

        for (uint64 index = 0; index < operatorIds.length; ++index) {
            uint32 operatorId = operatorIds[index];
              // TODO: why do we need to update?
//            _updateOperatorBalance(operatorId);

            console.log("NET: update operator balance");
            console.log(left - gasleft());
            left = gasleft();

            if (!owner.validatorsDisabled) {
                ++_operatorDatas[operatorId].activeValidatorCount;
            }

            console.log("NET: update active validator count");
            console.log(left - gasleft());
            left = gasleft();

            _useOperatorByOwner(ownerAddress, operatorId);

            console.log("NET: update operator by owner");
            console.log(left - gasleft());
            left = gasleft();
        }

        console.log("loop");
        console.log(left2 - gasleft());
        left = gasleft();

        if (tokenAmount > 0) {
            _deposit(tokenAmount);
        }

        console.log("deposit");
        console.log(left - gasleft());
        left = gasleft();

        require(!_liquidatable2(ownerAddress), "not enough balance");

        console.log("liquidatable");
        console.log(left - gasleft());
        left = gasleft();
    }

    function _removeValidatorUnsafe(address ownerAddress, bytes memory publicKey) private {
        _unregisterValidator(ownerAddress, publicKey);
        _ssvRegistryContract.removeValidator(publicKey);

        if (!_owners[ownerAddress].validatorsDisabled) {
            --_owners[ownerAddress].activeValidatorCount;
        }
    }

    function _unregisterValidator(address ownerAddress, bytes memory publicKey) private {
        // calculate balances for current operators in use and update their balances
        uint32[] memory currentOperatorIds = _ssvRegistryContract.getOperatorsByValidator(publicKey);
        for (uint64 index = 0; index < currentOperatorIds.length; ++index) {
            uint32 operatorId = currentOperatorIds[index];
            _updateOperatorBalance(operatorId);

            if (!_owners[msg.sender].validatorsDisabled) {
                --_operatorDatas[operatorId].activeValidatorCount;
            }

            _stopUsingOperatorByOwner(ownerAddress, operatorId);
        }
    }

    function _useOperatorByOwner(address ownerAddress, uint32 operatorId) private {
        _updateUsingOperatorByOwner(ownerAddress, operatorId, true);
    }

    function _stopUsingOperatorByOwner(address ownerAddress, uint32 operatorId) private {
        _updateUsingOperatorByOwner(ownerAddress, operatorId, false);
    }

    /**
     * @dev Updates the relation between operator and owner
     * @param ownerAddress Owner address.
     * @param increase Change value for validators amount.
     */
    function _updateUsingOperatorByOwner(address ownerAddress, uint32 operatorId, bool increase) private {
        uint256 left = gasleft();
        OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][operatorId];
        console.log("NET: operatorInUseData -_operatorsInUseByAddress ");
        console.log(left - gasleft());

        if (operatorInUseData.exists) {
            _updateOperatorUsageByOwner(operatorInUseData, ownerAddress, operatorId);
            console.log("NET: operatorInUseData -_updateOperatorUsageByOwner ");
            console.log(left - gasleft());

            if (increase) {
                ++operatorInUseData.validatorCount;
            } else {
                if (--operatorInUseData.validatorCount == 0) {
                    _owners[ownerAddress].balance -= operatorInUseData.used;

                    // remove from mapping and list;

                    _operatorsInUseList[ownerAddress][operatorInUseData.indexInArray] = _operatorsInUseList[ownerAddress][_operatorsInUseList[ownerAddress].length - 1];
                    _operatorsInUseByAddress[ownerAddress][_operatorsInUseList[ownerAddress][operatorInUseData.indexInArray]].indexInArray = operatorInUseData.indexInArray;
                    _operatorsInUseList[ownerAddress].pop();

                    delete _operatorsInUseByAddress[ownerAddress][operatorId];
                }
            }
        } else {
            _operatorsInUseByAddress[ownerAddress][operatorId] = OperatorInUse({index: _operatorIndexOf(operatorId), used: 0, exists: true, validatorCount: 1, indexInArray: uint32(_operatorsInUseList[ownerAddress].length)});
            _operatorsInUseList[ownerAddress].push(operatorId);
        }
    }

    function _disableOwnerValidatorsUnsafe(address ownerAddress) private {
        _updateNetworkEarnings();
        _updateAddressNetworkFee(ownerAddress);

        for (uint64 index = 0; index < _operatorsInUseList[ownerAddress].length; ++index) {
            uint32 operatorId = _operatorsInUseList[ownerAddress][index];
            _updateOperatorBalance(operatorId);
            OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][operatorId];
            _updateOperatorUsageByOwner(operatorInUseData, ownerAddress, operatorId);
            _operatorDatas[operatorId].activeValidatorCount -= operatorInUseData.validatorCount;
        }

        _ssvRegistryContract.disableOwnerValidators(ownerAddress);

        _owners[ownerAddress].validatorsDisabled = true;
    }

    function _enableOwnerValidatorsUnsafe(address ownerAddress) private {
        _updateNetworkEarnings();
        _updateAddressNetworkFee(ownerAddress);

        for (uint64 index = 0; index < _operatorsInUseList[ownerAddress].length; ++index) {
            uint32 operatorId = _operatorsInUseList[ownerAddress][index];
            _updateOperatorBalance(operatorId);
            OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][operatorId];
            _updateOperatorUsageByOwner(operatorInUseData, ownerAddress, operatorId);
            _operatorDatas[operatorId].activeValidatorCount += operatorInUseData.validatorCount;
        }

        _ssvRegistryContract.enableOwnerValidators(ownerAddress);

        _owners[ownerAddress].validatorsDisabled = false;
    }

    function _updateOperatorUsageByOwner(OperatorInUse storage operatorInUseData, address ownerAddress, uint32 operatorId) private {
        uint256 left = gasleft();


        _updateOperatorInUseUsageOf(operatorInUseData, ownerAddress, operatorId);

//        operatorInUseData.used = _operatorInUseUsageOf(operatorInUseData, ownerAddress, operatorId);
//        console.log("NET: _updateOperatorUsageByOwner -_operatorInUseUsageOf ");
//        console.log(left - gasleft());
//        left = gasleft();
//        operatorInUseData.index = _operatorIndexOf(operatorId);
//        console.log("NET: _updateOperatorUsageByOwner -_operatorIndexOf ");
//        console.log(left - gasleft());
    }

    function _expensesOf(address ownerAddress) private view returns(uint64) {
        uint64 usage = _addressNetworkFee(ownerAddress);
        for (uint64 index = 0; index < _operatorsInUseList[ownerAddress].length; ++index) {
            OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][_operatorsInUseList[ownerAddress][index]];
            usage += _operatorInUseUsageOf(operatorInUseData, ownerAddress, _operatorsInUseList[ownerAddress][index]);
        }

        return usage;
    }

    function _totalEarningsOf(address ownerAddress) private view returns (uint64) {
        uint64 balance = 0;

        uint32[] memory operatorsByOwner = _ssvRegistryContract.getOperatorsByOwnerAddress(ownerAddress);
        for (uint64 index = 0; index < operatorsByOwner.length; ++index) {
            balance += _operatorEarningsOf(operatorsByOwner[index]);
        }

        return balance;
    }

    function _totalBalanceOf(address ownerAddress) private view returns (uint64) {
        uint64 balance = _owners[ownerAddress].balance + _totalEarningsOf(ownerAddress) - _expensesOf(ownerAddress);

        require(balance >= 0, "negative balance");

        return balance;
    }

    function _operatorEarnRate(uint32 operatorId) private view returns (uint64) {
        return uint64(_ssvRegistryContract.getOperatorCurrentFee(operatorId)) * _operatorDatas[operatorId].activeValidatorCount;
    }

    /**
     * @dev See {ISSVNetwork-operatorEarningsOf}.
     */
    function _operatorEarningsOf(uint32 operatorId) private view returns (uint64) {
        return _operatorDatas[operatorId].earnings +
               (uint64(block.number)- _operatorDatas[operatorId].blockNumber) *
               _operatorEarnRate(operatorId);
    }

    function _addressNetworkFee(address ownerAddress) private view returns (uint64) {
        return _owners[ownerAddress].networkFee +
              (_currentNetworkFeeIndex() - _owners[ownerAddress].networkFeeIndex) *
              _owners[ownerAddress].activeValidatorCount;
    }

    function _burnRate(address ownerAddress) private view returns (uint64 ownerBurnRate) {
        if (_owners[ownerAddress].validatorsDisabled) {
            return 0;
        }

        for (uint64 index = 0; index < _operatorsInUseList[ownerAddress].length; ++index) {
            ownerBurnRate += _operatorInUseBurnRateWithNetworkFeeUnsafe(ownerAddress, _operatorsInUseList[ownerAddress][index]);
        }

        uint32[] memory operatorsByOwner = _ssvRegistryContract.getOperatorsByOwnerAddress(ownerAddress);

        for (uint64 index = 0; index < operatorsByOwner.length; ++index) {
            if (ownerBurnRate <= _operatorEarnRate(operatorsByOwner[index])) {
                return 0;
            } else {
                ownerBurnRate -= _operatorEarnRate(operatorsByOwner[index]);
            }
        }
    }

    function _overdue(address ownerAddress) private view returns (bool) {
        return _totalBalanceOf(ownerAddress) < _minimumBlocksBeforeLiquidation * _burnRate(ownerAddress);
    }

    function _liquidatable(address ownerAddress) private view returns (bool) {
        return !_owners[msg.sender].validatorsDisabled && _overdue(ownerAddress);
    }

    function _liquidatable2(address ownerAddress) private view returns (bool) {
        uint256 left = gasleft();

        uint64 _totalEarningsOf = 0;

        uint32[] memory operatorsByOwner = _ssvRegistryContract.getOperatorsByOwnerAddress(ownerAddress);
        for (uint64 index = 0; index < operatorsByOwner.length; ++index) {
            _totalEarningsOf += _operatorEarningsOf(operatorsByOwner[index]);
        }


        console.log("NET: _liquidatable2 -_totalEarningsOf ");
        console.log(left - gasleft());
        left = gasleft();



        uint64 _expensesOf = _addressNetworkFee(ownerAddress);
        uint256 len = _operatorsInUseList[ownerAddress].length;
        for (uint64 index = 0; index < len; ++index) {
            OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][_operatorsInUseList[ownerAddress][index]];
            _expensesOf += _operatorInUseUsageOf(operatorInUseData, ownerAddress, _operatorsInUseList[ownerAddress][index]);
        }

        console.log("NET: _liquidatable2 -_expensesOf ");
        console.log(len);
        console.log(left - gasleft());
        left = gasleft();

        uint64 _totalBalanceOf = _owners[ownerAddress].balance + _totalEarningsOf - _expensesOf;
        console.log("NET: _liquidatable2 -_totalBalanceOf ");
        console.log(left - gasleft());


        bool _overdue = _totalBalanceOf < _minimumBlocksBeforeLiquidation * _burnRate(ownerAddress);

        return !_owners[msg.sender].validatorsDisabled && _overdue;
    }

    function _canLiquidate(address ownerAddress) private view returns (bool) {
        return !_owners[msg.sender].validatorsDisabled && (msg.sender == ownerAddress || _overdue(ownerAddress));
    }

    function _getNetworkEarnings() private view returns (uint64) {
        return _networkEarnings + (uint64(block.number)- _networkEarningsBlockNumber) * _networkFee * _ssvRegistryContract.activeValidatorCount();
    }

    function _getNetworkTreasury() private view returns (uint64) {
        return  _getNetworkEarnings() - _withdrawnFromTreasury;
    }

    /**
     * @dev Get operator index by address.
     */
    function _operatorIndexOf(uint32 operatorId) private view returns (uint64) {

        uint256 left = gasleft();
        OperatorData memory a = _operatorDatas[operatorId];
        console.log("NET: _updateOperatorUsageByOwner -_operatorInUseUsageOf4 ");
        console.log(left - gasleft());


        left = gasleft();
        uint64 b = _ssvRegistryContract.getOperatorCurrentFee(operatorId);
        console.log("NET: _updateOperatorUsageByOwner -_operatorInUseUsageOf5 ");
        console.log(left - gasleft());



        return a.index +
            b * (uint64(block.number) - a.indexBlockNumber);
    }

    function _operatorInUseUsageOf(OperatorInUse storage operatorInUseData, address ownerAddress, uint32 operatorId) private view returns (uint64) {

        uint256 left = gasleft();
        uint64 x = _operatorIndexOf(operatorId);
        console.log("NET: _updateOperatorUsageByOwner -_operatorInUseUsageOf3 ");
        console.log(left - gasleft());

        return operatorInUseData.used + (
                _owners[ownerAddress].validatorsDisabled ? 0 :
                (x - operatorInUseData.index) * operatorInUseData.validatorCount
               );
    }

    function _updateOperatorInUseUsageOf(OperatorInUse storage operatorInUseData, address ownerAddress, uint32 operatorId) private returns (uint64) {

        uint256 left = gasleft();

        OperatorData memory a = _operatorDatas[operatorId];
        uint64 b = _ssvRegistryContract.getOperatorCurrentFee(operatorId);

        uint64 index = a.index +
        b * (uint64(block.number) - a.indexBlockNumber);



        console.log("NET: _updateOperatorUsageByOwner -_operatorInUseUsageOf3 ");
        console.log(left - gasleft());

        operatorInUseData.used = operatorInUseData.used + (
        _owners[ownerAddress].validatorsDisabled ? 0 :
        (index - operatorInUseData.index) * operatorInUseData.validatorCount
        );

        operatorInUseData.index = index;

        return index;
    }

    function _operatorInUseBurnRateWithNetworkFeeUnsafe(address ownerAddress, uint32 operatorId) private view returns (uint64) {
        OperatorInUse storage operatorInUseData = _operatorsInUseByAddress[ownerAddress][operatorId];
        return uint64(_ssvRegistryContract.getOperatorCurrentFee(operatorId) + _networkFee) * operatorInUseData.validatorCount;
    }

    /**
     * @dev Returns the current network fee index
     */
    function _currentNetworkFeeIndex() private view returns(uint64) {
        return _networkFeeIndex + (uint64(block.number) - _networkFeeIndexBlockNumber) * _networkFee;
    }

    function version() external pure override returns (uint32) {
        return 1;
    }

    uint64[50] ______gap;
}