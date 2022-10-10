import { useStarknetCall } from "@starknet-react/core";
import BigNumber from "bignumber.js";
import { useEffect, useRef, useState } from "react";
import { uint256 } from "starknet";

import { useExecute, useTransactionStatus } from "../contracts/helpers";
import { useRtwrkThemeAuctionContract } from "../contracts/rtwrkThemeAuction";
import SmallClock from "../public/clock-small.svg";
import CrossImage from "../public/cross.svg";
import { useStoreDispatch, useStoreState } from "../store";
import styles from "../styles/Auction.module.scss";
import carouselStyles from "../styles/RtwrkAndBidCarousel.module.scss";
import {
  feltArrayToStr,
  getAddressFromBN,
  getExecuteParameterFromString,
  getUintFromNumber,
  shortAddress,
  useHasChanged,
} from "../utils";
import Button from "./button";
import Input from "./input";

type Props = {
  auctionId: number;
  auctionTimestamp: number;
  pendingRtwrkId: number;
  nextRwrkId: number;
  pendingAuctionId: number;
  lastBidProcessing: boolean;
  lastDrawingToSettle: boolean;
};

const BID_INCREMENT = 0.005; // IN ETH
const THEME_MAX_LENGTH = 155; // 5 felts

const Auction = ({
  auctionId,
  auctionTimestamp,
  pendingRtwrkId,
  nextRwrkId,
  pendingAuctionId,
  lastBidProcessing,
  lastDrawingToSettle,
}: Props) => {
  const state = useStoreState();
  const dispatch = useStoreDispatch();
  const { contract: rtwrkThemeAuctionContract } =
    useRtwrkThemeAuctionContract();
  const now = new Date().getTime() / 1000;
  const auctionEnd = auctionTimestamp + 24 * 3600;
  const auctionStartedSince = now - auctionTimestamp;
  const isCurrentAuction = auctionStartedSince <= 24 * 3600;
  const [secondsUntilAuctionFinished, setSecondsUntilAuctionFinished] =
    useState(auctionEnd - Math.floor(new Date().getTime() / 1000));
  useEffect(() => {
    const refresh = () => {
      const now = new Date().getTime() / 1000;
      const sUntilFinished = auctionEnd - Math.floor(now);
      setSecondsUntilAuctionFinished(sUntilFinished);
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [auctionEnd]);

  const {
    data: currentAuctionBidData,
    loading: currentAuctionBidLoading,
    refresh: refreshCurrentBid,
  } = useStarknetCall({
    contract: rtwrkThemeAuctionContract,
    method: "currentAuctionBid",
    args: [auctionId],
    options: {
      watch: true,
    },
  });

  const refreshCurrentBidRef = useRef(refreshCurrentBid);
  useEffect(() => {
    refreshCurrentBidRef.current = refreshCurrentBid;
  }, [refreshCurrentBid]);

  useHasChanged(lastBidProcessing, () => {
    refreshCurrentBidRef.current();
  });

  useEffect(() => {
    const currentAuctionBid = currentAuctionBidData
      ? {
          bidId: (currentAuctionBidData as any).bidId,
          bidAccount: getAddressFromBN(
            (currentAuctionBidData as any).bidAccount
          ),
          bidAmountEth: new BigNumber(
            uint256
              .uint256ToBN((currentAuctionBidData as any).bidAmount)
              .toString()
          )
            .multipliedBy("1e-18")
            .toString(),
          bidAmountWei: new BigNumber(
            uint256
              .uint256ToBN((currentAuctionBidData as any).bidAmount)
              .toString()
          ).toString(),
          bidTimestamp: (currentAuctionBidData as any).bidTimestamp.toNumber(),
          theme: feltArrayToStr((currentAuctionBidData as any).theme).join(""),
        }
      : undefined;
    dispatch.setCurrentAuctionBid(currentAuctionBid);
  }, [currentAuctionBidData, dispatch]);

  const currentAuctionBid = state.currentAuctionBid;

  const minBid = new BigNumber(BID_INCREMENT).plus(
    currentAuctionBid ? currentAuctionBid?.bidAmountEth : 0
  );

  const auctionHadBids =
    auctionId > 0 && !currentAuctionBidLoading && !!currentAuctionBid;
  const isAuctionFinished =
    (auctionTimestamp > 0 && secondsUntilAuctionFinished < 0) ||
    auctionId === 0;

  let hoursUntilFinished = secondsUntilAuctionFinished / 3600;
  let minsUntilFinished = (secondsUntilAuctionFinished % 3600) / 60;
  let secsUntilFinished = (minsUntilFinished * 60) % 60;
  hoursUntilFinished = Math.trunc(hoursUntilFinished);
  minsUntilFinished = Math.trunc(minsUntilFinished);
  secsUntilFinished = Math.trunc(secsUntilFinished);

  const [bidAmount, setBidAmount] = useState("");
  const [bidTheme, setBidTheme] = useState("");
  const [showError, setShowError] = useState(false);
  const [isAuctionLaunching, setIsAuctionLaunching] = useState(
    !!state.launchAuctionHash || pendingAuctionId != auctionId
  );
  const [isRtwrkLaunching, setIsRtwrkLaunching] = useState(
    !!state.launchAuctionRtwrkHash || pendingRtwrkId === nextRwrkId
  );

  const {
    accepted: launchAuctionAccepted,
    rejected: launchAuctionRejected,
    loading: launchAuctionLoading,
  } = useTransactionStatus(state.launchAuctionHash);

  const {
    accepted: launchAuctionRtwrkAccepted,
    rejected: launchAuctionRtwrkRejected,
    loading: launchAuctionRtwrkLoading,
  } = useTransactionStatus(state.launchAuctionRtwrkHash);

  useEffect(() => {
    if (state.launchAuctionHash && !launchAuctionLoading) {
      if (launchAuctionAccepted || launchAuctionRejected) {
        dispatch.setLaunchAuctionHash(undefined);
      }
    }
  }, [
    dispatch,
    launchAuctionAccepted,
    launchAuctionLoading,
    launchAuctionRejected,
    state.launchAuctionHash,
  ]);

  useEffect(() => {
    if (state.launchAuctionRtwrkHash && !launchAuctionRtwrkLoading) {
      if (launchAuctionRtwrkAccepted || launchAuctionRtwrkRejected) {
        dispatch.setLaunchAuctionRtwrkHash(undefined);
      }
    }
  }, [
    dispatch,
    launchAuctionRtwrkAccepted,
    launchAuctionRtwrkLoading,
    launchAuctionRtwrkRejected,
    state.launchAuctionRtwrkHash,
  ]);

  const bidAmountBigNumber = new BigNumber(bidAmount || 0);
  const bidAmountInWei = bidAmountBigNumber
    .multipliedBy("1e+18")
    .integerValue()
    .toFixed();

  const { execute: placeBid } = useExecute({
    calls: [
      {
        contractAddress: process.env.NEXT_PUBLIC_ETH_ERC20_ADDRESS,
        entrypoint: "approve",
        calldata: [
          process.env.NEXT_PUBLIC_RTWRK_THEME_AUCTION_ADDRESS,
          getUintFromNumber(bidAmountInWei).low,
          getUintFromNumber(bidAmountInWei).high,
        ],
      },
      {
        contractAddress: rtwrkThemeAuctionContract?.address || "",
        entrypoint: "placeBid",
        calldata: [
          auctionId,
          getUintFromNumber(bidAmountInWei).low,
          getUintFromNumber(bidAmountInWei).high,
          ...getExecuteParameterFromString(bidTheme),
        ],
      },
    ],
  });

  const { execute: launchAuctionRtwrkExecute } = useExecute({
    calls: {
      contractAddress: process.env.NEXT_PUBLIC_RTWRK_THEME_AUCTION_ADDRESS,
      entrypoint: "launchAuctionRtwrk",
      calldata: [],
    },
  });

  const launchAuctionRtwrk = () => {
    launchAuctionRtwrkExecute()
      .then((r: any) => {
        setIsRtwrkLaunching(true);
        dispatch.setLaunchAuctionRtwrkHash(r.transaction_hash);
      })
      .catch(console.warn);
  };

  const { execute: launchAuctionExecute } = useExecute({
    calls: {
      contractAddress: process.env.NEXT_PUBLIC_RTWRK_THEME_AUCTION_ADDRESS,
      entrypoint: "launchAuction",
      calldata: [],
    },
  });

  const launchAuction = () => {
    launchAuctionExecute()
      .then((r: any) => {
        setIsAuctionLaunching(true);
        dispatch.setLaunchAuctionHash(r.transaction_hash);
      })
      .catch(console.warn);
  };

  const validateAndPlaceBid = () => {
    if (bidAmountBigNumber.isEqualTo(0) || bidTheme.trim().length === 0) {
      setShowError(false);
      return;
    }
    if (
      bidAmountBigNumber.isLessThan(minBid) ||
      bidTheme.trim().length > THEME_MAX_LENGTH
    ) {
      setShowError(true);
      return;
    }
    const bidAction = {
      auctionId,
      bidAmount: bidAmountInWei,
      theme: bidTheme,
    };
    placeBid()
      .then((r: any) => {
        setBidAmount("");
        setBidTheme("");
        dispatch.setLastBidAction({
          ...bidAction,
          transactionHash: r.transaction_hash,
        });
      })
      .catch(console.warn);
  };

  const lastDrawingNotFinished =
    (state.drawingIsHappening || lastDrawingToSettle) &&
    !isCurrentAuction &&
    auctionHadBids;

  return (
    <div className={styles.auction}>
      {isAuctionFinished &&
        !auctionHadBids &&
        !isAuctionLaunching &&
        !lastDrawingNotFinished &&
        !currentAuctionBidLoading && (
          <div>
            <div className={styles.singleSeparator} />
            There was no bid in the last auction. Start a new auction for rtwrk
            #{nextRwrkId}
            <Button rainbow block text="Start auction" action={launchAuction} />
          </div>
        )}
      {isAuctionLaunching && (
        <div>
          <SmallClock />
          <br />
          <br />
          <div>
            Rtwrk #{nextRwrkId} auction will start soon (in a few minutes or a
            few hours).
          </div>
        </div>
      )}
      {isAuctionFinished &&
        auctionHadBids &&
        !isAuctionLaunching &&
        !lastDrawingNotFinished && (
          <div>
            <div className={styles.singleSeparator} />
            <div className={carouselStyles.dual}>
              <div className={carouselStyles.labelAndValue}>
                <div className={carouselStyles.label}>Winner</div>
                <div style={{ width: 110 }}>
                  {currentAuctionBid
                    ? shortAddress(currentAuctionBid.bidAccount)
                    : "--"}
                </div>
              </div>
              <div className={carouselStyles.labelAndValue}>
                <div className={carouselStyles.label}>Winning bid</div>
                <div>
                  {currentAuctionBid
                    ? `${currentAuctionBid.bidAmountEth} ETH`
                    : "--"}
                </div>
              </div>
            </div>
            <div className={carouselStyles.labelAndValue}>
              <div className={carouselStyles.label}>Theme</div>
              <div>{currentAuctionBid ? currentAuctionBid.theme : "--"}</div>
            </div>
            {!isRtwrkLaunching && (
              <Button
                rainbow
                block
                text={`Launch rtwrk #${nextRwrkId} drawing`}
                action={launchAuctionRtwrk}
              />
            )}
            {isRtwrkLaunching && (
              <div>
                <div
                  className={styles.singleSeparator}
                  style={{ marginBottom: 15 }}
                />
                <SmallClock style={{ marginBottom: 10 }} />
                <br />
                Rtwrk #{nextRwrkId}’s drawing will start at Starknet’s next
                block. It can take up to several hours.
              </div>
            )}
          </div>
        )}
      {!isAuctionFinished && !isAuctionLaunching && !lastDrawingNotFinished && (
        <>
          {showError && (
            <div className={styles.bidError}>
              <CrossImage
                onClick={() => {
                  setShowError(false);
                }}
              />
              <div
                className={styles.singleSeparator}
                style={{ opacity: 0.5, marginBottom: 10 }}
              />
              <div style={{ color: "#FF4848" }}>
                Before placing your bid, make sure your theme is{" "}
                {THEME_MAX_LENGTH} characters long max & your bid is{" "}
                {minBid.toFixed()} eth min.
              </div>
            </div>
          )}
          <div className={carouselStyles.dual}>
            <div className={carouselStyles.labelAndValue}>
              <div className={carouselStyles.label}>Auction ends in</div>
              <div style={{ width: 110 }}>
                {auctionTimestamp > 0
                  ? `${hoursUntilFinished}h ${minsUntilFinished}m ${secsUntilFinished}s`
                  : "--"}
              </div>
            </div>
            <div className={carouselStyles.labelAndValue}>
              <div className={carouselStyles.label}>Current bid</div>
              <div>
                {currentAuctionBid
                  ? `${currentAuctionBid.bidAmountEth} ETH`
                  : "--"}
              </div>
            </div>
          </div>
          <div className={carouselStyles.labelAndValue}>
            <div className={carouselStyles.label}>Current theme</div>
            <div>
              {currentAuctionBid && currentAuctionBid.theme
                ? currentAuctionBid.theme
                : "--"}
            </div>
          </div>
          <div className={styles.singleSeparator} />
          <>
            <Input
              placeholder="Your theme"
              text={bidTheme}
              onChange={setBidTheme}
            />
            <div className={styles.inputAndButton}>
              <Input
                number
                placeholder={`${minBid.toFixed()} eth or more`}
                onChange={(a: string) => {
                  if (parseFloat(a) < 0) {
                    setBidAmount("0");
                    return;
                  }
                  setBidAmount(a);
                }}
                text={bidAmount}
              />
              <Button rainbow text="Place bid" action={validateAndPlaceBid} />
            </div>
          </>
        </>
      )}
      {lastDrawingNotFinished && (
        <>
          <div className={carouselStyles.dual}>
            <div className={carouselStyles.labelAndValue}>
              <div className={carouselStyles.label}>Auction ends in</div>
              <div style={{ width: 110 }}>--</div>
            </div>
            <div className={carouselStyles.labelAndValue}>
              <div className={carouselStyles.label}>Current bid</div>
              <div>--</div>
            </div>
          </div>
          <div className={carouselStyles.labelAndValue}>
            <div className={carouselStyles.label}>Current theme</div>
            <div>--</div>
          </div>
          <div className={styles.singleSeparator} />

          <div>
            Auction for rtwrk #{nextRwrkId} will start when rtwrk #
            {nextRwrkId - 1} is finished and minted.
          </div>
        </>
      )}
      {/* Auction {auctionId} - {auctionTimestamp} -{" "}
      {isAuctionFinished ? "finished" : "non finished"} */}
    </div>
  );
};

export default Auction;
