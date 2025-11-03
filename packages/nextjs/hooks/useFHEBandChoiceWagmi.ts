// hooks/useFHEBandChoiceWagmi.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

// hooks/useFHEBandChoiceWagmi.ts

export const useFHEBandChoiceWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheBandChoice } = useDeployedContractInfo({
    contractName: "FHEBandChoice",
    chainId: allowedChainId,
  });

  type FHEBandChoiceInfo = Contract<"FHEBandChoice"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheBandChoice?.address && fheBandChoice?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheBandChoice!.address, (fheBandChoice as FHEBandChoiceInfo).abi, providerOrSigner);
  };

  // === READ ENCRYPTED USER CHOICE ===
  const { data: myChoiceHandle, refetch: refreshMyChoiceHandle } = useReadContract({
    address: hasContract ? (fheBandChoice!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((fheBandChoice as FHEBandChoiceInfo).abi as any) : undefined,
    functionName: "viewUserChoice" as const,
    args: [accounts ? accounts[0] : ""],
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const handle = useMemo(() => (myChoiceHandle as string | undefined) ?? undefined, [myChoiceHandle]);

  const hasChosen = useMemo(
    () => !!handle && handle !== ethers.ZeroHash && handle !== "0x" && handle !== "0x0",
    [handle],
  );

  const requests = useMemo(
    () =>
      hasContract && handle && handle !== ethers.ZeroHash
        ? ([{ handle, contractAddress: fheBandChoice!.address }] as const)
        : undefined,
    [hasContract, fheBandChoice?.address, handle],
  );

  const {
    canDecrypt,
    decrypt,
    isDecrypting,
    message: decMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const clearChoice = useMemo(() => {
    if (!handle) return undefined;
    const clear = results[handle];
    return clear ? ({ handle, clear } as const) : undefined;
  }, [handle, results]);

  const isDecrypted = useMemo(
    () => !!handle && typeof results?.[handle] !== "undefined" && BigInt(results[handle]) !== BigInt(0),
    [handle, results],
  );

  const decryptMyChoice = decrypt;

  // === ENCRYPTION ===
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheBandChoice?.address,
  });

  const canChoose = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodFor = (functionName: "makeChoice" | "changeChoice") => {
    const functionAbi = fheBandChoice?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi)
      return {
        method: undefined as string | undefined,
        error: `Function ABI not found for ${functionName}`,
      };
    const firstInput = functionAbi.inputs?.[0];
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  // === EXECUTE CHOICE ===
  const executeChoice = useCallback(
    async (bandId: number) => {
      if (isProcessing || bandId <= 0) return;
      setIsProcessing(true);
      setMessage(`${hasChosen ? "Updating" : "Encrypting"} choice for band #${bandId}...`);
      try {
        const { method, error } = getEncryptionMethodFor(hasChosen ? "changeChoice" : "makeChoice");
        if (!method) return setMessage(error ?? "Encryption method not found");

        const enc = await encryptWith(builder => {
          (builder as any)[method](bandId);
        });
        if (!enc) return setMessage("Encryption failed");

        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract or signer not available");

        const params = buildParamsFromAbi(enc, fheBandChoice!.abi as any[], hasChosen ? "changeChoice" : "makeChoice");
        const tx = await writeContract[hasChosen ? "changeChoice" : "makeChoice"](...params, { gasLimit: 300_000 });
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`Choice(${bandId}) ${hasChosen ? "updated" : "submitted"} successfully!`);
        await refreshMyChoiceHandle();
      } catch (e) {
        setMessage(`Choice submission failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, encryptWith, getContract, refreshMyChoiceHandle, fheBandChoice?.abi],
  );

  return {
    contractAddress: fheBandChoice?.address,
    canDecrypt,
    canChoose,
    decryptMyChoice,
    executeChoice,
    refreshMyChoiceHandle,
    isDecrypted,
    message,
    clear: clearChoice?.clear,
    handle,
    isDecrypting,
    isProcessing,
    hasChosen,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
