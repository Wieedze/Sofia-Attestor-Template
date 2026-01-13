/**
 * MultiVault ABI (minimal - only functions needed for attestor)
 */
export const MultiVaultAbi = [
  // Approval
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "sender", type: "address" },
      { name: "approvalType", type: "uint8" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "approvals",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint8" }],
    stateMutability: "view"
  },

  // Atom Functions
  {
    type: "function",
    name: "calculateAtomId",
    inputs: [{ name: "data", type: "bytes" }],
    outputs: [{ name: "id", type: "bytes32" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "isTermCreated",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view"
  },

  // Cost Functions
  {
    type: "function",
    name: "getAtomCost",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getTripleCost",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view"
  },

  // Triple Functions
  {
    type: "function",
    name: "calculateTripleId",
    inputs: [
      { name: "subjectId", type: "bytes32" },
      { name: "predicateId", type: "bytes32" },
      { name: "objectId", type: "bytes32" }
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "getTriple",
    inputs: [{ name: "tripleId", type: "bytes32" }],
    outputs: [
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" }
    ],
    stateMutability: "view"
  },
] as const
