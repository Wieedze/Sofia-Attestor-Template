/**
 * SofiaFeeProxy ABI
 * Proxy contract for Intuition MultiVault with fee collection
 */
export const SofiaFeeProxyAbi = [
  // Fee Calculation
  {
    inputs: [
      { name: "depositCount", type: "uint256" },
      { name: "totalDeposit", type: "uint256" }
    ],
    name: "calculateDepositFee",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "depositCount", type: "uint256" },
      { name: "totalDeposit", type: "uint256" },
      { name: "multiVaultCost", type: "uint256" }
    ],
    name: "getTotalCreationCost",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "baseFee",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },

  // Create Operations
  {
    inputs: [
      { name: "receiver", type: "address" },
      { name: "data", type: "bytes[]" },
      { name: "assets", type: "uint256[]" },
      { name: "curveId", type: "uint256" }
    ],
    name: "createAtoms",
    outputs: [{ name: "atomIds", type: "bytes32[]" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "receiver", type: "address" },
      { name: "subjectIds", type: "bytes32[]" },
      { name: "predicateIds", type: "bytes32[]" },
      { name: "objectIds", type: "bytes32[]" },
      { name: "assets", type: "uint256[]" },
      { name: "curveId", type: "uint256" }
    ],
    name: "createTriples",
    outputs: [{ name: "tripleIds", type: "bytes32[]" }],
    stateMutability: "payable",
    type: "function"
  },

  // View Functions (passthrough)
  {
    inputs: [],
    name: "getAtomCost",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getTripleCost",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
] as const
