import * as helpers from '../helpers/contract-helpers';

import { expect } from 'chai';
import { trackGas, GasGroup } from '../helpers/gas-usage';

let ssvNetworkContract: any, pod1: any, minDepositAmount: any;

describe('Deposit Tests', () => {
  beforeEach(async () => {
    // Initialize contract
    ssvNetworkContract = (await helpers.initializeContract()).contract;
    // Register operators
    await helpers.registerOperators(0, 12, helpers.CONFIG.minimalOperatorFee);

    minDepositAmount = (helpers.CONFIG.minimalBlocksBeforeLiquidation + 10) * helpers.CONFIG.minimalOperatorFee * 4;

    // Register validators
    pod1 = await helpers.registerValidators(4, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
  });

  it('Deposit as owner emits FundsDeposit event', async () => {
    await helpers.DB.ssvToken.connect(helpers.DB.owners[4]).approve(ssvNetworkContract.address, minDepositAmount);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4])['deposit(uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))'](pod1.args.operatorIds, minDepositAmount, pod1.args.pod)).to.emit(ssvNetworkContract, 'FundsDeposit');
  });

  it('Deposit as non-owner emits FundsDeposit event', async () => {
    await helpers.DB.ssvToken.connect(helpers.DB.owners[0]).approve(ssvNetworkContract.address, minDepositAmount);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[0])['deposit(address,uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))'](helpers.DB.owners[4].address, pod1.args.operatorIds, minDepositAmount, pod1.args.pod)).to.emit(ssvNetworkContract, 'FundsDeposit');
  });

  it('Deposit as owner returns an error - PodNotExists', async () => {
    await expect(ssvNetworkContract.connect(helpers.DB.owners[1])['deposit(uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))'](pod1.args.operatorIds, minDepositAmount, pod1.args.pod)).to.be.revertedWith('PodNotExists');
  });

  it('Deposit as non-owner returns an error - PodNotExists', async () => {
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4])['deposit(uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))']([1,2,4,5], minDepositAmount, pod1.args.pod)).to.be.revertedWith('PodNotExists');
  });

  it('Deposit as owner gas limits', async () => {
    await helpers.DB.ssvToken.connect(helpers.DB.owners[4]).approve(ssvNetworkContract.address, minDepositAmount);
    await trackGas(ssvNetworkContract.connect(helpers.DB.owners[4])['deposit(uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))'](pod1.args.operatorIds, minDepositAmount, pod1.args.pod), [GasGroup.DEPOSIT]);
  });

  it('Deposit as non-owner gas limits', async () => {
    await helpers.DB.ssvToken.connect(helpers.DB.owners[0]).approve(ssvNetworkContract.address, minDepositAmount);
    await trackGas(ssvNetworkContract.connect(helpers.DB.owners[0])['deposit(address,uint64[],uint256,(uint32,uint64,uint64,uint64,uint64,bool))'](helpers.DB.owners[4].address, pod1.args.operatorIds, minDepositAmount, pod1.args.pod), [GasGroup.DEPOSIT]);
  });
});
