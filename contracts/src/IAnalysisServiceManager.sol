// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IAnalysisServiceManager {
    event NewTaskCreated(uint32 indexed taskIndex, Task task);

    event TaskResponded(uint32 indexed taskIndex, Task task, address operator);

    struct Task {
        string walletAdress;
        uint32 taskCreatedBlock;
    }

    function latestTaskNum() external view returns (uint32);

    function allTaskHashes(
        uint32 taskIndex
    ) external view returns (bytes32);

    function allTaskResponses(
        address operator,
        uint32 taskIndex
    ) external view returns (bytes memory);

    function createNewTask(
        string memory walletAdress
    ) external returns (Task memory);

    function respondToTask(
        Task calldata task,
        uint32 referenceTaskIndex,
        bytes calldata signature
    ) external;
}
