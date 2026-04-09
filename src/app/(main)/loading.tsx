import { LoadingSpinner } from "@/components/loading-spinner";

export default function Loading() {
  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] w-full items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
