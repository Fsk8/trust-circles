// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TrustCircleFactory.sol";
import "../src/TrustCircle.sol";
import "../src/ReputationManager.sol";

contract TrustCircleTest is Test {
    ReputationManager internal rep;
    TrustCircleFactory internal factory;
    TrustCircle internal circle;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA01);
    address internal outsider = address(0x075);

    function setUp() external {
        rep = new ReputationManager();
        factory = new TrustCircleFactory(address(rep));
        rep.setFactory(address(factory));

        address[] memory members = new address[](0);

        address circleAddress =
            factory.createCircle("Main Circle", true, address(0), ITrustCircleTypes.TrustLevel.High, members, 1 ether);

        circle = TrustCircle(payable(circleAddress));
        circle.addMember(alice);
        circle.addMember(bob);

        vm.deal(address(this), 50 ether);
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
        vm.deal(carol, 50 ether);
        vm.deal(outsider, 50 ether);
    }

    function test_AddMember_OnlyOwnerAndNoInvalidMember() external {
        vm.prank(alice);
        vm.expectRevert();
        circle.addMember(carol);

        vm.expectRevert(bytes("TrustCircle: zero address"));
        circle.addMember(address(0));

        circle.addMember(carol);
        assertTrue(circle.isMember(carol));

        vm.expectRevert(bytes("TrustCircle: already member"));
        circle.addMember(carol);
    }

    function test_Contribute_OnlyMemberAndMinContribution() external {
        vm.prank(outsider);
        vm.expectRevert(bytes("TrustCircle: not a member"));
        circle.contribute{value: 1 ether}(0);

        vm.prank(alice);
        vm.expectRevert(bytes("TrustCircle: below minContribution"));
        circle.contribute{value: 0.5 ether}(0);

        uint256 prevRep = rep.getScore(alice);
        vm.prank(alice);
        circle.contribute{value: 2 ether}(0);

        assertEq(circle.totalPool(), 2 ether);
        assertEq(circle.contributions(alice), 2 ether);
        assertEq(rep.getScore(alice), prevRep + rep.POINTS_PER_CONTRIBUTION());
    }

    function test_RequestFlow_Approved_TransfersFunds() external {
        vm.prank(alice);
        circle.contribute{value: 5 ether}(0);

        uint256 aliceBefore = alice.balance;

        vm.prank(alice);
        circle.submitRequest(1 ether, "Medical emergency");

        vm.prank(bob);
        circle.vote(0, true);

        circle.executeRequest(0);

        (, , , , uint256 votesFor, uint256 votesAgainst, TrustCircle.RequestStatus status) = circle.getRequest(0);
        assertEq(votesFor, 1);
        assertEq(votesAgainst, 0);
        assertEq(uint256(status), uint256(TrustCircle.RequestStatus.Executed));
        assertEq(circle.totalPool(), 4 ether);
        assertEq(alice.balance, aliceBefore + 1 ether);
    }

    function test_RequestFlow_Rejected_PenalizesReputation() external {
        vm.prank(alice);
        circle.contribute{value: 3 ether}(0);

        uint256 repAfterContribution = rep.getScore(alice);

        vm.prank(alice);
        circle.submitRequest(1 ether, "Rejected request");

        vm.prank(address(this));
        circle.vote(0, false);
        vm.prank(bob);
        circle.vote(0, false);

        circle.executeRequest(0);

        (, , , , , , TrustCircle.RequestStatus status) = circle.getRequest(0);
        assertEq(uint256(status), uint256(TrustCircle.RequestStatus.Rejected));
        assertEq(rep.getScore(alice), repAfterContribution - rep.PENALTY_REJECTION());
    }

    function test_RequestFlow_Expired() external {
        vm.prank(alice);
        circle.contribute{value: 2 ether}(0);

        vm.prank(alice);
        circle.submitRequest(1 ether, "Late votes");

        vm.warp(block.timestamp + 25 hours);
        circle.executeRequest(0);

        (, , , , , , TrustCircle.RequestStatus status) = circle.getRequest(0);
        assertEq(uint256(status), uint256(TrustCircle.RequestStatus.Expired));
    }

    function test_Pause_BlocksOperations_ButAllowsExecute() external {
        vm.prank(alice);
        circle.contribute{value: 3 ether}(0);

        vm.prank(alice);
        circle.submitRequest(1 ether, "Approved before pause");
        vm.prank(bob);
        circle.vote(0, true);

        factory.pauseCircle(address(circle));
        assertTrue(circle.paused());

        vm.prank(alice);
        vm.expectRevert(bytes("TrustCircle: circle is paused"));
        circle.contribute{value: 1 ether}(0);

        vm.prank(alice);
        vm.expectRevert(bytes("TrustCircle: circle is paused"));
        circle.submitRequest(1 ether, "blocked");

        vm.prank(address(this));
        vm.expectRevert(bytes("TrustCircle: circle is paused"));
        circle.vote(0, true);

        circle.executeRequest(0);
        (, , , , , , TrustCircle.RequestStatus status) = circle.getRequest(0);
        assertEq(uint256(status), uint256(TrustCircle.RequestStatus.Executed));
    }

    function test_AdminRecovery_MajorityChangesOwner() external {
        factory.initiateAdminRecovery(address(circle), bob);

        vm.prank(alice);
        circle.voteAdminRecovery(true);
        vm.prank(bob);
        circle.voteAdminRecovery(true);

        vm.prank(alice);
        circle.executeAdminRecovery();

        assertEq(circle.owner(), bob);
        assertFalse(circle.recoveryActive());
    }

    function test_AdminRecovery_ExpiresAndCancels() external {
        factory.initiateAdminRecovery(address(circle), bob);

        vm.warp(block.timestamp + 73 hours);
        vm.prank(alice);
        circle.executeAdminRecovery();

        assertFalse(circle.recoveryActive());
    }
}
