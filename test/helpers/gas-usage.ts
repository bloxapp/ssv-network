import { expect } from 'chai';

export enum GasGroup {
  REGISTER_OPERATOR,
  REMOVE_OPERATOR,
  REGISTER_VALIDATOR_EXISTING_POD,
  REGISTER_VALIDATOR_EXISTING_CLUSTER,
  REGISTER_VALIDATOR_NEW_STATE,
  REMOVE_VALIDATOR,
  TRANSFER_VALIDATOR_NEW_CLUSTER,
  TRANSFER_VALIDATOR,
  TRANSFER_VALIDATOR_NON_EXISTING_POD,
  BULK_TRANSFER_VALIDATOR,
  BULK_TRANSFER_VALIDATOR_NON_EXISTING_POD,
  DEPOSIT,
  WITHDRAW,
  REGISTER_POD,
  LIQUIDATE_POD,
  REACTIVATE_POD,
}

const MAX_GAS_PER_GROUP: any =
  process.env.IS_TEST_SOL_COV === '1' ? {
    /* SOLIDITY COVERAGE INCREASED GAS LIMITS ONLY!!!! */
    [GasGroup.REGISTER_OPERATOR]: 110000,
    [GasGroup.REMOVE_OPERATOR]: 50000,
    [GasGroup.REGISTER_VALIDATOR_EXISTING_POD]: 240000,
    [GasGroup.REGISTER_VALIDATOR_EXISTING_CLUSTER]: 250000,
    [GasGroup.REGISTER_VALIDATOR_NEW_STATE]: 320000,
    [GasGroup.REMOVE_VALIDATOR]: 150000,
    [GasGroup.TRANSFER_VALIDATOR_NEW_CLUSTER]: 410000,
    [GasGroup.TRANSFER_VALIDATOR]: 280000,
    [GasGroup.TRANSFER_VALIDATOR_NON_EXISTING_POD]: 240000,
    [GasGroup.BULK_TRANSFER_VALIDATOR]: 440000,
    [GasGroup.BULK_TRANSFER_VALIDATOR_NON_EXISTING_POD]: 460000,
    [GasGroup.DEPOSIT]: 85000,
    [GasGroup.WITHDRAW]: 120000,
    [GasGroup.REGISTER_POD]: 150000,
    [GasGroup.LIQUIDATE_POD]: 190000,
    [GasGroup.REACTIVATE_POD]: 200000,
  } : {
    /* REAL GAS LIMITS */
    [GasGroup.REGISTER_OPERATOR]: 105000,
    [GasGroup.REMOVE_OPERATOR]: 45000,
    [GasGroup.REGISTER_VALIDATOR_EXISTING_POD]: 199000,
    [GasGroup.REGISTER_VALIDATOR_EXISTING_CLUSTER]: 216000,
    [GasGroup.REGISTER_VALIDATOR_NEW_STATE]: 313000,
    [GasGroup.REMOVE_VALIDATOR]: 120000,
    [GasGroup.TRANSFER_VALIDATOR_NEW_CLUSTER]: 400000,
    [GasGroup.TRANSFER_VALIDATOR]: 260000,
    [GasGroup.TRANSFER_VALIDATOR_NON_EXISTING_POD]: 290000,
    [GasGroup.BULK_TRANSFER_VALIDATOR]: 366000,
    [GasGroup.BULK_TRANSFER_VALIDATOR_NON_EXISTING_POD]: 383000,
    [GasGroup.DEPOSIT]: 77500,
    [GasGroup.WITHDRAW]: 102000,
    [GasGroup.REGISTER_POD]: 137000,
    [GasGroup.LIQUIDATE_POD]: 156000,
    [GasGroup.REACTIVATE_POD]: 163000,
  };

class GasStats {
  max: number | null = null;
  min: number | null = null;
  totalGas = 0;
  txCount = 0;


  addStat(gas: number) {
    this.totalGas += gas;
    ++this.txCount;
    this.max = Math.max(gas, (this.max === null) ? -Infinity : this.max);
    this.min = Math.min(gas, (this.min === null) ? Infinity : this.min);
  }

  get average(): number {
    return this.totalGas / this.txCount;
  }
}

const gasUsageStats = new Map();

for (const group in MAX_GAS_PER_GROUP) {
  gasUsageStats.set(group, new GasStats());
}

export const trackGas = async (tx: Promise<any>, groups?: Array<GasGroup>): Promise<any> => {
  const receipt = await (await tx).wait();

  groups && [...new Set(groups)].forEach(group => {
    const gasUsed = parseInt(receipt.gasUsed);

    if (!process.env.NO_GAS_ENFORCE) {
      const maxGas = MAX_GAS_PER_GROUP[group];
      expect(gasUsed).to.be.lessThanOrEqual(maxGas, 'gasUsed higher than max allowed gas');
    }

    gasUsageStats.get(group.toString()).addStat(gasUsed);
  });
  return {
    ...receipt,
    gasUsed: +receipt.gasUsed,
    eventsByName: receipt.events.reduce((aggr: any, item: any) => {
      aggr[item.event] = aggr[item.event] || [];
      aggr[item.event].push(item);
      return aggr;
    }, {}) };
};

export const getGasStats = (group: string) => {
  return gasUsageStats.get(group) || new GasStats();
};

