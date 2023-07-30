import { EIP712Proxy } from './eip712-proxy';
import { Delegated, Offchain, OFFCHAIN_ATTESTATION_VERSION } from './offchain';
import {
  AttestationRequest,
  DelegatedAttestationRequest,
  DelegatedProxyAttestationRequest,
  DelegatedProxyRevocationRequest,
  DelegatedRevocationRequest,
  MultiAttestationRequest,
  MultiDelegatedAttestationRequest,
  MultiDelegatedProxyAttestationRequest,
  MultiDelegatedProxyRevocationRequest,
  MultiDelegatedRevocationRequest,
  MultiRevocationRequest,
  NO_EXPIRATION,
  RevocationRequest
} from './request';
import { Base, SignerOrProvider, Transaction } from './transaction';
import {
  getTimestampFromOffchainRevocationEvents,
  getTimestampFromTimestampEvents,
  getUIDsFromAttestEvents,
  ZERO_BYTES32
} from './utils';
import { EAS__factory, EAS as EASContract } from '@ethereum-attestation-service/eas-contracts';
import { BigNumber, BigNumberish, ContractReceipt, Overrides, PayableOverrides } from 'ethers';

export { PayableOverrides, Overrides } from 'ethers';
export * from './request';

export interface Attestation {
  uid: string;
  schema: string;
  refUID: string;
  time: BigNumberish;
  expirationTime: BigNumberish;
  revocationTime: BigNumberish;
  recipient: string;
  revocable: boolean;
  attester: string;
  data: string;
}

export interface EASOptions {
  signerOrProvider?: SignerOrProvider;
  proxy?: EIP712Proxy;
}

export class EAS extends Base<EASContract> {
  private proxy?: EIP712Proxy;
  private delegated?: Delegated;
  private offchain?: Offchain;

  constructor(address: string, options?: EASOptions) {
    const { signerOrProvider, proxy } = options || {};

    super(new EAS__factory(), address, signerOrProvider);

    if (proxy) {
      this.proxy = proxy;
    }
  }

  // Connects the API to a specific signer
  public connect(signerOrProvider: SignerOrProvider) {
    delete this.delegated;
    delete this.offchain;

    super.connect(signerOrProvider);

    return this;
  }

  // Returns the version of the contract
  public getVersion(): Promise<string> {
    return this.contract.version();
  }

  // Returns an existing schema by attestation UID
  public getAttestation(uid: string): Promise<Attestation> {
    return this.contract.getAttestation(uid);
  }

  // Returns whether an attestation is valid
  public isAttestationValid(uid: string): Promise<boolean> {
    return this.contract.isAttestationValid(uid);
  }

  // Returns whether an attestation has been revoked
  public async isAttestationRevoked(uid: string): Promise<boolean> {
    const attestation = await this.contract.getAttestation(uid);
    if (attestation.uid === ZERO_BYTES32) {
      throw new Error('Invalid attestation');
    }

    return !attestation.revocationTime.isZero();
  }

  // Returns the timestamp that the specified data was timestamped with
  public getTimestamp(data: string): Promise<BigNumberish> {
    return this.contract.getTimestamp(data);
  }

  // Returns the timestamp that the specified data was timestamped with
  public getRevocationOffchain(user: string, uid: string): Promise<BigNumberish> {
    return this.contract.getRevokeOffchain(user, uid);
  }

  // Returns the EIP712 proxy
  public getEIP712Proxy(): EIP712Proxy | undefined {
    return this.proxy;
  }

  // Returns the delegated attestations helper
  public getDelegated(): Promise<Delegated> | Delegated {
    if (this.delegated) {
      return this.delegated;
    }

    return this.setDelegated();
  }

  // Returns the offchain attestations helper
  public getOffchain(): Promise<Offchain> | Offchain {
    if (this.offchain) {
      return this.offchain;
    }

    return this.setOffchain();
  }

  // Attests to a specific schema
  public async attest(
    {
      schema,
      data: { recipient, data, expirationTime = NO_EXPIRATION, revocable = true, refUID = ZERO_BYTES32, value = 0 }
    }: AttestationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<string>> {
    const tx = await this.contract.attest(
      { schema, data: { recipient, expirationTime, revocable, refUID, data, value } },
      { value, ...overrides }
    );

    return new Transaction(tx, async (receipt: ContractReceipt) => (await getUIDsFromAttestEvents(receipt.events))[0]);
  }

  // Attests to a specific schema via an EIP712 delegation request
  public async attestByDelegation(
    {
      schema,
      data: { recipient, data, expirationTime = NO_EXPIRATION, revocable = true, refUID = ZERO_BYTES32, value = 0 },
      attester,
      signature
    }: DelegatedAttestationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<string>> {
    const tx = await this.contract.attestByDelegation(
      {
        schema,
        data: {
          recipient,
          expirationTime,
          revocable,
          refUID,
          data,
          value
        },
        signature,
        attester
      },
      { value, ...overrides }
    );

    return new Transaction(tx, async (receipt: ContractReceipt) => (await getUIDsFromAttestEvents(receipt.events))[0]);
  }

  // Multi-attests to multiple schemas
  public async multiAttest(
    requests: MultiAttestationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<string[]>> {
    const multiAttestationRequests = requests.map((r) => ({
      schema: r.schema,
      data: r.data.map((d) => ({
        recipient: d.recipient,
        expirationTime: d.expirationTime ?? NO_EXPIRATION,
        revocable: d.revocable ?? true,
        refUID: d.refUID ?? ZERO_BYTES32,
        data: d.data ?? ZERO_BYTES32,
        value: d.value ?? 0
      }))
    }));

    const requestedValue = multiAttestationRequests.reduce((res, { data }) => {
      const total = data.reduce((res, r) => res.add(r.value), BigNumber.from(0));
      return res.add(total);
    }, BigNumber.from(0));

    const tx = await this.contract.multiAttest(multiAttestationRequests, {
      value: requestedValue,
      ...overrides
    });

    // eslint-disable-next-line require-await
    return new Transaction(tx, async (receipt: ContractReceipt) => getUIDsFromAttestEvents(receipt.events));
  }

  // Multi-attests to multiple schemas via an EIP712 delegation requests
  public async multiAttestByDelegation(
    requests: MultiDelegatedAttestationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<string[]>> {
    const multiAttestationRequests = requests.map((r) => ({
      schema: r.schema,
      data: r.data.map((d) => ({
        recipient: d.recipient,
        expirationTime: d.expirationTime ?? NO_EXPIRATION,
        revocable: d.revocable ?? true,
        refUID: d.refUID ?? ZERO_BYTES32,
        data: d.data ?? ZERO_BYTES32,
        value: d.value ?? 0
      })),
      signatures: r.signatures,
      attester: r.attester
    }));

    const requestedValue = multiAttestationRequests.reduce((res, { data }) => {
      const total = data.reduce((res, r) => res.add(r.value), BigNumber.from(0));
      return res.add(total);
    }, BigNumber.from(0));

    const tx = await this.contract.multiAttestByDelegation(multiAttestationRequests, {
      value: requestedValue,
      ...overrides
    });

    // eslint-disable-next-line require-await
    return new Transaction(tx, async (receipt: ContractReceipt) => getUIDsFromAttestEvents(receipt.events));
  }

  // Revokes an existing attestation
  public async revoke(
    { schema, data: { uid, value = 0 } }: RevocationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    const tx = await this.contract.revoke({ schema, data: { uid, value } }, { value, ...overrides });

    return new Transaction(tx, async () => {});
  }

  // Revokes an existing attestation an EIP712 delegation request
  public async revokeByDelegation(
    { schema, data: { uid, value = 0 }, signature, revoker }: DelegatedRevocationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    const tx = await this.contract.revokeByDelegation(
      {
        schema,
        data: {
          uid,
          value
        },
        signature,
        revoker
      },
      { value, ...overrides }
    );

    return new Transaction(tx, async () => {});
  }

  // Multi-revokes multiple attestations
  public async multiRevoke(
    requests: MultiRevocationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    const multiRevocationRequests = requests.map((r) => ({
      schema: r.schema,
      data: r.data.map((d) => ({
        uid: d.uid,
        value: d.value ?? 0
      }))
    }));

    const requestedValue = multiRevocationRequests.reduce((res, { data }) => {
      const total = data.reduce((res, r) => res.add(r.value), BigNumber.from(0));
      return res.add(total);
    }, BigNumber.from(0));

    const tx = await this.contract.multiRevoke(multiRevocationRequests, {
      value: requestedValue,
      ...overrides
    });

    return new Transaction(tx, async () => {});
  }

  // Multi-revokes multiple attestations via an EIP712 delegation requests
  public async multiRevokeByDelegation(
    requests: MultiDelegatedRevocationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    const multiRevocationRequests = requests.map((r) => ({
      schema: r.schema,
      data: r.data.map((d) => ({
        uid: d.uid,
        value: d.value ?? 0
      })),
      signatures: r.signatures,
      revoker: r.revoker
    }));

    const requestedValue = multiRevocationRequests.reduce((res, { data }) => {
      const total = data.reduce((res, r) => res.add(r.value), BigNumber.from(0));
      return res.add(total);
    }, BigNumber.from(0));

    const tx = await this.contract.multiRevokeByDelegation(multiRevocationRequests, {
      value: requestedValue,
      ...overrides
    });

    return new Transaction(tx, async () => {});
  }

  // Attests to a specific schema via an EIP712 delegation request using an external EIP712 proxy
  public attestByDelegationProxy(
    request: DelegatedProxyAttestationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<string>> {
    if (!this.proxy) {
      throw new Error("Proxy wasn't set");
    }

    return this.proxy.attestByDelegationProxy(request, overrides);
  }

  // Multi-attests to multiple schemas via an EIP712 delegation requests using an external EIP712 proxy
  public multiAttestByDelegationProxy(
    requests: MultiDelegatedProxyAttestationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<string[]>> {
    if (!this.proxy) {
      throw new Error("Proxy wasn't set");
    }

    return this.proxy.multiAttestByDelegationProxy(requests, overrides);
  }

  // Revokes an existing attestation an EIP712 delegation request using an external EIP712 proxy
  public revokeByDelegationProxy(
    request: DelegatedProxyRevocationRequest,
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    if (!this.proxy) {
      throw new Error("Proxy wasn't set");
    }

    return this.proxy.revokeByDelegationProxy(request, overrides);
  }

  // Multi-revokes multiple attestations via an EIP712 delegation requests using an external EIP712 proxy
  public multiRevokeByDelegationProxy(
    requests: MultiDelegatedProxyRevocationRequest[],
    overrides?: PayableOverrides
  ): Promise<Transaction<void>> {
    if (!this.proxy) {
      throw new Error("Proxy wasn't set");
    }

    return this.proxy.multiRevokeByDelegationProxy(requests, overrides);
  }

  // Timestamps the specified bytes32 data
  public async timestamp(data: string, overrides?: Overrides): Promise<Transaction<BigNumberish>> {
    const tx = await this.contract.timestamp(data, overrides ?? {});

    return new Transaction(
      tx,
      async (receipt: ContractReceipt) => (await getTimestampFromTimestampEvents(receipt.events))[0]
    );
  }

  // Timestamps the specified multiple bytes32 data
  public async multiTimestamp(data: string[], overrides?: Overrides): Promise<Transaction<BigNumberish[]>> {
    const tx = await this.contract.multiTimestamp(data, overrides ?? {});

    // eslint-disable-next-line require-await
    return new Transaction(tx, async (receipt: ContractReceipt) => getTimestampFromTimestampEvents(receipt.events));
  }

  // Revokes the specified offchain attestation UID
  public async revokeOffchain(uid: string, overrides?: Overrides): Promise<Transaction<BigNumberish>> {
    const tx = await this.contract.revokeOffchain(uid, overrides ?? {});

    return new Transaction(
      tx,
      async (receipt: ContractReceipt) => (await getTimestampFromOffchainRevocationEvents(receipt.events))[0]
    );
  }

  // Revokes the specified multiple offchain attestation UIDs
  public async multiRevokeOffchain(uids: string[], overrides?: Overrides): Promise<Transaction<BigNumberish[]>> {
    const tx = await this.contract.multiRevokeOffchain(uids, overrides ?? {});

    // eslint-disable-next-line require-await
    return new Transaction(tx, async (receipt: ContractReceipt) =>
      getTimestampFromOffchainRevocationEvents(receipt.events)
    );
  }

  // Returns the domain separator used in the encoding of the signatures for attest, and revoke
  public getDomainSeparator(): Promise<string> {
    return this.contract.getDomainSeparator();
  }

  // Returns the current nonce per-account.
  public getNonce(address: string): Promise<BigNumber> {
    return this.contract.getNonce(address);
  }

  // Returns the EIP712 type hash for the attest function
  public getAttestTypeHash(): Promise<string> {
    return this.contract.getAttestTypeHash();
  }

  // Returns the EIP712 type hash for the revoke function
  public getRevokeTypeHash(): Promise<string> {
    return this.contract.getRevokeTypeHash();
  }

  // Sets the delegated attestations helper
  private async setDelegated(): Promise<Delegated> {
    this.delegated = new Delegated({
      address: this.contract.address,
      version: await this.getVersion(),
      chainId: await this.getChainId()
    });

    return this.delegated;
  }

  // Sets the offchain attestations helper
  private async setOffchain(): Promise<Offchain> {
    this.offchain = new Offchain(
      {
        address: this.contract.address,
        version: await this.getVersion(),
        chainId: await this.getChainId()
      },
      OFFCHAIN_ATTESTATION_VERSION
    );

    return this.offchain;
  }
}
