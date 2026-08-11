// Supabase Edge Function: generate-recurring
// Generated recurring transactions from templates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to calculate the next date based on frequency and interval
export function calculateNextDate(currentDate: Date, frequency: string, interval: number): Date {
  const next = new Date(currentDate.getTime());
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
  return next;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with Service Role Key (bypasses RLS to run administrative tasks)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const now = new Date();

    // 1. Fetch all active recurring templates that are due
    const { data: templates, error: fetchError } = await supabaseClient
      .from("recurring_templates")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("next_generation_date", now.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring templates due for generation.", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generatedTransactions = [];

    // Fetch exchange rates once for lookups
    const { data: rates, error: ratesError } = await supabaseClient
      .from("exchange_rates")
      .select("*");
    
    if (ratesError) {
      throw ratesError;
    }

    const findExchangeRate = (from: string, to: string): number => {
      if (from === to) return 1.0;
      const match = rates.find((r) => r.from_currency === from && r.to_currency === to);
      return match ? Number(match.rate) : 1.0;
    };

    // 2. Loop through each template and generate occurrences
    for (const template of templates) {
      let currentNextDate = new Date(template.next_generation_date);
      const endDate = template.end_date ? new Date(template.end_date) : null;
      let isActive = true;

      const transactionsToInsert = [];

      // Generate all occurrences that fell before or equal to "now"
      while (currentNextDate <= now && isActive) {
        if (endDate && currentNextDate > endDate) {
          isActive = false;
          break;
        }

        let exchangeRate = 1.0;
        if (template.type === "transfer" && template.destination_account_id) {
          const { data: accData } = await supabaseClient
            .from("accounts")
            .select("id, currency")
            .in("id", [template.account_id, template.destination_account_id]);

          const srcAcc = accData?.find((a) => a.id === template.account_id);
          const destAcc = accData?.find((a) => a.id === template.destination_account_id);
          if (srcAcc && destAcc) {
            exchangeRate = findExchangeRate(srcAcc.currency, destAcc.currency);
          }
        }

        transactionsToInsert.push({
          user_id: template.user_id,
          account_id: template.account_id,
          destination_account_id: template.destination_account_id,
          category_id: template.category_id,
          type: template.type,
          amount_cents: template.amount_cents,
          currency: template.currency,
          exchange_rate: exchangeRate,
          date: currentNextDate.toISOString(),
          note: template.note ? `Auto-generated: ${template.note}` : "Auto-generated recurring transaction",
          payment_method: template.payment_method || "other",
          recurring_template_id: template.id,
        });

        currentNextDate = calculateNextDate(currentNextDate, template.frequency, template.interval);

        if (endDate && currentNextDate > endDate) {
          isActive = false;
        }
      }

      if (transactionsToInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabaseClient
          .from("transactions")
          .insert(transactionsToInsert)
          .select();

        if (insertError) {
          console.error(`Error inserting transactions for template ${template.id}:`, insertError);
          continue;
        }

        if (inserted) {
          generatedTransactions.push(...inserted);
        }

        const { error: updateError } = await supabaseClient
          .from("recurring_templates")
          .update({
            next_generation_date: currentNextDate.toISOString(),
            last_generated_at: now.toISOString(),
            is_active: isActive,
            updated_at: now.toISOString(),
          })
          .eq("id", template.id);

        if (updateError) {
          console.error(`Error updating recurring template ${template.id}:`, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Successfully processed templates",
        processed_templates: templates.length,
        generated_transactions_count: generatedTransactions.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
