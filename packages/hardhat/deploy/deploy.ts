import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEBandChoice = await deploy("FHEBandChoice", {
    from: deployer,
    log: true,
  });

  console.log(`FHEBandChoice contract: `, deployedFHEBandChoice.address);
};
export default func;
func.id = "deploy_FHEBandChoice"; // id required to prevent reexecution
func.tags = ["FHEBandChoice"];
