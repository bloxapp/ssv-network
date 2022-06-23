pragma solidity ^0.4.0;

import "../DKG.sol";

/**
    An example contract for managing DKG validators.
    This contract is NOT COMPILABLE!
*/
contract DKGRegistration {

    bytes[] queuedValidators;
    uint nextValidatorIdx;
    DKG dkgRegistry;
    bytes constantWithdrawalCredentials;

    /**
     * @dev Emitted when a validator is queued
     * @param validatorPubKey
     */
    event ValidatorQueued(bytes validatorPubKey);

    /**
     * @dev Emitted when a validator is de-queued
     * @param validatorPubKey
     */
    event ValidatorDeQueued(bytes validatorPubKey);

    /**
     * @dev Emitted when a validator is deposited
     * @param validatorPubKey
     */
    event Deposited(bytes validatorPubKey);

    function DKGRegistration(bytes _withdrawalCredentials){
        nextValidatorIdx = 0;
        constantWithdrawalCredentials = _withdrawalCredentials;
    }

    /**
     * @dev A callback for a dkg run
     * @param operatorIds Operators SSV ID
     * @param signatures validation signature which result from DKG to validate the operator actually generated them
     * @param encryptedShares Operator shares for the validator
     * @param sharesPublicKeys the PK for the encrypted shares
     * @param setSize the number of operators participating in the DKG
     * @param withdrawalCredentials the provided credentials as input to the DKG
     * @param depositSignature a valid signature to be used to deposit the eth2 validator
     * @param validatorPubKey the validator's pub key
     */
    function dkgCallback(
        uint256[] calldata operatorIds,
        bytes[]  calldata signatures,
        bytes[] calldata encryptedShares,
        bytes[] calldata sharesPublicKeys,
        uint16 calldata setSize,
        bytes calldata withdrawalCredentials,
        bytes calldata depositSignature,
        bytes calldata validatorPubKey
    ) external {
        require(constantWithdrawalCredentials == withdrawalCredentials);

        dkgRegistry.registerValidator(
            operatorIds,
            signatures,
            encryptedShares,
            sharesPublicKeys,
            setSize,
            withdrawalCredentials,
            depositSignature,
            validatorPubKey
        );

        queuedValidators.push(validatorPubKey);

        emit ValidatorQueued(validatorPubKey);
    }

    function depositNextValidator() {
        require(queuedValidators.length > nextValidator, "not enough validators queued");

        validator = queuedValidators[nextValidatorIdx];
        signature = dkgRegistry.depositSignatureForValidator(validator);

        // Compute deposit data root (`DepositData` hash tree root) according to deposit_contract.sol
        // Taken from https://github.com/lidofinance/lido-dao/blob/master/contracts/0.4.24/Lido.sol#L526-L542
        // NOT COMPILABLE
        bytes32 pubkeyRoot = sha256(_pad64(validator));
        bytes32 signatureRoot = sha256(
            abi.encodePacked(
                sha256(BytesLib.slice(signature, 0, 64)),
                sha256(_pad64(BytesLib.slice(signature, 64, SIGNATURE_LENGTH.sub(64))))
            )
        );

        bytes32 depositDataRoot = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(pubkeyRoot, withdrawalCredentials)),
                sha256(abi.encodePacked(_toLittleEndian64(depositAmount), signatureRoot))
            )
        );

        getDepositContract().deposit.value(value)(
            validator, abi.encodePacked(constantWithdrawalCredentials), signature, depositDataRoot);

        emit Deposited(validator);

        nextValidatorIdx++;
    }
}
