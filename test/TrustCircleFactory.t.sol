// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TrustCircleFactory.sol";
import "../src/TrustCircle.sol";
import "../src/ReputationManager.sol";
import "./mocks/MockERC20.sol";

contract TrustCircleFactoryTest is Test {
    ReputationManager internal rep;
    TrustCircleFactory internal factory;
    MockERC20 internal token;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() external {
        rep = new ReputationManager();
        factory = new TrustCircleFactory(address(rep));
        rep.setFactory(address(factory));
        token = new MockERC20();
    }

    function test_CreateCircle_Validations() external {
        address[] memory members = new address[](0);

        vm.expectRevert(bytes("Factory: empty name"));
        factory.createCircle("", true, address(0), ITrustCircleTypes.TrustLevel.High, members, 1);

        vm.expectRevert(bytes("Factory: min=0"));
        factory.createCircle("A", true, address(0), ITrustCircleTypes.TrustLevel.High, members, 0);

        vm.expectRevert(bytes("Factory: token!=0 for AVAX"));
        factory.createCircle("A", true, address(token), ITrustCircleTypes.TrustLevel.High, members, 1);

        vm.expectRevert(bytes("Factory: token=0 for ERC20"));
        factory.createCircle("A", false, address(0), ITrustCircleTypes.TrustLevel.High, members, 1);

        vm.expectRevert(bytes("Factory: token not contract"));
        factory.createCircle("A", false, alice, ITrustCircleTypes.TrustLevel.High, members, 1);
    }

    function test_CreateCircle_RegistersMetadataAndViews() external {
        address[] memory members = new address[](0);

        address circleAddress =
            factory.createCircle("Circle 1", true, address(0), ITrustCircleTypes.TrustLevel.Medium, members, 1 ether);

        assertTrue(factory.isRegisteredCircle(circleAddress));
        assertEq(factory.circleCount(), 1);
        assertEq(factory.getAllCircles()[0], circleAddress);

        (
            address storedCircle,
            address admin,
            string memory name,
            bool isNative,
            address tokenAddress,
            ITrustCircleTypes.TrustLevel level,
            uint256 createdAt
        ) = factory.circleInfo(circleAddress);

        assertEq(storedCircle, circleAddress);
        assertEq(admin, address(this));
        assertEq(name, "Circle 1");
        assertTrue(isNative);
        assertEq(tokenAddress, address(0));
        assertEq(uint256(level), uint256(ITrustCircleTypes.TrustLevel.Medium));
        assertGt(createdAt, 0);

        address[] memory byAdmin = factory.getCirclesByAdmin(address(this));
        assertEq(byAdmin.length, 1);
        assertEq(byAdmin[0], circleAddress);
    }

    function test_Callbacks_OnlyRegisteredCircle() external {
        vm.expectRevert(bytes("Factory: not a circle"));
        factory.onContribution(alice, 1);

        vm.expectRevert(bytes("Factory: not a circle"));
        factory.onRequestRejected(alice);

        address[] memory members = new address[](0);
        address circleAddress =
            factory.createCircle("Circle 2", true, address(0), ITrustCircleTypes.TrustLevel.High, members, 1);

        uint256 beforeRep = rep.getScore(alice);
        vm.prank(circleAddress);
        factory.onContribution(alice, 1 ether);
        assertEq(rep.getScore(alice), beforeRep + rep.POINTS_PER_CONTRIBUTION());

        vm.prank(circleAddress);
        factory.onRequestRejected(alice);
        assertEq(rep.getScore(alice), beforeRep + rep.POINTS_PER_CONTRIBUTION() - rep.PENALTY_REJECTION());
    }

    function test_KillSwitch_And_AdminRecovery_AreOwnerOnly() external {
        address[] memory members = new address[](0);
        address circleAddress =
            factory.createCircle("Circle 3", true, address(0), ITrustCircleTypes.TrustLevel.High, members, 1);

        TrustCircle(payable(circleAddress)).addMember(bob);

        vm.prank(alice);
        vm.expectRevert();
        factory.pauseCircle(circleAddress);

        factory.pauseCircle(circleAddress);
        assertTrue(TrustCircle(payable(circleAddress)).paused());

        factory.unpauseCircle(circleAddress);
        assertFalse(TrustCircle(payable(circleAddress)).paused());

        vm.prank(alice);
        vm.expectRevert();
        factory.initiateAdminRecovery(circleAddress, bob);

        factory.initiateAdminRecovery(circleAddress, bob);
        assertTrue(TrustCircle(payable(circleAddress)).recoveryActive());
    }
}
