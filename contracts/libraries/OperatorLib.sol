// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import "../interfaces/ISSVNetworkCore.sol";
import "./SSVStorage.sol";
import "./Types.sol";

library OperatorLib {
    using Types64 for uint64;

    function updateSnapshot(ISSVNetworkCore.Operator memory operator) internal view {
        uint64 blockDiffFee = (uint32(block.number) - operator.snapshot.block) * operator.fee;

        operator.snapshot.index += blockDiffFee;
        operator.snapshot.balance += blockDiffFee * operator.validatorCount;
        operator.snapshot.block = uint32(block.number);
    }

    function checkOwner(ISSVNetworkCore.Operator memory operator) internal view {
        if (operator.snapshot.block == 0) revert ISSVNetworkCore.OperatorDoesNotExist();
        if (operator.owner != msg.sender) revert ISSVNetworkCore.CallerNotOwner();
    }

    function updateOperators(
        uint64[] memory operatorIds,
        bool increaseValidatorCount,
        uint32 deltaValidatorCount
    ) internal returns (uint64 clusterIndex, uint64 burnRate) {
        StorageData storage s = SSVStorage.load();
        for (uint i; i < operatorIds.length; ) {
            uint64 operatorId = operatorIds[i];
            if (s.operators[operatorId].snapshot.block != 0) {
                ISSVNetworkCore.Operator memory operator = s.operators[operatorId];
                updateSnapshot(operator);
                if (increaseValidatorCount) {
                    operator.validatorCount += deltaValidatorCount;
                } else {
                    operator.validatorCount -= deltaValidatorCount;
                }
                burnRate += operator.fee;
                s.operators[operatorId] = operator;
            }

            clusterIndex += s.operators[operatorId].snapshot.index;
            unchecked {
                ++i;
            }
        }
    }
}
