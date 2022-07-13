// Network Contract Unit Tests

// Declare all imports
import { ethers, upgrades } from 'hardhat';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { progressBlocks, progressTime } from '../helpers/utils';
before(() => {
  chai.should();
  chai.use(chaiAsPromised);
});
const { expect } = chai;

// Define global variables
const minimumBlocksBeforeLiquidation = 7000;
const operatorMaxFeeIncrease = 1000;
const operatorPublicKeyPrefix = '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345';
const validatorPublicKeyPrefix = '98765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765';
let ssvToken: any, ssvRegistry: any, ssvNetwork: any, utils: any;
let owner: any, account1: any, account2: any, account3: any, account4: any;
const operatorsPub = Array.from(Array(10).keys()).map(k => `0x${operatorPublicKeyPrefix}${k}`);
const validatorsPub = Array.from(Array(10).keys()).map(k => `0x${validatorPublicKeyPrefix}${k}`);
const operatorsIds = Array.from(Array(10).keys()).map(k => k + 1);
const tokens = '10000000000';
const DAY = 86400;
const setOperatorFeePeriod = 0;
const approveOperatorFeePeriod = DAY;

describe('SSV Network', function () {
  beforeEach(async function () {
    [owner, account1, account2, account3, account4] = await ethers.getSigners();
    const utilsFactory = await ethers.getContractFactory('Utils');
    const ssvTokenFactory = await ethers.getContractFactory('SSVTokenMock');
    const ssvRegistryFactory = await ethers.getContractFactory('SSVRegistry');
    const ssvNetworkFactory = await ethers.getContractFactory('SSVNetwork');

    utils = await utilsFactory.deploy();
    ssvToken = await ssvTokenFactory.deploy();
    ssvRegistry = await upgrades.deployProxy(ssvRegistryFactory, { initializer: false });
    await ssvToken.deployed();
    await ssvRegistry.deployed();
    ssvNetwork = await upgrades.deployProxy(ssvNetworkFactory, [ssvRegistry.address, ssvToken.address, minimumBlocksBeforeLiquidation, operatorMaxFeeIncrease, setOperatorFeePeriod, approveOperatorFeePeriod]);
    await ssvNetwork.deployed();
    await ssvToken.mint(account1.address, '100000000000');

    // Register operators
    await ssvNetwork.connect(account2).registerOperator('testOperator 0', operatorsPub[0], 10000);
    await ssvNetwork.connect(account2).registerOperator('testOperator 1', operatorsPub[1], 20000);
    await ssvNetwork.connect(account3).registerOperator('testOperator 2', operatorsPub[2], 30000);
    await ssvNetwork.connect(account3).registerOperator('testOperator 3', operatorsPub[3], 40000);
    await ssvNetwork.connect(account3).registerOperator('testOperator 4', operatorsPub[4], 50000);

    // Register validators
    await ssvToken.connect(account1).approve(ssvNetwork.address, tokens);
    await ssvToken.connect(account1).transfer(account2.address, tokens);
    await ssvNetwork.connect(account1).registerValidator(validatorsPub[0], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
  });

  it('Operator limit', async function () {
    // TO DO
    expect(await ssvNetwork.validatorsPerOperatorCount(operatorsIds[0])).to.equal(1);
    await ssvNetwork.connect(account1).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), 0);
    // await expect(ssvNetwork.connect(account1).registerValidator(validatorsPub[2], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), 0)).to.be.revertedWith('ExceedValidatorLimit');
    // await expect(ssvNetwork.connect(account1).updateValidator(validatorsPub[0], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), 0)).to.be.revertedWith('ExceedValidatorLimit');
  });

  it('Owner address limit', async function () {
    // TO DO
    await ssvNetwork.connect(account3).registerOperator('testOperator 5', operatorsPub[5], 50000);
    // await expect(ssvNetwork.connect(account3).registerOperator('testOperator 6', operatorsPub[6], 50000)).to.be.revertedWith('ExceedRegisteredOperatorsByAccountLimit');
  });

  it('Operators getter', async function () {
    expect((await ssvNetwork.getOperatorById(operatorsIds[0])).map((v: any) => v.toString())).to.eql(['testOperator 0', account2.address, operatorsPub[0], '1', '10000', '0', 'true']);
    expect((await ssvNetwork.getOperatorById(operatorsIds[1])).map((v: any) => v.toString())).to.eql(['testOperator 1', account2.address, operatorsPub[1], '1', '20000', '0', 'true']);
    expect((await ssvNetwork.getOperatorById(operatorsIds[2])).map((v: any) => v.toString())).to.eql(['testOperator 2', account3.address, operatorsPub[2], '1', '30000', '0', 'true']);
  });

  it('Get operator current fee', async function () {
    expect(await ssvNetwork.getOperatorFee(operatorsIds[0])).to.equal(10000);
    expect(await ssvNetwork.getOperatorFee(operatorsIds[1])).to.equal(20000);
    expect(await ssvNetwork.getOperatorFee(operatorsIds[2])).to.equal(30000);
  });

  it('Balances should be correct after 100 blocks', async function () {
    await progressBlocks(100);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9990000000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(3000000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(7000000);
  });

  it('Withdraw', async function () {
    await progressBlocks(200);
    await ssvNetwork.connect(account1).withdraw('10000000');
    await ssvNetwork.connect(account2).withdraw('1000000');
    await ssvNetwork.connect(account3).withdraw('1000000');
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9969700000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(5090000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(13210000);
  });

  it('Revert withdraw: NotEnoughBalance', async function () {
    await progressBlocks(350)
    await expect(ssvNetwork.connect(account1)
      .withdraw('80000000000'))
      .to.be.revertedWith('NotEnoughBalance');
    await expect(ssvNetwork.connect(account2)
      .withdraw('9000000000'))
      .to.be.revertedWith('NotEnoughBalance');
    await expect(ssvNetwork.connect(account3)
      .withdraw('25000000000'))
      .to.be.revertedWith('NotEnoughBalance');
  });

  it('Register same validator', async function () {
    await expect(ssvNetwork.connect(account2).registerValidator(validatorsPub[0], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens)).to.be.revertedWith('ValidatorAlreadyExists');
  });

  it('Register another validator', async function () {
    await progressBlocks(600);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9940000000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(18000000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(42000000);
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
    await progressBlocks(100);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9929800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(10014060000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(56140000);
  });

  it('Get validators by owner address', async function () {
    expect(await ssvNetwork.getValidatorsByOwnerAddress(account1.address)).to.eql([validatorsPub[0]]);
  });

  it('Withdraw all when burn rate is positive', async function () {
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(100000);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(40000);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9999800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(10000060000);
    await expect(ssvNetwork.connect(account1).withdrawAll()).to.be.revertedWith("BurnRatePositive");
  });

  it('Liquidate when burn rate is positive', async function () {
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(100000);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(40000);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9999800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(10000060000);
    await expect(ssvNetwork.connect(account1).liquidate([account1.address])).to.emit(ssvToken, 'Transfer').withArgs(ssvNetwork.address, account1.address, 9999700000);
    expect(await ssvToken.balanceOf(account1.address)).to.equal(89999700000);
    await ssvNetwork.connect(account1).registerValidator(validatorsPub[2], operatorsIds.slice(1, 5), operatorsPub.slice(1, 5), operatorsPub.slice(1, 5), 0);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    await ssvNetwork.connect(account1).removeValidator(validatorsPub[2]);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    await ssvNetwork.connect(account1).registerValidator(validatorsPub[2], operatorsIds.slice(1, 5), operatorsPub.slice(1, 5), operatorsPub.slice(1, 5), 0);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    await ssvNetwork.connect(account1).removeValidator(validatorsPub[2]);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    await ssvNetwork.connect(account1).registerValidator(validatorsPub[2], operatorsIds.slice(1, 5), operatorsPub.slice(1, 5), operatorsPub.slice(1, 5), 0);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    await ssvNetwork.connect(account1).updateValidator(validatorsPub[2], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), 0);
    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(70000);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(0);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999600000);

    await progressBlocks(100)
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9992600000);

    await expect(ssvNetwork.connect(account1).reactivateAccount(0)).to.be.revertedWith('NotEnoughBalance');
    await ssvToken.connect(account1).approve(ssvNetwork.address, 5000000000);
    await ssvNetwork.connect(account1).reactivateAccount(5000000000);
    await expect(ssvNetwork.connect(account1).reactivateAccount(0)).to.be.revertedWith('AccountAlreadyEnabled');

    expect(await ssvNetwork.getAddressBurnRate(account1.address)).to.equal(200000);
    expect(await ssvNetwork.getAddressBurnRate(account2.address)).to.equal(10000);

    await progressBlocks(50)
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(4989800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9991880000);
  });

  it('Withdraw all when burn rate is non-positive', async function () {
    await ssvNetwork.connect(account3).registerValidator(validatorsPub[2], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), 0);
    expect(await ssvNetwork.getAddressBurnRate(account3.address)).to.equal(0);
    await expect(ssvNetwork.connect(account3).withdrawAll()).to.emit(ssvToken, 'Transfer').withArgs(ssvNetwork.address, account3.address, 110000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(0);
    expect(await ssvNetwork.isLiquidated(account3.address)).to.equal(false);
    expect(await ssvToken.balanceOf(account3.address)).to.equal(110000);
  });

  it('Remove a validator', async function () {
    await ssvNetwork.connect(account1).removeValidator(validatorsPub[0]);
    await progressBlocks(99);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9999900000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(30000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(70000);
  });

  it('Try to approve when no pending fee', async function () {
    await expect(ssvNetwork.connect(account3).executeOperatorFee(operatorsIds[3])).to.be.revertedWith('NoPendingFeeChangeRequest');
  });

  it('Update operator fee', async function () {
    await ssvNetwork.connect(account3).declareOperatorFee(operatorsIds[3], "44000");
    await ssvNetwork.connect(account3).executeOperatorFee(operatorsIds[3]);
    await progressBlocks(99);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9989504000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(3030000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(7466000);
  });

  it('Register a validator with deposit', async function () {
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
    await progressBlocks(10);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999660000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(1540000);
  });

  it('Activate a validator', async function () {
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4), tokens);
    await progressBlocks(10);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999660000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(1540000);
  });

  it('Remove a validator when overdue', async function () {
    await ssvNetwork.connect(account1).withdraw('9290000000');
    await progressBlocks(8000);
    await expect(ssvNetwork.connect(account1).removeValidator(validatorsPub[0])).to.be.revertedWith('NegativeBalance');
  });

  it('Balance when overdue', async function () {
    await ssvNetwork.connect(account1).withdraw('9290000000');
    await progressBlocks(8000);
    await expect(ssvNetwork.getAddressBalance(account1.address)).to.be.revertedWith('NegativeBalance');
  });

  it('Update operator fee not from owner', async function () {
    await expect(ssvNetwork.connect(account1).declareOperatorFee(operatorsIds[3], 6)).to.be.revertedWith('CallerNotOperatorOwner');
  });

  it('Remove an operator not from owner', async function () {
    await expect(ssvNetwork.connect(account1).removeOperator(operatorsIds[4])).to.be.revertedWith('CallerNotOperatorOwner');
  });

  it('Remove an operator', async function () {
    await ssvToken.connect(account2).approve(ssvNetwork.address, tokens);
    await ssvNetwork.connect(account2).registerValidator(validatorsPub[2], operatorsIds.slice(1, 5), operatorsPub.slice(1, 5), operatorsPub.slice(1, 5), tokens);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9999800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(10000060000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(140000);
    await progressBlocks(10)
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998800000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999160000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(2040000);
    await ssvNetwork.connect(account2).removeValidator(validatorsPub[2]);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998700000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999070000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(2230000);
    await progressBlocks(10);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9997700000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999370000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(2930000);
    await ssvNetwork.connect(account3).removeOperator(operatorsIds[4]);
    await progressBlocks(9);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9996700000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(9999670000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(3630000);
  });

  it('Deactivate an operator', async function () {
    await progressBlocks(10)
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9999000000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(300000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(700000);
    await ssvNetwork.connect(account1).removeValidator(validatorsPub[0]);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998900000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(330000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(770000);
    await progressBlocks(10);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998900000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(330000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(770000);
    await ssvNetwork.connect(account3).removeOperator(operatorsIds[4]);
    await progressBlocks(9);
    expect(await ssvNetwork.getAddressBalance(account1.address)).to.equal(9998900000);
    expect(await ssvNetwork.getAddressBalance(account2.address)).to.equal(330000);
    expect(await ssvNetwork.getAddressBalance(account3.address)).to.equal(770000);
    expect((await ssvRegistry.getOperatorById(operatorsIds[4]))[1]).to.equal(account3.address);
    expect((await ssvRegistry.getOperatorById(operatorsIds[4]))[6]).to.equal(false);
  });

  it('Operator max fee increase', async function () {
    expect(await ssvNetwork.getOperatorFeeIncreaseLimit()).to.equal(1000);
    await expect(ssvNetwork.connect(account2).declareOperatorFee(operatorsIds[0], 12000)).to.be.revertedWith('FeeExceedsIncreaseLimit');
    await expect(ssvNetwork.connect(account2).declareOperatorFee(operatorsIds[1], 24000)).to.be.revertedWith('FeeExceedsIncreaseLimit');
    await ssvNetwork.connect(account2).declareOperatorFee(operatorsIds[0], 11000);
    await ssvNetwork.connect(account2).executeOperatorFee(operatorsIds[0]);
    expect(await ssvRegistry.getOperatorFee(operatorsIds[0])).to.equal(11000);
    await ssvNetwork.updateOperatorFeeIncreaseLimit(2000);
    expect(await ssvNetwork.getOperatorFeeIncreaseLimit()).to.equal(2000);
    await expect(ssvNetwork.connect(account2).declareOperatorFee(operatorsIds[1], 25000)).to.be.revertedWith('FeeExceedsIncreaseLimit');
    await ssvNetwork.connect(account2).declareOperatorFee(operatorsIds[1], 24000);
    await ssvNetwork.connect(account2).executeOperatorFee(operatorsIds[1]);
  });

  it('Update operator max fee increase emits event', async function () {
    await expect(ssvNetwork.updateOperatorFeeIncreaseLimit(200)).to.emit(ssvNetwork, 'OperatorFeeIncreaseLimitUpdate').withArgs(200);
  });

  it('Minimum blocks before liquidation', async function () {
    expect(await ssvNetwork.getLiquidationThresholdPeriod()).to.equal(7000);
    await expect(ssvNetwork.updateLiquidationThresholdPeriod(6569)).to.be.revertedWith('BelowMinimumBlockPeriod');
    await ssvNetwork.updateLiquidationThresholdPeriod(7001);
    expect(await ssvNetwork.getLiquidationThresholdPeriod()).to.equal(7001);
  });

  it('Update minimum blocks before liquidation emits event', async function () {
    await expect(ssvNetwork.updateLiquidationThresholdPeriod(9999999999999)).to.emit(ssvNetwork, 'LiquidationThresholdPeriodUpdate').withArgs(9999999999999);
  });

  it('Set network fee', async function () {
    expect(await ssvNetwork.getNetworkFee()).to.equal('0');
    await expect(ssvNetwork.updateNetworkFee(1)).to.emit(ssvNetwork, 'NetworkFeeUpdate').withArgs('0', '1');
    expect(await ssvNetwork.getNetworkFee()).to.equal('1');
    await progressBlocks(20);
    expect(await ssvNetwork.getNetworkEarnings()).to.equal(20);
  });

  it('Withdraw network fees', async function () {
    await expect(ssvNetwork.updateNetworkFee(1)).to.emit(ssvNetwork, 'NetworkFeeUpdate').withArgs('0', '1');
    await progressBlocks(20);
    await expect(ssvNetwork.connect(account2).withdrawNetworkEarnings(60)).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(ssvNetwork.withdrawNetworkEarnings(80)).to.be.revertedWith('NotEnoughBalance');
    await expect(ssvNetwork.withdrawNetworkEarnings(20)).to.emit(ssvToken, 'Transfer').withArgs(ssvNetwork.address, owner.address, '20');
    expect(await ssvNetwork.getNetworkEarnings()).to.equal(3);
    await expect(ssvNetwork.withdrawNetworkEarnings(60)).to.be.revertedWith('NotEnoughBalance');
  });

  it('Update declare operator fee period', async function () {
    await expect(ssvNetwork.updateDeclareOperatorFeePeriod(DAY));
    expect(await ssvNetwork.getDeclaredOperatorFeePeriod()).to.equal(DAY);
  });

  it('Update execute operator fee period', async function () {
    await expect(ssvNetwork.updateExecuteOperatorFeePeriod(DAY))
    expect(await ssvNetwork.getExecuteOperatorFeePeriod()).to.equal(DAY);
  });

  it('Create an operator with low fee', async function () {
    await expect(ssvNetwork.connect(account3).registerOperator('testOperator 5', operatorsIds[5], 1000)).to.be.revertedWith('FeeTooLow');
  });

  it('Fee change request', async function () {
    await expect(ssvNetwork.updateDeclareOperatorFeePeriod(DAY))
    await expect(ssvNetwork.updateExecuteOperatorFeePeriod(DAY))
    await ssvNetwork.connect(account3).declareOperatorFee(operatorsIds[3], '41000');
    expect(await ssvNetwork.getOperatorFee(operatorsIds[3])).to.equal(40000);
    const currentBlockTime = await utils.blockTimestamp();
    expect((await ssvNetwork.getOperatorDeclaredFee(operatorsIds[3])).map((v: any) => v.toString())).to.eql(['41000', (+currentBlockTime + DAY).toString(), (+currentBlockTime + 2 * DAY).toString()]);

    //approve fee too soon
    await expect(ssvNetwork.connect(account3).executeOperatorFee(operatorsIds[3])).to.be.revertedWith('ApprovalNotWithinTimeframe');

    // Approve too late
    await progressTime(3 * DAY)
    await expect(ssvNetwork.connect(account3).executeOperatorFee(operatorsIds[3])).to.be.revertedWith('ApprovalNotWithinTimeframe');

    // Cancel set operator fee
    await ssvNetwork.connect(account3).declareOperatorFee(operatorsIds[3], '41000');
    await ssvNetwork.connect(account3).cancelDeclaredOperatorFee(operatorsIds[3]);
    expect(await ssvNetwork.getOperatorFee(operatorsIds[3])).to.equal(40000);
    expect((await ssvNetwork.getOperatorDeclaredFee(operatorsIds[3])).map((v: any) => v.toString())).to.eql(['0', '0', '0']);

    // Approve fee on time
    await ssvNetwork.connect(account3).declareOperatorFee(operatorsIds[3], '41000');
    await progressTime(DAY * 15 / 10)
    await ssvNetwork.connect(account3).executeOperatorFee(operatorsIds[3])
    expect(await ssvNetwork.getOperatorFee(operatorsIds[3])).to.equal(41000);
    expect((await ssvNetwork.getOperatorDeclaredFee(operatorsIds[3])).map((v: any) => v.toString())).to.eql(['0', '0', '0']);

    // update fee with low fee
    await expect(ssvNetwork.connect(account3).declareOperatorFee(operatorsIds[3], 1000)).to.be.revertedWith('FeeTooLow');
  });

  it('Deposit account from another address', async function () {
    const balanceBefore = +await ssvNetwork.getAddressBalance(account4.address);
    const tokens = 10000;
    await ssvToken.connect(owner).approve(ssvNetwork.address, tokens)
    await ssvNetwork.connect(owner).deposit(account4.address, tokens);
    expect(await ssvNetwork.getAddressBalance(account4.address)).to.equal(balanceBefore + tokens);
  });
});