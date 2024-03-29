import { useCallback, useEffect, useRef, useState } from "react";
import { BigNumberish } from "starknet/utils/number";

import { useCall, useExecute } from "../contracts/helpers";
import { useOriginalPxlERC721Contract } from "../contracts/originalPxlERC721";
import { usePxlERC721Contract } from "../contracts/pxlERC721";
import { useStoreState } from "../store";
import styles from "../styles/RegenesisPage.module.scss";
import ConnectToStarknet from "./connectToStarknet";
import RegenesisPxl from "./regenesisPxl";
import TopNav from "./topNav";
import Window from "./window";

const Separator = () => <div className={styles.separator} />;

export default function RegenesisPage() {
  const state = useStoreState();
  const { contract: originalPxlERC721Contract } =
    useOriginalPxlERC721Contract();
  const { contract: pxlERC721Contract } = usePxlERC721Contract();
  const {
    data: originalPxlsOwnedData,
    loading: originalPxlsOwnedLoading,
    refresh: originalPxlsRefresh,
  } = useCall({
    contract: originalPxlERC721Contract,
    method: "pixelsOfOwner",
    args: [state.account || ""],
    condition: !!state.account,
  });
  const originalPxlsOwned =
    originalPxlsOwnedLoading || !originalPxlsOwnedData?.[0]
      ? []
      : originalPxlsOwnedData[0]?.map((p: BigNumberish) => ({
          pxlId: p.toNumber(),
          migrated: false,
        }));
  const {
    data: pxlsOwnedData,
    loading: pxlsOwnedLoading,
    refresh: pxlsRefresh,
  } = useCall({
    contract: pxlERC721Contract,
    method: "pxlsOwned",
    args: [state.account || ""],
    condition: !!state.account,
  });
  const pxlsOwned =
    pxlsOwnedLoading || !pxlsOwnedData?.[0]
      ? []
      : pxlsOwnedData[0]?.map((p: BigNumberish) => ({
          pxlId: p.toNumber(),
          migrated: true,
        }));
  const loading = pxlsOwnedLoading || originalPxlsOwnedLoading;
  const [migrating, _setMigrating] = useState<any>({});

  const setMigrating = useCallback(
    async (v: any) => {
      await Promise.all([pxlsRefresh(), originalPxlsRefresh()]);
      _setMigrating(v);
    },
    [originalPxlsRefresh, pxlsRefresh]
  );

  useEffect(() => {
    setMigrating(
      JSON.parse(localStorage.getItem("pxls-migrating-regenesis") || "{}") || {}
    );
  }, [setMigrating]);

  let height = 560;
  originalPxlsOwned.forEach((o: any) => {
    if (migrating[o.pxlId]) {
      height += 192;
    } else {
      height += 245;
    }
  });

  pxlsOwned.forEach((o: any) => {
    if (migrating[o.pxlId]) {
      height += 192;
    } else {
      height += 245;
    }
  });

  const totalCount = originalPxlsOwned.length + pxlsOwned.length;

  const allPxls = [...originalPxlsOwned, ...pxlsOwned].sort(
    (a, b) => a.pxlId - b.pxlId
  );

  const pxlsDivs: any = [];
  let pxlTop = 0;

  const [pxlToBurn, setPxlToBurn] = useState<number | null>(null);

  const { execute: executeBurnAndMint } = useExecute({
    calls: [
      {
        contractAddress:
          process.env.NEXT_PUBLIC_ORIGINAL_PXL_ERC721_ADDRESS || "",
        entrypoint: "approve",
        calldata: [process.env.NEXT_PUBLIC_PXL_ERC721_ADDRESS, pxlToBurn, 0],
      },
      {
        contractAddress: process.env.NEXT_PUBLIC_PXL_ERC721_ADDRESS || "",
        entrypoint: "burnAndMint",
        calldata: [pxlToBurn, 0],
      },
    ],
  });

  const burnAndMint = useCallback((pxlId: number) => {
    setPxlToBurn(pxlId);
  }, []);

  const launchingBurnTransaction = useRef<number | null>(null);

  useEffect(() => {
    if (pxlToBurn && pxlToBurn !== launchingBurnTransaction.current) {
      launchingBurnTransaction.current = pxlToBurn;
      const effect = async () => {
        try {
          const r: any = await executeBurnAndMint();
          setPxlToBurn(null);
          const currentMigrating =
            JSON.parse(
              localStorage.getItem("pxls-migrating-regenesis") || "{}"
            ) || {};
          currentMigrating[pxlToBurn] = r.transaction_hash;
          localStorage.setItem(
            "pxls-migrating-regenesis",
            JSON.stringify(currentMigrating)
          );
          setMigrating(currentMigrating);
        } catch (e) {
          setPxlToBurn(null);
        }
      };
      effect();
    } else if (!pxlToBurn) {
      launchingBurnTransaction.current = null;
    }
  }, [executeBurnAndMint, pxlToBurn, setMigrating]);

  if (!loading) {
    allPxls.forEach((pxl) => {
      pxlsDivs.push(
        <RegenesisPxl
          key={pxl.pxlId}
          pxlTop={pxlTop}
          pxl={pxl}
          migrating={migrating}
          burnAndMint={burnAndMint}
          setMigrating={setMigrating}
        />
      );
      pxlTop += (pxl.migrated && migrating[pxl.pxlId] ? 157 : 212) + 30;
    });
  }

  return (
    <div className={styles.regenesisPage}>
      <div className={styles.regenesisPageContent} style={{ height }}>
        <div className={styles.regenesisPageContainer} style={{ height }}>
          <TopNav white logo />
          <div>
            <Window
              style={{
                width: 525,
                padding: "16px 29px 30px 29px",
                top: 160,
                left: 340,
              }}
            >
              <div style={{ marginTop: 12 }} />
              <p>Hey, pxlr!</p>
              <Separator />
              <p>
                In order to keep your pxl NFT post-Starknet regenesis, you’ll
                need to migrate it (our contract will burn it and mint it again
                in the same transaction). Do it before Jan 31st 2023, after that
                you might lose it forever. As of now, only NFTs belonging to the
                new collection will have the ability to draw rtwrks.
              </p>
              <Separator />
              {!state.account && (
                <p>
                  Please start by connecting your wallet.
                  <br />
                  <ConnectToStarknet
                    connectButton={
                      <span className={styles.button}>Connect wallet</span>
                    }
                  />
                </p>
              )}
              {state.account && (
                <p>
                  {loading && <span>Loading your Pxls...</span>}
                  {!loading && totalCount === 0 && (
                    <span style={{ wordBreak: "break-word" }}>
                      There is no pxl NFT owned by this wallet:
                      <br />
                      {state.account}
                    </span>
                  )}
                  {!loading && totalCount > 0 && (
                    <div>
                      Please follow the instructions below.{" "}
                      <span style={{ color: "#FF4848" }}>
                        If you have multiple pxl NFTs, you will have to repeat
                        this process for each pxl NFT.
                      </span>
                    </div>
                  )}
                </p>
              )}
            </Window>
          </div>
          <div className={styles.pxlsDivs}>{pxlsDivs}</div>
        </div>
      </div>
    </div>
  );
}
