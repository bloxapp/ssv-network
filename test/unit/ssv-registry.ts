import { ethers, upgrades } from 'hardhat';
import { solidity } from 'ethereum-waffle';

import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { rawListeners } from 'process';

import { progressBlocks, progressTime, snapshot } from '../helpers/utils';

declare var network: any;

before(() => {
  chai.should();
  chai.use(chaiAsPromised);
});

const { expect } = chai;

const operatorPublicKeyPrefix = '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345';
const validatorPublicKeyPrefix = '98765432109876543210987654321098765432109876543210987654321098765432109876543210987654321098765';

//@ts-ignore
let ssvRegistry: any;
//@ts-ignore
let owner: any, account1: any, account2: any, account3: any, account4: any;

const operatorsPub = Array.from(Array(10).keys()).map(k => `0x${operatorPublicKeyPrefix}${k}`);
const validatorsPub = Array.from(Array(10).keys()).map(k => `0x${validatorPublicKeyPrefix}${k}`);
const operatorsIds = Array.from(Array(10).keys()).map(k => k + 1);

const validatorsPerOperatorLimit = 2000;

describe('SSV Registry', function() {
  before(async function () {
    [owner, account1, account2, account3] = await ethers.getSigners();
    const ssvRegistryFactory = await ethers.getContractFactory('SSVRegistry');
    ssvRegistry = await upgrades.deployProxy(ssvRegistryFactory, [validatorsPerOperatorLimit]);
    await ssvRegistry.deployed();
    await ssvRegistry.registerOperator('testOperator 0', account1.address, operatorsPub[0], 10);
    await ssvRegistry.registerOperator('testOperator 1', account1.address, operatorsPub[1], 20);
    await ssvRegistry.registerOperator('testOperator 2', account1.address, operatorsPub[2], 30);
    await ssvRegistry.registerOperator('testOperator 3', account2.address, operatorsPub[3], 40);
    await ssvRegistry.registerOperator('testOperator 4', account2.address, operatorsPub[4], 50);
    await ssvRegistry.registerValidator(account1.address, validatorsPub[0], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4));
    await ssvRegistry.registerValidator(account1.address, validatorsPub[1], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4));
    await ssvRegistry.registerValidator(account2.address, validatorsPub[2], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4));
  });

  it('operator limit', async function() {
    await snapshot(async () => {
      expect(await ssvRegistry.validatorsPerOperatorCount(operatorsIds[0])).to.equal(3);
      expect(await ssvRegistry.getValidatorsPerOperatorLimit()).to.equal(2000);
      await ssvRegistry.setValidatorsPerOperatorLimit(2);
      expect(await ssvRegistry.getValidatorsPerOperatorLimit()).to.equal(2);
      await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 7), operatorsPub.slice(0, 7), operatorsPub.slice(0, 7))).to.be.revertedWith('exceed validator limit');
    });
  });

  it('register validators with errors', async () => {
    await expect(ssvRegistry.registerValidator(account3.address, "0x12345678", operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4))).to.be.revertedWith('invalid public key length');
    await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 3), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4))).to.be.revertedWith('OESS data structure is not valid');
    await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 4), operatorsPub.slice(0, 3), operatorsPub.slice(0, 4))).to.be.revertedWith('OESS data structure is not valid');
    await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 3))).to.be.revertedWith('OESS data structure is not valid');
    await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 1), operatorsPub.slice(0, 1), operatorsPub.slice(0, 1))).to.be.revertedWith('OESS data structure is not valid');
    await expect(ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 3), operatorsPub.slice(0, 3), operatorsPub.slice(0, 3))).to.be.revertedWith('OESS data structure is not valid');
  });

  it('register a valid validator', async () => {
    await ssvRegistry.registerValidator(account3.address, validatorsPub[3], operatorsIds.slice(0, 4), operatorsPub.slice(0, 4), operatorsPub.slice(0, 4));
  });

  it('validators getter', async () => {
    expect((await ssvRegistry.validators(validatorsPub[0])).map((v: any) => v.toString())).to.eql([account1.address, validatorsPub[0], 'true']);
    expect((await ssvRegistry.validators(validatorsPub[1])).map((v: any) => v.toString())).to.eql([account1.address, validatorsPub[1], 'true']);
    expect((await ssvRegistry.validators(validatorsPub[2])).map((v: any) => v.toString())).to.eql([account2.address, validatorsPub[2], 'true']);
  });

  it('get validators by address', async () => {
    expect(await ssvRegistry.getValidatorsByAddress(account1.address)).to.eql([validatorsPub[0], validatorsPub[1]]);
    expect(await ssvRegistry.getValidatorsByAddress(account2.address)).to.eql([validatorsPub[2]]);
  });

  it('get validator owner', async () => {
    expect(await ssvRegistry.getValidatorOwner(validatorsPub[0])).to.equal(account1.address);
    expect(await ssvRegistry.getValidatorOwner(validatorsPub[2])).to.equal(account2.address);
  });

  it('disable owner validators', async () => {
    expect(await ssvRegistry.isOwnerValidatorsDisabled(account1.address)).to.equal(false);
    await ssvRegistry.disableOwnerValidators(account1.address);
    expect(await ssvRegistry.isOwnerValidatorsDisabled(account1.address)).to.equal(true);
  })

  it('enable owner validators', async () => {
    expect(await ssvRegistry.isOwnerValidatorsDisabled(account1.address)).to.equal(true);
    await ssvRegistry.enableOwnerValidators(account1.address);
    expect(await ssvRegistry.isOwnerValidatorsDisabled(account1.address)).to.equal(false);
  })
});