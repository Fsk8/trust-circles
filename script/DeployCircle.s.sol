// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TrustCircleFactory.sol";

contract DeployCircle is Script {
    function run() external returns (address circleAddress) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");

        string memory name = vm.envString("CIRCLE_NAME");
        bool isNative = vm.envBool("CIRCLE_IS_NATIVE");
        address tokenAddress = vm.envAddress("CIRCLE_TOKEN_ADDRESS");
        uint8 trustLevelRaw = uint8(vm.envUint("CIRCLE_TRUST_LEVEL"));
        uint256 minContribution = vm.envUint("CIRCLE_MIN_CONTRIBUTION");

        require(trustLevelRaw <= uint8(ITrustCircleTypes.TrustLevel.Low), "Invalid trust level");

        address[] memory initialMembers = new address[](0);

        vm.startBroadcast(deployerPk);
        circleAddress = TrustCircleFactory(factoryAddress).createCircle(
            name,
            isNative,
            tokenAddress,
            ITrustCircleTypes.TrustLevel(trustLevelRaw),
            initialMembers,
            minContribution
        );
        vm.stopBroadcast();
    }
}
