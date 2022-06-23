// File: contracts/ISSVRegistry.sol
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.2;

import "./ISSVRegistry.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract DKG {
    using ECDSA for bytes32;

    mapping(bytes => bytes) depositSignature;
    ISSVRegistry ssvRegistry;

    /**
     * @dev Validates and registers an DKG validator
     * @param operatorIds Operators SSV ID
     * @param signatures validation signature which result from DKG to validate the operator actually generated them
     * @param encryptedShares Operator shares for the validator
     * @param sharesPublicKeys the PK for the encrypted shares
     * @param setSize the number of operators participating in the DKG
     * @param withdrawalCredentials the provided credentials as input to the DKG
     * @param depositSignature a valid signature to be used to deposit the eth2 validator
     * @param validatorPubKey the validator's pub key
     */
    function registerValidator(
        uint256[] calldata operatorIds,
        bytes[]  calldata signatures,
        bytes[] calldata encryptedShares,
        bytes[] calldata sharesPublicKeys,
        uint16 calldata setSize,
        bytes calldata withdrawalCredentials,
        bytes calldata depositSignature,
        bytes calldata validatorPubKey
    ) external {
        // verify signature
        for (uint8 index = 0; index < setSize; ++index) {
            res = keccak256(
                abi.encode(
                    encryptedShares[index],
                    sharesPublicKeys[index],
                    validatorPubKey,
                    depositSignature
                )
            )
            .toEthSignedMessageHash()
            .recover(signatures[index]);

            require(
               res == ssvRegistry.operatorAddressByID(operatorIds[index],
                "signature invalid"
            );
        }

        // register validator
        ssvRegistry.registerValidator(
            address(this),
            validatorPubKey,
            operatorIds,
            sharesPublicKeys,
            encryptedShares,
            false
        );

        // save validator info for deposit
        depositSignature[validatorPubKey] = depositSignature;
    }

    function depositSignatureForValidator(bytes validatorPubKey) external returns (bytes) {
        return depositSignature[validatorPubKey];
    }
}
