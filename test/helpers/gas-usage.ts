import { expect } from 'chai';

export enum GasGroup {
  REGISTER_OPERATOR,
  REMOVE_OPERATOR,
  REMOVE_OPERATOR_WITH_WITHDRAW,
  REGISTER_VALIDATOR_EXISTING_POD,
  REGISTER_VALIDATOR_NEW_STATE,
  REGISTER_VALIDATOR_WITHOUT_DEPOSIT,

  REGISTER_VALIDATOR_EXISTING_POD_7,
  REGISTER_VALIDATOR_NEW_STATE_7,
  REGISTER_VALIDATOR_WITHOUT_DEPOSIT_7,

  REGISTER_VALIDATOR_EXISTING_POD_10,
  REGISTER_VALIDATOR_NEW_STATE_10,
  REGISTER_VALIDATOR_WITHOUT_DEPOSIT_10,

  REGISTER_VALIDATOR_EXISTING_POD_13,
  REGISTER_VALIDATOR_NEW_STATE_13,
  REGISTER_VALIDATOR_WITHOUT_DEPOSIT_13,

  REMOVE_VALIDATOR,
  DEPOSIT,
  WITHDRAW_POD_BALANCE,
  WITHDRAW_OPERATOR_BALANCE,
  LIQUIDATE_POD_4,
  LIQUIDATE_POD_7,
  LIQUIDATE_POD_10,
  LIQUIDATE_POD_13,
  REACTIVATE_POD,
}

const MAX_GAS_PER_GROUP: any = {
  /* REAL GAS LIMITS */
  [GasGroup.REGISTER_OPERATOR]: 134000,
  [GasGroup.REMOVE_OPERATOR]: 62600,
  [GasGroup.REMOVE_OPERATOR_WITH_WITHDRAW]: 62000,

  [GasGroup.REGISTER_VALIDATOR_EXISTING_POD]: 228800,
  [GasGroup.REGISTER_VALIDATOR_NEW_STATE]: 245600,
  [GasGroup.REGISTER_VALIDATOR_WITHOUT_DEPOSIT]: 208400,

  [GasGroup.REGISTER_VALIDATOR_EXISTING_POD_7]: 300000,
  [GasGroup.REGISTER_VALIDATOR_NEW_STATE_7]: 316800,
  [GasGroup.REGISTER_VALIDATOR_WITHOUT_DEPOSIT_7]: 279500,

  [GasGroup.REGISTER_VALIDATOR_EXISTING_POD_10]: 371600,
  [GasGroup.REGISTER_VALIDATOR_NEW_STATE_10]: 388400,
  [GasGroup.REGISTER_VALIDATOR_WITHOUT_DEPOSIT_10]: 351100,

  [GasGroup.REGISTER_VALIDATOR_EXISTING_POD_13]: 442900,
  [GasGroup.REGISTER_VALIDATOR_NEW_STATE_13]: 459650,
  [GasGroup.REGISTER_VALIDATOR_WITHOUT_DEPOSIT_13]: 422400,

  [GasGroup.REMOVE_VALIDATOR]: 109000,
  [GasGroup.DEPOSIT]: 77500,
  [GasGroup.WITHDRAW_POD_BALANCE]: 90700,
  [GasGroup.WITHDRAW_OPERATOR_BALANCE]: 56600,
  [GasGroup.LIQUIDATE_POD_4]: 125700,
  [GasGroup.LIQUIDATE_POD_7]: 164000,
  [GasGroup.LIQUIDATE_POD_10]: 203550,
  [GasGroup.LIQUIDATE_POD_13]: 243500,
  [GasGroup.REACTIVATE_POD]: 126600,
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
    }, {})
  };
};

export const getGasStats = (group: string) => {
  return gasUsageStats.get(group) || new GasStats();
};

