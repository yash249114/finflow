import LoadingSpinner from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-500 font-mono">Loading...</p>
      </div>
    </div>
  );
}
