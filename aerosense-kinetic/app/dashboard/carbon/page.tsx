"use client";

import { useState, useEffect, useCallback } from "react";
import { Leaf, TrendingUp, ArrowLeftRight, Plus, X, ShoppingCart, Clock, Filter } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";

interface Listing {
  id: number;
  type: "sell" | "buy";
  sellerEmail: string | null;
  buyerEmail: string | null;
  creditsAmount: number;
  remainingCredits: number;
  pricePerCredit: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: number;
  fromEmail: string;
  toEmail: string;
  amount: number;
  totalPrice: number;
  createdAt: string;
}

interface Balance {
  companyId: number;
  carbonCredits: number;
}

type MarketFilter = "all" | "sell" | "buy";

export default function CarbonMarketPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [buyRequests, setBuyRequests] = useState<Listing[]>([]);
  const [myBuyRequests, setMyBuyRequests] = useState<Listing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [activeTab, setActiveTab] = useState<"market" | "activity">("market");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [showSellModal, setShowSellModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyMaxPrice, setBuyMaxPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [listingsRes, myListingsRes, buyRequestsRes, myBuyRequestsRes, txRes, balanceRes] =
        await Promise.all([
          axiosInstance.get("/carbon/listings"),
          axiosInstance.get("/carbon/my-listings"),
          axiosInstance.get("/carbon/buy-requests"),
          axiosInstance.get("/carbon/my-buy-requests"),
          axiosInstance.get("/carbon/transactions"),
          axiosInstance.get("/carbon/balance"),
        ]);
      setListings(listingsRes.data);
      setMyListings(myListingsRes.data);
      setBuyRequests(buyRequestsRes.data);
      setMyBuyRequests(myBuyRequestsRes.data);
      setTransactions(txRes.data);
      setBalance(balanceRes.data);
    } catch {
      setError("Failed to load market data.");
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleBuy = async (listingId: number) => {
    setError(null);
    try {
      await axiosInstance.post(`/carbon/listings/${listingId}/buy`);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Purchase failed.");
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await axiosInstance.post("/carbon/listings", {
        creditsAmount: parseFloat(sellAmount),
        pricePerCredit: parseFloat(sellPrice),
      });
      setShowSellModal(false);
      setSellAmount("");
      setSellPrice("");
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Failed to create listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBuyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await axiosInstance.post("/carbon/buy-requests", {
        creditsAmount: parseFloat(buyAmount),
        pricePerCredit: parseFloat(buyMaxPrice),
      });
      setShowBuyModal(false);
      setBuyAmount("");
      setBuyMaxPrice("");
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Failed to place buy request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSellVolume = listings.reduce((sum, l) => sum + l.remainingCredits, 0);
  const totalBuyVolume = buyRequests.reduce((sum, r) => sum + r.remainingCredits, 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const showSellCards = marketFilter === "all" || marketFilter === "sell";
  const showBuyCards = marketFilter === "all" || marketFilter === "buy";
  const hasMarketItems =
    (showSellCards && listings.length > 0) || (showBuyCards && buyRequests.length > 0);

  return (
    <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
            <Leaf size={22} className="text-[#009B9E]" />
            Carbon Market
          </h1>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
            Carbon Credit Trading Platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBuyModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#F28C28] text-white text-sm font-bold rounded-2xl hover:bg-[#d4741a] transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
          >
            <ShoppingCart size={16} />
            Buy Request
          </button>
          <button
            onClick={() => setShowSellModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#009B9E] text-white text-sm font-bold rounded-2xl hover:bg-[#007d80] transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
          >
            <Plus size={16} />
            Sell Credits
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={16} /></button>
        </div>
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Credit Balance</p>
          <p className="text-2xl font-black text-[#005A8C] mt-1">
            {balance ? balance.carbonCredits.toLocaleString() : "—"}
          </p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">tCO₂e</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sell Orders</p>
          <p className="text-2xl font-black text-[#009B9E] mt-1">{listings.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalSellVolume.toLocaleString()} tCO₂e available</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Open Buy Requests</p>
          <p className="text-2xl font-black text-[#F28C28] mt-1">{buyRequests.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalBuyVolume.toLocaleString()} tCO₂e wanted</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Transactions</p>
          <p className="text-2xl font-black text-gray-700 mt-1">{transactions.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">total trades</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 bg-white border border-gray-200/60 rounded-2xl p-1.5 w-fit shadow-sm">
        {(["market", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-[#005A8C] text-white shadow-sm"
                : "text-gray-500 hover:text-[#005A8C]"
            }`}
          >
            {tab === "market" ? "Marketplace" : "My Activity"}
          </button>
        ))}
      </div>

      {/* Marketplace Tab */}
      {activeTab === "market" && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <div className="flex gap-1.5">
              {(["all", "sell", "buy"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMarketFilter(f)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    marketFilter === f
                      ? f === "sell"
                        ? "bg-[#009B9E] text-white"
                        : f === "buy"
                        ? "bg-[#F28C28] text-white"
                        : "bg-[#005A8C] text-white"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {f === "all"
                    ? "All Orders"
                    : f === "sell"
                    ? `Sell Orders (${listings.length})`
                    : `Buy Requests (${buyRequests.length})`}
                </button>
              ))}
            </div>
          </div>

          {!hasMarketItems ? (
            <div className="bg-white border border-gray-200/60 rounded-[2rem] p-16 text-center shadow-sm">
              <Leaf size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="font-black text-gray-400">No orders found</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the buttons above to create a sell listing or buy request
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Sell listing cards */}
              {showSellCards && listings.map((listing) => (
                <div
                  key={`sell-${listing.id}`}
                  className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm hover:border-[#009B9E]/40 hover:shadow-md transition-all flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Seller</p>
                      <p className="text-sm font-black text-gray-800 mt-0.5 truncate max-w-[180px]">
                        {listing.sellerEmail}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      SELL
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-gray-50 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Available</p>
                      <p className="text-xl font-black text-[#005A8C] mt-0.5">
                        {listing.remainingCredits.toLocaleString()}
                        <span className="text-xs font-normal text-gray-400 ml-1">tCO₂e</span>
                      </p>
                      {listing.remainingCredits < listing.creditsAmount && (
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          of {listing.creditsAmount.toLocaleString()} listed
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Price/Credit</p>
                      <p className="text-xl font-black text-[#F28C28] mt-0.5">
                        ${listing.pricePerCredit.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400">Total Value</p>
                      <p className="text-sm font-black text-gray-700">${listing.totalPrice.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleBuy(listing.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#005A8C] text-white text-xs font-bold rounded-xl hover:bg-[#00426b] transition-all cursor-pointer"
                    >
                      <ShoppingCart size={13} />
                      Buy
                    </button>
                  </div>
                </div>
              ))}

              {/* Buy request cards */}
              {showBuyCards && buyRequests.map((req) => (
                <div
                  key={`buy-${req.id}`}
                  className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm hover:border-[#F28C28]/40 hover:shadow-md transition-all flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyer</p>
                      <p className="text-sm font-black text-gray-800 mt-0.5 truncate max-w-[180px]">
                        {req.buyerEmail}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      BUY
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-gray-50 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Wants</p>
                      <p className="text-xl font-black text-[#F28C28] mt-0.5">
                        {req.remainingCredits.toLocaleString()}
                        <span className="text-xs font-normal text-gray-400 ml-1">tCO₂e</span>
                      </p>
                      {req.remainingCredits < req.creditsAmount && (
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          of {req.creditsAmount.toLocaleString()} requested
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Max Price</p>
                      <p className="text-xl font-black text-[#005A8C] mt-0.5">
                        ${req.pricePerCredit.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400">Max Total</p>
                      <p className="text-sm font-black text-gray-700">
                        ${(req.remainingCredits * req.pricePerCredit).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                      OPEN
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Activity Tab */}
      {activeTab === "activity" && (
        <div className="flex flex-col gap-6">

          {/* My Active Sell Listings */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-[#009B9E]" />
              My Active Sell Listings
            </h2>
            {myListings.length === 0 ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                No active sell listings. Click "Sell Credits" to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#009B9E]/10 flex items-center justify-center">
                        <Leaf size={16} className="text-[#009B9E]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {listing.remainingCredits.toLocaleString()} tCO₂e
                          <span className="text-xs font-normal text-gray-400 ml-2">
                            @ ${listing.pricePerCredit}/credit
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">
                          Listed {formatDate(listing.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-[#F28C28]">${listing.totalPrice.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Buy Requests */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <ShoppingCart size={16} className="text-[#F28C28]" />
              My Buy Requests
            </h2>
            {myBuyRequests.length === 0 ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                No buy requests yet. Click "Buy Request" to place one.
              </div>
            ) : (
              <div className="space-y-3">
                {myBuyRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#F28C28]/10 flex items-center justify-center">
                        <ShoppingCart size={16} className="text-[#F28C28]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {req.creditsAmount.toLocaleString()} tCO₂e
                          <span className="text-xs font-normal text-gray-400 ml-2">
                            @ max ${req.pricePerCredit}/credit
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">
                          {req.remainingCredits > 0
                            ? `${req.remainingCredits.toLocaleString()} tCO₂e unfilled`
                            : "Fully filled"}{" "}
                          · Placed {formatDate(req.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        req.status === "filled"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : req.status === "cancelled"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-[#005A8C]" />
              Transaction History
            </h2>
            {transactions.length === 0 ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                No transactions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                        <ArrowLeftRight size={14} className="text-[#005A8C]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {tx.amount.toLocaleString()} tCO₂e
                        </p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">
                          {tx.fromEmail} → {tx.toEmail}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-700">${tx.totalPrice.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 justify-end mt-0.5">
                        <Clock size={10} />
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sell Credits Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-[#005A8C]">List Credits for Sale</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Balance: {balance ? balance.carbonCredits.toLocaleString() : "—"} tCO₂e
                </p>
              </div>
              <button
                onClick={() => setShowSellModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Credits Amount (tCO₂e)
                </label>
                <input
                  type="number" min="1" step="0.01" required
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Price per Credit (USD)
                </label>
                <input
                  type="number" min="0.01" step="0.01" required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="e.g. 12.50"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                />
              </div>
              {sellAmount && sellPrice && (
                <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Listing Value</p>
                  <p className="text-xl font-black text-[#005A8C] mt-0.5">
                    ${(parseFloat(sellAmount || "0") * parseFloat(sellPrice || "0")).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#009B9E] text-white font-bold rounded-2xl hover:bg-[#007d80] transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {isSubmitting ? "Creating Listing..." : "List for Sale"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Buy Request Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-[#F28C28]">Place Buy Request</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Auto-matches cheapest sell orders ≤ your max price
                </p>
              </div>
              <button
                onClick={() => setShowBuyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateBuyRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Credits Wanted (tCO₂e)
                </label>
                <input
                  type="number" min="1" step="0.01" required
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="e.g. 300"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Max Price per Credit (USD)
                </label>
                <input
                  type="number" min="0.01" step="0.01" required
                  value={buyMaxPrice}
                  onChange={(e) => setBuyMaxPrice(e.target.value)}
                  placeholder="e.g. 13.00"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/10 transition-all"
                />
              </div>
              {buyAmount && buyMaxPrice && (
                <div className="p-4 bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-xl">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Max Total Spend</p>
                  <p className="text-xl font-black text-[#F28C28] mt-0.5">
                    ${(parseFloat(buyAmount || "0") * parseFloat(buyMaxPrice || "0")).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#F28C28] text-white font-bold rounded-2xl hover:bg-[#d4741a] transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {isSubmitting ? "Placing Request..." : "Place Buy Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
