import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchPatientDiet, logPatientMeal } from "@/services/clinicalService";

export const DietManager: React.FC = () => {
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [mealLogs, setMealLogs] = useState<any[]>([]);
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [foodItemsInput, setFoodItemsInput] = useState<string>("Oatmeal with berries, Green tea");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDiet();
  }, []);

  const loadDiet = async () => {
    try {
      setLoading(true);
      const data = await fetchPatientDiet();
      setDietPlan(data.diet_plan);
      setMealLogs(data.meal_logs);
    } catch (err) {
      console.error("Failed to load diet plan", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const items = foodItemsInput.split(",").map((i) => i.trim()).filter(Boolean);
      await logPatientMeal({
        meal_type: mealType,
        food_items: items,
      });
      setFoodItemsInput("");
      loadDiet();
    } catch (err) {
      console.error("Failed to log meal", err);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Diet & Nutritional Plan"
        title="Diet Management"
        meta="Follow your doctor's dietary recommendations and log your daily meals."
      />

      {loading ? (
        <div className="px-5 py-12 text-center font-mono text-sm text-stone sm:px-8">
          Loading diet recommendations…
        </div>
      ) : (
        <div className="px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Doctor Guidelines */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
            <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
              Doctor Recommendations
            </h2>
            <div className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-1">
              <span className="font-mono text-xs uppercase tracking-wider text-teal-deep font-semibold block">Overall Goal:</span>
              <p className="font-display text-base text-ink font-medium">{dietPlan?.guidelines || "Balanced Low-Sodium Nutrition"}</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-4 space-y-2">
                <span className="font-mono text-xs font-bold text-teal-deep uppercase tracking-wider block">
                  ✓ Foods Recommended:
                </span>
                <ul className="text-xs text-ink list-disc list-inside space-y-1">
                  {(dietPlan?.allowed_foods || ["Fresh vegetables", "Whole grains", "Lean proteins"]).map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 space-y-2">
                <span className="font-mono text-xs font-bold text-clay-alert uppercase tracking-wider block">
                  ✕ Foods to Avoid:
                </span>
                <ul className="text-xs text-ink list-disc list-inside space-y-1">
                  {(dietPlan?.restricted_foods || ["High sodium meals", "Refined sugars"]).map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Log Meal & History */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
              <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
                Log Daily Meal
              </h2>
              <form onSubmit={handleLogMeal} className="space-y-4">
                <div>
                  <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Meal Category:</label>
                  <select
                    value={mealType}
                    onChange={(e: any) => setMealType(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                    Food Items (comma-separated):
                  </label>
                  <input
                    type="text"
                    required
                    value={foodItemsInput}
                    onChange={(e) => setFoodItemsInput(e.target.value)}
                    placeholder="e.g. Brown rice, Steamed vegetables, Grilled fish"
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity"
                >
                  + Record Meal Log
                </button>
              </form>
            </div>

            {/* Meal History */}
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-stone font-semibold border-b border-hairline pb-2">Recent Meal History</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {mealLogs.length > 0 ? (
                  mealLogs.map((m) => (
                    <div key={m.id} className="rounded-xl border border-hairline bg-bg-mist p-3 font-mono text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-teal-deep uppercase">{m.meal_type}</span>
                        <span className="text-stone">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-ink font-sans">{m.food_items.join(", ")}</p>
                    </div>
                  ))
                ) : (
                  <p className="font-mono text-xs text-stone italic">No meal logs recorded today.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
