import * as helpers from '../helpers/contract-helpers';
import * as utils from '../helpers/utils';

import { expect } from 'chai';
import { trackGas, GasGroup } from '../helpers/gas-usage';

let ssvNetworkContract: any, minDepositAmount: any, firstPod: any;

describe('Reactivate Validator Tests', () => {
  beforeEach(async () => {
    // Initialize contract
    ssvNetworkContract = (await helpers.initializeContract()).contract;

    // Register operators
    await helpers.registerOperators(0, 12, helpers.CONFIG.minimalOperatorFee);

    minDepositAmount = (helpers.CONFIG.minimalBlocksBeforeLiquidation + 10) * helpers.CONFIG.minimalOperatorFee * 4;

    // Register validators
    // cold register
    await helpers.DB.ssvToken.connect(helpers.DB.owners[3]).approve(ssvNetworkContract.address, minDepositAmount);
    await ssvNetworkContract.connect(helpers.DB.owners[3]).registerValidator(
      helpers.DataGenerator.publicKey(9),
      helpers.DataGenerator.cluster.new(),
      helpers.DataGenerator.shares(0),
      minDepositAmount,
      {
        validatorCount: 0,
        networkFee: 0,
        networkFeeIndex: 0,
        index: 0,
        balance: 0,
        disabled: false
      }
    );

    // first validator
    await helpers.DB.ssvToken.connect(helpers.DB.owners[1]).approve(ssvNetworkContract.address, minDepositAmount);
    const register = await trackGas(ssvNetworkContract.connect(helpers.DB.owners[1]).registerValidator(
      helpers.DataGenerator.publicKey(1),
      [1,2,3,4],
      helpers.DataGenerator.shares(0),
      minDepositAmount,
      {
        validatorCount: 0,
        networkFee: 0,
        networkFeeIndex: 0,
        index: 0,
        balance: 0,
        disabled: false
      }
    ), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
    firstPod = register.eventsByName.PodMetadataUpdated[0].args;
  });

  it('Reactivate emits PodEnabled', async () => {
    await utils.progressBlocks(helpers.CONFIG.minimalBlocksBeforeLiquidation);
    const liquidatedPod = await trackGas(ssvNetworkContract.liquidatePod(firstPod.ownerAddress, firstPod.operatorIds, firstPod.pod), [GasGroup.LIQUIDATE_POD]);
    const updatedPod = liquidatedPod.eventsByName.PodMetadataUpdated[0].args;
    await helpers.DB.ssvToken.connect(helpers.DB.owners[1]).approve(ssvNetworkContract.address, minDepositAmount);

    await expect(ssvNetworkContract.connect(helpers.DB.owners[1]).reactivatePod(updatedPod.operatorIds, minDepositAmount, updatedPod.pod)).to.emit(ssvNetworkContract, 'PodEnabled');
  });

  it('Reactivate returns an error - PodAlreadyEnabled', async () => {
    await expect(ssvNetworkContract.connect(helpers.DB.owners[1]).reactivatePod(firstPod.operatorIds, minDepositAmount, firstPod.pod)).to.be.revertedWith('PodAlreadyEnabled');
  });

  it('Reactivate returns an error - NegativeBalance', async () => {
    await utils.progressBlocks(helpers.CONFIG.minimalBlocksBeforeLiquidation);
    const liquidatedPod = await trackGas(ssvNetworkContract.liquidatePod(firstPod.ownerAddress, firstPod.operatorIds, firstPod.pod), [GasGroup.LIQUIDATE_POD]);
    const updatedPod = liquidatedPod.eventsByName.PodMetadataUpdated[0].args;
    await helpers.DB.ssvToken.connect(helpers.DB.owners[1]).approve(ssvNetworkContract.address, helpers.CONFIG.minimalOperatorFee);

    await expect(ssvNetworkContract.connect(helpers.DB.owners[1]).reactivatePod(updatedPod.operatorIds, helpers.CONFIG.minimalOperatorFee, updatedPod.pod)).to.be.revertedWith('NotEnoughBalance');
  });

  it('Reactivate with removed operator in a cluster', async () => {
    await utils.progressBlocks(helpers.CONFIG.minimalBlocksBeforeLiquidation);
    const liquidatedPod = await trackGas(ssvNetworkContract.liquidatePod(firstPod.ownerAddress, firstPod.operatorIds, firstPod.pod), [GasGroup.LIQUIDATE_POD]);
    const updatedPod = liquidatedPod.eventsByName.PodMetadataUpdated[0].args;
    await ssvNetworkContract.removeOperator(1);

    await helpers.DB.ssvToken.connect(helpers.DB.owners[1]).approve(ssvNetworkContract.address, minDepositAmount);
    await trackGas(ssvNetworkContract.connect(helpers.DB.owners[1]).reactivatePod(updatedPod.operatorIds, minDepositAmount, updatedPod.pod), [GasGroup.REACTIVATE_POD]);
  });
});
