// File: contracts/SSVRegistry.sol
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.16;

import "../SSVNetworkViews.sol";

contract SSVNetworkViews_V2_1 is SSVNetworkViews {
   uint64 public validatorsPerOperatorListed;

    function initializeV2(uint64 newValidatorsPerOperatorListed) reinitializer(2) public {
        validatorsPerOperatorListed = newValidatorsPerOperatorListed;
    }
}