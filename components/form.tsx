"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// ============================================================
// KONFIGURASI UKURAN PRODUK
// Urutan ini WAJIB sama dengan urutan kolom di sheet "PO PW CUSTOMER":
// QTY ORDER = kolom G..O (termasuk GALON 19L)
// QTY BONUS = kolom T..AA (TIDAK ada galon)
// ============================================================
const ORDER_SIZES = [
  { key: "s250", label: "250 ML" },
  { key: "s330", label: "330 ML" },
  { key: "s350", label: "350 ML" },
  { key: "s550", label: "550 ML" },
  { key: "s500", label: "500 ML" },
  { key: "s600", label: "600 ML" },
  { key: "s750", label: "750 ML" },
  { key: "s1500", label: "1500 ML" },
  { key: "gln", label: "Galon 19L" },
] as const;

const BONUS_SIZES = ORDER_SIZES.filter((s) => s.key !== "gln");

type OrderSizeKey = (typeof ORDER_SIZES)[number]["key"];
type BonusSizeKey = Exclude<OrderSizeKey, "gln">;

const HARI_OPTIONS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

// Format nomor telepon jadi grup 4 digit dipisah strip, mis. "1234-1234-123"
// untuk 10 digit atau "1234-1234-1234" untuk 12 digit.
function formatNoPenerima(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.match(/.{1,4}/g)?.join("-") ?? digits;
}

function buildQtyShape<K extends string>(keys: readonly K[]) {
  return keys.reduce(
    (acc, key) => {
      acc[key] = z.coerce
        .number({ error: "Harus berupa angka" })
        .min(0, "Tidak boleh negatif")
        .default(0);
      return acc;
    },
    {} as Record<K, z.ZodTypeAny>,
  );
}

function buildEmptyQty<K extends string>(keys: readonly K[]) {
  return keys.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<K, number>,
  );
}

const orderKeys = ORDER_SIZES.map((s) => s.key);
const bonusKeys = BONUS_SIZES.map((s) => s.key);

const qtyOrderSchema = z.object(buildQtyShape(orderKeys));
const qtyBonusSchema = z.object(buildQtyShape(bonusKeys));

const emptyQtyOrder = buildEmptyQty(orderKeys);
const emptyQtyBonus = buildEmptyQty(bonusKeys);
const formSchema = z.object({
  namaSales: z.string().min(3, { message: "Nama sales minimal 3 karakter" }), // B
  jadwalKirimHari: z.enum(HARI_OPTIONS, {
    error: "Pilih hari jadwal kirim",
  }), // C
  tanggalKirim: z.string().min(1, { message: "Tanggal kirim wajib diisi" }), // D
  kodePelanggan: z.string().min(1, { message: "Kode pelanggan wajib diisi" }), // E
  namaPelanggan: z
    .string()
    .min(3, { message: "Nama pelanggan minimal 3 karakter" }), // F
  qtyOrder: qtyOrderSchema.refine(
    (qty) => Object.values(qty).some((v) => Number(v) > 0),
    { message: "Isi minimal 1 qty order" },
  ), // G-O
  maxKirimJam: z.string().optional(), // P (optional)
  alamatKirim: z
    .string()
    .min(8, { message: "Alamat kirim minimal 8 karakter" }), // Q
  penerima: z.string().min(3, { message: "Nama penerima minimal 3 karakter" }), // R
  noPenerima: z.string().refine(
    (val) => {
      const digits = val.replace(/\D/g, "");
      return (
        digits.length >= 10 &&
        digits.length <= 16 &&
        formatNoPenerima(val) === val
      );
    },
    { message: "Nomor penerima harus 10-16 digit, format 1234-1234-123" },
  ), // S
  qtyBonus: qtyBonusSchema, // T-AA, boleh semua 0
  catatan: z.string().optional(), // Catatan/deskripsi tambahan (optional)
});

type FormValues = z.infer<typeof formSchema>;

// ============================================================
// Komponen presentasional kecil (murni tampilan, tidak menyentuh logika)
// ============================================================
function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white">
      <div className="mb-6 flex items-start gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-alert">{message}</p>;
}

export default function FormPOHarian() {
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  // Ganti dengan URL deployment Web App Apps Script yang baru (lihat doPost.gs)
  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwM8b2sCUuoj7Pmggra5CbvHzzzk-wJ6ltd_jcATHoAII_BTd94JSI-m1Q3pgMdaxWc/exec";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      namaSales: "",
      jadwalKirimHari: undefined,
      tanggalKirim: "",
      kodePelanggan: "",
      namaPelanggan: "",
      qtyOrder: emptyQtyOrder,
      maxKirimJam: "",
      alamatKirim: "",
      penerima: "",
      noPenerima: "",
      qtyBonus: emptyQtyBonus,
      catatan: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const params = new URLSearchParams();
      params.append("nama_sales", data.namaSales);
      params.append("jadwal_kirim_hari", data.jadwalKirimHari);
      params.append("tanggal_kirim", data.tanggalKirim);
      params.append("kode_pelanggan", data.kodePelanggan);
      params.append("nama_pelanggan", data.namaPelanggan);

      // QTY ORDER -> qty_250, qty_330, ..., qty_gln
      ORDER_SIZES.forEach(({ key }) => {
        const paramKey = key === "gln" ? "qty_gln" : `qty_${key.slice(1)}`;
        params.append(paramKey, String(data.qtyOrder[key] ?? 0));
      });

      params.append("max_kirim_jam", data.maxKirimJam ?? "");
      params.append("alamat_kirim", data.alamatKirim);
      params.append("penerima", data.penerima);
      params.append("no_penerima", data.noPenerima);

      // QTY BONUS -> bonus_250, bonus_330, ..., bonus_1500 (tidak ada bonus_gln)
      BONUS_SIZES.forEach(({ key }) => {
        params.append(`bonus_${key.slice(1)}`, String(data.qtyBonus[key] ?? 0));
      });

      params.append("catatan", data.catatan ?? "");

      // "NO" tidak perlu dikirim — otomatis dihitung oleh script (baris terakhir)
      // "STATUS KIRIM" tidak diisi lewat form — diisi manual di sheet oleh admin

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      reset();
      setShowSuccessDialog(true);
      setTimeout(() => setShowSuccessDialog(false), 3000);
    } catch {
      setShowErrorDialog(true);
      setTimeout(() => setShowErrorDialog(false), 3000);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-utama focus:ring-4 focus:ring-utama/10";

  const qtyInputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-utama focus:ring-4 focus:ring-utama/10";

  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  const qtyLabelClass = "mb-1 block text-xs font-medium text-gray-500";

  const { onChange: onNoPenerimaChange, ...noPenerimaRegister } =
    register("noPenerima");

  return (
    <>
      <div className="mx-auto w-full max-w-5xl">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-6"
        >
          {/* Sales & Jadwal */}
          <SectionCard title="Sales & Jadwal Kirim">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label className={labelClass}>Nama Sales*</label>
                <input
                  type="text"
                  {...register("namaSales")}
                  className={inputClass}
                />
                <FieldError message={errors.namaSales?.message} />
              </div>

              <div>
                <label className={labelClass}>Jadwal Kirim (Hari)*</label>
                <select
                  {...register("jadwalKirimHari")}
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Pilih hari
                  </option>
                  {HARI_OPTIONS.map((hari) => (
                    <option key={hari} value={hari}>
                      {hari}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.jadwalKirimHari?.message} />
              </div>

              <div>
                <label className={labelClass}>Tanggal Kirim*</label>
                <input
                  type="date"
                  {...register("tanggalKirim")}
                  className={inputClass}
                />
                <FieldError message={errors.tanggalKirim?.message} />
              </div>
            </div>
          </SectionCard>

          {/* Pelanggan */}
          <SectionCard title="Data Pelanggan">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Kode Pelanggan*</label>
                <input
                  type="text"
                  {...register("kodePelanggan")}
                  className={inputClass}
                />
                <FieldError message={errors.kodePelanggan?.message} />
              </div>

              <div>
                <label className={labelClass}>Nama Pelanggan*</label>
                <input
                  type="text"
                  {...register("namaPelanggan")}
                  className={inputClass}
                />
                <FieldError message={errors.namaPelanggan?.message} />
              </div>
            </div>
          </SectionCard>

          {/* QTY ORDER */}
          <SectionCard
            title="Qty Order"
            description="Isi minimal 1 ukuran produk yang dipesan."
          >
            <div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {ORDER_SIZES.map(({ key, label }) => (
                  <div key={key}>
                    <label className={qtyLabelClass}>{label}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      {...register(`qtyOrder.${key}` as const)}
                      className={qtyInputClass}
                    />
                  </div>
                ))}
              </div>
              <FieldError
                message={errors.qtyOrder?.message as string | undefined}
              />
            </div>
          </SectionCard>

          {/* Info kirim lanjutan */}
          <SectionCard title="Detail Pengiriman">
            <div>
              <label className={labelClass}>Max Kirim Jam (Opsional)</label>
              <input
                type="time"
                {...register("maxKirimJam")}
                className={`${inputClass} sm:w-48`}
              />
              <FieldError message={errors.maxKirimJam?.message} />
            </div>

            <div>
              <label className={labelClass}>Alamat Kirim*</label>
              <textarea
                rows={3}
                {...register("alamatKirim")}
                className={`${inputClass} resize-none`}
              />
              <FieldError message={errors.alamatKirim?.message} />
            </div>
          </SectionCard>

          {/* Info Penerima */}
          <SectionCard title="Informasi Penerima">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Penerima*</label>
                <input
                  type="text"
                  {...register("penerima")}
                  className={inputClass}
                />
                <FieldError message={errors.penerima?.message} />
              </div>

              <div>
                <label className={labelClass}>
                  No. Penerima* (10-16 digit, cth. 0812-1234-123)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={19}
                  placeholder="0812-1234-123"
                  {...noPenerimaRegister}
                  onChange={(e) => {
                    e.target.value = formatNoPenerima(e.target.value);
                    onNoPenerimaChange(e);
                  }}
                  className={inputClass}
                />
                <FieldError message={errors.noPenerima?.message} />
              </div>
            </div>
          </SectionCard>

          {/* QTY BONUS */}
          <SectionCard
            title="Qty Bonus"
            description="Silakan isi jika tersedia bonus"
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {BONUS_SIZES.map(({ key, label }) => (
                <div key={key}>
                  <label className={qtyLabelClass}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    {...register(`qtyBonus.${key}` as const)}
                    className={qtyInputClass}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className={labelClass}>Catatan (Opsional)</label>
              <textarea
                rows={3}
                placeholder="Tambahkan catatan atau deskripsi tambahan jika diperlukan..."
                {...register("catatan")}
                className={`${inputClass} resize-none`}
              />
              <FieldError message={errors.catatan?.message} />
            </div>
          </SectionCard>

          {/* Submit Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-utama px-8 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-400 hover:shadow disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Mengirim...
                </>
              ) : (
                "Kirim PO"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-10 w-10 text-green-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-lg font-semibold text-gray-900">
              PO berhasil dikirim
            </h2>
            <p className="text-center text-sm text-gray-500 pt-1.5">
              Terima kasih. Data sudah masuk ke sheet PO PW CUSTOMER.
            </p>
            <div className="flex justify-center pt-6">
              <button
                onClick={() => setShowSuccessDialog(false)}
                className="rounded-full border border-gray-200 px-8 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {showErrorDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-10 w-10 text-alert"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0 3.75h.007M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-lg font-semibold text-gray-900">
              Terjadi kesalahan
            </h2>
            <p className="text-center text-sm text-gray-500 pt-1.5">
              PO gagal terkirim. Silakan coba lagi.
            </p>
            <div className="flex justify-center pt-6">
              <button
                onClick={() => setShowErrorDialog(false)}
                className="rounded-full border border-gray-200 px-8 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
