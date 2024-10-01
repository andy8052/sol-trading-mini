import React, { useState, useEffect } from "react";
import WebApp from "@twa-dev/sdk";
import capsuleClient from "./lib/capsuleClient";
// import { CapsuleSolanaWeb3Signer } from '@usecapsule/solana-web3.js-v1-integration';
import { WalletType } from "@usecapsule/web-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Spinner } from "./components/ui/spinner";
import {
  clearChunkedStorage,
  ErrorHandler,
  LogFunction,
  retrieveChunkedData,
  storeWithChunking,
} from "./lib/cloudStorageUtil";
import { gql, GraphQLClient } from "graphql-request";
import { QuoteGetRequest, createJupiterApiClient } from '@jup-ag/api';
// import * as solana from '@solana/web3.js';
// import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';

const endpoint = `https://programs.shyft.to/v0/graphql/?api_key=Y7PAezP6ijvZZd9A`;

// const connection = new solana.Connection(solana.clusterApiUrl('mainnet-beta'), 'confirmed');

// const solanaSigner = new CapsuleSolanaWeb3Signer(capsuleClient as CoreCapsule, connection);

const graphQLClient = new GraphQLClient(endpoint, {
  method: `POST`,
  jsonSerializer: {
    parse: JSON.parse,
    stringify: JSON.stringify,
  },
});

const jupiterQuoteApi = createJupiterApiClient();

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | undefined>("");
  const [userShare, setUserShare] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [logs, setLogs] = useState<Array<{ message: string; type: "info" | "error" | "success" }>>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [isStorageComplete, setIsStorageComplete] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(WalletType.SOLANA);
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [lpPair, setLpPair] = useState<string | undefined>();
  const [solAmount, setSolAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'app' | 'chart'>('app');

  useEffect(() => {
    initializeApp();
  }, []);

  interface LiquidityPoolResponse {
    Raydium_LiquidityPoolv4: Array<{ pubkey: string }>;
  }

  async function queryLpPair(tokenOne:string) {
      const query = gql`
          query MyQuery($where: Raydium_LiquidityPoolv4_bool_exp,
          $order_by: [Raydium_LiquidityPoolv4_order_by!]) {
      Raydium_LiquidityPoolv4(
          where: $where
          order_by: $order_by
      ) {
          amountWaveRatio
          baseDecimal
          baseLotSize
          baseMint
          baseNeedTakePnl
          baseTotalPnl
          baseVault
          depth
          lpMint
          lpReserve
          lpVault
          marketId
          marketProgramId
          maxOrder
          maxPriceMultiplier
          minPriceMultiplier
          minSeparateDenominator
          minSeparateNumerator
          minSize
          nonce
          openOrders
          orderbookToInitTime
          owner
          pnlDenominator
          pnlNumerator
          poolOpenTime
          punishCoinAmount
          punishPcAmount
          quoteDecimal
          quoteLotSize
          quoteMint
          quoteNeedTakePnl
          quoteTotalPnl
          quoteVault
          resetFlag
          state
          status
          swapBase2QuoteFee
          swapBaseInAmount
          swapBaseOutAmount
          swapFeeDenominator
          swapFeeNumerator
          swapQuote2BaseFee
          swapQuoteInAmount
          swapQuoteOutAmount
          systemDecimalValue
          targetOrders
          tradeFeeDenominator
          tradeFeeNumerator
          volMaxCutRatio
          withdrawQueue
          pubkey
      }
      }`;

      const variables = {
          where: {
          _or: [
                {baseMint:{_eq:tokenOne}},
                {quoteMint:{_eq:tokenOne}},  
          ]},
          order_by: [
              {
                  lpReserve: "desc"
              }
          ]
      };

      const data = await graphQLClient.request<LiquidityPoolResponse>(query, variables);
      setLpPair(data.Raydium_LiquidityPoolv4[0]?.pubkey);
  }

  async function getQuote() {
    // basic params
    // const params: QuoteGetRequest = {
    //   inputMint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    //   outputMint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    //   amount: 35281,
    //   slippageBps: 50,
    //   onlyDirectRoutes: false,
    //   asLegacyTransaction: false,
    // }

    // auto slippage w/ minimizeSlippage params
    const params: QuoteGetRequest = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // $WIF
        amount: 100000000, // 0.1 SOL
        autoSlippage: true,
        autoSlippageCollisionUsdValue: 1_000,
        maxAutoSlippageBps: 1000, // 10%
        minimizeSlippage: true,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
    };

    // get quote
    const quote = await jupiterQuoteApi.quoteGet(params);
    log(JSON.stringify(quote), "info");

    if (!quote) {
        throw new Error("unable to quote");
    }
    return quote;
}

  useEffect(() => {
      queryLpPair(tokenAddress);
      // getQuote();
  }, [tokenAddress]);

  const initializeApp = async () => {
    setIsLoading(true);
    setLoadingText("Initializing Capsule Telegram Mini App Demo...");

    try {
      WebApp.ready();

      const username = WebApp.initDataUnsafe.user?.username;
      if (!username) throw new Error("Username not found");

      if (!WebApp.initDataUnsafe.user) {
        throw new Error("No User found. Please open App from Telegram");
      }

      log(`User authenticated: ${username}`, "success");
      setIsAuthenticated(true);
      setLoadingText(
        `Checking ${username}'s telegram cloud storage for existing wallet data...`
      );
      const userShare = await retrieveChunkedData("userShare", log, handleError);
      const walletId = await retrieveChunkedData("walletId", log, handleError);

      await getQuote();

      if (userShare && walletId) {
        setUserShare(userShare);
        setWalletId(walletId);
        setIsStorageComplete(true);
        log(`Wallet data found: ${walletId}`, "success");
        await capsuleClient.setUserShare(userShare);

        const pregenWallet = await capsuleClient.getAddress(walletId);
        // const pregenWallet = pregenWallets[0].address || "";
        setAddress(pregenWallet);
      } else {
        log(`No existing wallet data found for user ${WebApp.initDataUnsafe.user.username}`, "info");
      }
    } catch (error) {
      handleError(`Initialization error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      setLoadingText("");
    }
  };

  const log: LogFunction = (message, type) => {
    setLogs((prevLogs) => [...prevLogs, { message, type }]);
  };

  const handleError: ErrorHandler = (errorMessage) => log(errorMessage, "error");

  const generateWallet = async (): Promise<void> => {
    setIsLoading(true);
    setLoadingText("Generating a new wallet...");
    try {
      const username = WebApp.initDataUnsafe.user?.username;
      if (!username) throw new Error("Username not found");

      const pregenWallet = await capsuleClient.createWalletPreGen(
        WalletType.SOLANA,
        `${username + crypto.randomUUID().split("-")[0]}@test.usecapsule.com`
      );


      log(`Wallet created with ID: ${pregenWallet.id} and Address: ${pregenWallet.address || "N/A"}`, "success");

      const share = (await capsuleClient.getUserShare()) || "";

      // Update state immediately
      setUserShare(share);
      setAddress(pregenWallet.address);
      setWalletId(pregenWallet.id);
      setWalletType(pregenWallet?.type || WalletType.SOLANA);
      // Start asynchronous storage operations
      log("Storing the wallet data in users telegram cloud storage...", "info");
      log("This may take a few seconds. The wallet is now usable, but please DO NOT close the mini-app while this is in progress", "info");

      Promise.all([
        storeWithChunking("userShare", share, log, handleError),
        storeWithChunking("walletId", pregenWallet.id, log, handleError),
      ])
        .then(() => {
          log("Wallet data stored successfully", "success");
          setIsStorageComplete(true);
        })
        .catch((error) => {
          handleError(`Error storing wallet data: ${error instanceof Error ? error.message : String(error)}`);
          setIsStorageComplete(true);
        });
    } catch (error) {
      handleError(`Error generating wallet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      setLoadingText("");
    }
  };
  const signMessage = async () => {
    if (!walletId || !userShare) {
      handleError("Wallet ID or User Share not available to sign message");
      return;
    }

    setIsLoading(true);
    setLoadingText(`Signing message "${message}"...`);
    try {
      await capsuleClient.setUserShare(userShare);
      const messageBase64 = btoa(message);
      const sig = await capsuleClient.signMessage(walletId, messageBase64);

      if ("transactionReviewUrl" in sig) {
        throw new Error(`Error: Transaction review required: ${sig.transactionReviewUrl}`);
      }
      setSignature(sig.signature);
      log(`Message signed successfully`, "success");
    } catch (error) {
      handleError(`Error signing message: ${error}`);
    } finally {
      setIsLoading(false);
      setLoadingText("");
    }
  };

  const clearStorage = async () => {
    setIsLoading(true);
    setLoadingText("Clearing storage and resetting state...");
    try {
      await clearChunkedStorage(log, handleError);
      setUserShare(null);
      setWalletId(null);
      setIsStorageComplete(false);
      log("Finished clearing storage and resetting state", "success");
    } catch (error) {
      handleError(`Error clearing storage: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      setLoadingText("");
    }
  };

  const logout = () => {
    log("Logging out...", "info");
    WebApp.close();
  };

  const copyWalletAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
        .then(() => {
          // toast({
          //   title: "Address Copied",
          //   description: "Wallet address has been copied to clipboard",
          // });
          log("Wallet address copied to clipboard", "success");
        })
        .catch((error) => {
          handleError(`Failed to copy address: ${error}`);
        });
    } else {
      handleError("No wallet address available to copy");
    }
  };

  const handleTokenAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenAddress(e.target.value);
  };

  const handleSolAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSolAmount(e.target.value);
  };

  const executeSwap = async () => {
    if (!solAmount || !tokenAddress || !walletId || !userShare) {
      handleError("Missing required information for swap");
      return;
    }

    setIsLoading(true);
    setLoadingText("Executing swap...");

    try {
      // Convert SOL amount to lamports
      const lamports = Math.floor(parseFloat(solAmount) * 1e9);

      // Get quote from Jupiter
      const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=${lamports}&slippageBps=50`).then(res => res.json());

      // Get swap transaction
      const { swapTransaction } = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: address,
          wrapAndUnwrapSol: true
        })
      }).then(res => res.json());

      // Deserialize the transaction
      // const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      // const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign and send the transaction
      await capsuleClient.setUserShare(userShare);
      const signedTx = await capsuleClient.signTransaction(walletId, swapTransaction, 'mainnet-beta');
      log(`Signed transaction: ${signedTx}`, "success");
      // await capsuleClient.sendTransaction(walletId, swapTransaction, 'mainnet-beta');
      // const signedTx = await capsuleClient.signTransaction(walletId, transaction);

      // Send the signed transaction
      // const connection = new Connection('https://api.mainnet-beta.solana.com');
      // const signature = await connection.sendRawTransaction(signedTx.serialize());

      log(`Swap executed successfully. Transaction signature: ${signature}`, "success");
    } catch (error) {
      handleError(`Error executing swap: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      setLoadingText("");
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen">
      <div className="flex-grow overflow-auto">
        {activeTab === 'app' ? (
          // Main app content
          <>
            <div className="header">
              <Button variant={"link"}>
                <a href="https://usecapsule.com" target="_blank">Capsule</a>
              </Button>
              <Button variant={"link"}>
                <a href="https://docs.usecapsule.com" target="_blank">Docs</a>
              </Button>
              <Button variant={"link"}>
                <a href="https://developer.usecapsule.com" target="_blank">Get Access</a>
              </Button>
              <Button
                variant={"link"}
                onClick={logout}
                disabled={!isStorageComplete}>
                ❌ Close App
              </Button>
            </div>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{isAuthenticated ? "Wallet Manager" : "Capsule TG App Example"}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {!isAuthenticated ? (
                  <p>Authenticating...</p>
                ) : !walletId ? (
                  <div className="flex justify-between">
                    <Button
                      onClick={generateWallet}
                      disabled={isLoading}>
                      {isLoading ? <Spinner /> : "Create New Wallet"}
                    </Button>
                    <p></p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[12px] truncate mr-2">{`Wallet Address: ${address}`}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyWalletAddress}
                        disabled={!address}>
                        Copy
                      </Button>
                      <p>{walletType}</p>
                    </div>
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Message to sign"
                      className="mb-2 bg-card"
                    />
                    <Button
                      variant={"outline"}
                      onClick={signMessage}
                      className="mb-2"
                      disabled={isLoading || !message}>
                      {isLoading ? <Spinner /> : "Sign Message"}
                    </Button>
                    {signature && <p className="mb-2 break-all">Signature: {signature}</p>}
                    {lpPair && <p className="mb-2 break-all">LP Pair: {lpPair}</p>}
                    <div>
                      <Button
                        onClick={clearStorage}
                        className="ml-2"
                        disabled={isLoading}>
                        Clear Storage
                      </Button>
                    </div>
                    <Input
                      value={tokenAddress}
                      onChange={handleTokenAddressChange}
                      placeholder="Paste Solana token address"
                      className="mb-2 bg-card"
                    />
                    <Input
                      value={solAmount}
                      onChange={handleSolAmountChange}
                      placeholder="Enter SOL amount to swap"
                      className="mb-2 bg-card"
                      type="number"
                      step="0.000000001"
                      min="0"
                    />
                    <Button
                      onClick={executeSwap}
                      disabled={isLoading || !solAmount || !tokenAddress}
                      className="mb-2"
                    >
                      {isLoading ? <Spinner /> : "Swap SOL for Token"}
                    </Button>
                  </>
                )}
                {loadingText && <p className="mt-2">{loadingText}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex justify-between flex-row">
                <CardTitle>App Logs</CardTitle>
                <Button
                  size={"sm"}
                  variant={"outline"}
                  onClick={() => setShowLogs(!showLogs)}>
                  {showLogs ? 'Hide' : 'Show'}
                </Button>
                <Button
                  size={"sm"}
                  disabled={logs.length === 0}
                  variant={"outline"}
                  onClick={() => setLogs([])}>
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="overflow-auto max-h-60">
                <p>{userShare ? (isStorageComplete ? `Wallet Stored: ✅` : `Wallet Stored: In Progress`) : ``}</p>
                <p>{userShare ? (isLoading ? `Wallet Fetched: In Progress` : `Wallet Fetched: ✅`) : ``}</p>
                <div className="font-mono text-[12px]">
                  {!!showLogs && (
                    logs.length === 0 ? (
                      <p>No logs yet.</p>
                    ) : (
                      logs.map((log, index) => (
                        <p
                          key={index}
                          className={`${log.type === "error" ? "text-red-500" : log.type === "success" ? "text-green-500" : ""}`}>
                          {log.message}
                        </p>
                      ))
                    ))
                  }
                </div>
                </CardContent>
            </Card>
          </>
        ) : (
          // Chart iframe
          <div className="h-full w-full">
            {lpPair && (
              <iframe
                src={`https://www.geckoterminal.com/solana/pools/${lpPair}?embed=1&info=0&swaps=0`}
                className="w-full h-full border-0"
                title="GeckoTerminal Embed"
              />
            )}
          </div>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <div className="flex justify-around items-center h-16 bg-gray-100 mt-4">
        <Button
          onClick={() => setActiveTab('app')}
          variant={activeTab === 'app' ? "default" : "outline"}
        >
          App
        </Button>
        <Button
          onClick={() => setActiveTab('chart')}
          variant={activeTab === 'chart' ? "default" : "outline"}
          disabled={!lpPair}
        >
          Chart
        </Button>
      </div>
    </div>
  );
};

export default App;