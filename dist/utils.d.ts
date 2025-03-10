import { BigNumberish, ContractReceipt, ContractTransaction, Event } from 'ethers';
export declare const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export declare const ZERO_BYTES = "0x";
export declare const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export declare const getSchemaUID: (schema: string, resolverAddress: string, revocable: boolean) => string;
export declare const getUID: (schema: string, recipient: string, attester: string, time: BigNumberish, expirationTime: BigNumberish, revocable: boolean, refUID: string, data: string, bump: number) => string;
export declare const getOffchainUID: (version: number, schema: string, recipient: string, time: BigNumberish, expirationTime: BigNumberish, revocable: boolean, refUID: string, data: string) => string;
export declare const getUIDsFromMultiAttestTx: (res: Promise<ContractTransaction> | ContractTransaction) => Promise<string[]>;
export declare const getUIDFromAttestTx: (res: Promise<ContractTransaction> | ContractTransaction) => Promise<string>;
export declare const getUIDFromMultiDelegatedProxyAttestTx: (res: Promise<ContractTransaction> | ContractTransaction) => Promise<string[]>;
export declare const getUIDFromMultiDelegatedProxyAttestReceipt: (res: Promise<ContractReceipt> | ContractReceipt) => Promise<string[]>;
export declare const getUIDFromDelegatedProxyAttestTx: (res: Promise<ContractTransaction> | ContractTransaction) => Promise<string>;
export declare const getUIDFromDelegatedProxyAttestReceipt: (res: Promise<ContractReceipt> | ContractReceipt) => Promise<string>;
export declare const getUIDsFromAttestEvents: (events?: ReadonlyArray<any>) => string[];
export declare const getTimestampFromTimestampEvents: (events?: Event[]) => BigNumberish[];
export declare const getTimestampFromOffchainRevocationEvents: (events?: Event[]) => BigNumberish[];
