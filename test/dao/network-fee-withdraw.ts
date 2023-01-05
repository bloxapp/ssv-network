// Declare imports
import * as helpers from '../helpers/contract-helpers';
import * as utils from '../helpers/utils';
import { expect } from 'chai';
import { GasGroup } from '../helpers/gas-usage';

// Declare globals
let ssvNetworkContract: any, minDepositAmount: any, burnPerBlock: any, networkFee: any;

describe('DAO Network Fee Withdraw Tests', () => {
  beforeEach(async () => {
    // Initialize contract
    ssvNetworkContract = (await helpers.initializeContract()).contract;

    // Define minumum allowed network fee to pass shrinkable validation
    networkFee = helpers.CONFIG.minimalOperatorFee;

    // Register operators
    await helpers.registerOperators(0, 12, helpers.CONFIG.minimalOperatorFee);

    burnPerBlock = helpers.CONFIG.minimalOperatorFee * 4 + networkFee;
    minDepositAmount = helpers.CONFIG.minimalBlocksBeforeLiquidation * burnPerBlock;

    // Deposit into accounts
    // await helpers.deposit([4], [minDepositAmount]);

    // Set network fee
    await ssvNetworkContract.updateNetworkFee(networkFee);

    // Register validators
    // cold register
    await helpers.DB.ssvToken.connect(helpers.DB.owners[6]).approve(helpers.DB.ssvNetwork.contract.address, '1000000000000000');
    await ssvNetworkContract.connect(helpers.DB.owners[6]).registerValidator(
      '0x221111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111119',
      [1,2,3,4],
      helpers.DataGenerator.shares(0),
      '1000000000000000',
      {
        validatorCount: 0,
        networkFee: 0,
        networkFeeIndex: 0,
        index: 0,
        balance: 0,
        disabled: false
      }
    );

    await helpers.registerValidators(4, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
    await utils.progressBlocks(10);

    // Temporary till deposit logic not available
    // Mint tokens
    await helpers.DB.ssvToken.mint(ssvNetworkContract.address, minDepositAmount);
  });

  it('Withdraw network earnings emits "NetworkEarningsWithdrawn"', async () => {
    const amount = await ssvNetworkContract.getNetworkEarnings();
    await expect(ssvNetworkContract.withdrawNetworkEarnings(amount
    )).to.emit(ssvNetworkContract, 'NetworkEarningsWithdrawn').withArgs(amount, helpers.DB.owners[0].address);
  });

  it('Get withdrawable network earnings', async () => {
    expect(await ssvNetworkContract.getNetworkEarnings()).to.above(0);
  });

  it('Get withdrawable network earnings as not owner', async () => {
    await ssvNetworkContract.connect(helpers.DB.owners[3]).getNetworkEarnings();
  });

  it('Withdraw network earnings with not enough balance reverts "InsufficientBalance"', async () => {
    const amount = await ssvNetworkContract.getNetworkEarnings() * 2;
    await expect(ssvNetworkContract.withdrawNetworkEarnings(amount
    )).to.be.revertedWith('InsufficientBalance');
  });

  it('Withdraw network earnings from an address thats not the DAO reverts "caller is not the owner"', async () => {
    const amount = await ssvNetworkContract.getNetworkEarnings();
    await expect(ssvNetworkContract.connect(helpers.DB.owners[3]).withdrawNetworkEarnings(amount
    )).to.be.revertedWith('caller is not the owner');
  });
});
