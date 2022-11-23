// Decalre imports
import * as helpers from '../helpers/contract-helpers';
import { expect } from 'chai';
import { GasGroup } from '../helpers/gas-usage';

// Decalre globals
let ssvNetworkContract: any, clusterResult1: any, clusterResult2: any, clusterResult3: any, minDepositAmount: any;

describe('Bulk Transfer Validator Tests', () => {
  beforeEach(async () => {
    // Initialize contract
    ssvNetworkContract = (await helpers.initializeContract()).contract;

    // Register operators
    await helpers.registerOperators(0, 15, helpers.CONFIG.minimalOperatorFee);

    minDepositAmount = (helpers.CONFIG.minimalBlocksBeforeLiquidation + 2) * helpers.CONFIG.minimalOperatorFee * 4;

    // Register validators
    clusterResult1 = await helpers.registerValidators(4, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
    clusterResult2 = await helpers.registerValidators(4, 9, `${minDepositAmount * 9}`, helpers.DataGenerator.cluster.byId(clusterResult1.clusterId), [GasGroup.REGISTER_VALIDATOR_EXISTING_CLUSTER]);
    clusterResult3 = await helpers.registerValidators(4, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
  });

  it('Bulk transfer validators emits "BulkValidatorTransferred"', async () => {
    await helpers.registerPodAndDeposit(4, helpers.DataGenerator.cluster.byId(clusterResult3.clusterId), `${minDepositAmount * (clusterResult2.validators.length + 1) }`);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length + 1).fill(helpers.DataGenerator.shares(0)),
    )).to.emit(ssvNetworkContract, 'BulkValidatorTransferred');
  });

  it('Bulk transfer validators I do not own reverts "ValidatorNotOwned"', async () => {
    await helpers.registerPodAndDeposit(5, helpers.DataGenerator.cluster.byId(clusterResult3.clusterId), `${minDepositAmount * (clusterResult2.validators.length + 1) }`);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[5]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length + 1).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('ValidatorNotOwned');
  });

  it('Bulk transfer validators with a validator I do not own reverts "ValidatorNotOwned"', async () => {
    const account5cluster = await helpers.registerValidators(5, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
    await helpers.registerPodAndDeposit(4, helpers.DataGenerator.cluster.byId(clusterResult3.clusterId), `${minDepositAmount * (clusterResult2.validators.length + 1) }`);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, account5cluster.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length + 2).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('ValidatorNotOwned');
  });

  it('Bulk transfer validators with an invalid public key reverts "InvalidPublicKeyLength"', async () => {
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, helpers.DataGenerator.shares(0), ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length + 2).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('InvalidPublicKeyLength');
  });

  it('Bulk transfer 10 validators', async () => {
    await helpers.bulkTransferValidator(
      4,
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      `${minDepositAmount * 10 }`,
      [GasGroup.BULK_TRANSFER_VALIDATOR]);
  });

  it('Bulk transfer 10 validators to a cluster with 7 operators', async () => {
    // Register validator with 7 operators
    const { clusterId } = await helpers.registerValidators(4, 1, `${(minDepositAmount / 4) * 7}`, [1, 2, 3, 4, 5, 6, 7]);

    // Transfer validator to an existing cluster
    await helpers.bulkTransferValidator(
      4,
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterId,
      `${(minDepositAmount / 4) * 7 * 10}`,
      [GasGroup.BULK_TRANSFER_VALIDATOR_NON_EXISTING_POD]);
  });

  it('Bulk transfer 10 validators to cluster created by other owner', async () => {
    // Register validator with 7 operators
    const { clusterId } = await helpers.registerValidators(5, 1, minDepositAmount, helpers.DataGenerator.cluster.new(), [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);

    // Bulk transfer 10 validators
    await helpers.bulkTransferValidator(
      4,
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterId,
      `${minDepositAmount * 10}`,
      [GasGroup.BULK_TRANSFER_VALIDATOR_NON_EXISTING_POD]);
  });

  it('Bulk transfer 10 validators to non exsisten cluster "ClusterNotExists"', async () => {
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId.slice(0, -1) + 'a',
      clusterResult1.clusterId,
      Array(clusterResult2.validators.length + 1).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('ClusterNotExists');
  });

  it('Validator and share length mismatch reverts "ParametersMismatch"', async () => {
    // 10 validators and 11 shares
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('ParametersMismatch');

    // 9 validators and 8 shares
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      clusterResult2.validators.map((validator: any) => validator.publicKey),
      clusterResult1.clusterId,
      clusterResult3.clusterId,
      Array(clusterResult2.validators.length - 1).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('ParametersMismatch');
  });

  it('Bulk transfer validator with not enough amount reverts "PodLiquidatable"', async () => {
    const { clusterId } = await helpers.registerValidators(5, 1, minDepositAmount, [9, 10, 11, 12], [GasGroup.REGISTER_VALIDATOR_NEW_STATE]);
    await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
      [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
      clusterResult1.clusterId,
      clusterId,
      Array(clusterResult2.validators.length + 1).fill(helpers.DataGenerator.shares(0)),
    )).to.be.revertedWith('PodLiquidatable');
  });

  // TODO: fix after connecting the token
  it('Bulk transfer validator with not enough balance', async () => {
    // await expect(ssvNetworkContract.connect(helpers.DB.owners[4]).bulkTransferValidators(
    //   [clusterResult1.validators[0].publicKey, ...clusterResult2.validators.map((validator: any) => validator.publicKey)],
    //   clusterResult1.clusterId,
    //   clusterResult3.clusterId,
    //   Array(clusterResult2.validators.length + 1).fill(helpers.DataGenerator.shares(0)),
    //   '10000000'
    // )).to.be.revertedWith('NotEnoughDeposited');
  });
});
