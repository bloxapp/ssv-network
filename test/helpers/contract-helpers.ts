// Imports
declare const ethers: any;
declare const upgrades: any;

import { trackGas, GasGroup } from './gas-usage';

export let DB: any;
export let CONFIG: any;

export const DataGenerator = {
  publicKey: (index: number) => `0x${index.toString(16).padStart(96, '1')}`,
  shares: (index: number) => `0x${index.toString(16).padStart(360, '1')}`,
  cluster: {
    new: (size = 4) => {
      const usedOperatorIds: any = {};
      for (const clusterId in DB.clusters) {
        for (const operatorId of DB.clusters[clusterId].operatorIds) {
          usedOperatorIds[operatorId] = true;
        }
      }

      const result = [];
      for (const operator of DB.operators) {
        if (operator && !usedOperatorIds[operator.id]) {
          result.push(operator.id);
          usedOperatorIds[operator.id] = true;

          if (result.length == size) {
            break;
          }
        }
      }
      if (result.length < size) {
        throw new Error('No new clusters. Try to register more operators.');
      }

      return result;
    },
    byId: (id: any) => DB.clusters[id].operatorIds
  }
};

export const initializeContract = async () => {
  CONFIG = {
    operatorMaxFeeIncrease: 1000,
    declareOperatorFeePeriod: 3600, // HOUR
    executeOperatorFeePeriod: 86400, // DAY
    minimalOperatorFee: 100000000,
    minimalBlocksBeforeLiquidation: 50,
  };

  DB = {
    owners: [],
    validators: [],
    operators: [],
    clusters: [],
    ssvNetwork: {},
    ssvToken: {},
  };

  // Define accounts
  DB.owners = await ethers.getSigners();

  // Initialize contract
  const ssvNetwork = await ethers.getContractFactory('SSVNetwork');
  const ssvToken = await ethers.getContractFactory('SSVTokenMock');

  DB.ssvToken = await ssvToken.deploy();
  await DB.ssvToken.deployed();

  DB.ssvNetwork.contract = await upgrades.deployProxy(ssvNetwork, [
    DB.ssvToken.address,
    CONFIG.operatorMaxFeeIncrease,
    CONFIG.declareOperatorFeePeriod,
    CONFIG.executeOperatorFeePeriod
  ]);

  await DB.ssvNetwork.contract.deployed();

  DB.ssvNetwork.owner = DB.owners[0];

  return { contract: DB.ssvNetwork.contract, owner: DB.ssvNetwork.owner };
};

export const registerOperators = async (ownerId: number, numberOfOperators: number, fee: string, gasGroups: GasGroup[] = [GasGroup.REGISTER_OPERATOR]) => {
  for (let i = 0; i < numberOfOperators; ++i) {
    const { eventsByName } = await trackGas(
      DB.ssvNetwork.contract.connect(DB.owners[ownerId]).registerOperator(DataGenerator.publicKey(i), fee),
      gasGroups
    );
    const event = eventsByName.OperatorAdded[0];
    DB.operators[event.args.id] = {
      id: event.args.id, ownerId: ownerId, publicKey: DataGenerator.publicKey(i)
    };
  }
};

export const deposit = async (ownerIds: number[], amounts: string[]) => {
  // for (let i = 0; i < ownerIds.length; ++i) {
  //   await DB.ssvNetwork.contract.connect(DB.owners[ownerIds[i]]).deposit(amounts[i]);
  // }
};

export const registerValidators = async (ownerId: number, numberOfValidators: number, amount: string, operatorIds: number[], gasGroups?: GasGroup[]) => {
  const validators: any = [];
  let clusterId: any;

  // Register validators to contract
  for (let i = 0; i < numberOfValidators; i++) {
    const publicKey = DataGenerator.publicKey(DB.validators.length);
    const shares = DataGenerator.shares(DB.validators.length);

    const { eventsByName } = await trackGas(DB.ssvNetwork.contract.connect(DB.owners[ownerId]).registerValidator(
      publicKey,
      operatorIds,
      shares,
      amount,
    ), gasGroups);

    clusterId = eventsByName.ValidatorAdded[0].args.podId;
    DB.clusters[clusterId] = ({ id: clusterId, operatorIds });
    DB.validators.push({ publicKey, clusterId, shares });
    validators.push({ publicKey, shares });
  }

  return { validators, clusterId };
};

export const transferValidator = async (ownerId: number, publicKey: string, operatorIds: number[], amount: string, gasGroups?: GasGroup[]) => {
  let podId: any;
  const shares = DataGenerator.shares(DB.validators.length);

  // Transfer validator
  const { eventsByName } = await trackGas(DB.ssvNetwork.contract.connect(DB.owners[ownerId]).transferValidator(
    publicKey,
    operatorIds,
    shares,
    amount,
  ), gasGroups);

  // FOR ADAM TO UPDATE
  // podId = eventsByName.ValidatorTransferred[0].args.podId;
  // DB.clusters[podId] = ({ id: podId, operatorIds });
  // DB.validators[publicKey].podId = podId;
  // DB.validators[publicKey].shares = shares;

  // return { podId };
};


export const bulkTransferValidator = async (ownerId: number, publicKey: string[], fromCluster: string, toCluster: string, amount: string, gasGroups?: GasGroup[]) => {
  let podId: any;
  const shares = Array(publicKey.length).fill(DataGenerator.shares(0));

  // Bulk transfer validators
  const { eventsByName } = await trackGas(DB.ssvNetwork.contract.connect(DB.owners[ownerId]).bulkTransferValidators(
    publicKey,
    fromCluster,
    toCluster,
    shares,
    amount,
  ), gasGroups);

  // FOR ADAM TO UPDATE
  // podId = eventsByName.ValidatorTransferred[0].args.podId;
  // DB.clusters[podId] = ({ id: podId, operatorIds });
  // DB.validators[publicKey].podId = podId;
  // DB.validators[publicKey].shares = shares;

  // return { podId };
};
