declare const ethers: any;

import * as helpers from '../helpers/contract-helpers';

import { expect } from 'chai';
import { trackGas, GasGroup } from '../helpers/gas-usage';

let ssvNetworkContract: any;

describe('Register Validator Tests', () => {
  beforeEach(async () => {
    ssvNetworkContract = (await helpers.initializeContract()).contract;
    await helpers.registerOperators(0, 1, '10');
    await helpers.registerOperators(1, 1, '10');
    await helpers.registerOperators(2, 1, '10');
    await helpers.registerOperators(3, 1, '10');

    await helpers.deposit([4], ['100000']);
    await helpers.deposit([5], ['100000']);
  });

  it('Register validator in empty pod', async () => {
    await helpers.registerValidators(4, 1, '10000', helpers.DataGenerator.pod.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
  });

  it('Register two validators in existed pod', async () => {
    const result = await helpers.registerValidators(4, 1, '10000', helpers.DataGenerator.pod.new());
    await helpers.registerValidators(4, 1, '10000', helpers.DataGenerator.pod.byId(result.podId), [GasGroup.REGISTER_VALIDATOR_EXISTED_POD]);
  });

  it('Register two validators in existed cluster', async () => {
    const result = await helpers.registerValidators(4, 1, '10000', helpers.DataGenerator.pod.new());
    await helpers.registerValidators(5, 1, '10000', helpers.DataGenerator.pod.byId(result.podId), [GasGroup.REGISTER_VALIDATOR_EXISTED_CLUSTER]);
  });

  it('Fails to register with invalid operator list size', async () => {
    await expect(trackGas(ssvNetworkContract.registerValidator(
      helpers.DataGenerator.publicKey(helpers.DB.validators.length),
      [1, 2],
      helpers.DataGenerator.shares(helpers.DB.validators.length),
      '10000'
    ))).to.be.revertedWith('OessDataStructureInvalid');
  });
});
