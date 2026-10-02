import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PassCard } from "@/components/pass-card";
import { PrintButton } from "@/components/print-button";
import { getStore } from "@/lib/store";
import { qrSvg } from "@/lib/qr";
import { passUrl } from "@/lib/url";
import { maskPhone } from "@/lib/phone";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Your pass",
  // Unlisted: a pass link should not turn up in search results.
  robots: { index: false, follow: false },
};

export default async function PassPage({ params }: PageProps<"/pass/[passId]">) {
  const { passId } = await params;
  const person = await getStore().getPersonByPassId(passId);

  if (!person) notFound();

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <p className="text-center text-sm font-semibold tracking-widest text-saffron-700 uppercase">
          {siteConfig.centreName}
        </p>

        <div className="mt-6">
          <PassCard
            name={person.name}
            passId={person.passId}
            qrSvg={await qrSvg(await passUrl(person.passId))}
            phoneMasked={maskPhone(person.phone)}
            issuedDate={person.createdDate}
            variant={person.totalVisits > 1 ? "welcome" : "new"}
            totalVisits={person.totalVisits}
          />
        </div>

        <div className="mt-5 flex justify-center print:hidden">
          <PrintButton />
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          If you lose this pass, register again with the same contact number and
          we will find your record.
        </p>
      </div>
    </main>
  );
}
