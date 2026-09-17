"use client";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import BottomLogo from "@/components/BottomLogo";
import GlassCard from "@/components/GlassCard";
import Link from "next/link";
import Image from "next/image";
import { resolveReferralAgentId } from "@/lib/referral";

const mi = [
  { h: "/sell", l: "فروش امن", img: "/Group 47.svg", d: "d3" },
  { h: "/buy", l: "خرید امن", img: "/Group 46.svg", d: "d1" },
  { h: "/search", l: "کارشناسی قیمت", img: "/search.svg", d: "d2" },
  { h: "/invest", l: "سرمایه‌گذاری امن", img: "/Group 48.svg", d: "d4" },
];

function Home() {
  useEffect(() => {
    // Capture the referral context from the URL for this page load.
    // On a direct visit (no ?agentId), resolveReferralAgentId() clears any
    // stale agentId from localStorage/sessionStorage so it cannot leak
    // into later form submissions.
    resolveReferralAgentId();
  }, []);

  return (
    <Layout
      ch={
        <>

          <div className="pt-4 flex flex-col justify-between min-h-[100dvh] flex-1">
            <div className="flex-1 flex flex-col px-6">
              <div className="flex justify-center my-8">
                <Image
                  src="/vector99.png"
                  alt="بهترین انتخاب"
                  width={320}
                  height={85}
                  className="w-full max-w-[320px] h-auto"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>

              <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 py-6">
                {mi.map((item) => (
                  <Link
                    key={item.h}
                    href={item.h}
                    className="h-full w-full flex"
                  >
                    <GlassCard
                      cls={`p-6 flex flex-col items-center justify-center gap-5 w-full h-full cursor-pointer menu-card afu ${item.d}`}
                      ch={
                        <>

                          <div className="flex items-center justify-center w-24 h-24 relative">
                            <Image
                              src={item.img}
                              alt={item.l}
                              fill
                              style={{ objectFit: "contain" }}
                            />
                          </div>


                          <span className="w-full text-white text-xl sm:text-2xl md:text-3xl font-bold text-center leading-tight">
                            {item.l}
                          </span>
                        </>
                      }
                    />
                  </Link>
                ))}
              </div>
            </div>


            <div className="w-full flex-shrink-0 pb-4">
              <BottomLogo />
            </div>
          </div>
        </>
      }
    />
  );
}

export default Home;