// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import "../interfaces/functions/IFnSSVDAO.sol";
import "../interfaces/events/IEvSSVDAO.sol";
import "../libraries/Types.sol";
import "../libraries/OperatorLib.sol";
import "../libraries/NetworkLib.sol";
import "../libraries/DAOLib.sol";
import "../libraries/CoreLib.sol";
import "../libraries/SSVStorage.sol";

contract SSVDAO is IFnSSVDAO, IEvSSVDAO {
    using Types64 for uint64;
    using Types256 for uint256;

    using NetworkLib for Network;
    using DAOLib for DAO;

    uint64 private constant MINIMAL_LIQUIDATION_THRESHOLD = 100_800;

    function updateNetworkFee(uint256 fee) external override {
        uint64 previousFee = SSVStorage.load().network.networkFee;

        SSVStorage.load().network.updateNetworkFee(fee);

        emit NetworkFeeUpdated(previousFee, fee);
    }

    function withdrawNetworkEarnings(uint256 amount) external override {
        DAO memory dao_ = SSVStorage.load().dao;

        uint64 shrunkAmount = amount.shrink();

        uint64 networkBalance = dao_.networkTotalEarnings(SSVStorage.load().network.networkFee);

        if (shrunkAmount > networkBalance) {
            revert InsufficientBalance();
        }

        dao_.balance = networkBalance - shrunkAmount;
        SSVStorage.load().dao = dao_;

        CoreLib.transferBalance(msg.sender, amount);

        emit NetworkEarningsWithdrawn(amount, msg.sender);
    }

    function updateOperatorFeeIncreaseLimit(uint64 percentage) external override {
        SSVStorage.load().operatorFeeConfig.operatorMaxFeeIncrease = percentage;
        emit OperatorFeeIncreaseLimitUpdated(percentage);
    }

    function updateDeclareOperatorFeePeriod(uint64 timeInSeconds) external override {
        SSVStorage.load().operatorFeeConfig.declareOperatorFeePeriod = timeInSeconds;
        emit DeclareOperatorFeePeriodUpdated(timeInSeconds);
    }

    function updateExecuteOperatorFeePeriod(uint64 timeInSeconds) external override {
        SSVStorage.load().operatorFeeConfig.executeOperatorFeePeriod = timeInSeconds;
        emit ExecuteOperatorFeePeriodUpdated(timeInSeconds);
    }

    function updateLiquidationThresholdPeriod(uint64 blocks) external override {
        if (blocks < MINIMAL_LIQUIDATION_THRESHOLD) {
            revert NewBlockPeriodIsBelowMinimum();
        }

        SSVStorage.load().minimumBlocksBeforeLiquidation = blocks;
        emit LiquidationThresholdPeriodUpdated(blocks);
    }

    function updateMinimumLiquidationCollateral(uint256 amount) external override {
        SSVStorage.load().minimumLiquidationCollateral = amount.shrink();
        emit MinimumLiquidationCollateralUpdated(amount);
    }
}
