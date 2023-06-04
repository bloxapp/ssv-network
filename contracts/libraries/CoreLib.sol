// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import "./SSVStorage.sol";

library CoreLib {
    event ModuleUpgraded(SSVModules moduleId, address moduleAddress);

    function getVersion() internal pure returns (string memory) {
        return "v0.3.2-rc0";
    }

    function transferBalance(address to, uint256 amount) internal {
        if (!SSVStorage.load().token.transfer(to, amount)) {
            revert ISSVNetworkCore.TokenTransferFailed();
        }
    }

    function deposit(uint256 amount) internal {
        if (!SSVStorage.load().token.transferFrom(msg.sender, address(this), amount)) {
            revert ISSVNetworkCore.TokenTransferFailed();
        }
    }

    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        if (account == address(0)) {
            return false;
        }
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    function delegateCall(address ssvModule, bytes memory callMessage) internal returns (bytes memory) {
        // Check when calls are not made using proxy contract
        if (!isContract(ssvModule)) revert ISSVNetworkCore.TargetModuleDoesNotExist();

        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory returnData) = ssvModule.delegatecall(callMessage);
        if (!success && returnData.length > 0) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let returnData_size := mload(returnData)
                revert(add(32, returnData), returnData_size)
            }
        }
        return returnData;
    }

    function setModuleContract(SSVModules moduleId, address moduleAddress) internal {
        if (!isContract(moduleAddress)) revert ISSVNetworkCore.TargetModuleDoesNotExist();

        SSVStorage.load().ssvContracts[moduleId] = moduleAddress;
        emit ModuleUpgraded(moduleId, moduleAddress);
    }
}
