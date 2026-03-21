// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ReputationManager.sol";

contract ReputationManagerTest is Test {
    ReputationManager internal rep;

    address internal owner = address(this);
    address internal factory = address(0xFAc7);
    address internal user = address(0xBEEF);
    address internal stranger = address(0xDEAD);

    function setUp() external {
        rep = new ReputationManager();
    }

    function test_GetScore_DefaultInitialReputation() external view {
        assertEq(rep.getScore(user), rep.INITIAL_REPUTATION());
    }

    function test_SetFactory_OnlyOwnerAndNoZeroAddress() external {
        vm.prank(stranger);
        vm.expectRevert();
        rep.setFactory(factory);

        vm.expectRevert(bytes("RepMgr: zero address"));
        rep.setFactory(address(0));

        rep.setFactory(factory);
        assertEq(rep.factory(), factory);
    }

    function test_Increase_OnlyAuthorized() external {
        vm.prank(stranger);
        vm.expectRevert(bytes("RepMgr: not authorized"));
        rep.increase(user);

        rep.increase(user);
        assertEq(rep.score(user), rep.INITIAL_REPUTATION() + rep.POINTS_PER_CONTRIBUTION());

        rep.setFactory(factory);
        vm.prank(factory);
        rep.increase(user);
        assertEq(rep.score(user), rep.INITIAL_REPUTATION() + (2 * rep.POINTS_PER_CONTRIBUTION()));
    }

    function test_Decrease_ClampsToZero_NoUnderflow() external {
        rep.decrease(user);
        assertEq(rep.score(user), rep.INITIAL_REPUTATION() - rep.PENALTY_REJECTION());

        rep.decrease(user);
        rep.decrease(user);
        rep.decrease(user);
        rep.decrease(user);
        assertEq(rep.score(user), 0);
    }
}
