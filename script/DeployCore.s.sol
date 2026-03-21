// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ReputationManager.sol";
import "../src/TrustCircleFactory.sol";

contract DeployCore is Script {
    function run() external returns (address reputationManager, address factory) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPk);

        ReputationManager rep = new ReputationManager();
        TrustCircleFactory fac = new TrustCircleFactory(address(rep));
        rep.setFactory(address(fac));

        vm.stopBroadcast();

        reputationManager = address(rep);
        factory = address(fac);
    }
}
