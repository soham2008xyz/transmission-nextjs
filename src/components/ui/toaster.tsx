import { useToast } from "@/lib/useToast";

export function Toaster() {
  // This component should be placed at the root of your app (e.g., in layout or main page)
  // It renders the toast notifications using shadcn/ui
  const { toasts } = useToast();
  return (
    <div className='fixed top-0 right-0 z-50 p-4 space-y-2'>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`bg-white dark:bg-gray-900 border rounded shadow-lg px-4 py-2 ${
            toast.variant === "destructive"
              ? "border-red-500"
              : "border-gray-200"
          }`}>
          <div className='font-semibold'>{toast.title}</div>
          {toast.description && (
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              {toast.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
