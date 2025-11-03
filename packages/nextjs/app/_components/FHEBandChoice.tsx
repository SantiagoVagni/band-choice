"use client";

import React, { useEffect, useMemo, useState } from "react";
import { KPOP_GROUPS } from "../../constants/index";
import { useFhevm } from "@fhevm-sdk";
import { Drawer, Modal } from "antd";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEBandChoiceWagmi } from "~~/hooks/useFHEBandChoiceWagmi";

export const FHEBandChoice = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);
  const initialMockChains = {
    11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const bandChoice = useFHEBandChoiceWagmi({
    instance: fhevmInstance,
    initialMockChains,
  });

  const [selected, setSelected] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!bandChoice.isDecrypting && bandChoice.clear) {
      const found = KPOP_GROUPS.find(g => g.id === Number(bandChoice.clear));
      if (found) {
        setSelected(found);
        setModalOpen(true);
      }
    }
  }, [bandChoice.isDecrypting, bandChoice.clear]);

  const handleVote = async () => {
    if (!selected) return;
    try {
      setDrawerOpen(false);
      await bandChoice.executeChoice(selected.id);
    } catch {
      console.error("Vote failed");
    }
  };

  return (
    <div className="min-h-[calc(100vh-55px)] w-full text-white flex flex-col items-center p-10">
      <div className="max-w-7xl w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_0_60px_-15px_rgba(255,0,150,0.4)] p-10">
        <h1 className="text-5xl font-extrabold text-center bg-gradient-to-r from-pink-400 via-violet-300 to-blue-400 bg-clip-text text-transparent drop-shadow-md mb-4">
          🎤 FHE BandChoice Awards 2025
        </h1>
        <p className="text-center text-gray-300 mb-10 text-lg">
          Vote privately for your favorite <b className="text-pink-400">K-pop group</b> — secured by{" "}
          <b className="text-violet-300">Fully Homomorphic Encryption 🔐</b>
        </p>

        {!isConnected ? (
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
              {KPOP_GROUPS.map(g => (
                <div
                  key={g.id}
                  onClick={() => {
                    setSelected(g);
                    setDrawerOpen(true);
                  }}
                  className="relative bg-gradient-to-br from-violet-800/40 to-pink-700/30 border border-white/20 rounded-2xl p-4 cursor-pointer hover:scale-105 transition-all shadow-[0_0_25px_-5px_rgba(255,0,255,0.3)] hover:shadow-[0_0_35px_-5px_rgba(255,0,255,0.5)] flex flex-col items-center"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent opacity-0 hover:opacity-10 transition-all"></div>
                  <img
                    src={g.image}
                    alt={g.name}
                    className="w-28 h-28 rounded-full object-cover mb-3 shadow-[0_0_20px_rgba(255,255,255,0.3)] border-2 border-white/30"
                  />
                  <h3 className="text-lg font-bold text-pink-300 drop-shadow-sm">{g.name}</h3>
                  <button className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-pink-400 text-pink-300 hover:bg-pink-500/20 transition-all"> 💜 Vote </button>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <button
                onClick={() => bandChoice.decryptMyChoice()}
                disabled={bandChoice.isDecrypting}
                className="bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition-transform"
              >
                {bandChoice.isDecrypting ? "⏳ Decrypting..." : "🔓 Decrypt My Choice"}
              </button>
            </div>
          </>
        )}
      </div>

      <Drawer
        title={<span className="text-black font-bold text-xl">{selected?.name}</span>}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        placement="right"
        width={700}
        styles={{
          body: { background: "linear-gradient(135deg, #1a0028 20%, #2a003f 80%)", color: "white" },
          header: { background: "linear-gradient(to right, #ff80bf, #a855f7)", color: "white" },
        }}
      >
        {selected && (
          <div className="flex flex-col sm:flex-row gap-8">
            <img
              src={selected.image}
              alt={selected.name}
              className="w-60 h-60 rounded-2xl object-cover shadow-[0_0_30px_rgba(255,0,255,0.4)] border-4 border-white/20"
            />
            <div className="flex-1 space-y-3">
              <p className="text-lg font-semibold text-pink-300">
                Debut: <span className="text-gray-200">{selected.debut}</span>
              </p>
              <p className="text-lg font-semibold text-pink-300">
                Members: <span className="text-gray-200">{selected.members}</span>
              </p>
              <p className="text-gray-200 leading-relaxed">{selected.description}</p>
              <p className="text-sm font-medium text-pink-400">
                🏆 Awards: <span className="text-gray-100">{selected.awards}</span>
              </p>
              <button
                onClick={handleVote}
                className="mt-6 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:scale-105 transition-transform text-white px-6 py-3 rounded-xl font-semibold shadow-lg"
              >
                💜 Vote for {selected.name}
              </button>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        closable={false}
        centered
        width={600}
        className="!overflow-hidden"
        styles={{
          content: {
            background: "linear-gradient(135deg, #1a0028 10%, #3a0055 90%)",
            border: "1px solid white",
            boxShadow: "0 0 50px rgba(255,0,200,0.3)",
            borderRadius: "20px",
          },
        }}
      >
        {selected && (
          <div className="text-center p-6 text-white">
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-pink-400 via-violet-300 to-blue-400 bg-clip-text text-transparent mb-4">
              🎉 You Voted For {selected.name}!
            </h2>
            <img
              src={selected.image}
              alt={selected.name}
              className="w-44 h-44 mx-auto rounded-2xl object-cover shadow-[0_0_40px_rgba(255,0,255,0.5)] border-2 border-white/30 mb-4"
            />
            <p className="text-gray-200 mb-2 text-lg leading-relaxed">{selected.description}</p>
            <p className="text-pink-300 font-medium">🏆 Awards: {selected.awards}</p>
            <p className="text-sm text-gray-400 mt-2">
              Debut: {selected.debut} • Members: {selected.members}
            </p>
            <button
              onClick={() => setModalOpen(false)}
              className="mt-6 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition-transform"
            >
              ✨ Close
            </button>
          </div>
        )}
      </Modal>

      {bandChoice.isProcessing && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 overflow-hidden">
          <p className="mt-4 text-pink-300 font-medium">Processing your encrypted vote...</p>
        </div>
      )}
    </div>
  );
};
