import Form from "@/components/form";

export default function FormPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 md:px-8">
        {/* Header */}
        <header className="flex items-end justify-between border-b border-gray-200 pb-6">
          <div>
            <h2 className="text-4xl font-semibold tracking-tight text-gray-900">
              PO Harian
            </h2>
            <p className="mt-1 text-sm text-smp-muted">
              Form pemesanan pengiriman harian
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-smp-muted">
            Tim Sales
          </span>
        </header>

        {/* Form */}
        <div className="flex flex-1 flex-col py-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-10">
            <Form />
          </div>
        </div>
      </div>
    </main>
  );
}
