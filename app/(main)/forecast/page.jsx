import Forecast from "@/app/components/forecast/Forecast";

export const metadata = { title: "Prediksi" };

export default function ForecastPage() {
  return (
    <main className="p-4 md:p-6">
      <Forecast />
    </main>
  );
}