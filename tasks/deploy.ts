import { task } from "hardhat/config";
import { generateABI } from "./utils";

task("deploy:all", "Deploy SSVNetwork and SSVNetworkViews contracts")
    .addParam("tag", "Version of the contract")
    .setAction(async ({ tag }, hre) => {
        try {
            const ssvTokenAddress = process.env.SSV_TOKEN_ADDRESS;

            const [deployer] = await ethers.getSigners();
            console.log(`Deploying contracts with the account:${deployer.address}`);

            // deploy SSVNetwork
            const ssvNetworkFactory = await ethers.getContractFactory('SSVNetwork');
            console.log(`Deploying SSVNetwork with ssvToken ${ssvTokenAddress}`);
            const ssvNetwork = await upgrades.deployProxy(ssvNetworkFactory, [
                tag,
                ssvTokenAddress,
                process.env.OPERATOR_MAX_FEE_INCREASE,
                process.env.DECLARE_OPERATOR_FEE_PERIOD,
                process.env.EXECUTE_OPERATOR_FEE_PERIOD,
                process.env.MINIMUM_BLOCKS_BEFORE_LIQUIDATION,
                process.env.MINIMUM_LIQUIDATION_COLLATERAL
            ],
                {
                    kind: "uups"
                });
            await ssvNetwork.deployed();
            console.log(`SSVNetwork proxy deployed to: ${ssvNetwork.address}`);

            let implAddress = await upgrades.erc1967.getImplementationAddress(ssvNetwork.address);
            console.log(`SSVNetwork implementation deployed to: ${implAddress}`);

            // deploy SSVNetworkViews
            const ssvViewsFactory = await ethers.getContractFactory('SSVNetworkViews');
            console.log(`Deploying SSVNetworkViews with SSVNetwork ${ssvNetwork.address}...`);
            const viewsContract = await upgrades.deployProxy(ssvViewsFactory, [
                ssvNetwork.address
            ],
                {
                    kind: "uups"
                });
            await viewsContract.deployed();
            console.log(`SSVNetworkViews proxy deployed to: ${viewsContract.address}`);

            implAddress = await upgrades.erc1967.getImplementationAddress(viewsContract.address);
            console.log(`SSVNetworkViews implementation deployed to: ${implAddress}`);

            await generateABI(hre, ["SSVNetwork", "SSVNetworkViews"], [ssvNetwork.address, viewsContract.address]);
        } catch (error) {
            console.error(error);
            process.exitCode = 1;
        }
    });