"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AmountBadge from "@/components/ui/amount-badge";
import CategoryBadge from "@/components/ui/category-badge";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  source: string;
  created_at: string;
}

interface UploadError {
  row: number;
  reason: string;
}

interface UploadResult {
  uploaded: number;
  failed: number;
  errors: UploadError[];
}

export default function TransactionsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filters states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    startDate: "",
    endDate: "",
    category: "",
    search: "",
  });

  // CSV Drag and drop / Upload states
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showErrorAccordion, setShowErrorAccordion] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Categories list for filter dropdown
  const categories = [
    "Revenue",
    "Payroll",
    "Infrastructure",
    "Office",
    "Meals",
    "Marketing",
    "Contractors",
    "Utilities",
    "Travel",
    "Other",
  ];

  // Fetch transactions list
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    
    // Build query params
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (activeFilters.startDate) params.append("start_date", activeFilters.startDate);
    if (activeFilters.endDate) params.append("end_date", activeFilters.endDate);
    if (activeFilters.category) params.append("category", activeFilters.category);

    try {
      const res = await fetch(`${API_URL}/api/v1/transactions?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        let list = data.data || [];
        
        // Client-side search filtering on descriptions since backend doesn't support search natively
        if (activeFilters.search) {
          const s = activeFilters.search.toLowerCase();
          list = list.filter((tx: Transaction) => 
            tx.description.toLowerCase().includes(s)
          );
        }

        setTransactions(list);
        setTotalCount(data.pagination?.total || list.length);
      } else {
        toast.error("Failed to fetch transactions");
      }
    } catch {
      toast.error("Connection error while loading transactions");
    } finally {
      setLoading(false);
    }
  }, [page, limit, activeFilters, API_URL]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Apply filters
  const handleApplyFilters = () => {
    setPage(1);
    setActiveFilters({ startDate, endDate, category, search });
  };

  // Clear filters
  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCategory("");
    setSearch("");
    setPage(1);
    setActiveFilters({ startDate: "", endDate: "", category: "", search: "" });
  };

  // Filter count indicator
  const getFilterCount = () => {
    let count = 0;
    if (activeFilters.startDate) count++;
    if (activeFilters.endDate) count++;
    if (activeFilters.category) count++;
    if (activeFilters.search) count++;
    return count;
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const f = droppedFiles[0];
      if (f.name.endsWith(".csv")) {
        setFile(f);
        setUploadResult(null);
      } else {
        toast.error("Please drop a valid CSV file");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFile(selectedFiles[0]);
      setUploadResult(null);
    }
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadResult(null);
  };

  // Submit CSV Upload
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(20);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(50);

      const res = await fetch(`${API_URL}/api/v1/transactions/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      setUploadProgress(85);

      if (res.ok) {
        const data: UploadResult = await res.json();
        setUploadResult(data);
        setFile(null);
        toast.success(`Upload completed. ${data.uploaded} rows parsed successfully.`);
        
        // Refresh local data
        fetchTransactions();
      } else {
        toast.error("Failed to upload CSV file.");
      }
    } catch {
      toast.error("Connection error during CSV upload.");
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  // Format relative date (e.g. "2 days ago")
  const formatRelativeDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      return `${diffDays} days ago`;
    } catch {
      return "Recently";
    }
  };

  const filterCount = getFilterCount();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <h1 className="text-3xl font-bold tracking-tight text-white">Transactions</h1>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
          {totalCount} total
        </span>
      </div>

      {/* CSV Upload Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-bold text-white mb-4">Import Transactions</h3>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={file ? undefined : handleSelectFileClick}
          className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
            file
              ? "border-gray-800 bg-gray-950/20 cursor-default"
              : isDragOver
              ? "border-blue-500 bg-blue-500/5 scale-[1.01] cursor-pointer"
              : "border-gray-850 hover:border-gray-700 bg-gray-950/30 hover:bg-gray-950/50 cursor-pointer"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />

          {!file ? (
            <div className="space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drop your CSV file here</p>
                <p className="text-xs text-text-muted mt-1">or click to browse local directories</p>
              </div>
              <p className="text-[10px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                Accepts .csv statements exported from QuickBooks, Xero, Wave, or any standard bank ledger.
              </p>
            </div>
          ) : (
            <div className="space-y-4 w-full max-w-md">
              <div className="flex items-center justify-between bg-gray-950 p-4 rounded-xl border border-gray-800">
                <div className="flex items-center space-x-3 min-w-0">
                  <FileSpreadsheet className="h-8 w-8 text-blue-400 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="rounded-lg p-2 text-text-muted hover:bg-gray-900 hover:text-danger transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {!uploading ? (
                <Button
                  onClick={handleUpload}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Upload {file.name}
                </Button>
              ) : (
                <div className="space-y-2">
                  {/* Custom animated progress bar */}
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-text-muted animate-pulse">
                    Processing rows and extracting categories...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Results report */}
        {uploadResult && (
          <div className="mt-6 bg-gray-950 rounded-xl p-5 border border-gray-850 animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-success">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Import Complete</h4>
                  <p className="text-xs text-text-muted">
                    {uploadResult.uploaded} transactions imported successfully.
                  </p>
                </div>
              </div>

              {uploadResult.failed > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-warning">
                    {uploadResult.failed} failed rows
                  </span>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </div>
              )}
            </div>

            {/* Error logs Accordion */}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowErrorAccordion(!showErrorAccordion)}
                  className="w-full bg-gray-900 px-4 py-3 text-xs font-semibold text-gray-300 hover:text-white flex justify-between items-center select-none"
                >
                  <span>{showErrorAccordion ? "Hide details" : "Show details on failed rows"}</span>
                  <span>{showErrorAccordion ? "▲" : "▼"}</span>
                </button>

                {showErrorAccordion && (
                  <div className="max-h-48 overflow-y-auto bg-gray-950 p-3 divide-y divide-gray-900">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="text-text-muted font-bold">
                          <th className="pb-2">Row #</th>
                          <th className="pb-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-900">
                        {uploadResult.errors.map((err, i) => (
                          <tr key={i} className="text-gray-300">
                            <td className="py-2 pr-4 font-mono font-bold text-warning">Row {err.row}</td>
                            <td className="py-2 text-text-muted">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-4 shadow-md">
        {/* Date start */}
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date end */}
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-blue-500 focus:border-blue-500 h-8"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Search Description
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500 pl-8 h-8 text-xs rounded-lg"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2 shrink-0 h-8">
          <Button
            onClick={handleApplyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 h-8 rounded-lg"
          >
            <Filter className="h-3.5 w-3.5 mr-1" /> Apply
            {filterCount > 0 && (
              <span className="ml-1 bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[10px]">
                {filterCount}
              </span>
            )}
          </Button>

          {filterCount > 0 && (
            <Button
              onClick={handleClearFilters}
              className="border border-gray-700 hover:bg-gray-800 text-text-muted text-xs px-3 h-8 rounded-lg"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-6 w-[15%] bg-gray-800 rounded animate-pulse" />
                <div className="h-6 w-[45%] bg-gray-800 rounded animate-pulse" />
                <div className="h-6 w-[15%] bg-gray-800 rounded animate-pulse" />
                <div className="h-6 w-[15%] bg-gray-800 rounded animate-pulse" />
                <div className="h-6 w-[10%] bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <UploadCloud className="h-12 w-12 text-gray-700" />
            <div>
              <p className="text-sm font-semibold text-white">No transactions yet</p>
              <p className="text-xs text-text-muted mt-1">Upload your first CSV statement to get started</p>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold transition-all shadow-md"
            >
              Upload CSV
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs divide-y divide-gray-800 select-none">
              <thead className="bg-gray-950 text-text-muted uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-medium whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-semibold truncate max-w-[200px]" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-6 py-4">
                      <AmountBadge amount={tx.amount} />
                    </td>
                    <td className="px-6 py-4">
                      <CategoryBadge category={tx.category} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-gray-800 border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-text-muted">
                        {tx.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                      {formatRelativeDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {transactions.length > 0 && (
          <div className="bg-gray-950 border-t border-gray-850 px-6 py-4 flex items-center justify-between text-xs select-none">
            <span className="text-text-muted">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)} of {totalCount} transactions
            </span>

            <div className="flex items-center space-x-4">
              {/* Limit selector */}
              <div className="flex items-center space-x-2">
                <span className="text-text-muted">Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value));
                    setPage(1);
                  }}
                  className="bg-gray-800 border border-gray-750 text-white rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 h-7"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Prev/Next buttons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white disabled:text-gray-700 disabled:hover:bg-transparent hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold text-white px-2">Page {page}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * limit >= totalCount}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white disabled:text-gray-700 disabled:hover:bg-transparent hover:bg-gray-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
