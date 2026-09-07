import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className="flex items-center gap-2 rounded-md border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
